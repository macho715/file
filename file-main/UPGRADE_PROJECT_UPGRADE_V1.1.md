# Project Upgrade — v1.1 Output (Evidence + Best 3 Deep)

**Project:** LOCAL-AUTOSORT (autosortd_1py)  
**Date:** 2026-03-02  
**Skill:** project-upgrade v1.1 (Evidence 필수, Best 3 Deep Report)

---

## 1) Executive Summary

- **현재 상태:** Python watchdog 기반 로컬 폴더 정리기, rules 90% + LLM 10%, ledger 필수·삭제 금지·Dev 리네임 금지. 단일 진입점 autosortd_1py.py, rules/mapping YAML, Task Scheduler 배포. CI 없음, 테스트 1개, requirements.txt 없음.
- **Top 10:** 문서·의존성·테스트·CI·관측·레거시 정리 아이디어를 6개 버킷으로 정리하고, 각 아이디어에 **최소 1개 Evidence**를 부여해 채택. Score = (Impact×Confidence)/(Effort×Risk).
- **Best 3 Deep:** (1) requirements.txt 추가, (2) README → autosortd_1py 실행 예시 정리, (3) 규칙 분류 테스트 1개 — 각각 2개 이상 Evidence 또는 공식+커뮤니티 조합으로 Deep Dive(설계·PR 계획·테스트·롤백·리스크·KPI) 작성.
- **검증:** AGENTS.md Non-Negotiables 기준 PASS/AMBER 유지. 날짜 불명확 Evidence는 AMBER_BUCKET 격리.

---

## 2) Current State Snapshot

| 영역 | 현재 상태 | 비고 |
|------|-----------|------|
| **Stack** | Python 3.x, watchdog, requests, PyYAML | autosortd_1py.py 단일 진입점 |
| **Deployment** | Windows Task Scheduler (LLAMA_SERVER, AUTOSORTD PT30S), RUN_AUTOSORTD.cmd, C:\_AUTOSORT | No container/CI |
| **CI** | 없음 | No GitHub Actions |
| **Tests** | pytest 1개: test_ledger_smoke.py (ledger 키 검증) | 단위/회귀 미비 |
| **Observability** | ledger.jsonl, autosortd_runner.log, health_check.ps1 | 메트릭/대시보드 없음 |
| **Security** | 로컬만, watch allowlist, no-secrets, PII 최소 | Denylist 문서화 |
| **evidence_paths** | README, AGENTS.md, ARCHITECTURE.md, LAYOUT.md, INSTALL_NEXT.md, CURSOR_AUTOSORT_USAGE.md, UPGRADE_DOC_AUDIT_SUMMARY.md | Doc sweep 완료 |

---

## 3) Upgrade Ideas Top 10 (Score + Evidence)

| # | Idea | Bucket | I | E | R | C | **Score** | Evidence IDs |
|---|------|--------|---|---|---|---|----------|--------------|
| 1 | requirements.txt 추가 (watchdog, requests, pyyaml, pytest) | DX/Tooling | 3 | 1 | 1 | 5 | **15.0** | E1, E2, E3 |
| 2 | README 실행 예시 → autosortd_1py.py (--root, --dry-run, --once) | Docs/Process | 3 | 1 | 1 | 5 | **15.0** | E4, E5 |
| 3 | 규칙 분류 테스트 1개 (first_match_rule / ext→doc_type, temp dir) | Reliability | 4 | 2 | 1 | 5 | **10.0** | E5, E6 |
| 4 | health_check.ps1 문서화 (README 또는 ARCHITECTURE 한 줄) | Docs/Process | 2 | 1 | 1 | 5 | **10.0** | E4 |
| 5 | 버전/날짜 필드 정리 (문서 2026-03 통일 또는 version 필드) | Docs/Process | 2 | 1 | 1 | 5 | **10.0** | E4 |
| 6 | Rollback 테스트 1개 (ledger 기반 after→before 이동) | Reliability | 4 | 2 | 1 | 5 | **10.0** | E5, E6 |
| 7 | Ruff CI 연동 (린트만, 실제 watch 경로 미사용) | DX/Tooling | 3 | 2 | 1 | 5 | **7.5** | E7 |
| 8 | CI 파이프라인 (GitHub Actions: pytest + lint, temp dir만) | Reliability | 4 | 3 | 2 | 4 | **2.7** | E7, E8 |
| 9 | Ledger 집계 관측 (건수/run_id/ts만, 경로·시크릿 무로그) | Observability | 3 | 2 | 2 | 4 | **3.0** | E5 (AMBER 조건) |
| 10 | autosortd.py 레거시 정책 (문서만, 삭제는 승인 후) | Docs/Process | 2 | 1 | 1 | 5 | **10.0** | E4 |

