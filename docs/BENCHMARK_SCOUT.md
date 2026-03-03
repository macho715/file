# Plan Benchmark Scout — Baselines & Targets

**Project:** LOCAL-AUTOSORT (autosortd_1py)  
**Source:** IMPLEMENTATION_PLAN.md, UPGRADE_BEST3_DEEP_SYNTH.md, UPGRADE_VERIFIER_REPORT.md, AGENTS.md  
**Date:** 2026-03-03

---

## 1) Baselines to Capture Now (PRs 전)

| Metric | How to capture | Command / location | Note |
|--------|----------------|---------------------|------|
| **pytest duration** | Run once, record wall time | `pytest tests/ -v --tb=short` (or `tests/test_ledger_smoke.py` only if full suite not present) | Baseline for “tests &lt; 5min” (Best3). |
| **pip install time** | Fresh venv, time install of current deps | `python -m venv .venv && .venv\Scripts\activate && pip install watchdog requests pyyaml pytest` (or current set), record seconds | Baseline for “CI install +30s 이내” (Best3). |
| **Test count** | Number of tests collected | `pytest tests/ --collect-only -q` → count lines | Track growth after PR-6, PR-7. |
| **Ledger write (optional)** | If running daemon: moves per run | From ledger.jsonl line count per run_id (no path/content in log) | AGENTS.md: ledger always; no secrets in logs. |

**Where to store:** `docs/BASELINE.md` (same repo) with a small table, e.g.:

```markdown
| Metric | Value | Date | Command |
|--------|-------|------|---------|
| pytest (s) | — | YYYY-MM-DD | pytest tests/ -v |
| pip install (s) | — | YYYY-MM-DD | pip install ... |
| test count | — | YYYY-MM-DD | pytest --collect-only -q |
```

No JSON/tooling required; file-based only.

---

## 2) Benchmarks to Track per Phase

| Phase | PRs | Metrics | Target (from Best3 / Verifier) |
|-------|-----|---------|--------------------------------|
| **30일** | PR-1..PR-5 | pip install 1회 성공; README 명령 1회 성공 | 재현 가능 설치; no autosortd.py delete |
| **60일** | PR-6..PR-9 | pytest duration; test count; ruff check time; CI job duration | Tests &lt; 5min; CI 의존성 설치 기존 대비 +30s 이내; CI uses temp only (no real watch path) |
| **90일** | PR-10..PR-12 | Ledger 집계 출력 포맷; E2E smoke (if any) | 출력에 경로·내용·시크릿 없음; E2E temp only |

**Per-PR checks (from Verifier Test matrix):**

- **PR-1:** Integration: `pip install -r requirements.txt && pytest tests/` 1회 성공.
- **PR-6, PR-7:** Unit/integration; assert temp dir only, no path/content in logs.
- **PR-9:** CI workflow 1회 성공; workflow does not reference C:\_AUTOSORT or real watch path.
- **PR-10:** Output review: only counts, run_id, timestamp.

---

## 3) Where to Store Baselines

| Artifact | Location | Format |
|----------|----------|--------|
| **Baseline snapshot** | `file-claude-project-upgrade-VsJEE/docs/BASELINE.md` (or repo root `docs/BASELINE.md`) | Markdown table (metric, value, date, command) |
| **Benchmark targets** | This file (`docs/BENCHMARK_SCOUT.md`) or IMPLEMENTATION_PLAN.md | Already in plan; update BASELINE.md when measuring |

No extra tooling; keep it minimal.

---

## 4) Optional External References

- **pytest timing:** `pytest -v --durations=10` for slowest 10 tests (pytest 6.0+). [pytest docs — duration](https://docs.pytest.org/en/stable/reference/reference.html#cmdoption-pytest-durations).
- **GitHub Actions:** Keep workflows free of secrets and real paths; use temp dirs for test data. [GitHub Actions best practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) (secrets, paths).

*(Use as needed; no obligation to add more.)*

---

*Refs: IMPLEMENTATION_PLAN.md, UPGRADE_BEST3_DEEP_SYNTH.md, UPGRADE_VERIFIER_REPORT.md, AGENTS.md*
