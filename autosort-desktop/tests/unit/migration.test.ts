import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  initDatabase,
  getSetting,
  getFileByPath,
  listLedger,
  checkDedupCache,
  DatabaseInstance,
} from '../../src/main/services/database';
import { runLegacyMigration } from '../../src/main/services/migration';
import { AutosortPaths } from '../../src/main/core/types';
import { ensureDirSync } from '../../src/main/core/file-operations';

describe('runLegacyMigration', () => {
  let tempRoot = '';
  let dbPath = '';
  let db: DatabaseInstance;
  let paths: AutosortPaths;

  function buildPaths(root: string): AutosortPaths {
    return {
      root,
      staging: path.join(root, 'staging'),
      out: path.join(root, 'out'),
      quarantine: path.join(root, 'quarantine'),
      dup: path.join(root, 'dup'),
      logs: path.join(root, 'logs'),
      cache: path.join(root, 'cache'),
      rules_dir: path.join(root, 'rules'),
    };
  }

  beforeEach(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'autosort-migration-'));
    paths = buildPaths(tempRoot);
    Object.values(paths).forEach((p) => ensureDirSync(p));
    dbPath = path.join(tempRoot, 'autosort.db');
    db = await initDatabase(dbPath);
  });

  afterEach(() => {
    if (dbPath && fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { force: true });
    }
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('completes when legacy files do not exist', async () => {
    await runLegacyMigration(db, paths);

    const moved = listLedger(db, 10);
    expect(moved.length).toBe(0);
    expect(getSetting(db, 'migration_legacy_v1_done')).toBe('true');
  });

  it('migrates cache.json to files / dedup_cache / ledger', async () => {
    fs.writeFileSync(
      path.join(paths.cache, 'cache.json'),
      JSON.stringify({
        shaA: {
          run_id: 'R1',
          before: 'C:/legacy/before-a.pdf',
          after: 'C:/legacy/out/after-a.pdf',
          decision: {
            doc_type: 'ops_doc',
            confidence: 0.95,
            reasons: ['rule_match'],
            tags: ['AGI_TR'],
          },
          reason: 'rule_match',
        },
        shaB: {
          run_id: 'R1',
          before: 'C:/legacy/before-b.pdf',
          after: 'C:/legacy/out/after-b.pdf',
          decision: {
            doc_type: 'other',
            confidence: 0.4,
            reasons: ['duplicate_hash'],
            tags: [],
          },
          reason: 'duplicate_hash',
        },
      })
    );

    await runLegacyMigration(db, paths);

    const dedup = checkDedupCache(db, 'shaA');
    expect(dedup).not.toBeNull();
    expect(checkDedupCache(db, 'shaB')).not.toBeNull();

    const migratedFile = getFileByPath(db, 'C:/legacy/before-b.pdf');
    expect(migratedFile?.classification_source).toBe('duplicate');

    const ledgers = listLedger(db, 20);
    expect(ledgers.length).toBe(2);
    expect(ledgers.some((l) => String(l.reason) === 'rule_match')).toBe(true);
    expect(ledgers.some((l) => String(l.reason) === 'duplicate_hash')).toBe(true);
  });

  it('migrates ledger.jsonl and skips invalid lines', async () => {
    fs.writeFileSync(
      path.join(paths.logs, 'ledger.jsonl'),
      [
        '{"ts":"2026-03-03T00:00:01Z","run_id":"R1","action":"move","sha256":"s1","before":"A","after":"B","reason":"existing","decision_json":{"doc_type":"other"}}',
        'invalid-json',
        '{"ts":"2026-03-03T00:00:02Z","run_id":"R1","action":"approve","sha256":"s2","before":"C","after":"D","reason":"approved","decision_json":{"doc_type":"ops_doc"}}',
      ].join('\n')
    );

    await runLegacyMigration(db, paths);

    const ledgers = listLedger(db, 20);
    expect(ledgers.length).toBe(2);
    expect(ledgers.map((entry) => String(entry.reason))).toContain('approved');
  });

  it('remains idempotent when run twice', async () => {
    fs.writeFileSync(path.join(paths.cache, 'cache.json'), '{}');

    await runLegacyMigration(db, paths);
    const once = listLedger(db, 10).length;

    await runLegacyMigration(db, paths);
    const twice = listLedger(db, 10).length;

    expect(once).toBe(twice);
    expect(getSetting(db, 'migration_legacy_v1_done')).toBe('true');
  });

  it('maps decision_source for duplicate and unstable reasons', async () => {
    fs.writeFileSync(
      path.join(paths.cache, 'cache.json'),
      JSON.stringify({
        shaX: {
          run_id: 'R1',
          before: 'X',
          after: 'Y',
          decision: {
            doc_type: 'other',
            confidence: 0,
          },
          reason: 'duplicate_hash',
        },
        shaY: {
          run_id: 'R1',
          before: 'A',
          after: 'B',
          decision: {
            doc_type: 'temp',
            confidence: 0,
          },
          reason: 'unstable',
        },
      })
    );

    await runLegacyMigration(db, paths);

    const fileX = getFileByPath(db, 'X');
    expect(fileX?.classification_source).toBe('duplicate');

    const fileY = getFileByPath(db, 'A');
    expect(fileY?.classification_source).toBe('unstable');
  });
});
