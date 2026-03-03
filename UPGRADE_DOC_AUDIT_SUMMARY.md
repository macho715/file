# Upgrade Doc Audit — Current State Snapshot

**Project:** LOCAL-AUTOSORT (autosortd_1py)  
**Date:** 2026-03-02  
**Purpose:** Repo document sweep for project-upgrade workflow; input to upgrade-verifier and roadmap.

---

## 1) Executive Summary

- **LOCAL-AUTOSORT** is a local folder watcher that classifies files (rules 90% + optional LLM 10%), moves them into a fixed SSOT tree, and writes every move to a ledger (no delete, no rename for dev assets).
- **Single entrypoint:** `autosortd_1py.py` (Watchdog, LLM, staging, dup, cache; `--once` / `--dry-run`). Rules: `rules.yaml` + `mapping.yaml` under `C:\_AUTOSORT`. Deploy: Task Scheduler (LLAMA_SERVER + AUTOSORTD PT30S) + `RUN_AUTOSORTD.cmd`.
- **Stack:** Python 3.x, watchdog, requests, PyYAML; WSL2 llama.cpp or Ollama for LLM. No formal CI; one pytest smoke test (ledger keys). Observability: ledger.jsonl, runner log, health_check.ps1.
- **Pain points:** README still shows `autosortd.py` for dry-run (legacy); no `requirements.txt`; no CI; single smoke test; LLM dependency (WSL/Ollama) is operational risk.
- **Quick wins:** Add `requirements.txt`; align README run examples with `autosortd_1py.py`; add 1–2 tests (rule classification, rollback); document health_check in README/ARCHITECTURE.

---

## 2) Current State Snapshot (Table)

| 영역 | 현재 상태 | 비고 |
|------|-----------|------|
| **Stack** | Python 3.x, watchdog, requests, PyYAML (optional pydantic/rapidfuzz in INSTALL_NEXT) | Single main script: autosortd_1py.py |
| **Deployment** | Windows Task Scheduler (`\AUTOSORT\LLAMA_SERVER`, `\AUTOSORT\AUTOSORTD` PT30S); RUN_AUTOSORTD.cmd + lock; C:\_AUTOSORT tree | No container/CI |
| **CI** | 없음 | No GitHub Actions / pipeline |
| **Tests** | pytest 1개: tests/test_ledger_smoke.py (ledger 필수 키 검증) | 단위/회귀 테스트 미비 |
| **Observability** | logs/ledger.jsonl, logs/autosortd_runner.log, health_check.ps1 (RC 0/1/2) | 메트릭/대시보드 없음 |
| **Security** | 로컬만; watch allowlist; AGENTS.md no-secrets; PII 최소(스니펫) | Denylist 문서화됨 |
| **Pain points** | README autosortd.py 레거시 언급, requirements.txt 부재, CI 없음, 테스트 적음, LLM 의존성 | |
| **Quick wins** | requirements.txt, README 실행 예시 정리, 테스트 1–2개 추가, health_check 문서화 | |

---

## 3) Pain Points (Bullets)

- README "빠른 실행"에 `autosortd.py --watch ... --dry-run` 예시가 있음 → 실제 진입점은 autosortd_1py.py (레거시 문구 잔존).
- **requirements.txt** 없음 → 설치 재현성·CI 연동 어려움.
- **CI 없음** → PR 시 자동 테스트/린트 없음.
- **테스트**는 ledger smoke 1개뿐 → 규칙 분류·rollback·안정성 검증 부족.
- **LLM** 의존성(WSL llama / Ollama) → 서버 미기동 시 문서 분류 실패·quarantine 증가 가능(문서화됨).

---

## 4) Quick Wins (Bullets)

- **requirements.txt** 작성 (watchdog, requests, pyyaml, pytest).
- README 실행 예시를 `autosortd_1py.py --root ... --dry-run` / `--once` 기준으로 통일.
- **테스트 추가:** 규칙 분류 1건 (first_match_rule 또는 확장자→doc_type), rollback 1건 (after→before 이동).
- **health_check.ps1** 역할을 README 또는 ARCHITECTURE에 한 줄 요약 추가.

---

## 5) AMBER / Gaps

- **autosortd.py** 존재 여부·역할: LAYOUT/README에 "메인 실행 스크립트 (run_once)"로 남아 있음. ARCHITECTURE는 "미구현(레거시)"로 정리됨 → 코드베이스에 autosortd.py 파일 있는지 및 삭제/유지 정책 확인 필요.
- **날짜/버전:** 문서에 2026-02, 2026-03 등 혼재; 공식 "버전" 필드 없음.
- **Evidence list:** upgrade-web-scout(background) 결과와 합쳐서 Top 10 아이디어·Evidence는 별도 산출 예정.

---

*This file is read-only output from the document sweep. Use it as input to upgrade-verifier and synthesis.*