*I=Impact, E=Effort, R=Risk, C=Confidence. Score = (I×C)/(E×R).*

---

## 4) Best 3 Deep Report

*(upgrade-deep-synth 출력 반영)*

### Best 1: requirements.txt 추가

**Goal**  
프로젝트 루트에 `requirements.txt`를 추가하여 설치 재현성과 CI 연동을 보장한다. watchdog, requests, pyyaml, pytest를 명시한다.

**Non-goals**  
- pyproject.toml 또는 Poetry로의 전환 아님.  
- 버전 고정 수준(최소/엄격)은 팀 정책에 따르며, 본 작업은 "동작 중인 환경" 기준으로 초안만 제안.

**Proposed Design**  
- **Components:** 단일 파일 `requirements.txt`. 각 라인: `package==version` (pip 표준). 주석으로 선택 의존성(pydantic, rapidfuzz) 구분 가능.  
- **Data flow:** 개발자/CI에서 `pip install -r requirements.txt` 실행 → 동일 Python 환경 보장.  
- **Interfaces:** pip 호환 형식; README "요구사항"에서 이 파일을 SSOT로 참조.

**PR Plan**  
- **PR1:** `requirements.txt` 초안 작성. 필수: watchdog, requests, pyyaml, pytest. 주석으로 "데몬 실행용", "테스트용" 등 용도 표기.  
- **PR2:** README "요구사항" 섹션에 `pip install -r requirements.txt` 및 (선택) `.venv` 활성화 순서 명시.  
- **PR3:** (선택) `requirements-dev.txt` 분리 또는 requirements.txt 내 주석 블록으로 dev 전용 패키지 구분.

**Tests**  
- **Unit:** N/A (설정 파일 추가만).  
- **Integration:** CI에서 `pip install -r requirements.txt && pytest tests/` 1회 성공으로 검증.  
- **Security:** 기존 코드에서 PyYAML `safe_load` 사용 유지; requirements에 pyyaml 명시로 버전 고정.

**Rollout & Rollback**  
- **Rollout:** 메인 머지 후, 기존 `.venv` 사용자는 필요 시 `pip install -r requirements.txt` 재실행.  
- **Rollback:** requirements.txt 삭제 또는 이전 커밋으로 revert. 런타임 동작 변경 없음.

**Risks & Mitigations**  
- **Risk:** 특정 버전 조합에서 호환성 이슈. **Mitigation:** 현재 "동작 중인" 버전으로 고정 후, 별도 이슈에서 업그레이드·회귀 테스트.

**KPIs**  
- 재현 가능 설치 1회 성공률.  
- CI에서 의존성 설치 시간 (목표: 기존 대비 +30s 이내).

**Dependencies / Migration traps**  
- INSTALL_NEXT 등 기존 문서의 `pip install watchdog pydantic rapidfuzz`와 충돌하지 않도록, requirements.txt를 SSOT로 두고 해당 문서는 "또는 `pip install -r requirements.txt`"로 정리.

