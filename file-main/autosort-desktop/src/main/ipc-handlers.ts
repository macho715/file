import * as fs from 'fs';
import * as path from 'path';
import { ipcMain } from 'electron';
import { compileRules } from './core/rule-engine';
import { loadMappingConfig, loadRulesConfig } from './core/config-loader';
import {
  DatabaseInstance,
  addWatchedFolder,
  getFileById,
  getQuarantinedFiles,
  getSetting,
  getStats,
  getWatchedFolders,
  insertLedgerEntry,
  listFiles,
  listLedger,
  removeWatchedFolder,
  searchFiles,
  setSetting,
  setWatchedFolderEnabled,
  updateFileStatus,
} from './services/database';
import { ClassifierConfig } from './services/classifier';
import { FileWatcher, WatchedFolder } from './services/watcher';
import {
  createLLMDecision,
  llmDecisionToDict,
  llmDecisionFromDict,
} from './core/types';
import { generateRunId, utcIsoNow } from './core/file-operations';
import {
  moveWithLedger,
} from './core/move-engine';
import { resolveDestination } from './core/mapping-resolver';

function queryAll(
  db: DatabaseInstance,
  sql: string,
  params?: unknown[]
): Record<string, unknown>[] {
  try {
    const results = db.exec(sql, params as any[]);
    if (results.length === 0) return [];
    const { columns, values } = results[0];
    return values.map((row: any[]) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj;
    });
  } catch {
    return [];
  }
}

function queryOne(
  db: DatabaseInstance,
  sql: string,
  params?: unknown[]
): Record<string, unknown> | null {
  const results = queryAll(db, sql, params);
  return results.length > 0 ? results[0] : null;
}

