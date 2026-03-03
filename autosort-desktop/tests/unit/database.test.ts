import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  initDatabase,
  insertFile,
  updateFileStatus,
  insertLedgerEntry,
  upsertDedupCache,
  checkDedupCache,
  getFileByPath,
  bulkInsertFiles,
  listLedger,
  getWatchedFolders,
  addWatchedFolder,
  setWatchedFolderEnabled,
  getFileById,
  listFiles,
  getQuarantinedFiles,
  DatabaseInstance,
} from '../../src/main/services/database';

describe('database unit coverage', () => {
  let dbPath = '';
  let db: DatabaseInstance;

  beforeEach(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autosort-db-'));
    dbPath = path.join(root, 'autosort.db');
    db = await initDatabase(dbPath);
  });

  afterEach(() => {
    if (dbPath && fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { force: true });
    }
  });

  it('inserts and reads file rows with tags/reasons', () => {
    const fileId = insertFile(db, {
      filename: 'test_report.pdf',
      extension: '.pdf',
      size_bytes: 12,
      sha256: 'sha-test-001',
      original_path: 'C:/in/test_report.pdf',
      current_path: 'C:/out/ops_doc/test_report.pdf',
      doc_type: 'ops_doc',
      confidence: 0.95,
      rule_id: 'OPS__AGI_TR',
      classification_source: 'rule:OPS__AGI_TR',
      project: null,
      vendor: null,
      file_date: null,
      suggested_name: 'test_report',
      source_folder_id: null,
      status: 'moved',
      classified_at: '2026-03-03T00:00:00Z',
      moved_at: '2026-03-03T00:00:00Z',
      tags: ['AGI_TR', 'ops'],
      reasons: ['rule_match'],
    });

    expect(fileId).toBeGreaterThan(0);

    const row = getFileById(db, fileId);
    expect(row?.filename).toBe('test_report.pdf');

    const rowByPath = getFileByPath(db, 'C:/in/test_report.pdf');
    expect(rowByPath?.id).toBe(fileId);
  });

  it('updates status and current_path', () => {
    const fileId = insertFile(db, {
      filename: 'tmp.py',
      extension: '.py',
      size_bytes: 1,
      sha256: 'sha-test-002',
      original_path: 'C:/in/tmp.py',
      current_path: 'C:/out/dev_code/tmp.py',
      doc_type: 'dev_code',
      confidence: 0.98,
      rule_id: 'DEV__CODE',
      classification_source: 'rule:DEV__CODE',
      project: null,
      vendor: null,
      file_date: null,
      suggested_name: 'tmp',
      source_folder_id: null,
      status: 'moved',
      classified_at: '2026-03-03T00:00:00Z',
      moved_at: '2026-03-03T00:00:00Z',
      tags: [],
      reasons: ['rule_match'],
    });

    updateFileStatus(db, fileId, 'approved', 'C:/out/dev_code/approved.py');
    const updated = getFileById(db, fileId);
    expect(updated?.status).toBe('approved');
    expect(updated?.current_path).toBe('C:/out/dev_code/approved.py');
  });

  it('handles dedup cache and updates current_path', () => {
    upsertDedupCache(db, 'sha-dup', 55, 'run-1', '/src/a.txt', '/out/a.txt');
    upsertDedupCache(db, 'sha-dup', 55, 'run-2', '/src/a.txt', '/out/b.txt');

    const item = checkDedupCache(db, 'sha-dup');
    expect(item?.file_id).toBe(55);
    expect(item?.current_path).toBe('/out/b.txt');
    expect(item?.first_seen_path).toBe('/src/a.txt');
  });

  it('inserts ledger entry and exposes json serialization', () => {
    insertLedgerEntry(db, {
      ts: '2026-03-03T00:00:00Z',
      run_id: 'R1',
      action: 'move',
      sha256: 'sha-ledger',
      reason: 'unit',
      before_path: 'C:/in/a.txt',
      after_path: 'C:/out/a.txt',
      file_id: 1,
      decision_json: { doc_type: 'ops_doc' },
    });

    const ledger = listLedger(db, 10);
    expect(ledger.length).toBe(1);
    expect(ledger[0].decision_json).toBeDefined();
    expect(typeof ledger[0].decision_json).toBe('string');
    expect(JSON.parse(String(ledger[0].decision_json as string)).doc_type).toBe('ops_doc');
  });

  it('manages watched folders and enabled flag', () => {
    addWatchedFolder(db, 'C:/tmp/watching', 'Tmp', true);
    addWatchedFolder(db, 'C:/tmp/watching', 'Tmp2', false);

    const folders = getWatchedFolders(db);
    expect(folders).toHaveLength(1);

    const folder = folders[0];
    expect(folder.label).toBe('Tmp2');
    setWatchedFolderEnabled(db, Number(folder.id as number), false);

    const updated = getWatchedFolders(db)[0];
    expect(Number(updated.enabled)).toBe(0);
  });

  it('supports bulk insert in a single function', () => {
    bulkInsertFiles(db, [
      {
        filename: 'a.txt',
        extension: '.txt',
        size_bytes: 1,
        sha256: 'sha-a',
        original_path: 'C:/in/a.txt',
        current_path: 'C:/out/a.txt',
        doc_type: 'other',
        confidence: 0.5,
        rule_id: null,
        classification_source: 'rule:TXT',
        project: null,
        vendor: null,
        file_date: null,
        suggested_name: 'a',
        source_folder_id: null,
        status: 'moved',
        classified_at: '2026-03-03T00:00:00Z',
        moved_at: '2026-03-03T00:00:00Z',
        tags: ['note'],
        reasons: ['rule'],
      },
      {
        filename: 'b.txt',
        extension: '.txt',
        size_bytes: 2,
        sha256: 'sha-b',
        original_path: 'C:/in/b.txt',
        current_path: 'C:/out/b.txt',
        doc_type: 'other',
        confidence: 0.5,
        rule_id: null,
        classification_source: 'rule:TXT',
        project: null,
        vendor: null,
        file_date: null,
        suggested_name: 'b',
        source_folder_id: null,
        status: 'moved',
        classified_at: '2026-03-03T00:00:00Z',
        moved_at: '2026-03-03T00:00:00Z',
        tags: [],
        reasons: ['rule'],
      },
      {
        filename: 'c.txt',
        extension: '.txt',
        size_bytes: 3,
        sha256: 'sha-c',
        original_path: 'C:/in/c.txt',
        current_path: 'C:/out/c.txt',
        doc_type: 'other',
        confidence: 0.5,
        rule_id: null,
        classification_source: 'rule:TXT',
        project: null,
        vendor: null,
        file_date: null,
        suggested_name: 'c',
        source_folder_id: null,
        status: 'moved',
        classified_at: '2026-03-03T00:00:00Z',
        moved_at: '2026-03-03T00:00:00Z',
        tags: ['note'],
        reasons: ['rule'],
      },
    ]);

    const items = listFiles(db);
    expect(items.length).toBe(3);
  });

  it('returns quarantined files list for UI queries', () => {
    insertFile(db, {
      filename: 'q.pdf',
      extension: '.pdf',
      size_bytes: 1,
      sha256: 'sha-q',
      original_path: 'C:/in/q.pdf',
      current_path: 'C:/quarantine/q.pdf',
      doc_type: 'other',
      confidence: 0,
      rule_id: null,
      classification_source: 'quarantine',
      project: null,
      vendor: null,
      file_date: null,
      suggested_name: 'q',
      source_folder_id: null,
      status: 'quarantined',
      classified_at: null,
      moved_at: null,
      tags: [],
      reasons: ['unmatched'],
    });

    const quarantined = getQuarantinedFiles(db);
    expect(quarantined.length).toBe(1);
    expect(quarantined[0].status).toBe('quarantined');
  });
});
