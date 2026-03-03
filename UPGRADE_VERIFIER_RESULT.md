# Upgrade Verifier — PASS/FAIL Result

**Project:** LOCAL-AUTOSORT  
**Date:** 2026-03-02  
**Input:** UPGRADE_DOC_AUDIT_SUMMARY.md + AGENTS.md Non-Negotiables

---

## 1) Constraint Checklist (AGENTS.md)

| # | Rule | Verifier note |
|---|------|----------------|
| 1 | NO DELETE | All proposals must not introduce any file deletion. |
| 2 | NO RENAME for dev | Any new code path must preserve dev_code/dev_repo/dev_config filename. |
| 3 | Rule-first, LLM-last | New features must not force LLM for rule-classifiable files. |
| 4 | Ledger always | Every move must still write ledger entry; new tests may assert this. |
| 5 | Quarantine on uncertainty | No change to "ambiguous → quarantine" policy. |
| 6 | Stability gate | .crdownload/.part/.tmp handling unchanged. |
| 7 | No internal secrets | No logging of API keys, paths, PII. |

---

## 2) PASS/FAIL per Idea (Quick Wins + Typical Upgrades)

| Idea | PASS/FAIL | Reason |
|------|-----------|--------|
| **Add requirements.txt** | **PASS** | No behavior change; improves reproducibility. No conflict with Non-Negotiables. |
| **Align README run examples to autosortd_1py.py** | **PASS** | Documentation only; reinforces single entrypoint. No code/behavior change. |
| **Add 1–2 tests (rule classification, rollback)** | **PASS** | Tests must not delete user files or rename dev; they use temp dirs and assert ledger. Already true for test_ledger_smoke. New tests: same pattern (temp dir, assert keys/behavior). |
| **Document health_check.ps1 in README/ARCHITECTURE** | **PASS** | Documentation only. |
| **Add CI (e.g. GitHub Actions)** | **PASS** | CI runs tests/lint only; no production move/delete. Ensure CI does not run watcher against real paths; use pytest in repo only. |
| **Add observability (metrics/dashboard)** | **AMBER** | PASS if read-only (e.g. ledger stats, counts). FAIL if it would log paths/content or secrets. |
| **Change SSOT folder tree** | **FAIL** | AGENTS.md: "Changing the SSOT folder tree" requires human approval; verifier treats as out-of-scope for auto-apply. |
| **Remove or repurpose autosortd.py** | **AMBER** | If file exists: deletion is forbidden by Non-Negotiables for *user* files; repo code removal is a policy decision. Rename/archive only with approval. |

---

## 3) AMBER (Confirm Before Applying)

- **Observability:** Any new logging or metrics must not include full paths, file contents, or credentials. Prefer aggregates (counts, rates) and run_id/ts only.
- **autosortd.py:** If present in repo, do not delete without explicit approval; document as legacy or remove references only (README/ARCHITECTURE already aligned to autosortd_1py).
- **CI:** Default branch / protected paths — ensure CI does not run against `C:\_AUTOSORT` or real inbox; tests must use temp directories only.

---

## 4) Verification Plan (After Applying Changes)

- **Smoke:** Run `pytest tests/test_ledger_smoke.py -v` from repo root; must pass.
- **Ledger:** After any code change to move logic: run one dry-run or one real move; check `logs/ledger.jsonl` for one line with keys: `ts`, `run_id`, `action`, `sha256`, `reason`, `before`, `after`.
- **No delete:** Search codebase for `os.remove`, `unlink`, `Path.unlink`, or delete-on-move; must be 0 for user files (or only temp dirs in tests).
- **No rename dev:** In move/actuator path, assert `doc_type in {dev_code, dev_repo, dev_config}` ⇒ `new_name == original_name`.
- **Temp stability:** No move of `.crdownload`/`.part`/`.tmp` before stability check (existing logic unchanged).
- **Lint:** If CI added, run `ruff check .` (or existing linter); fix only what is necessary for the change.

---

*Result can be used with upgrade-web-scout evidence (when available) to build the final Top 10 + 30/60/90-day roadmap.*
