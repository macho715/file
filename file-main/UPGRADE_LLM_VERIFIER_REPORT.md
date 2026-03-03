# Upgrade-Verifier Report — LLM Replacement (Deep2 Gate Review)

**Scope:** LLM replacement upgrade (local LLM → Cursor/Codex skills, no API).  
**Inputs:** UPGRADE_LLM_TO_CURSOR_CODEX_REPLACEMENT.md, UPGRADE_LLM_DEEP_SYNTH_REPORT.md, AGENTS.md.  
**Date:** 2026-03-03

---

## 1) Best 3 vs Non-Negotiables Table

| Idea | NO DELETE | NO RENAME dev | Ledger always | Quarantine | Temp stability | No secrets | **Go/No-Go** |
|------|-----------|---------------|---------------|------------|----------------|------------|---------------|
| **1. Daemon --no-llm mode** | ✓ (move only, no delete) | ✓ (dev unchanged) | ✓ (ledger entry for no_llm) | ✓ (unclassified docs → quarantine) | ✓ (unchanged; .crdownload/.part/.tmp still gated) | ✓ (no API/tokens; tests no real paths) | **Go** |
| **2. autosort-quarantine-triage "Cursor + Codex only"** | ✓ (skill says move+ledger, no delete) | ✓ (skill: overwrite/Dev rename forbidden) | ✓ (skill: move + ledger) | ✓ (triage from quarantine) | N/A (skill, no daemon temp logic) | ✓ (Deep: no tokens/internal URLs in skill) | **Go** |
| **3. NO_LOCAL_LLM_WORKFLOW doc** | ✓ (doc only) | ✓ (doc only) | ✓ (doc must state Ledger always) | ✓ (doc must state Quarantine on uncertainty) | N/A | ✓ (doc: no secrets/real paths) | **Go** |

**Overall vs Non-Negotiables:** **Go** — All three items satisfy the seven Non-Negotiables; no blocking gaps.

---

## 2) Apply Gates vs Plan

| Gate (from UPGRADE_LLM §7) | Deep Report reflection | **Verdict** | Reason |
|----------------------------|------------------------|-------------|--------|
| **--no-llm tests:** temp dir only; no real watch path / C:\_AUTOSORT | Best#1 Tests: "temp dir and mock", "run one pass on temp dir", "no real paths in test fixtures"; Security: "no real paths in test fixtures" | **PASS** | Deep Report explicitly requires temp dir only and no real paths. |
| **Skill redefinition:** no overwrite, no rename dev, no path/secrets in output | Best#2: "no delete/rename of dev assets"; Tests: "skill does not reference tokens or internal URLs"; PR: overwrite/Dev rename in §7 and skill design | **PASS** | Overwrite/rename dev and no secrets/paths are stated in both Replacement §7 and Deep Report. |
| **Doc:** "Quarantine on uncertainty, Ledger always" stated | Best#3: "move to SSOT and ledger per AGENTS.md"; KPIs: "cross-reference to AGENTS.md"; Replacement §7: "Quarantine/Ledger always 유지 문구 명시" | **PASS** | Doc is required to align with AGENTS and to state quarantine + ledger. |

**Apply Gates summary:** All three gates are reflected in the Deep Report; **PASS** for each.

---

## 3) Test Matrix

| Best# | Item | Required test type | Constraint | Deep Report | **Verdict** |
|-------|------|--------------------|------------|-------------|-------------|
| 1 | --no-llm | Unit + integration | Temp dir only, no real paths, no secrets | Unit: temp dir + mock; integration: one pass on temp dir; security: no secrets, no real paths | **PASS** |
| 2 | Skill redefinition | Manual / doc review | No daemon code; skill consistent with AGENTS; no tokens/URLs | "Manual/spot check SKILL.md consistent with AGENTS.md"; "skill does not reference tokens or internal URLs" | **PASS** |
| 3 | NO_LOCAL_LLM doc | Doc/link check | No unit/integration; no secrets/real paths | "Doc only: no unit/integration; check links and that no secrets/real paths" | **PASS** |

**Gap:** None. Required test types and constraints are satisfied by the Deep Report.

---

## 4) Rollback Triggers

| Item | Rollback trigger (concrete) | Documented rollback action |
|------|-----------------------------|----------------------------|
| **1. --no-llm** | --no-llm causes unclassified docs to be moved to a non-quarantine bucket, or ledger not written for no_llm decisions | Omit `--no-llm` or revert PR1+PR2 (remove flag and conditional; restore LLM call). |
| **2. Skill redefinition** | Skill text instructs overwrite, dev rename, or exposes paths/secrets | Revert SKILL.md and doc references (PR1–PR3 rollback). |
| **3. NO_LOCAL_LLM doc** | Doc contradicts AGENTS (e.g. suggests delete or no ledger) or contains secrets | Remove doc and links; revert PR1–PR3. |

---

## 5) Final Verdict

**Verdict: PASS**

All three Best3 items align with AGENTS.md Non-Negotiables (no delete, no rename for dev, ledger always, quarantine on uncertainty, temp stability where applicable, no secrets). Apply Gates from UPGRADE_LLM §7 are reflected in the Deep Report (tests temp-only, skill no overwrite/rename dev/no secrets, doc Quarantine/Ledger stated). Test matrix is satisfied; rollback triggers and actions are documented per item.

**Safe to execute per the plan.** Proceed with PRs as in the Replacement doc and Deep Report (--no-llm → skill redefinition → NO_LOCAL_LLM_WORKFLOW doc), with QA: smoke run with --no-llm on a test directory, 0 deletes, no rename of dev assets, and ledger/quarantine behavior per AGENTS.md.

---

*Refs: UPGRADE_LLM_TO_CURSOR_CODEX_REPLACEMENT.md, UPGRADE_LLM_DEEP_SYNTH_REPORT.md, AGENTS.md.*
