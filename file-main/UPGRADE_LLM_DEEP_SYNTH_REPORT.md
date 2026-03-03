# Best 3 Deep Report — LLM Replacement Upgrade (Cursor + Codex Only)

**Scope:** Replace local LLM (llama.cpp/Ollama) with Cursor subagents/skills + Codex skills; no API; same IDE only.  
**Single input:** UPGRADE_LLM_TO_CURSOR_CODEX_REPLACEMENT.md (no extra research).  
**Date:** 2026-03-03

---

## 0) Best3 Gate Summary

| Best# | Idea | Bucket | EvidenceCount | DateOK | AGENTS.md compliance | Final | Reason |
|-------|-----|--------|---------------|--------|----------------------|--------|--------|
| 1 | Daemon `--no-llm` mode | Runtime/CLI | ≥2 | Yes | Yes (no delete, no rename dev, ledger, quarantine, no secrets) | **PASS** | Repo (AGENTS.md §2.2, autosortd) + §9 (Cursor Changelog 2.4, Skilllm Agent Skills); --no-llm preserves quarantine/ledger. |
| 2 | autosort-quarantine-triage "Cursor + Codex only" | Skill | ≥2 | Yes | Yes (skill redefinition only) | **PASS** | Repo (.cursor/skills/autosort-quarantine-triage, CURSOR_AUTOSORT_USAGE) + §9 (Skilllm, Cursor Dynamic context). |
| 3 | NO_LOCAL_LLM_WORKFLOW doc | Docs | ≥2 | Yes* | Yes (doc-only) | **PASS** | Repo (AGENTS.md, CURSOR_AUTOSORT_USAGE) + §9 (InfoQ 2026-01); *one §9 ref AMBER on date. |

---

## 1) BEST #1 Deep Dive — Daemon `--no-llm` Mode

- **Goal:** Add a `--no-llm` flag so the daemon never calls the local LLM; when rules cannot classify `.pdf`/`.docx`/`.xlsx`, send to quarantine and log to ledger (same as LLM failure path).
- **Non-goals:** No API or new network calls; no removal of existing LLM code (only gated); no rename/delete of user files; no change to Dev classification or rename policy.

- **Proposed design**
  - **Components:** `autosortd_1py.py` (or `autosortd.py`): CLI parser, `handle_one()`.
  - **Data flow:** `--no-llm` → skip LLM branch in `handle_one()` for docs; same `file_meta` + rule outcome → if "unclassified doc" then quarantine path + ledger entry (decision = "no_llm", reason = "--no-llm").
  - **Interfaces:** New CLI flag `--no-llm`; existing `LLMDecision`/quarantine/ledger unchanged; no new external API.

- **PR plan (≥3 steps)**
  1. **PR1:** Add `--no-llm` to argparse; pass flag into processing loop. *Rollback:* remove flag and one conditional.
  2. **PR2:** In `handle_one()`, when extension is doc and rules don't classify: if `--no-llm` then goto quarantine + ledger (no `requests` call). *Rollback:* revert conditional, restore LLM call.
  3. **PR3:** Update CURSOR_AUTOSORT_USAGE (and if present README) with `--no-llm` and "no local LLM" workflow. *Rollback:* revert doc edits.

- **Tests**
  - Unit: with temp dir and mock `handle_one`, assert `--no-llm` + unclassified `.pdf` produces ledger entry and no HTTP call.
  - Integration: run one pass on temp dir with one unclassified doc, assert file in quarantine and ledger line present.
  - Security: no secrets in logs; no real paths in test fixtures.

- **Rollout:** Default remains with LLM; opt-in `--no-llm`; no feature flag needed.  
- **Rollback:** Omit `--no-llm` or revert PR1+PR2.

- **Risks & mitigations**
  1. More files in quarantine → document in NO_LOCAL_LLM_WORKFLOW that triage is manual/Cursor+Codex.
  2. Scripts assume LLM always called → document and keep default behavior with LLM.
  3. Flag typo/confusion → add help text and usage example in CURSOR_AUTOSORT_USAGE.

- **KPIs**
  - Zero moves to wrong bucket when `--no-llm` (quarantine only for unclassified docs).
  - Ledger entries for every "no_llm" decision.
  - No `requests` calls when `--no-llm` (test assertion).

- **Evidence**
  - Repo: AGENTS.md §2.2 (LLM selective for .pdf/.docx/.xlsx); autosortd handle_one/LLM flow.
  - §9: Cursor Changelog 2.4 (2026-01-22); Skilllm Agent Skills (2026-01-17).

---

## 2) BEST #2 Deep Dive — autosort-quarantine-triage "Cursor + Codex Only"

