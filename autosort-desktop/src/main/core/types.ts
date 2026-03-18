// Core types ported from Python autosortd_1py.py

export interface LLMDecision {
  doc_type: string;
  action: string | null;
  rule_id: string | null;
  project: string | null;
  vendor: string | null;
  date: string | null; // YYYY-MM-DD or null
  suggested_name: string;
  confidence: number; // 0..1
  reasons: string[];
  tags: string[];
}

export function createLLMDecision(partial?: Partial<LLMDecision>): LLMDecision {
  return {
    doc_type: partial?.doc_type ?? 'other',
    action: partial?.action ?? null,
    rule_id: partial?.rule_id ?? null,
    project: partial?.project ?? null,
    vendor: partial?.vendor ?? null,
    date: partial?.date ?? null,
    suggested_name: partial?.suggested_name ?? '',
    confidence: partial?.confidence ?? 0.0,
    reasons: partial?.reasons ?? [],
    tags: partial?.tags ?? [],
  };
}

export function llmDecisionFromDict(d: Record<string, unknown>): LLMDecision {
  let doc_type = String(d.doc_type ?? '').trim() || 'other';
  let project = d.project != null ? String(d.project).trim() || null : null;
  let vendor = d.vendor != null ? String(d.vendor).trim() || null : null;
  let date = d.date != null ? String(d.date).trim() : null;
  const suggested_name = String(d.suggested_name ?? '');

  let confidence: number;
  try {
    confidence = Number(d.confidence ?? 0);
    if (isNaN(confidence)) confidence = 0;
  } catch {
    confidence = 0;
  }
  confidence = Math.max(0, Math.min(1, confidence));

  let reasons = (d.reasons as unknown[]) ?? [];
  let tags = (d.tags as unknown[]) ?? [];
  if (!Array.isArray(reasons)) reasons = [String(reasons)];
  if (!Array.isArray(tags)) tags = [String(tags)];
  const reasonsStr: string[] = reasons.filter((x) => String(x).trim()).map(String);
  const tagsStr: string[] = tags.filter((x) => String(x).trim()).map(String);

  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    date = null;
  }

  const action = typeof d.action === 'string' ? d.action : null;
  const rule_id = typeof d.rule_id === 'string' ? d.rule_id : null;

  return {
    doc_type,
    action,
    rule_id,
    project,
    vendor,
    date,
    suggested_name,
    confidence,
    reasons: reasonsStr,
    tags: tagsStr,
  };
}

export function llmDecisionToDict(dec: LLMDecision): Record<string, unknown> {
  return {
    doc_type: dec.doc_type,
    action: dec.action,
    rule_id: dec.rule_id,
    project: dec.project,
    vendor: dec.vendor,
    date: dec.date,
    suggested_name: dec.suggested_name,
    confidence: dec.confidence,
    reasons: dec.reasons,
    tags: dec.tags,
  };
}

export function normalizeRuleAction(action: unknown): string | null {
  if (typeof action !== 'string') return null;
  const normalized = action.trim().toLowerCase();
  return normalized || null;
}

export interface CompiledRule {
  id: string;
  type: string;
  doc_type: string;
  confidence: number;
  tags: string[];
  action: string | null;
  reason: string | null;
  ext_set: Set<string> | null;
  ext_group: string | null;
  regex: RegExp | null;
  target: string; // "name" | "path"
}

export interface RoutingResult {
  dest_dir: string;
  rename_policy: string; // "keep" | "normalize"
  forced_quarantine: boolean;
  forced_reason: string;
  forced_action: string | null;
}

export interface AutosortPaths {
  root: string;
  staging: string;
  out: string;
  quarantine: string;
  dup: string;
  logs: string;
  cache: string;
  rules_dir: string;
}

export interface LedgerEntry {
  ts: string;
  run_id: string;
  action: string;
  sha256: string;
  reason: string;
  before: string;
  after: string;
}

export type FileProcessStatus =
  | 'pending'
  | 'moved'
  | 'quarantined'
  | 'duplicate'
  | 'error'
  | 'approved'
  | 'deleted';

export interface FileProcessResult {
  fileId: number;
  filename: string;
  originalPath: string;
  currentPath: string;
  doc_type: string;
  confidence: number;
  status: FileProcessStatus;
  rule_id: string | null;
  classification_source: string;
  tags: string[];
  reasons: string[];
  sha256: string;
  originalName?: string;
}

export interface DbInsertFileInput {
  filename: string;
  extension: string;
  size_bytes: number;
  sha256: string;
  original_path: string;
  current_path: string;
  doc_type: string;
  confidence: number;
  rule_id: string | null;
  classification_source: string;
  project: string | null;
  vendor: string | null;
  file_date: string | null;
  suggested_name: string;
  source_folder_id: number | null;
  status: FileProcessStatus;
  classified_at: string | null;
  moved_at: string | null;
  tags: string[];
  reasons: string[];
}
