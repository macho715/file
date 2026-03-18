import { describe, it, expect } from 'vitest';
import { compileRules, firstMatchRule } from '../../src/main/core/rule-engine';

// Ported from test_autosortd_behavior.py

const RULES_CFG = {
  ext_groups: {
    temp: ['.crdownload', '.part', '.tmp'],
    archives: ['.zip', '.7z', '.rar', '.tar', '.gz'],
    dev_code: ['.py', '.js', '.ts', '.tsx', '.json', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.ps1', '.sh', '.bat', '.cmd', '.ipynb'],
    notes: ['.md', '.txt'],
    images: ['.jpg', '.jpeg', '.png', '.webp'],
    docs: ['.pdf', '.docx', '.xlsx', '.xlsm'],
  },
  rules: [
    {
      id: 'TEMP__INCOMPLETE_DOWNLOAD',
      type: 'ext',
      match: ['.crdownload', '.part', '.tmp'],
      doc_type: 'temp',
      confidence: 0.99,
      action: 'quarantine',
      reason: 'incomplete_or_temp',
    },
    {
      id: 'ARCHIVE__TR_DASH_MAIN',
      type: 'regex',
      target: 'name',
      pattern: '(?i)^tr_dash-main(\\s*\\(\\d+\\))?\\.(zip|7z|rar)$',
      doc_type: 'dev_archive',
      tags: ['tr_dash'],
      confidence: 0.99,
    },
    {
      id: 'ARCHIVE__GENERIC',
      type: 'ext_group',
      group: 'archives',
      doc_type: 'dev_archive',
      confidence: 0.98,
    },
    {
      id: 'DEV__CODE',
      type: 'ext_group',
      group: 'dev_code',
      doc_type: 'dev_code',
      confidence: 0.98,
    },
    {
      id: 'DEV__NOTES',
      type: 'ext_group',
      group: 'notes',
      doc_type: 'dev_note',
      confidence: 0.95,
    },
    {
      id: 'PHOTO__ALL',
      type: 'ext_group',
      group: 'images',
      doc_type: 'photo',
      confidence: 0.95,
    },
    {
      id: 'OPS__AGI_TR',
      type: 'regex',
      target: 'name',
      pattern: '(?i)\\bAGI[_ -]?TR\\b',
      doc_type: 'ops_doc',
      tags: ['AGI_TR'],
      confidence: 0.93,
    },
    {
      id: 'DOCS__FALLBACK',
      type: 'ext_group',
      group: 'docs',
      doc_type: 'other',
      confidence: 0.60,
    },
  ],
};

describe('compileRules', () => {
  it('should compile all valid rules', () => {
    const result = compileRules(RULES_CFG);
    expect(result.compiled_rules.length).toBe(8);
    expect(Object.keys(result.ext_groups).length).toBe(6);
  });

  it('should skip invalid rule types', () => {
    const cfg = {
      ext_groups: {},
      rules: [{ id: 'BAD', type: 'unknown', doc_type: 'other', confidence: 0.5 }],
    };
    const result = compileRules(cfg);
    expect(result.compiled_rules.length).toBe(0);
  });
});

describe('firstMatchRule', () => {
  const { ext_groups, compiled_rules } = compileRules(RULES_CFG);

  it('should match temp files to quarantine', () => {
    const dec = firstMatchRule('test.crdownload', '/path/test.crdownload', '.crdownload', ext_groups, compiled_rules);
    expect(dec).not.toBeNull();
    expect(dec!.doc_type).toBe('temp');
    expect(dec!.action).toBe('quarantine');
    expect(dec!.rule_id).toBe('TEMP__INCOMPLETE_DOWNLOAD');
  });

  it('should match Python files to dev_code', () => {
    const dec = firstMatchRule('main.py', '/path/main.py', '.py', ext_groups, compiled_rules);
    expect(dec).not.toBeNull();
    expect(dec!.doc_type).toBe('dev_code');
    expect(dec!.confidence).toBe(0.98);
  });

  it('should match markdown files to dev_note', () => {
    const dec = firstMatchRule('README.md', '/path/README.md', '.md', ext_groups, compiled_rules);
    expect(dec).not.toBeNull();
    expect(dec!.doc_type).toBe('dev_note');
  });

  it('should match zip files to dev_archive', () => {
    const dec = firstMatchRule('data.zip', '/path/data.zip', '.zip', ext_groups, compiled_rules);
    expect(dec).not.toBeNull();
    expect(dec!.doc_type).toBe('dev_archive');
  });

  it('should match tr_dash-main.zip with regex', () => {
    const dec = firstMatchRule('tr_dash-main.zip', '/path/tr_dash-main.zip', '.zip', ext_groups, compiled_rules);
    expect(dec).not.toBeNull();
    expect(dec!.doc_type).toBe('dev_archive');
    expect(dec!.tags).toContain('tr_dash');
    expect(dec!.rule_id).toBe('ARCHIVE__TR_DASH_MAIN');
  });

  it('should match AGI_TR pattern', () => {
    const dec = firstMatchRule('AGI_TR report.pdf', '/path/AGI_TR report.pdf', '.pdf', ext_groups, compiled_rules);
    expect(dec).not.toBeNull();
    expect(dec!.doc_type).toBe('ops_doc');
    expect(dec!.tags).toContain('AGI_TR');
  });

  it('should fallback docs to other with low confidence', () => {
    const dec = firstMatchRule('random.pdf', '/path/random.pdf', '.pdf', ext_groups, compiled_rules);
    expect(dec).not.toBeNull();
    expect(dec!.doc_type).toBe('other');
    expect(dec!.confidence).toBe(0.60);
  });

  it('should return null for unknown extensions', () => {
    const dec = firstMatchRule('file.abc', '/path/file.abc', '.abc', ext_groups, compiled_rules);
    expect(dec).toBeNull();
  });

  it('should match images to photo', () => {
    const dec = firstMatchRule('pic.jpg', '/path/pic.jpg', '.jpg', ext_groups, compiled_rules);
    expect(dec).not.toBeNull();
    expect(dec!.doc_type).toBe('photo');
  });
});