function boolFromDb(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function registerIpcHandlers(
  db: DatabaseInstance,
  config: ClassifierConfig | null,
  watcher: FileWatcher | null
): void {
  ipcMain.handle('stats:dashboard', () => {
    return getStats(db);
  });

  ipcMain.handle('files:search', (_event, query: string, limit?: number) => {
    return searchFiles(db, query, limit);
  });

  ipcMain.handle(
    'files:list',
    (_event, filters?: { status?: string; doc_type?: string; limit?: number }) => {
      return listFiles(db, filters);
    }
  );

  ipcMain.handle('files:get', (_event, id: number) => {
    const file = queryOne(db, 'SELECT * FROM files WHERE id = ?', [id]);
    if (!file) return null;
    const tags = queryAll(
      db,
      'SELECT tag FROM file_tags WHERE file_id = ?',
      [id]
    ).map((t) => String(t.tag ?? ''));
    const reasons = queryAll(
      db,
      'SELECT reason FROM file_reasons WHERE file_id = ?',
      [id]
    ).map((r) => String(r.reason ?? ''));
    return {
      ...file,
      tags,
      reasons,
    };
  });

  ipcMain.handle('watchers:list', () => {
    return getWatchedFolders(db);
  });

  ipcMain.handle(
    'watchers:add',
    async (_event, folderPath: string, label: string, recursive: boolean) => {
      const result = addWatchedFolder(db, folderPath, label, recursive);
      const folderId = Number(result.lastInsertRowid || 0);
      setSetting(db, `sweep_done_${folderId}`, 'false');
      if (watcher && folderId > 0) {
        await watcher.addFolder({
          id: folderId,
          path: folderPath,
          enabled: true,
          recursive,
          label,
        });
      }
      return result;
    }
  );

  ipcMain.handle('watchers:remove', async (_event, id: number) => {
    const folder = queryOne(db, 'SELECT * FROM watched_folders WHERE id = ?', [id]);
    if (folder && watcher) {
      await watcher.removeFolder(String(folder.path));
    }
    return removeWatchedFolder(db, id);
  });

  ipcMain.handle('watchers:toggle', async (_event, id: number, enabled: boolean) => {
    const folder = queryOne(db, 'SELECT * FROM watched_folders WHERE id = ?', [id]);
    if (!folder) return false;

    setWatchedFolderEnabled(db, id, enabled);

    if (!watcher) return true;
    if (enabled) {
      await watcher.addFolder({
        id,
        path: String(folder.path),
        enabled: true,
        recursive: boolFromDb(folder.recursive),
        label: String(folder.label ?? ''),
      });
      setSetting(db, `sweep_done_${id}`, 'false');
      await watcher.sweepExisting(String(folder.path), boolFromDb(folder.recursive));
      setSetting(db, `sweep_done_${id}`, 'true');
    } else {
      await watcher.removeFolder(String(folder.path));
    }
    return true;
  });

  ipcMain.handle('watchers:sweepAll', async (_event, id?: number) => {
    if (!watcher) return 0;
    let folders = getWatchedFolders(db) as unknown as WatchedFolder[];
    if (typeof id === 'number') {
      folders = folders.filter((folder) => folder.id === id);
    }

    let count = 0;
    for (const folder of folders) {
      if (!boolFromDb(folder.enabled)) continue;
      const sweptCount = await watcher.sweepExisting(
        folder.path,
        boolFromDb(folder.recursive)
      );
      setSetting(db, `sweep_done_${folder.id}`, 'true');
      count += sweptCount;
    }
    return count;
  });

  ipcMain.handle('quarantine:list', () => {
    return getQuarantinedFiles(db);
  });

  ipcMain.handle('quarantine:approve', async (_event, fileId: number) => {
    return runQuarantineAction(db, config, fileId, null, false);
  });

  ipcMain.handle(
    'quarantine:reclassify',
    async (_event, fileId: number, overrides?: {
      doc_type?: string;
      project?: string;
      vendor?: string;
      tags?: string[];
      reasons?: string[];
    }) => {
      return runQuarantineAction(db, config, fileId, overrides || null, true);
    }
  );

  ipcMain.handle('quarantine:delete', async (_event, fileId: number) => {
    if (!config) return false;
    const file = getFileById(db, fileId) as
      | (Record<string, unknown> & { current_path?: unknown; sha256?: unknown })
      | null;
    if (!file?.current_path || typeof file.current_path !== 'string') return false;

    const src = String(file.current_path);
    if (!fs.existsSync(src)) return false;

    const runId = generateRunId();
    const deletedDir = path.join(config.paths.quarantine, 'deleted');
    const deletedPath = moveWithLedger(
      config.paths,
      src,
      deletedDir,
      path.basename(src),
      config.ledgerPath,
      runId,
      String(file.sha256 ?? ''),
      'manual_delete'
    );

    updateFileStatus(db, Number(file.id || 0), 'deleted', deletedPath);
    insertLedgerEntry(db, {
      ts: utcIsoNow(),
      run_id: runId,
      action: 'manual_delete',
      sha256: String(file.sha256 ?? ''),
      reason: 'manual_delete',
      before_path: src,
      after_path: deletedPath,
      file_id: Number(file.id || 0),
      decision_json: {
        action: 'manual_delete',
      },
    });
    return true;
  });

  ipcMain.handle('ledger:list', (_event, limit?: number) => {
    return listLedger(db, limit);
  });

  ipcMain.handle('settings:get', (_event, key: string) => {
    return getSetting(db, key);
  });

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    setSetting(db, key, value);
    return true;
  });

  ipcMain.handle('settings:getAll', () => {
    return queryAll(db, 'SELECT * FROM settings');
  });

  ipcMain.handle('app:info', () => {
    return {
      root: config?.paths.root ?? 'C:\\_AUTOSORT',
      watchedFolders: watcher?.watchedPaths ?? [],
      rulesCount: config?.compileResult.compiled_rules.length ?? 0,
      llmUrl: config?.llmBaseUrl ?? '',
      llmType: config?.llmType ?? 'llama_cpp',
    };
  });

  ipcMain.handle('app:reloadRules', () => {
    if (!config || !config.paths) return { success: false, rulesCount: 0 };

    const bundledRulesDir = path.join(__dirname, '..', '..', 'rules');
    const rulesDir = fs.existsSync(path.join(config.paths.rules_dir, 'rules.yaml'))
      ? config.paths.rules_dir
      : bundledRulesDir;

    const rulesCfg = loadRulesConfig(rulesDir);
    const mappingCfg = loadMappingConfig(rulesDir);

    if (!rulesCfg || !rulesCfg.rules) {
      return { success: false, rulesCount: 0 };
    }

    const compileResult = compileRules(rulesCfg);
    config.rulesCfg = rulesCfg;
    config.mappingCfg = mappingCfg;
    config.compileResult = compileResult;

    return {
      success: true,
      rulesCount: compileResult.compiled_rules.length,
    };
  });
}