- **Goal:** Redefine the autosort-quarantine-triage skill so it is "Cursor + Codex only": rules first, then human-driven triage in IDE using Cursor + Codex doc/pdf/spreadsheet skills; no optional local LLM call.
- **Non-goals:** No new API or automation server; no change to daemon behavior (that is Best #1); no delete/rename of dev assets; AGENTS.md remains SSOT.

- **Proposed design**
  - **Components:** `.cursor/skills/autosort-quarantine-triage/SKILL.md` (and any bundled scripts if present).
  - **Data flow:** Skill describes: (1) list Quarantine contents, (2) apply keyword/rules from AGENTS.md, (3) if still ambiguous, user runs Codex doc/pdf/spreadsheet skills in IDE for extraction/classification, (4) user moves file to SSOT and logs (or ledger) per AGENTS.md.
  - **Interfaces:** SKILL.md contract: when to use, inputs (quarantine path, file list), outputs (suggested bucket + optional safe name); no programmatic LLM API.

- **PR plan (≥3 steps)**
  1. **PR1:** Edit SKILL.md: remove "optional LLM" and add "Cursor + Codex only"; add steps for Codex doc/pdf/spreadsheet. *Rollback:* revert SKILL.md.
  2. **PR2:** Add "When not to use": local LLM, external API, automated classification without human. *Rollback:* revert section.
  3. **PR3:** Align skill with AGENTS.md §2.2 keyword list and §1 target tree; reference NO_LOCAL_LLM_WORKFLOW once it exists. *Rollback:* revert references.

- **Tests**
  - No daemon code change; manual/spot check that SKILL.md is consistent with AGENTS.md and CURSOR_AUTOSORT_USAGE.
  - Security: skill does not reference tokens or internal URLs.

- **Rollout:** Merge skill edits; document in CURSOR_AUTOSORT_USAGE.  
- **Rollback:** Revert SKILL.md and doc references.

- **Risks & mitigations**
  1. Users expect "one-click" classification → clarify in skill that triage is human-in-the-loop.
  2. Codex skill paths wrong → document exact skill names/paths (e.g. doc, pdf, spreadsheet) in SKILL.md.

- **KPIs**
  - SKILL.md contains zero references to "Ollama"/"llama.cpp"/local LLM API.
  - At least one reference to Codex doc/pdf/spreadsheet skills and to NO_LOCAL_LLM_WORKFLOW (post Best #3).

- **Evidence**
  - Repo: .cursor/skills/autosort-quarantine-triage; CURSOR_AUTOSORT_USAGE.
  - §9: Skilllm Agent Skills (2026-01-17); Cursor Dynamic context (2026-01).

---

## 3) BEST #3 Deep Dive — NO_LOCAL_LLM_WORKFLOW Doc

- **Goal:** Add a short operational guide "로컬 LLM 없이" (without local LLM): run daemon with `--no-llm`, use quarantine + Cursor + Codex skills for triage, no API.
- **Non-goals:** No code or skill logic change in this item; no API design; no change to SSOT tree or AGENTS.md rules.

- **Proposed design**
  - **Components:** One doc: `docs/NO_LOCAL_LLM_WORKFLOW.md` (or repo-root if no `docs/`).
  - **Data flow:** Doc → human: start daemon with `--no-llm` → unclassified docs go to quarantine → open Cursor, use autosort-quarantine-triage + Codex skills → move to SSOT and ledger per AGENTS.md.
  - **Interfaces:** Doc sections: prerequisite (--no-llm), triage steps, link to skill and AGENTS.md; no programmatic interface.

- **PR plan (≥3 steps)**
  1. **PR1:** Create `docs/NO_LOCAL_LLM_WORKFLOW.md` with goal, prereqs, and "Step 1: Run with --no-llm". *Rollback:* delete file or revert.
  2. **PR2:** Add "Step 2: Triage quarantine" (skill + Codex doc/pdf/spreadsheet). *Rollback:* revert section.
  3. **PR3:** Add "Recovery / Rollback" and reference AGENTS.md §7; link from CURSOR_AUTOSORT_USAGE. *Rollback:* revert links and section.

- **Tests**
  - Doc only: no unit/integration; check links and that no secrets/real paths.
  - Security: no tokens, no internal URLs.

- **Rollout:** Merge doc; link from usage/README.  
- **Rollback:** Remove doc and links.

- **Risks & mitigations**
  1. Doc out of date after code change → reference "--no-llm" and single workflow so fewer code-doc drift points.
  2. Non-KR readers → keep title + one-line KR; body can be EN.

- **KPIs**
  - Doc exists and describes --no-llm and quarantine triage with Cursor+Codex.
  - At least one cross-reference to AGENTS.md and to autosort-quarantine-triage skill.

- **Evidence**
  - Repo: AGENTS.md §2.2, §7; CURSOR_AUTOSORT_USAGE.
  - §9: InfoQ (2026-01); Cursor docs/skills (AMBER: date not stated in input).

---

## 4) Implementation Notes (what to do first)

1. **Implement `--no-llm`** in the daemon: add flag, in `handle_one()` for unclassified docs skip LLM and go to quarantine + ledger; verify with temp dir and ledger check.
2. **Edit autosort-quarantine-triage SKILL.md** to "Cursor + Codex only": remove optional LLM, add steps for Codex doc/pdf/spreadsheet and reference AGENTS.md.
3. **Add `docs/NO_LOCAL_LLM_WORKFLOW.md`** with --no-llm workflow, quarantine triage, and links to skill and AGENTS.md.
4. **Update CURSOR_AUTOSORT_USAGE** (and README if present) with `--no-llm` and link to NO_LOCAL_LLM_WORKFLOW.
5. **Smoke run** with `--no-llm` on a test directory; confirm 0 deletes, no rename of dev assets, ledger and quarantine behave per AGENTS.md.

---

## 5) JSON Envelope

```json
{
  "best3": [
    { "rank": 1, "idea": "Daemon --no-llm mode", "bucket": "Runtime/CLI", "evidence_count": 2, "gate": "PASS" },
    { "rank": 2, "idea": "autosort-quarantine-triage Cursor + Codex only redefinition", "bucket": "Skill", "evidence_count": 2, "gate": "PASS" },
    { "rank": 3, "idea": "NO_LOCAL_LLM_WORKFLOW operational guide (no local LLM)", "bucket": "Docs", "evidence_count": 2, "gate": "PASS" }
  ],
  "meta": { "version": "upgrade-deep-synth.v1", "scope": "LLM replacement upgrade, Cursor+Codex only, no API" }
}
```

---

*Refs: UPGRADE_LLM_TO_CURSOR_CODEX_REPLACEMENT.md, AGENTS.md, CURSOR_AUTOSORT_USAGE.md, .cursor/skills/autosort-quarantine-triage/SKILL.md.*
