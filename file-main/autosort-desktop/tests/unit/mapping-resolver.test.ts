import { describe, it, expect } from 'vitest';
import { resolveDestination, shouldAutoApply } from '../../src/main/core/mapping-resolver';
import { AutosortPaths, createLLMDecision } from '../../src/main/core/types';
import * as path from 'path';

const TEST_PATHS: AutosortPaths = {
  root: 'C:\\_TEST',
  staging: 'C:\\_TEST\\staging',
  out: 'C:\\_TEST\\out',
  quarantine: 'C:\\_TEST\\quarantine',
  dup: 'C:\\_TEST\\dup',
  logs: 'C:\\_TEST\\logs',
  cache: 'C:\\_TEST\\cache',
  rules_dir: 'C:\\_TEST\\rules',
};

const MAPPING_CFG = {
  doc_type_map: {
    dev_code: 'Dev\\Repos',
    dev_note: 'Dev\\Notes',
    dev_archive: 'Dev\\Archives',
    ops_doc: 'Docs\\Ops',
    other: 'Docs\\Other',
  },
  tag_overrides: [
    { when_all: ['tr_dash'], dest_rel: 'Dev\\Archives\\tr_dash-main', rename_policy: 'keep' },
    { when_all: ['AGI_TR'], dest_rel: 'Docs\\Ops\\AGI_TR', rename_policy: 'keep' },
  ],
  rename_policy: {
    dev_code: 'keep',
    dev_note: 'keep',
    ops_doc: 'keep',
    other: 'keep',
  },
  apply_gate: {
    quarantine_below: 0.90,
    quarantine_doc_types: ['other'],
    allow_auto_apply_doc_types: ['dev_code', 'dev_archive', 'dev_note', 'ops_doc', 'photo', 'temp'],
  },
  project_overrides: [
    { project: 'AGI_TR', doc_types: ['ops_doc'], append_subdir: true },
    { project: '__any__', doc_types: ['ops_doc'], append_subdir: true },
  ],
};

describe('resolveDestination', () => {
  it('should route dev_code to Dev/Repos', () => {
    const dec = createLLMDecision({ doc_type: 'dev_code', confidence: 0.98 });
    const result = resolveDestination(TEST_PATHS, MAPPING_CFG, dec);
    expect(result.dest_dir).toContain('Dev');
    expect(result.dest_dir).toContain('Repos');
    expect(result.rename_policy).toBe('keep');
  });

  it('should apply tag override for tr_dash', () => {
    const dec = createLLMDecision({
      doc_type: 'dev_archive',
      tags: ['tr_dash'],
      confidence: 0.99,
    });
    const result = resolveDestination(TEST_PATHS, MAPPING_CFG, dec);
    expect(result.dest_dir).toContain('tr_dash-main');
  });

  it('should quarantine action=quarantine', () => {
    const dec = createLLMDecision({
      doc_type: 'temp',
      action: 'quarantine',
      confidence: 0.99,
    });
    const result = resolveDestination(TEST_PATHS, MAPPING_CFG, dec);
    expect(result.forced_quarantine).toBe(true);
  });

  it('should force quarantine for "other" doc_type', () => {
    const dec = createLLMDecision({ doc_type: 'other', confidence: 0.50 });
    const result = resolveDestination(TEST_PATHS, MAPPING_CFG, dec);
    expect(result.forced_quarantine).toBe(true);
  });

  it('should append project subfolder for ops_doc with AGI_TR', () => {
    const dec = createLLMDecision({
      doc_type: 'ops_doc',
      project: 'AGI_TR',
      confidence: 0.95,
      tags: ['AGI_TR'],
    });
    const result = resolveDestination(TEST_PATHS, MAPPING_CFG, dec);
    expect(result.dest_dir).toContain('AGI_TR');
  });
});

describe('shouldAutoApply', () => {
  it('should allow auto-apply for high confidence dev_code', () => {
    const dec = createLLMDecision({ doc_type: 'dev_code', confidence: 0.98 });
    const result = shouldAutoApply(MAPPING_CFG, dec);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('auto_apply');
  });

  it('should reject low confidence', () => {
    const dec = createLLMDecision({ doc_type: 'dev_code', confidence: 0.50 });
    const result = shouldAutoApply(MAPPING_CFG, dec);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('low_confidence');
  });

  it('should reject doc_type not in allowlist', () => {
    const dec = createLLMDecision({ doc_type: 'invoice', confidence: 0.95 });
    const result = shouldAutoApply(MAPPING_CFG, dec);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_in_allowlist_doc_type');
  });
});