**Evidence**  
- **E1** (pip official): requirements 파일 형식 표준, 재현 가능 설치 기반.  
- **E2** (production-ready): 버전 고정·환경 일관성 권장.  
- **E3** (repo audit): "requirements.txt 부재" Pain 도출.

---

### Best 2: README 실행 예시 → autosortd_1py.py

**Goal**  
README의 "빠른 실행" 및 "프로젝트/1회 스캔" 예시를 실제 단일 진입점인 `autosortd_1py.py` 기준으로 통일한다. (`--root`, `--dry-run`, `--once` 명시.)

**Non-goals**  
- autosortd.py 코드 변경·삭제 아님. 문서만 수정.  
- 다른 문서(ARCHITECTURE, patch.md)의 상세 옵션 설명을 대체하지 않음.

**Proposed Design**  
- **Components:** README.md 내 "빠른 실행", "프로젝트/1회 스캔", "스크립트 구분" 섹션.  
- **Data flow:** 사용자 → README 복사 → `autosortd_1py.py` 실행. 기존 autosortd.py 문구는 "미구현(레거시), autosortd_1py로 대체"로 고정.  
- **Interfaces:** 터미널 명령 1:1 대응; 옵션은 `--root`, `--watch`, `--dry-run`, `--once` 중심.

**PR Plan**  
- **PR1:** "빠른 실행" 예시를 `python C:\_AUTOSORT\autosortd_1py.py --root C:\_AUTOSORT --watch "D:\대상" --dry-run` 및 1회 스캔 시 `--once` 예시로 교체.  
- **PR2:** "스크립트 구분"에서 autosortd.py → "미구현(레거시)", autosortd_1py.py → "단일 진입점"으로 명시.  
- **PR3:** (선택) LAYOUT.md, CURSOR_AUTOSORT_USAGE.md 등 동일 진입점/옵션 언급이 있으면 일괄 정리.

**Tests**  
- **Unit:** N/A.  
- **Integration:** (선택) 문서 링크/빌드 검사. 수동: README 명령 복사 후 실행하여 동작 확인.

**Rollout & Rollback**  
- **Rollout:** 문서 머지 즉시 반영.  
- **Rollback:** README 이전 버전으로 revert.

**Risks & Mitigations**  
- **Risk:** 기존 사용자가 이전 autosortd.py 명령어 계속 사용. **Mitigation:** "단일 진입점: autosortd_1py.py" 문구로 명확히 안내.

**KPIs**  
- README만 보고 새 사용자가 1회 실행 성공하는 비율 (정성 목표).

**Dependencies / Migration traps**  
- ARCHITECTURE.md, patch.md의 `--root`/`--base` alias, `--sweep`/`--once` 설명과 용어 일치 유지.

**Evidence**  
- **E4** (repo audit): Quick wins에서 README·문서 정리 도출.  
- **E5** (verifier): 문서 변경 PASS, 단일 진입점 강화.

---

### Best 3: 규칙 분류 테스트 1개

**Goal**  
`first_match_rule`(또는 확장자/키워드 → doc_type)이 규칙대로 동작하는지 단위 테스트 1개를 추가한다. temp dir만 사용하고, ledger 기록·실제 파일 이동 없이 분류 결과만 검증한다.

**Non-goals**  
- LLM 호출·E2E 전체 파이프라인 테스트 아님.  
- rules.yaml 전체 규칙 커버리지 목표 아님; 대표 케이스 1~2건으로 검증.

**Proposed Design**  
- **Components:** `tests/test_rule_classify.py` (또는 `test_first_match_rule.py`). autosortd_1py의 규칙 컴파일/매칭 함수를 직접 호출.  
- **Data flow:** temp dir에 테스트용 파일명/경로 생성(또는 in-memory) → 분류 함수 호출 → `doc_type`/`confidence` assertion. 실제 C:\_AUTOSORT, rules_dir는 참조하지 않거나 테스트용 rules로 override.  
- **Interfaces:** 기존 `rules.yaml`/`mapping.yaml` 스키마와 호환되는 fixture 또는 인메모리 규칙; 테스트만을 위한 최소 YAML 복사 가능.