function runQuarantineAction(
  db: DatabaseInstance,
  config: ClassifierConfig | null,
  fileId: number,
  overrides: { doc_type?: string; project?: string; vendor?: string; tags?: string[]; reasons?: string[] } | null,
  reclassify: boolean
): boolean {
  if (!config) return false;
  const file = getFileById(db, fileId) as
    | (Record<string, unknown> & {
        id?: number;
        current_path?: unknown;
        sha256?: unknown;
        doc_type?: unknown;
        project?: unknown;
        vendor?: unknown;
        file_date?: unknown;
        suggested_name?: unknown;
        confidence?: unknown;
      })
    | null;
  if (!file?.current_path || typeof file.current_path !== 'string') return false;

  const src = String(file.current_path);
  if (!fs.existsSync(src)) return false;

  const currentTags = queryAll(
    db,
    'SELECT tag FROM file_tags WHERE file_id = ?',
    [fileId]
  ).map((r) => String(r.tag ?? ''));
  const currentReasons = queryAll(
    db,
    'SELECT reason FROM file_reasons WHERE file_id = ?',
    [fileId]
  ).map((r) => String(r.reason ?? ''));

  const decision = createLLMDecision({
    doc_type: overrides?.doc_type || String(file.doc_type || 'other'),
    project:
      overrides?.project ??
      llmDecisionFromDict({
        project: file.project ?? null,
      }).project,
    vendor:
      overrides?.vendor ??
      llmDecisionFromDict({
        vendor: file.vendor ?? null,
      }).vendor,
    date:
      llmDecisionFromDict({
        date: file.file_date ?? null,
      }).date,
    suggested_name: String(file.suggested_name || path.basename(src)),
    confidence: Number(file.confidence ?? 0.99),
    reasons: overrides?.reasons?.length
      ? overrides.reasons
      : currentReasons.length > 0
        ? currentReasons
        : ['manual_review'],
    tags: overrides?.tags?.length ? overrides.tags : currentTags,
  });

  const routing = resolveDestination(config.paths, config.mappingCfg, decision);
  const forceQuarantine = routing.forced_quarantine || routing.forced_action === 'quarantine';
  const dstDir = forceQuarantine ? config.paths.quarantine : routing.dest_dir;
  const runId = generateRunId();
  const decisionJson = llmDecisionToDict(decision);
  const newName = String(file.suggested_name || decision.suggested_name || path.basename(src));
  const dst = moveWithLedger(
    config.paths,
    src,
    dstDir,
    newName,
    config.ledgerPath,
    runId,
    String(file.sha256 || ''),
    reclassify ? 'manual_reclassify' : 'manual_approve'
  );

  const status = reclassify
    ? (forceQuarantine ? 'quarantined' : 'moved')
    : 'approved';

  if (reclassify) {
    db.run(
      `UPDATE files
       SET doc_type = ?, project = ?, vendor = ?, file_date = ?, suggested_name = ?,
           status = ?, current_path = ?, confidence = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        decision.doc_type,
        decision.project,
        decision.vendor,
        decision.date,
        decision.suggested_name || path.basename(src),
        status,
        dst,
        decision.confidence,
        fileId,
      ]
    );

    db.run('DELETE FROM file_tags WHERE file_id = ?', [fileId]);
    for (const tag of decision.tags) {
      if (tag.trim()) {
        db.run('INSERT OR IGNORE INTO file_tags (file_id, tag) VALUES (?, ?)', [
          fileId,
          tag.trim(),
        ]);
      }
    }

    db.run('DELETE FROM file_reasons WHERE file_id = ?', [fileId]);
    for (const reason of decision.reasons) {
      if (reason.trim()) {
        db.run('INSERT INTO file_reasons (file_id, reason) VALUES (?, ?)', [
          fileId,
          reason.trim(),
        ]);
      }
    }
  } else {
    updateFileStatus(db, fileId, status, dst);
  }

  insertLedgerEntry(db, {
    ts: utcIsoNow(),
    run_id: runId,
    action: reclassify ? 'reclassify' : 'approve',
    sha256: String(file.sha256 || ''),
    reason: reclassify ? 'manual_reclassify' : 'manual_approve',
    before_path: src,
    after_path: dst,
    file_id: fileId,
    decision_json: decisionJson,
  });

  return true;
}
