# Best 3 Deep Report (upgrade-deep-synth)

**Project:** LOCAL-AUTOSORT (autosortd_1py)  
**Input:** Current State Snapshot + Top 10 (Score + Evidence) + Evidence Table  
**Gate:** Best 3 = #1, #2, #3 by score, each with ≥2 Evidence.  
**Date:** 2026-03-02

---

## Best 1: requirements.txt 추가

**Goal**  
프로젝트 루트에 `requirements.txt`를 추가하여 설치 재현성과 CI 연동을 보장한다. watchdog, requests, pyyaml, pytest를 명시한다.

**Non-goals**  
- pyproject.toml 또는 Poetry로의 전환 아님.  
- 버전 고정 수준(최소/엄격)은 팀 정책에 따르며, 본 작업은 “동작 중인 환경” 기준으로 초안만 제안.

**Proposed Design**  
- **Components:** 단일 파일 `requirements.txt`. 각 라인: `package==version` (pip 표준). 주석으로 선택 의존성(pydantic, rapidfuzz) 구분 가능.  
- **Data flow:** 개발자/CI에서 `pip install -r requirements.txt` 실행 → 동일 Python 환경 보장.  
- **Interfaces:** pip 호환 형식; README “요구사항”에서 이 파일을 SSOT로 참조.

**PR Plan**  
- **PR1:** `requirements.txt` 초안 작성. 필수: watchdog, requests, pyyaml, pytest. 주석으로 “데몬 실행용”, “테스트용” 등 용도 표기.  
- **PR2:** README “요구사항” 섹션에 `pip install -r requirements.txt` 및 (선택) `.venv` 활성화 순서 명시.  
- **PR3:** (선택) `requirements-dev.txt` 분리 또는 requirements.txt 내 주석 블록으로 dev 전용 패키지 구분.

**Tests**  
- **Unit:** N/A (설정 파일 추가만).  
- **Integration:** CI에서 `pip install -r requirements.txt && pytest tests/` 1회 성공으로 검증.  
- **Security:** 기존 코드에서 PyYAML `safe_load` 사용 유지; requirements에 pyyaml 명시로 버전 고정.

**Rollout & Rollback**  
- **Rollout:** 메인 머지 후, 기존 `.venv` 사용자는 필요 시 `pip install -r requirements.txt` 재실행.  
- **Rollback:** requirements.txt 삭제 또는 이전 커밋으로 revert. 런타임 동작 변경 없음.

**Risks & Mitigations**  
- **Risk:** 특정 버전 조합에서 호환성 이슈. **Mitigation:** 현재 “동작 중인” 버전으로 고정 후, 별도 이슈에서 업그레이드·회귀 테스트.

**KPIs**  
- 재현 가능 설치 1회 성공률.  
- CI에서 의존성 설치 시간 (목표: 기존 대비 +30s 이내).

**Dependencies / Migration traps**  
- INSTALL_NEXT 등 기존 문서의 `pip install watchdog pydantic rapidfuzz`와 충돌하지 않도록, requirements.txt를 SSOT로 두고 해당 문서는 “또는 `pip install -r requirements.txt`”로 정리.

**Evidence**  
- **E1** (pip official): requirements 파일 형식 표준, 재현 가능 설치 기반.  
- **E2** (production-ready): 버전 고정·환경 일관성 권장.  
- **E3** (repo audit): “requirements.txt 부재” Pain 도출.

---

## Best 2: README 실행 예시 → autosortd_1py.py

**Goal**  
README의 “빠른 실행” 및 “프로젝트/1회 스캔” 예시를 실제 단일 진입점인 `autosortd_1py.py` 기준으로 통일한다. (`--root`, `--dry-run`, `--once` 명시.)

**Non-goals**  
- autosortd.py 코드 변경·삭제 아님. 문서만 수정.  
- 다른 문서(ARCHITECTURE, patch.md)의 상세 옵션 설명을 대체하지 않음.

**Proposed Design**  
- **Components:** README.md 내 “빠른 실행”, “프로젝트/1회 스캔”, “스크립트 구분” 섹션.  
- **Data flow:** 사용자 → README 복사 → `autosortd_1py.py` 실행. 기존 autosortd.py 문구는 “미구현(레거시), autosortd_1py로 대체”로 고정.  
- **Interfaces:** 터미널 명령 1:1 대응; 옵션은 `--root`, `--watch`, `--dry-run`, `--once` 중심.

**PR Plan**  
- **PR1:** “빠른 실행” 예시를 `python C:\_AUTOSORT\autosortd_1py.py --root C:\_AUTOSORT --watch "D:\대상" --dry-run` 및 1회 스캔 시 `--once` 예시로 교체.  
- **PR2:** “스크립트 구분”에서 autosortd.py → “미구현(레거시)”, autosortd_1py.py → “단일 진입점”으로 명시.  
- **PR3:** (선택) LAYOUT.md, CURSOR_AUTOSORT_USAGE.md 등 동일 진입점/옵션 언급이 있으면 일괄 정리.

**Tests**  
- **Unit:** N/A.  
- **Integration:** (선택) 문서 링크/빌드 검사. 수동: README 명령 복사 후 실행하여 동작 확인.

**Rollout & Rollback**  
- **Rollout:** 문서 머지 즉시 반영.  
- **Rollback:** README 이전 버전으로 revert.

**Risks & Mitigations**  
- **Risk:** 기존 사용자가 이전 autosortd.py 명령어 계속 사용. **Mitigation:** “단일 진입점: autosortd_1py.py” 문구로 명확히 안내.

**KPIs**  
- README만 보고 새 사용자가 1회 실행 성공하는 비율 (정성 목표).

**Dependencies / Migration traps**  
- ARCHITECTURE.md, patch.md의 `--root`/`--base` alias, `--sweep`/`--once` 설명과 용어 일치 유지.

**Evidence**  
- **E4** (repo audit): Quick wins에서 README·문서 정리 도출.  
- **E5** (verifier): 문서 변경 PASS, 단일 진입점 강화.

---

## Best 3: 규칙 분류 테스트 1개

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
- **Risk:** rules 스키마 또는 규칙 순서 변경 시 테스트 깨짐. **Mitigation:** 규칙 변경 시 해당 테스트 케이스 동시 수정; 테스트를 “의도 문서화”로 활용.

**KPIs**  
- 테스트 실행 시간 (목표: 전체 &lt; 5분).  
- 규칙 변경 시 회귀 탐지율.

**Dependencies / Migration traps**  
- `rules_dir` 또는 규칙 로드 경로를 테스트에서 override 가능하게 두거나, 테스트 전용 fixture 디렉터리 사용. 실제 C:\_AUTOSORT 경로가 테스트에 하드코딩되지 않도록 함.

**Evidence**  
- **E5** (verifier): 테스트 추가 PASS, temp dir·ledger assertion 패턴.  
- **E6** (watchdog official): 이벤트 핸들링·필터링 권장 → 분류 로직 검증 필요성.

---

*This report is the output of the upgrade-deep-synth template. It can replace §4 in UPGRADE_PROJECT_UPGRADE_V1.1.md or be used as a standalone Best 3 Deep deliverable.*
