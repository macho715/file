# GATE 3 Evidence Template (copy/paste)

> 참고: email_search/dashboard PR1–PR9 검증용 체크리스트. 해당 프로젝트에서 수동 실행·기록 시 사용.

**Date/Time:** ________________  
**Tester:** ________________  
**Branch/Commit:** ________________  

---

## PR1 baseline behavior

- [ ] [search_policy.yaml] includes retrieval keys with defaults (retrieval_k, rrf_k, use_duckdb_fts).  
  **Expected:** file contains retrieval block and values load successfully.
- [ ] Search page loads without policy errors on start.  
  **Expected:** `streamlit run email_search/dashboard/app.py` starts and Search page renders.

## PR2 retrieval knobs in runtime

- [ ] Performed search with non-default policy values (e.g., retrieval_k: 300, rrf_k: 50).  
  **Input:** ________________  
  **Expected:** search returns results, no error.
- [ ] Verified no crash when policy keys absent (defaults still apply).  
  **Expected:** behavior unchanged.

## PR3 DuckDB FTS path + fallback

- [ ] With use_duckdb_fts: false (baseline DuckDB): query returns results.  
  **DB path:** ________________  
  **Expected:** successful search.
- [ ] With use_duckdb_fts: true: query returns results or clear no-crash fallback message if FTS index unavailable.  
  **Expected:** results or full-load fallback; no exception.
- [ ] Empty/invalid FTS conditions do not break search.  
  **Expected:** fallback to full-load path.

## PR4 debounce (explicit submit)

- [ ] Typing in query does not auto-run search until Search button clicked.  
  **Expected:** no repeated reload/search on each keystroke.
- [ ] Clicking Search triggers one search run.  
  **Expected:** results update once.

## PR5/PR6 suggestions

- [ ] Suggestions list appears (or safe empty state).  
  **Expected:** control exists and does not error on empty/first-load.
- [ ] Selecting a suggestion updates query input.  
  **Expected:** selected text appears in query field.
- [ ] Search executes successfully after suggestion selection.  
  **Expected:** query runs and returns results.

## PR7 zero-result relaxation + PR8 state

- [ ] Applied facet filters produce 0 results initially.  
  **Expected:** 0-result message shown.
- [ ] Relaxation attempt is attempted and recorded.  
  **Expected:** relaxation state appears in UI (chip / internal state note).

## PR9 relaxation chips + remove

- [ ] Relaxation chip is visible when relaxation applied.  
  **Expected:** chip label shows relaxed facet.
- [ ] Removing chip triggers rerun and strict filter behavior updates.  
  **Expected:** chip removed and result set changes accordingly.

## Regression smoke checks (AGENTS-aligned)

- [ ] `streamlit run email_search/dashboard/app.py`  
  **Expected:** app operational with Search page reachable.
- [ ] `python email_search/dashboard/scripts/run_full_export.py --excel <excel> --sheet "<sheet>" --out email_search/outputs/threads_smoke --query "LPO-1599"`  
  **Expected:** command exits cleanly and writes outputs.

---

## Summary / outcome

**Overall status:** [ ] PASS  [ ] FAIL  
**Notes / anomalies:** __________________________________________________________  
**Follow-up actions:** __________________________________________________________
