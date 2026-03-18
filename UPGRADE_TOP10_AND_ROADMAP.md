# Upgrade: Top 10 아이디어 + 30/60/90일 로드맵

**Project:** LOCAL-AUTOSORT (autosortd_1py)  
**Date:** 2026-03-02  
**Inputs:** UPGRADE_DOC_AUDIT_SUMMARY.md, UPGRADE_VERIFIER_RESULT.md  
**Evidence:** 문서 감사 + Verifier 결과. (백그라운드 upgrade-web-scout 트랜스크립트는 미저장 — 2025-06+ 외부 Evidence는 추후 보강)

---

## 1) Executive Summary

- Doc audit·Verifier 기준으로 **PASS한 Quick wins**과 **일반 업그레이드 후보**를 6개 버킷으로 묶고, Impact/Effort/Risk/Confidence로 우선순위 점수를 매겨 **Top 10**을 선정했다.
- **로드맵**은 30일(즉시 적용 가능·문서·의존성), 60일(테스트·CI), 90일(관측·정책 정리)으로 PR 단위 작업으로 쪼갰다.
- **Options A/B/C**는 보수(문서·의존성만) / 중간(+ 테스트·CI) / 공격(+ 관측·레거시 정리)으로 구분했다.

---

## 2) Top 10 Upgrade Ideas (Score 포함)

| # | Idea | Bucket | Impact | Effort | Risk | Conf | **Score** | Verifier |
|---|------|--------|-------:|-------:|-----:|-----:|----------:|----------|
| 1 | **requirements.txt 추가** (watchdog, requests, pyyaml, pytest) | DX/Tooling | 3 | 1 | 1 | 5 | **15.0** | PASS |
| 2 | **README 실행 예시 → autosortd_1py.py** (--root, --dry-run, --once) | Docs/Process | 3 | 1 | 1 | 5 | **15.0** | PASS |
| 3 | **규칙 분류 테스트 1개** (first_match_rule 또는 ext→doc_type, temp dir) | Reliability | 4 | 2 | 1 | 5 | **10.0** | PASS |
| 4 | **health_check.ps1 문서화** (README 또는 ARCHITECTURE 한 줄) | Docs/Process | 2 | 1 | 1 | 5 | **10.0** | PASS |
| 5 | **버전/날짜 필드 정리** (문서 내 2026-02/03 통일 또는 version 필드) | Docs/Process | 2 | 1 | 1 | 5 | **10.0** | — |
| 6 | **Rollback 테스트 1개** (after→before 이동, ledger 기반) | Reliability | 4 | 2 | 1 | 5 | **10.0** | PASS |
| 7 | **Ruff(또는 기존 린터) CI 연동** (린트만, 실제 watch 경로 미사용) | DX/Tooling | 3 | 2 | 1 | 5 | **7.5** | PASS |
| 8 | **CI 파이프라인 추가** (GitHub Actions 등: pytest + lint, temp dir만 사용) | Reliability | 4 | 3 | 2 | 4 | **2.7** | PASS |
| 9 | **Ledger 집계 관측** (건수/run_id/ts만, 경로·내용·시크릿 무로그) | Observability | 3 | 2 | 2 | 4 | **3.0** | AMBER |
| 10 | **autosortd.py 레거시 정책** (문서만: “미구현/대체됨” 고정, 삭제는 승인 후) | Docs/Process | 2 | 1 | 1 | 5 | **10.0** | AMBER |

**Score 식:** `PriorityScore = (Impact × Confidence) / (Effort × Risk)` (높을수록 우선)

---

## 3) Options A/B/C (보수 / 중간 / 공격)

| Option | 내용 | 예상 기간 | 리스크 |
|--------|------|-----------|--------|
| **A — 보수** | 1, 2, 4, 5, 10만 적용 (문서·requirements·레거시 문구 정리) | ~2주 | 낮음 |
| **B — 중간** | A + 3, 6, 7, 8 (테스트 2개, Ruff, CI 추가) | ~6주 | 중간 (CI에서 실제 경로 사용 금지 준수) |
| **C — 공격** | B + 9 (ledger 집계 관측, AMBER 조건 충족 시) | ~8주 | AMBER: 경로/내용/시크릿 로깅 금지 확인 필요 |