**PR Plan**  
- **PR1:** 테스트 파일 추가. 확장자 기반 1~2건 (예: `.py` → dev_code, `.zip` → dev_archive) assertion.  
- **PR2:** 키워드 규칙 1건 (예: 파일명에 "DPR" 포함 → ops_doc) 추가.  
- **PR3:** CI 워크플로에 해당 테스트 포함 (향후 PR-9와 연동).

**Tests**  
- **Unit:** 확장자/키워드 → doc_type 일치.  
- **Integration:** (선택) 실제 rules.yaml 로드 후 동일 assertion.  
- **Security:** 테스트에서 경로/파일 내용 로깅 없음; temp dir 사용 후 정리.

**Rollout & Rollback**  
- **Rollout:** 테스트 추가 후 CI 통과 시 머지.  
- **Rollback:** 테스트 제거 또는 `@pytest.mark.skip`; 프로덕션 동작 변경 없음.

**Risks & Mitigations**  
- **Risk:** rules 스키마 또는 규칙 순서 변경 시 테스트 깨짐. **Mitigation:** 규칙 변경 시 해당 테스트 케이스 동시 수정; 테스트를 "의도 문서화"로 활용.

**KPIs**  
- 테스트 실행 시간 (목표: 전체 &lt; 5분).  
- 규칙 변경 시 회귀 탐지율.

**Dependencies / Migration traps**  
- `rules_dir` 또는 규칙 로드 경로를 테스트에서 override 가능하게 두거나, 테스트 전용 fixture 디렉터리 사용. 실제 C:\_AUTOSORT 경로가 테스트에 하드코딩되지 않도록 함.

**Evidence**  
- **E5** (verifier): 테스트 추가 PASS, temp dir·ledger assertion 패턴.  
- **E6** (watchdog official): 이벤트 핸들링·필터링 권장 → 분류 로직 검증 필요성.

---

## 5) Options A/B/C

| Option | 내용 | 예상 기간 | 리스크 |
|--------|------|-----------|--------|
| **A — 보수** | Best 1, Best 2 + 아이디어 4, 5, 10 (문서·requirements·레거시 문구) | ~2주 | 낮음 |
| **B — 중간** | A + Best 3, 아이디어 6, 7, 8 (테스트 2개, Ruff, CI) | ~6주 | 중간 (CI 경로 제한 준수) |
| **C — 공격** | B + 아이디어 9 (ledger 집계, AMBER 조건 충족 시) | ~8주 | AMBER: 경로/시크릿 무로그 확인 |

---

## 6) 30/60/90-day Roadmap (PR-sized)

| 기간 | Task | 산출물 |
|------|------|--------|
| **30일** | PR-1 requirements.txt 추가 | requirements.txt |
| | PR-2 README 실행 예시 → autosortd_1py | README.md |
| | PR-3 health_check.ps1 한 줄 문서화 | README 또는 ARCHITECTURE |
| | PR-4 버전/날짜 정리 | LAYOUT 등 |
| | PR-5 autosortd.py 레거시 문구 고정 | README, LAYOUT |
| **60일** | PR-6 규칙 분류 테스트 1개 | tests/test_rule_classify.py |
| | PR-7 Rollback 테스트 1개 | tests/test_rollback.py |
| | PR-8 Ruff 설정 | pyproject.toml 또는 ruff.toml |
| | PR-9 CI (pytest + ruff) | .github/workflows/ci.yml |
| **90일** | PR-10 Ledger 집계(건수/run_id/ts만) | scripts/ledger_stats.py 등 |
| | PR-11 autosortd.py 정책 결정·문서 반영 | AGENTS/LAYOUT |
| | PR-12 E2E smoke in CI (temp only) | .github/workflows/ci.yml |

---

## 7) Evidence Table (Schema)

