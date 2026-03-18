import { describe, it, expect } from 'vitest';
import {
  llmDecisionFromDict,
  llmDecisionToDict,
  normalizeRuleAction,
} from '../../src/main/core/types';

describe('llmDecisionFromDict', () => {
  it('should parse a valid decision dict', () => {
    const dec = llmDecisionFromDict({
      doc_type: 'ops_doc',
      project: 'AGI_TR',
      vendor: 'TestVendor',
      date: '2026-01-15',
      suggested_name: 'report.pdf',
      confidence: 0.95,
      reasons: ['test'],
      tags: ['AGI_TR'],
    });
    expect(dec.doc_type).toBe('ops_doc');
    expect(dec.project).toBe('AGI_TR');
    expect(dec.confidence).toBe(0.95);
    expect(dec.tags).toEqual(['AGI_TR']);
    expect(dec.date).toBe('2026-01-15');
  });

  it('should default doc_type to "other" when empty', () => {
    const dec = llmDecisionFromDict({});
    expect(dec.doc_type).toBe('other');
    expect(dec.confidence).toBe(0);
  });

  it('should clamp confidence to 0..1', () => {
    const dec = llmDecisionFromDict({ confidence: 5.0 });
    expect(dec.confidence).toBe(1);
    const dec2 = llmDecisionFromDict({ confidence: -1 });
    expect(dec2.confidence).toBe(0);
  });

  it('should reject invalid date format', () => {
    const dec = llmDecisionFromDict({ date: 'not-a-date' });
    expect(dec.date).toBeNull();
  });

  it('should accept valid date', () => {
    const dec = llmDecisionFromDict({ date: '2026-03-01' });
    expect(dec.date).toBe('2026-03-01');
  });

  it('should handle non-array reasons/tags', () => {
    const dec = llmDecisionFromDict({ reasons: 'single', tags: 'tag1' });
    expect(dec.reasons).toEqual(['single']);
    expect(dec.tags).toEqual(['tag1']);
  });

  it('should filter empty strings from reasons/tags', () => {
    const dec = llmDecisionFromDict({ reasons: ['good', '', '  '], tags: ['a', ''] });
    expect(dec.reasons).toEqual(['good']);
    expect(dec.tags).toEqual(['a']);
  });
});

describe('llmDecisionToDict', () => {
  it('should roundtrip correctly', () => {
    const original = llmDecisionFromDict({
      doc_type: 'dev_code',
      confidence: 0.98,
      reasons: ['rule:DEV__CODE'],
      tags: [],
    });
    const dict = llmDecisionToDict(original);
    const restored = llmDecisionFromDict(dict as Record<string, unknown>);
    expect(restored.doc_type).toBe(original.doc_type);
    expect(restored.confidence).toBe(original.confidence);
    expect(restored.reasons).toEqual(original.reasons);
  });
});

describe('normalizeRuleAction', () => {
  it('should normalize quarantine', () => {
    expect(normalizeRuleAction('QUARANTINE')).toBe('quarantine');
    expect(normalizeRuleAction(' Quarantine ')).toBe('quarantine');
  });

  it('should return null for non-string', () => {
    expect(normalizeRuleAction(null)).toBeNull();
    expect(normalizeRuleAction(undefined)).toBeNull();
    expect(normalizeRuleAction(123)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(normalizeRuleAction('')).toBeNull();
    expect(normalizeRuleAction('   ')).toBeNull();
  });
});