---

## 4) 30/60/90-day Roadmap (PR-sized tasks)

### 30일 (즉시·문서·의존성)

| Task | 설명 | 산출물 |
|------|------|--------|
| **PR-1** | `requirements.txt` 추가 (watchdog, requests, pyyaml, pytest) | requirements.txt |
| **PR-2** | README "빠른 실행"을 autosortd_1py.py 기준으로 수정 (--root, --dry-run, --once) | README.md |
| **PR-3** | ARCHITECTURE 또는 README에 health_check.ps1 한 줄 요약 | README.md 또는 ARCHITECTURE.md |
| **PR-4** | 문서 내 버전/날짜 정리 (선택: version 필드 또는 2026-03 통일) | LAYOUT.md 등 |
| **PR-5** | autosortd.py 레거시 문구 고정 (README/LAYOUT: “미구현, autosortd_1py로 대체”) | README.md, LAYOUT.md |

### 60일 (테스트·CI)

| Task | 설명 | 산출물 |
|------|------|--------|
| **PR-6** | 규칙 분류 단위 테스트 1개 (temp dir, first_match_rule 또는 ext→doc_type) | tests/test_rule_classify.py |
| **PR-7** | Rollback 단위 테스트 1개 (ledger 기반 after→before 이동) | tests/test_rollback.py |
| **PR-8** | Ruff(또는 기존 린터) 설정 + `ruff check .` 실행 가능하게 | pyproject.toml 또는 ruff.toml |
| **PR-9** | CI 추가 (GitHub Actions: pytest + ruff, 실제 C:\_AUTOSORT/watch 경로 미사용) | .github/workflows/ci.yml |

### 90일 (관측·정책)

| Task | 설명 | 산출물 |
|------|------|--------|
| **PR-10** | Ledger 집계(건수/run_id/ts)만 노출하는 스크립트 또는 dashboard 옵션 (AMBER 조건: 경로·내용·시크릿 무포함) | scripts/ledger_stats.py 또는 dashboard 옵션 |
| **PR-11** | autosortd.py 파일 유무·삭제/보관 정책 결정 후 문서 반영 | AGENTS.md 또는 LAYOUT.md |
| **PR-12** | E2E smoke를 CI에서 실행 (temp dir만 사용, 선택) | .github/workflows/ci.yml 확장 |

---

## 5) Evidence List

| # | Idea | Source | Date | Why relevant |
|---|------|--------|------|--------------|
| 1–10 | 전체 | UPGRADE_DOC_AUDIT_SUMMARY.md | 2026-03-02 | 현재 상태·Pain·Quick wins 도출 |
| 1–10 | PASS/AMBER | UPGRADE_VERIFIER_RESULT.md | 2026-03-02 | AGENTS.md Non-Negotiables 대비 검증 |
| — | 외부 2025-06+ | upgrade-web-scout (background) | — | **트랜스크립트 미저장** — Python watcher/llama.cpp/YAML/ledger/보안 인기글 추후 보강 시 Evidence 추가 권장 |

---

## 6) AMBER / Gaps

- **Observability (아이디어 9):** Ledger 집계 시 경로·파일 내용·API 키/토큰이 로그에 포함되지 않도록 설계 필요. 집계(건수, run_id, ts)만 허용.
- **autosortd.py (아이디어 10):** 코드베이스에 파일 존재 여부·삭제 여부는 정책 결정 후 처리. 삭제 시에도 “사용자 파일 삭제 금지”는 유지; 레포 내 코드 제거만 승인 필요.
- **CI (아이디어 8):** 워크플로우가 `C:\_AUTOSORT` 또는 실제 inbox를 watch하지 않도록 설정 검토. pytest는 temp 디렉터리만 사용.
- **웹 스카웃 Evidence:** 2025-06+ 외부 인기글·공식 문서 링크는 별도 수집 후 이 표에 추가하면 로드맵 신뢰도 상승.

---

*이 문서는 UPGRADE_DOC_AUDIT_SUMMARY.md, UPGRADE_VERIFIER_RESULT.md와 함께 project-upgrade Output Contract에 맞춰 작성되었습니다.*
