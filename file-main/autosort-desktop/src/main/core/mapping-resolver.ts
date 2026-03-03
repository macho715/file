import * as path from 'path';
import { AutosortPaths, LLMDecision, RoutingResult, normalizeRuleAction } from './types';
import { safeFilename } from './file-operations';

function splitRelPath(rel: string): string {
  return rel.replace(/\//g, path.sep).replace(/\\/g, path.sep);
}

export function resolveDestination(
  paths: AutosortPaths,
  mappingCfg: Record<string, unknown>,
  decision: LLMDecision
): RoutingResult {
  const doc_type_map = (mappingCfg.doc_type_map as Record<string, string>) ?? {};
  const tag_overrides =
    (mappingCfg.tag_overrides as Record<string, unknown>[]) ?? [];
  const rename_policy_map =
    (mappingCfg.rename_policy as Record<string, string>) ?? {};
  const apply_gate = (mappingCfg.apply_gate as Record<string, unknown>) ?? {};

  let forced_quarantine = false;
  let forced_reason = '';
  let forced_action: string | null = null;

  if (normalizeRuleAction(decision.action) === 'quarantine') {
    forced_quarantine = true;
    forced_action = 'quarantine';
    forced_reason = 'rule_action_quarantine';
  } else if (decision.action !== null) {
    decision.reasons.push(`unsupported_rule_action:${decision.action}`);
  }

  const quarantine_doc_types = new Set(
    (apply_gate.quarantine_doc_types as string[]) ?? []
  );
  if (quarantine_doc_types.has(decision.doc_type)) {
    forced_quarantine = true;
    forced_reason = 'forced_quarantine_doc_type';
  }

  const base_rel =
    doc_type_map[decision.doc_type] ?? doc_type_map['other'] ?? 'Docs\\Other';
  let dest_rel = base_rel;
  let rp = rename_policy_map[decision.doc_type] ?? 'keep';

  const tagsSet = new Set(decision.tags ?? []);
  for (const ov of tag_overrides) {
    const need = new Set((ov.when_all as string[]) ?? []);
    if (need.size > 0) {
      let allMatch = true;
      for (const n of need) {
        if (!tagsSet.has(n)) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        dest_rel = (ov.dest_rel as string) ?? dest_rel;
        rp = (ov.rename_policy as string) ?? rp;
        break;
      }
    }
  }

  let dest_dir = path.join(paths.out, splitRelPath(String(dest_rel)));

  // Project-based sub-folder
  if (decision.project && !decision.doc_type.startsWith('dev_')) {
    const safeProj = safeFilename(decision.project, 60);
    if (safeProj) {
      const project_overrides =
        (mappingCfg.project_overrides as Record<string, unknown>[]) ?? [];
      let projApplied = false;
      for (const pov of project_overrides) {
        const povProj = String(pov.project ?? '').trim();
        const povTypes = (pov.doc_types as string[]) ?? [];
        const typeOk =
          povTypes.length === 0 || povTypes.includes(decision.doc_type);
        const nameOk = povProj === '__any__' || povProj === safeProj;
        if (nameOk && typeOk) {
          if (pov.append_subdir) {
            dest_dir = path.join(dest_dir, safeProj);
          } else if (pov.dest_rel_override) {
            dest_dir = path.join(
              paths.out,
              splitRelPath(String(pov.dest_rel_override))
            );
          }
          projApplied = true;
          break;
        }
      }
      if (!projApplied) {
        dest_dir = path.join(dest_dir, safeProj);
      }
    }
  }

  rp = String(rp ?? 'keep').trim().toLowerCase();
  if (rp !== 'keep' && rp !== 'normalize') {
    rp = 'keep';
  }

  return {
    dest_dir,
    rename_policy: rp,
    forced_quarantine,
    forced_reason,
    forced_action,
  };
}

export function shouldAutoApply(
  mappingCfg: Record<string, unknown>,
  decision: LLMDecision
): { ok: boolean; reason: string } {
  const apply_gate = (mappingCfg.apply_gate as Record<string, unknown>) ?? {};
  const q_below = Number(apply_gate.quarantine_below ?? 0.9);
  const allow = new Set(
    (apply_gate.allow_auto_apply_doc_types as string[]) ?? []
  );

  if (decision.confidence < q_below) {
    return { ok: false, reason: 'low_confidence' };
  }
  if (allow.size > 0 && !allow.has(decision.doc_type)) {
    return { ok: false, reason: 'not_in_allowlist_doc_type' };
  }
  return { ok: true, reason: 'auto_apply' };
}
