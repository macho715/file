# Baseline Metrics (capture before PRs)

**Purpose:** Snapshot for IMPLEMENTATION_PLAN benchmarks. See docs/BENCHMARK_SCOUT.md for targets.

| Metric | Value | Date | Command / note |
|--------|-------|------|-----------------|
| pytest (s) | | | `pytest tests/ -v --tb=short` |
| pip install (s) | | | Fresh venv, install current deps |
| test count | | | `pytest tests/ --collect-only -q` |
| ledger (optional) | | | Moves per run_id (no path in log) |

Update this table when capturing baselines; re-measure after 60-day phase (PR-9) to compare.
