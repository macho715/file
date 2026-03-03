import * as fs from 'fs';
import * as path from 'path';
import { AutosortPaths, llmDecisionFromDict } from '../core/types';
import { utcIsoNow } from '../core/file-operations';
import {
  DatabaseInstance,
  getSetting,
  setSetting,
  insertFile,
  insertLedgerEntry,
  upsertDedupCache,
  getLedgerEntry,
  getFileByPath,
  checkDedupCache,
} from './database';

interface LegacyCacheEntry {
  run_id?: string;
  before?: string;
  after?: string;
  decision?: Record<string, unknown>;
  reason?: string;
  dest_dir?: string;
}

interface LegacyLedgerLine {
  ts?: string;
  run_id?: string;
  action?: string;
  sha256?: string;
  reason?: string;
  before?: string;
  after?: string;
  before_path?: string;
  after_path?: string;
  file_id?: number;
  decision_json?: Record<string, unknown>;
}

export async function runLegacyMigration(
  db: DatabaseInstance,
  paths: AutosortPaths
): Promise<void> {
  if (getSetting(db, 'migration_legacy_v1_done') === 'true') {
    return;
  }

  const cachePath = path.join(paths.cache, 'cache.json');
  const ledgerPath = path.join(paths.logs, 'ledger.jsonl');

  if (fs.existsSync(cachePath)) {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const cache = parseCache(raw);
    for (const [sha, entry] of Object.entries(cache)) {
      if (!entry) continue;
      if (checkDedupCache(db, sha)) continue;

      const decision = llmDecisionFromDict(entry.decision ?? {});
      const status =
        entry.reason === 'duplicate_hash'
          ? 'duplicate'
          : entry.reason && /quarantine|parsefail|llm|unstable/i.test(entry.reason)
            ? 'quarantined'
            : 'moved';
      const beforePath = entry.before || '';
      const afterPath = entry.after || '';
      const currentPath = afterPath || beforePath || '';

      const fileId = insertFile(db, {
        filename: path.basename(afterPath || beforePath || 'unknown'),
        extension: path.extname(afterPath || beforePath || 'unknown').toLowerCase(),
        size_bytes: safeSize(afterPath || beforePath),
        sha256: sha,
        original_path: beforePath || currentPath,
        current_path: currentPath,
        doc_type: decision.doc_type,
        confidence: decision.confidence,
        rule_id: decision.rule_id,
        classification_source: decisionSourceFromReason(entry.reason),
        project: decision.project ?? null,
        vendor: decision.vendor ?? null,
        file_date: decision.date ?? null,
        suggested_name: decision.suggested_name || path.basename(afterPath || beforePath),
        source_folder_id: null,
        status,
        classified_at: utcIsoNow(),
        moved_at: status === 'moved' ? utcIsoNow() : null,
        tags: decision.tags ?? [],
        reasons: decision.reasons ?? [],
      });

      upsertDedupCache(
        db,
        sha,
        fileId,
        entry.run_id || 'legacy',
        beforePath || currentPath || sha,
        currentPath
      );

      insertLedgerEntry(db, {
        ts: utcIsoNow(),
        run_id: entry.run_id || 'legacy',
        action: 'migrate',
        sha256: sha,
        reason: entry.reason || 'migration',
        before_path: beforePath,
        after_path: afterPath,
        file_id: fileId,
        decision_json: entry.decision ?? null,
      });
    }
  }

  if (fs.existsSync(ledgerPath)) {
    const lines = fs.readFileSync(ledgerPath, 'utf-8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const parsed = parseJson<LegacyLedgerLine>(line);
      if (!parsed) continue;
      const before = parsed.before_path || parsed.before || '';
      const after = parsed.after_path || parsed.after || '';
      const runId = parsed.run_id || 'legacy';
      const ts = parsed.ts || utcIsoNow();
      if (!before && !after) continue;
      if (getLedgerEntry(db, ts, runId, before, after)) continue;

      const fileRow = getFileByPath(db, before) as { id?: number } | null;
      insertLedgerEntry(db, {
        ts,
        run_id: runId,
        action: parsed.action || 'import',
        sha256: String(parsed.sha256 || ''),
        reason: String(parsed.reason || ''),
        before_path: before,
        after_path: after,
        file_id: fileRow?.id ? Number(fileRow.id) : parsed.file_id ?? null,
        decision_json: parsed.decision_json ?? null,
      });
    }
  }

  setSetting(db, 'migration_legacy_v1_done', 'true');
  setSetting(db, 'migration_legacy_v1_completed_at', utcIsoNow());
}

function parseCache(raw: string): Record<string, LegacyCacheEntry> {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, LegacyCacheEntry>;
    }
  } catch {
    // ignore
  }
  return {};
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function decisionSourceFromReason(reason?: string): string {
  if (!reason) return 'import';
  if (reason.includes('duplicate')) return 'duplicate';
  if (reason.includes('unstable')) return 'unstable';
  if (reason.includes('llm_timeout')) return 'llm_timeout';
  if (reason.includes('llm_error')) return 'llm_error';
  if (reason.includes('parsefail')) return 'llm_error';
  if (reason.includes('forced')) return 'rule:forced';
  return 'migrated';
}
