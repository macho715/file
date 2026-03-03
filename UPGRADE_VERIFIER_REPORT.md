# Upgrade Verifier Report — Deep2 Gate Review

**Project:** LOCAL-AUTOSORT (autosortd_1py)  
**Date:** 2026-03-03  
**Input:** AGENTS.md, UPGRADE_BEST3_DEEP_SYNTH.md, UPGRADE_TOP10_AND_ROADMAP.md  
**Scope:** Best 3 + Top 10 vs Non-Negotiables; Apply Gates; Test Matrix; Rollback Triggers

---

## 1) Best 3 & Top 10 — Go/No-Go vs AGENTS.md

| # | Idea | NO DELETE | NO RENAME dev | Ledger always | Quarantine | Temp stability | No secrets | **Go/No-Go** |
|---|------|-----------|---------------|---------------|------------|----------------|------------|--------------|
| 1 | requirements.txt 추가 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Go** |
| 2 | README → autosortd_1py.py | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Go** |
| 3 | 규칙 분류 테스트 1개 | ✓ | ✓ | ✓ | ✓ | ✓ (temp only) | ✓ | **Go** |
| 4 | health_check.ps1 문서화 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Go** |
| 5 | 버전/날짜 필드 정리 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Go** |
| 6 | Rollback 테스트 1개 | ✓ | ✓ | ✓ (ledger 기반) | ✓ | ✓ (temp/fixture) | ✓ | **Go** |
| 7 | Ruff CI 연동 | ✓ | ✓ | ✓ | ✓ | ✓ (no watch path) | ✓ | **Go** |
| 8 | CI 파이프라인 | ✓ | ✓ | ✓ | ✓ | **Gate:** temp만 사용 | ✓ | **Go** (gate 적용 시) |
| 9 | Ledger 집계 관측 | ✓ | ✓ | ✓ | ✓ | ✓ | **Gate:** 경로·내용·시크릿 무로그 | **AMBER → Go** (gate 적용 시) |
| 10 | autosortd.py 레거시 정책 | ✓ | ✓ (문서만) | ✓ | ✓ | ✓ | ✓ | **AMBER → Go** (삭제 없음 명시) |

**요약:** Best 3 전부 **Go**. Top 10 중 #8·#9는 **Apply Gates** 충족 시 Go, #10은 “문서만·삭제 승인 후” 준수 시 Go.

---

## 2) Apply Gates (머지 전 필수 조건)

| PR / 아이디어 | Gate 조건 | 검증 방법 |
|---------------|-----------|-----------|
| **PR-6, PR-7** (테스트) | 테스트가 실제 `C:\_AUTOSORT` 또는 사용자 watch 경로를 사용하지 않음. temp dir 또는 fixture만 사용. | CI 워크플로·테스트 코드에서 경로 하드코딩 검색; pytest가 temp 디렉터리만 쓰는지 확인 |
| **PR-9** (CI) | GitHub Actions가 `C:\_AUTOSORT` 또는 실제 inbox/watch 경로를 watch·접근하지 않음. pytest + ruff만 실행. | `.github/workflows/ci.yml`에 `working-directory`·watch 경로·실제 루트 경로 미사용 |
| **PR-10** (Ledger 집계) | 집계 결과에 **경로·파일명·파일 내용·API 키/토큰/credentials** 포함 금지. 건수, run_id, timestamp만 허용. | scripts/ledger_stats.py(또는 동일 기능) 출력·로깅 포맷 리뷰; AGENTS.md §0 No internal secrets 준수 |
| **PR-5, PR-11** (#10 레거시) | autosortd.py **삭제 금지** (정책 확정 전). 문서에 “미구현/대체됨”만 반영. 레포 내 코드 삭제는 별도 승인 후. | PR diff에 `autosortd.py` delete 없음; 문서 변경만 |

---

## 3) Test Matrix (PR별 필수·권장 테스트)

| PR | Unit | Integration | E2E/Smoke | Perf/Security | 비고 |
|----|------|-------------|-----------|---------------|------|
| PR-1 (requirements.txt) | — | `pip install -r requirements.txt && pytest tests/` 1회 | — | — | CI에서 검증 |
| PR-2, 3, 4, 5 (문서) | — | (선택) 링크/빌드 검사 | 수동: README 명령 복사 실행 | — | — |
| PR-6 (규칙 분류 테스트) | ext/keyword → doc_type assertion | (선택) rules.yaml 로드 후 동일 | — | 경로·내용 미로깅, temp 정리 | temp dir만 사용 |
| PR-7 (Rollback 테스트) | ledger 기반 after→before 이동 검증 | (선택) fixture ledger | — | temp/fixture만 사용 | ledger 스키마 유지 |
| PR-8 (Ruff) | — | `ruff check .` 성공 | — | — | — |
| PR-9 (CI) | — | pytest + ruff 워크플로 1회 성공 | — | 워크플로에 실제 watch 경로 없음 | Gate §2 적용 |
| PR-10 (Ledger 집계) | (선택) 집계 수식 단위 테스트 | 출력에 경로/시크릿 없음 검증 | — | 출력 샘플 리뷰 | Gate §2 적용 |
| PR-11, 12 | — | — | (선택) E2E smoke temp만 | — | — |

---

## 4) Rollback Triggers (언제 revert 할지)

| PR / 변경 | Rollback trigger | 조치 |
|-----------|------------------|------|
| PR-1 (requirements.txt) | `pip install -r requirements.txt` 실패 또는 기존 환경과 호환 깨짐 | requirements.txt 제거 또는 이전 버전으로 revert; 런타임 변경 없음 |
| PR-2–5 (문서) | README/ARCHITECTURE 오류로 실행 실패 또는 진입점 혼동 | 해당 문서 이전 커밋으로 revert |
| PR-6 (규칙 테스트) | 규칙 로직 변경 없이 테스트만 깨짐(flaky) 또는 실제 경로 사용 발견 | 테스트 수정 또는 `@pytest.mark.skip`; 실제 watch 경로 제거 |
| PR-7 (Rollback 테스트) | ledger 스키마 변경으로 테스트 실패; 또는 테스트가 사용자 데이터 접근 | fixture/스키마 정렬 또는 테스트 제거; temp/fixture만 사용 확인 |
| PR-8 (Ruff) | ruff가 기존 코드에 대해 오탐 또는 빌드 실패 | ruff 설정 완화 또는 revert |
| PR-9 (CI) | CI가 실제 C:\_AUTOSORT 또는 watch 경로 사용함이 발견됨 | 워크플로 수정 즉시; 필요 시 CI PR revert |
| PR-10 (Ledger 집계) | 집계 출력/로깅에 경로·내용·시크릿 포함됨 | 해당 스크립트/옵션 비활성화 또는 revert; No internal secrets 재검토 |
| PR-5, PR-11 (#10) | autosortd.py 삭제가 포함됨(정책 미확정) | 삭제 revert; 문서만 변경 유지 |

---

## 5) AMBER 정리

- **#9 Ledger 집계:** Gate 충족(경로·내용·시크릿 무로그) 시 **Go**. 구현 시 출력/로깅 포맷 리뷰 필수.
- **#10 autosortd.py:** “문서만, 삭제는 승인 후” 유지 시 **Go**. PR에서 파일 삭제 여부 체크.

---

*This report is the output of the upgrade-verifier (Deep2 Gate Review). Use with UPGRADE_BEST3_DEEP_SYNTH.md and UPGRADE_TOP10_AND_ROADMAP.md.*
