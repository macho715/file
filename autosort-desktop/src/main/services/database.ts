import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore -- sql.js has no bundled type declarations
import initSqlJs from 'sql.js';
import { DbInsertFileInput, FileProcessStatus } from '../core/types';
type SqlJsDatabase = any;

export type DatabaseInstance = SqlJsDatabase;

const SCHEMA_VERSION = 1;
let _dbPath = '';
let _deferPersist = false;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watched_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  recursive INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  label TEXT
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  current_path TEXT,
  filename TEXT NOT NULL,
  extension TEXT,
  size_bytes INTEGER,
  sha256 TEXT,
  doc_type TEXT,
  confidence REAL,
  rule_id TEXT,
  classification_source TEXT,
  project TEXT,
  vendor TEXT,
  file_date TEXT,
  suggested_name TEXT,
  source_folder_id INTEGER,
  original_path TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  classified_at TEXT,
  moved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_files_sha256 ON files(sha256);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_doc_type ON files(doc_type);
CREATE INDEX IF NOT EXISTS idx_files_current_path ON files(current_path);

CREATE TABLE IF NOT EXISTS file_tags (
  file_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (file_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag);

CREATE TABLE IF NOT EXISTS file_reasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  run_id TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'move',
  sha256 TEXT,
  reason TEXT,
  before_path TEXT NOT NULL,
  after_path TEXT NOT NULL,
  file_id INTEGER,
  decision_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_ledger_run_id ON ledger(run_id);
CREATE INDEX IF NOT EXISTS idx_ledger_ts ON ledger(ts);

CREATE TABLE IF NOT EXISTS dedup_cache (
  sha256 TEXT PRIMARY KEY,
  file_id INTEGER,
  first_seen_run_id TEXT NOT NULL,
  first_seen_path TEXT NOT NULL,
  current_path TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function persistDb(db: DatabaseInstance) {
  if (_dbPath) {
    const data = db.export();
    fs.writeFileSync(_dbPath, Buffer.from(data));
  }
}

export async function withTransaction<T>(
  db: DatabaseInstance,
  fn: () => T
): Promise<T> {
  const prev = _deferPersist;
  _deferPersist = true;
  try {
    runSql(db, 'BEGIN TRANSACTION');
    const result = fn();
    runSql(db, 'COMMIT');
    persistDb(db);
    return result;
  } catch (e) {
    try {
      runSql(db, 'ROLLBACK');
    } catch {
      // ignore rollback failures
    }
    throw e;
  } finally {
    _deferPersist = prev;
  }
}

export async function initDatabase(dbPath: string): Promise<DatabaseInstance> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _dbPath = dbPath;

  const SQL = await initSqlJs();

  let db: DatabaseInstance;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA_SQL);

  // Check schema version
  const versionResult = db.exec('SELECT MAX(version) as v FROM schema_version');
  const currentVersion =
    versionResult.length > 0 && versionResult[0].values.length > 0
      ? (versionResult[0].values[0][0] as number | null)
      : null;

  if (currentVersion === null || currentVersion < SCHEMA_VERSION) {
    db.run('INSERT INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
  }

  persistDb(db);

  // Auto-save every 10 seconds
  setInterval(() => persistDb(db), 10000);

  return db;
}

// Helper: run a SELECT and return results as object arrays
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

function runSql(db: DatabaseInstance, sql: string, params?: unknown[]): void {
  db.run(sql, params as any[]);
  if (!_deferPersist) {
    persistDb(db);
  }
}

// Public API
export function getStats(db: DatabaseInstance) {
  const totalRow = queryOne(db, 'SELECT COUNT(*) as c FROM files');
  const total = (totalRow?.c as number) ?? 0;
  const byStatus = queryAll(
    db,
    'SELECT status, COUNT(*) as c FROM files GROUP BY status'
  );
  const byDocType = queryAll(
    db,
    'SELECT doc_type, COUNT(*) as c FROM files WHERE doc_type IS NOT NULL GROUP BY doc_type ORDER BY c DESC'
  );
  const recentMoves = queryAll(
    db,
    'SELECT * FROM ledger ORDER BY ts DESC LIMIT 20'
  );
  return { total, byStatus, byDocType, recentMoves };
}

export function searchFiles(
  db: DatabaseInstance,
  query: string,
  limit = 50
) {
  const likeQuery = `%${query}%`;
  return queryAll(
    db,
    `SELECT * FROM files
     WHERE filename LIKE ? OR doc_type LIKE ? OR project LIKE ?
     ORDER BY updated_at DESC
     LIMIT ?`,
    [likeQuery, likeQuery, likeQuery, limit]
  );
}

export function getWatchedFolders(db: DatabaseInstance) {
  return queryAll(db, 'SELECT * FROM watched_folders ORDER BY id');
}

export function addWatchedFolder(
  db: DatabaseInstance,
  folderPath: string,
  label: string,
  recursive = false
) {
  runSql(
    db,
    `INSERT INTO watched_folders (path, label, recursive)
     VALUES (?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET label = excluded.label, recursive = excluded.recursive`,
    [folderPath, label, recursive ? 1 : 0]
  );
  const row = queryOne(db, 'SELECT id FROM watched_folders WHERE path = ?', [folderPath]);
  return { lastInsertRowid: (row?.id as number) ?? 0 };
}

export function removeWatchedFolder(db: DatabaseInstance, id: number) {
  runSql(db, 'DELETE FROM watched_folders WHERE id = ?', [id]);
}

export function setWatchedFolderEnabled(
  db: DatabaseInstance,
  id: number,
  enabled: boolean
) {
  runSql(db, 'UPDATE watched_folders SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
}

export function getWatchedFolder(db: DatabaseInstance, id: number) {
  return queryOne(db, 'SELECT * FROM watched_folders WHERE id = ?', [id]);
}

export function getQuarantinedFiles(db: DatabaseInstance) {
  return queryAll(
    db,
    "SELECT * FROM files WHERE status = 'quarantined' ORDER BY first_seen_at DESC"
  );
}

export function getSetting(db: DatabaseInstance, key: string): string | null {
  const row = queryOne(db, 'SELECT value FROM settings WHERE key = ?', [key]);
  return (row?.value as string) ?? null;
}

export function setSetting(
  db: DatabaseInstance,
  key: string,
  value: string
): void {
  runSql(
    db,
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
    [key, value]
  );
}

export function listLedger(db: DatabaseInstance, limit = 50) {
  return queryAll(db, 'SELECT * FROM ledger ORDER BY ts DESC LIMIT ?', [
    limit,
  ]);
}

export function getLedgerEntry(db: DatabaseInstance, ts: string, runId: string, before: string, after: string) {
  return queryOne(db, 'SELECT id FROM ledger WHERE ts = ? AND run_id = ? AND before_path = ? AND after_path = ?', [ts, runId, before, after]);
}

export function listFiles(
  db: DatabaseInstance,
  filters?: { status?: string; doc_type?: string; limit?: number }
) {
  let sql = 'SELECT * FROM files WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.doc_type) {
    sql += ' AND doc_type = ?';
    params.push(filters.doc_type);
  }

  sql += ' ORDER BY updated_at DESC LIMIT ?';
  params.push(filters?.limit ?? 100);

  return queryAll(db, sql, params);
}

export function insertFile(
  db: DatabaseInstance,
  data: DbInsertFileInput
): number {
  runSql(
    db,
    `INSERT INTO files (
      filename, extension, size_bytes, sha256, doc_type, confidence, rule_id,
      classification_source, project, vendor, file_date, suggested_name,
      source_folder_id, original_path, current_path, status, classified_at, moved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.filename,
      data.extension,
      data.size_bytes,
      data.sha256,
      data.doc_type,
      data.confidence,
      data.rule_id,
      data.classification_source,
      data.project,
      data.vendor,
      data.file_date,
      data.suggested_name,
      data.source_folder_id,
      data.original_path,
      data.current_path,
      data.status,
      data.classified_at,
      data.moved_at,
    ]
  );

  const row = queryOne(db, 'SELECT MAX(id) as id FROM files');
  const fileId = Number(row?.id ?? 0);

  if (!Number.isNaN(fileId) && fileId > 0) {
    for (const tag of data.tags) {
      if (tag.trim()) {
        runSql(db, 'INSERT OR IGNORE INTO file_tags (file_id, tag) VALUES (?, ?)', [
          fileId,
          tag.trim(),
        ]);
      }
    }

    for (const reason of data.reasons) {
      if (reason.trim()) {
        runSql(db, 'INSERT INTO file_reasons (file_id, reason) VALUES (?, ?)', [
          fileId,
          reason.trim(),
        ]);
      }
    }
  }

  return fileId;
}

export function updateFileStatus(
  db: DatabaseInstance,
  fileId: number,
  status: FileProcessStatus,
  currentPath?: string
) {
  if (currentPath) {
    runSql(
      db,
      `UPDATE files
         SET status = ?, current_path = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [status, currentPath, fileId]
    );
  } else {
    runSql(
      db,
      `UPDATE files
         SET status = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [status, fileId]
    );
  }
}

export function insertLedgerEntry(db: DatabaseInstance, entry: {
  ts: string;
  run_id: string;
  action: string;
  sha256: string;
  reason: string;
  before_path: string;
  after_path: string;
  file_id: number | null;
  decision_json: Record<string, unknown> | null;
}) {
  runSql(
    db,
    `INSERT INTO ledger
      (ts, run_id, action, sha256, reason, before_path, after_path, file_id, decision_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.ts,
      entry.run_id,
      entry.action,
      entry.sha256,
      entry.reason,
      entry.before_path,
      entry.after_path,
      entry.file_id,
      entry.decision_json ? JSON.stringify(entry.decision_json) : null,
    ]
  );
}

export function upsertDedupCache(
  db: DatabaseInstance,
  sha256: string,
  fileId: number | null,
  runId: string,
  firstSeenPath: string,
  currentPath: string
) {
  runSql(
    db,
    `INSERT OR REPLACE INTO dedup_cache
      (sha256, file_id, first_seen_run_id, first_seen_path, current_path)
     VALUES (?, ?, ?, ?, ?)`,
    [sha256, fileId, runId, firstSeenPath, currentPath]
  );
}

export function checkDedupCache(
  db: DatabaseInstance,
  sha256: string
): { file_id: number | null; first_seen_path: string | null; current_path: string | null } | null {
  return queryOne(db, 'SELECT file_id, first_seen_path, current_path FROM dedup_cache WHERE sha256 = ?', [sha256]) as {
    file_id: number | null;
    first_seen_path: string | null;
    current_path: string | null;
  } | null;
}

export function getFileByPath(db: DatabaseInstance, originalPath: string) {
  return queryOne(db, 'SELECT * FROM files WHERE original_path = ?', [originalPath]);
}

export function getFileById(db: DatabaseInstance, fileId: number) {
  return queryOne(db, 'SELECT * FROM files WHERE id = ?', [fileId]);
}

export function bulkInsertFiles(db: DatabaseInstance, rows: DbInsertFileInput[]) {
  return withTransaction(db, () => {
    for (const data of rows) {
      insertFile(db, data);
    }
  });
}