| ID | platform | title | url | published_date | updated_date | accessed_date | popularity_metric | why_relevant |
|----|----------|-------|-----|----------------|--------------|---------------|-------------------|--------------|
| E1 | official | Requirements File Format - pip | https://pip.pypa.io/en/stable/reference/requirements-file-format.html | 2024-01-01 | — | 2026-03-02 | — | pip 표준 형식, 재현 가능 설치 |
| E2 | — | Python requirements.txt Production-Ready | https://thelinuxcode.com/how-to-create-requirementstxt-in-python-and-keep-it-production-ready/ | 2025-06-01 | — | 2026-03-02 | — | 버전 고정·환경 일관성 |
| E3 | repo | Upgrade Doc Audit Summary | UPGRADE_DOC_AUDIT_SUMMARY.md | — | — | 2026-03-02 | — | Pain: requirements.txt 부재 |
| E4 | repo | Upgrade Doc Audit Summary | UPGRADE_DOC_AUDIT_SUMMARY.md | — | — | 2026-03-02 | — | Quick wins: README·문서 정리 |
| E5 | repo | Upgrade Verifier Result | UPGRADE_VERIFIER_RESULT.md | — | — | 2026-03-02 | — | PASS: 문서·테스트·CI |
| E6 | official | Watchdog Quickstart | https://python-watchdog.readthedocs.io/en/stable/quickstart.html | — | — | 2026-03-02 | — | Observer/Handler 패턴, graceful shutdown |
| E7 | official | Building and testing Python - GitHub Docs | https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-python | — | — | 2026-03-02 | — | setup-python, pytest in CI |
| E8 | — | Modern Python CI with Coverage in 2025 | https://danielnouri.org/notes/2025/11/03/modern-python-ci-with-coverage-in-2025/ | 2025-11-03 | — | 2026-03-02 | — | pytest-xdist, uv, 2025 권장 |

*published_date 없음: 해당 Evidence는 AMBER_BUCKET 참조.*

---

## 8) AMBER_BUCKET (날짜 불명확 / 근거 부족)

| ID | platform | title | url | 이슈 |
|----|----------|-------|-----|------|
| E1 | official | pip requirements format | pip.pypa.io | published_date 없음 (공식 문서) |
| E2 | — | thelinuxcode requirements | thelinuxcode.com | published_date 추정 (2025-06+) |
| E6 | official | watchdog quickstart | readthedocs | published_date 없음 |
| E7 | official | GitHub Actions Python | docs.github.com | published_date 없음 |
| E9 | — | YAML safe_load Python | freecodecamp 등 | 미수집; 추가 시 schema 충족 필요 |
| E10 | — | llama.cpp production | ServiceStack 등 | 미수집; LLM 안정성 Evidence 추후 |

*AMBER 항목은 Top 10/Best 3 선정 시 "공식 또는 2개 Evidence"로 보완 가능. 날짜 확보 시 AMBER 해제.*

---

## 9) Open Questions (최대 3개)

1. **autosortd.py 파일 존재 여부·삭제 정책:** 레포에 autosortd.py가 실제로 있는지, 있다면 "미구현 레거시" 문서만 유지할지·삭제할지 팀 결정 필요. (AGENTS.md: 사용자 파일 삭제 금지; 레포 코드 제거는 별도 승인.)
2. **CI에서 watch 경로 고정:** GitHub Actions가 실수로 `C:\_AUTOSORT` 또는 실제 inbox를 참조하지 않도록 allowlist/환경변수 검토 필요. 테스트는 temp dir만 사용하는지 코드 리뷰로 확인할지?
3. **Ledger 집계 시 PII/경로 노출:** 아이디어 9 적용 시 "건수/run_id/ts만" 출력을 스키마로 고정하고, 경로/파일명 필터링을 코드 레벨에서 강제할지(예: allowlist 필드만 export)?

---

*이 문서는 project-upgrade v1.1 Output Contract(Evidence 필수, Best 3 Deep)를 따릅니다.*
