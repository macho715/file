# Implementation Plan — LOCAL-AUTOSORT Upgrade

**Source:** UPGRADE_TOP10_AND_ROADMAP.md, UPGRADE_BEST3_DEEP_SYNTH.md, UPGRADE_VERIFIER_REPORT.md, AGENTS.md  
**Date:** 2026-03-03  
**Constraints:** AGENTS.md Non-Negotiables (NO DELETE, NO RENAME dev, Ledger always, No secrets). Apply Gates from Verifier Report must hold before merge where noted.

---

## 30일 (즉시·문서·의존성)

- [ ] **PR-1: requirements.txt 추가**
  - **Goal:** 설치 재현성·CI 연동. watchdog, requests, pyyaml, pytest 명시.
  - **Deliverable:** `requirements.txt` (주석으로 용도 표기 가능).
  - **Acceptance:** `pip install -r requirements.txt && pytest tests/` 1회 성공.
  - **Gate:** 없음.

- [ ] **PR-2: README 실행 예시 → autosortd_1py.py**
  - **Goal:** "빠른 실행"/1회 스캔을 autosortd_1py.py 기준으로 통일 (--root, --dry-run, --once).
  - **Deliverable:** README.md 수정.
  - **Acceptance:** README 명령 복사 후 실행 시 동작; "단일 진입점: autosortd_1py.py" 명시.
  - **Gate:** 없음.

- [ ] **PR-3: health_check.ps1 문서화**
  - **Goal:** README 또는 ARCHITECTURE에 health_check.ps1 한 줄 요약.
  - **Deliverable:** README.md 또는 ARCHITECTURE.md.
  - **Acceptance:** 검색 가능한 한 줄 설명 존재.
  - **Gate:** 없음.

- [ ] **PR-4: 버전/날짜 필드 정리**
  - **Goal:** 문서 내 2026-02/03 또는 version 필드 통일.
  - **Deliverable:** LAYOUT.md 등 해당 문서.
  - **Acceptance:** 버전/날짜 일관성.
  - **Gate:** 없음.

- [ ] **PR-5: autosortd.py 레거시 문구 고정**
  - **Goal:** "미구현, autosortd_1py로 대체" 문서 반영. **파일 삭제 금지.**
  - **Deliverable:** README.md, LAYOUT.md (문서만).
  - **Acceptance:** PR diff에 autosortd.py 삭제 없음; 문서만 변경.
  - **Gate:** Verifier — autosortd.py 삭제 없음. 레포 내 코드 삭제는 별도 승인 후.

---

## 60일 (테스트·CI)

- [ ] **PR-6: 규칙 분류 단위 테스트 1개**
  - **Goal:** first_match_rule / ext→doc_type 검증. temp dir만 사용.
  - **Deliverable:** `tests/test_rule_classify.py` (또는 동일 목적 파일).
  - **Acceptance:** 확장자/키워드 → doc_type assertion; pytest 통과; **실제 C:\_AUTOSORT/watch 경로 미사용.**
  - **Gate:** Verifier — 테스트가 temp dir 또는 fixture만 사용. 경로 하드코딩 검색으로 확인.

- [ ] **PR-7: Rollback 단위 테스트 1개**
  - **Goal:** ledger 기반 after→before 이동 검증.
  - **Deliverable:** `tests/test_rollback.py` (또는 동일 목적 파일).
  - **Acceptance:** fixture/temp ledger로 검증; **temp/fixture만 사용.**
  - **Gate:** Verifier — 실제 사용자 경로·데이터 미접근.

- [ ] **PR-8: Ruff 설정 + 실행**
  - **Goal:** `ruff check .` 실행 가능.
  - **Deliverable:** pyproject.toml 또는 ruff.toml.
  - **Acceptance:** `ruff check .` 성공.
  - **Gate:** 없음.

- [ ] **PR-9: CI 파이프라인 추가**
  - **Goal:** GitHub Actions에서 pytest + ruff 실행. **실제 watch 경로 미사용.**
  - **Deliverable:** `.github/workflows/ci.yml`.
  - **Acceptance:** 워크플로 1회 성공; working-directory·watch 경로에 C:\_AUTOSORT/실제 inbox 없음.
  - **Gate:** Verifier — CI가 temp만 사용; 실제 watch 경로 접근 금지.

---

## 90일 (관측·정책)

- [ ] **PR-10: Ledger 집계 (건수/run_id/ts만)**
  - **Goal:** 집계 스크립트 또는 dashboard 옵션. **경로·파일 내용·API 키/시크릿 무포함.**
  - **Deliverable:** scripts/ledger_stats.py 또는 동일 기능.
  - **Acceptance:** 출력에 건수, run_id, timestamp만; 경로·내용·시크릿 없음.
  - **Gate:** Verifier — No internal secrets. 출력/로깅 포맷 리뷰 필수.

- [ ] **PR-11: autosortd.py 정책 결정 후 문서 반영**
  - **Goal:** 유무·삭제/보관 정책 결정 → AGENTS.md 또는 LAYOUT.md 반영. **삭제는 승인 후만.**
  - **Deliverable:** 문서 업데이트.
  - **Acceptance:** PR에 autosortd.py 삭제 없음(정책 확정 전).
  - **Gate:** Verifier — 삭제 없음 명시.

- [ ] **PR-12: (선택) E2E smoke CI**
  - **Goal:** CI에서 E2E smoke 실행. temp dir만 사용.
  - **Deliverable:** .github/workflows/ci.yml 확장.
  - **Acceptance:** smoke 통과; 실제 watch 경로 미사용.
  - **Gate:** Verifier — temp만 사용.

---

## 적용 전 체크리스트 (모든 PR)

1. **AGENTS.md 준수:** 0 deletions of user files; no rename for dev assets; ledger/quarantine/temp 규칙 유지; no secrets in logs/output.
2. **Apply Gates:** PR-5, PR-6, PR-7, PR-9, PR-10, PR-11에서 위 Gate 조건 충족.
3. **Rollback:** UPGRADE_VERIFIER_REPORT.md §4 Rollback Triggers에 따라 문제 시 revert 경로 확보.

---

*Refs: UPGRADE_TOP10_AND_ROADMAP.md, UPGRADE_BEST3_DEEP_SYNTH.md, UPGRADE_VERIFIER_REPORT.md, AGENTS.md*
