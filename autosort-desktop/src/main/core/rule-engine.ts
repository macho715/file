import {
  CompiledRule,
  LLMDecision,
  createLLMDecision,
  normalizeRuleAction,
} from './types';

export interface CompileResult {
  ext_groups: Record<string, string[]>;
  compiled_rules: CompiledRule[];
}

export function compileRules(rulesCfg: Record<string, unknown>): CompileResult {
  const ext_groups: Record<string, string[]> =
    (rulesCfg.ext_groups as Record<string, string[]>) ?? {};
  const compiled: CompiledRule[] = [];

  const rules = (rulesCfg.rules as Record<string, unknown>[]) ?? [];
  for (const r of rules) {
    const rid = String(r.id ?? 'NO_ID');
    const rtype = String(r.type ?? '').trim();
    const doc_type = String(r.doc_type ?? 'other').trim() || 'other';

    let conf: number;
    try {
      conf = Number(r.confidence ?? 0);
      if (isNaN(conf)) conf = 0;
    } catch {
      conf = 0;
    }
    conf = Math.max(0, Math.min(1, conf));

    let tags = (r.tags as unknown[]) ?? [];
    if (!Array.isArray(tags)) tags = [String(tags)];
    tags = tags.filter((x) => String(x).trim()).map(String);

    const action = typeof r.action === 'string' ? r.action : null;
    const reason = typeof r.reason === 'string' ? r.reason : null;

    const cr: CompiledRule = {
      id: rid,
      type: rtype,
      doc_type,
      confidence: conf,
      tags: tags as string[],
      action,
      reason,
      ext_set: null,
      ext_group: null,
      regex: null,
      target: 'name',
    };

    if (rtype === 'ext') {
      let match = (r.match as unknown[]) ?? [];
      if (!Array.isArray(match)) match = [String(match)];
      cr.ext_set = new Set(
        match.filter((x) => String(x).trim()).map((x) => String(x).toLowerCase())
      );
    } else if (rtype === 'ext_group') {
      cr.ext_group = String(r.group ?? '').trim() || null;
    } else if (rtype === 'regex') {
      cr.target = String(r.target ?? 'name').trim() || 'name';
      // Strip Python-style inline flags (?i) since we pass 'i' flag separately
      let pattern = String(r.pattern ?? '.*');
      pattern = pattern.replace(/^\(\?[imsx]+\)/i, '');
      try {
        cr.regex = new RegExp(pattern, 'i');
      } catch {
        continue; // skip invalid regex
      }
    } else {
      continue; // skip unknown rule type
    }

    compiled.push(cr);
  }

  return { ext_groups, compiled_rules: compiled };
}

export function firstMatchRule(
  filename: string,
  fullpath: string,
  ext: string,
  ext_groups: Record<string, string[]>,
  compiled_rules: CompiledRule[]
): LLMDecision | null {
  for (const r of compiled_rules) {
    let ok = false;

    if (r.type === 'ext' && r.ext_set !== null) {
      ok = r.ext_set.has(ext);
    } else if (r.type === 'ext_group' && r.ext_group) {
      const groupExts = (ext_groups[r.ext_group] ?? []).map((x) =>
        String(x).toLowerCase()
      );
      ok = groupExts.includes(ext);
    } else if (r.type === 'regex' && r.regex) {
      const targetStr = r.target === 'name' ? filename : fullpath;
      ok = r.regex.test(targetStr);
    }

    if (ok) {
      return createLLMDecision({
        doc_type: r.doc_type,
        action: normalizeRuleAction(r.action),
        rule_id: r.id,
        suggested_name: filename,
        confidence: r.confidence,
        reasons: [`rule:${r.id}`],
        tags: [...r.tags],
      });
    }
  }
  return null;
}
