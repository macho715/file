import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { compileRules } from '../../src/main/core/rule-engine';
import { AutosortPaths, FileProcessResult } from '../../src/main/core/types';
import { ensureDirSync } from '../../src/main/core/file-operations';
import { initDatabase, getFileById, checkDedupCache, listLedger } from '../../src/main/services/database';
import { ClassifierConfig, handleFile } from '../../src/main/services/classifier';

describe('classifier DB integration', () => {
  let tempRoot = '';
  let dbPath = '';
  let paths: AutosortPaths;
  let db: any;

  function newConfig(): ClassifierConfig {
    const rulesCfg = {
      ext_groups: {
        py: ['.py'],
        temp: ['.crdownload'],
      },
      rules: [
        {
          id: 'DEV__CODE',
          type: 'ext_group',
          group: 'py',
          doc_type: 'dev_code',
          confidence: 0.98,
          reason: 'dev_code',
          action: 'move',
        },
        {
          id: 'TEMP__FILE',
          type: 'ext_group',
          group: 'temp',
          doc_type: 'temp',
          confidence: 0.99,
          reason: 'temp_file',
          action: 'quarantine',
        },
      ],
      stability_check: {
        enabled: false,
      },
    };

    const mappingCfg = {
      doc_type_map: {
        dev_code: 'Dev\Repos',
        temp: 'Temp',
      },
      apply_gate: {
        quarantine_below: 0.95,
        quarantine_doc_types: ['temp'],
        allow_auto_apply_doc_types: ['dev_code', 'temp'],
      },
      tag_overrides: [],
    };

    const compileResult = compileRules(rulesCfg);

    return {
      paths,
      llmBaseUrl: 'http://127.0.0.1:99999/v1',
      llmType: 'llama_cpp',
      rulesCfg,
      mappingCfg,
      compileResult,
      cachePath: path.join(paths.cache, 'cache.json'),
      ledgerPath: path.join(paths.logs, 'ledger.jsonl'),
      dryRun: false,
      db,
    };
  }

  beforeEach(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'autosort-classifier-'));
    paths = {
      root: tempRoot,
      staging: path.join(tempRoot, 'staging'),
      out: path.join(tempRoot, 'out'),
      quarantine: path.join(tempRoot, 'quarantine'),
      dup: path.join(tempRoot, 'dup'),
      logs: path.join(tempRoot, 'logs'),
      cache: path.join(tempRoot, 'cache'),
      rules_dir: path.join(tempRoot, 'rules'),
    };
    Object.values(paths).forEach((p) => ensureDirSync(p));

    dbPath = path.join(tempRoot, 'autosort.db');
    db = await initDatabase(dbPath);
  });

  afterEach(() => {
    if (dbPath && fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });
    if (tempRoot && fs.existsSync(tempRoot)) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('moves python file and records db + ledger + dedup', async () => {
    const inbox = path.join(tempRoot, 'inbox');
    ensureDirSync(inbox);
    const filePath = path.join(inbox, 'main.py');
    fs.writeFileSync(filePath, 'print("hello")');

    const result = await handleFile(newConfig(), filePath);
    expect(result).not.toBeNull();
    const outcome = result as FileProcessResult;
    expect(outcome.status).toBe('moved');
    expect(outcome.doc_type).toBe('dev_code');

    const row = getFileById(db, outcome.fileId);
    expect(row?.status).toBe('moved');
    expect(checkDedupCache(db, outcome.sha256)).not.toBeNull();

    const ledgerRows = listLedger(db, 10);
    expect(ledgerRows.length).toBe(1);
    expect(String(ledgerRows[0].action)).toBe('move');
    expect(fs.existsSync(String(outcome.currentPath))).toBe(true);
  });

  it('detects duplicate file and records duplicate status', async () => {
    const inbox = path.join(tempRoot, 'inbox');
    ensureDirSync(inbox);

    const cfg = newConfig();

    const firstPath = path.join(inbox, 'main.py');
    fs.writeFileSync(firstPath, 'print("hello")');
    const firstResult = await handleFile(cfg, firstPath);
    expect(firstResult?.status).toBe('moved');

    const secondPath = path.join(inbox, 'main_copy.py');
    fs.writeFileSync(secondPath, 'print("hello")');
    const secondResult = await handleFile(cfg, secondPath);
    expect(secondResult).not.toBeNull();
    expect(secondResult?.status).toBe('duplicate');

    const ledgerRows = listLedger(db, 20);
    expect(ledgerRows.length).toBeGreaterThanOrEqual(2);
  });

  it('quarantines incomplete downloads', async () => {
    const inbox = path.join(tempRoot, 'inbox');
    ensureDirSync(inbox);
    const cfg = newConfig();

    const filePath = path.join(inbox, 'download.crdownload');
    fs.writeFileSync(filePath, 'partial data');

    const result = await handleFile(cfg, filePath);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('quarantined');
    expect(result?.doc_type).toBe('temp');
    expect(fs.existsSync(String(result?.currentPath))).toBe(true);
  });

  it('returns null for directory input', async () => {
    const cfg = newConfig();
    const dir = path.join(tempRoot, 'subdir');
    ensureDirSync(dir);

    const result = await handleFile(cfg, dir);
    expect(result).toBeNull();
  });

  it('removes source when move succeeds', async () => {
    const inbox = path.join(tempRoot, 'inbox');
    ensureDirSync(inbox);
    const cfg = newConfig();

    const filePath = path.join(inbox, 'main.py');
    fs.writeFileSync(filePath, 'print("moved")');
    const result = await handleFile(cfg, filePath);

    expect(result?.status).toBe('moved');
    expect(fs.existsSync(filePath)).toBe(false);
    expect(fs.existsSync(String(result?.currentPath))).toBe(true);
  });
});
