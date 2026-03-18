# PLAN_LLM_REPLACEMENT

**Project:** LOCAL-AUTOSORT (`autosortd_1py.py`)  
**Date:** 2026-03-03  
**Goal:** 로컬 LLM 의존성을 선택적으로 제거하고, 문서 미분류를 quarantine + ledger로 일관 처리

---

## 1) Summary
- `--no-llm` 모드를 추가하여 로컬 LLM 호출 없이도 데몬이 안전하게 동작하도록 한다.
- 문서 미분류(`.pdf/.docx/.xlsx`)는 `quarantine`으로 이동하고 ledger reason=`no_llm_ambiguous_doc`를 기록한다.
- 운영은 `Cursor + Codex only` triage 워크플로로 문서화한다.

## 2) Current Gaps to Fix
1. 계획서의 함수명 기준을 실제 코드에 맞춰 `handle_file()`로 통일
2. PR 체계를 PR1~PR3으로 고정 (중복 PR 제거)
3. `docs/NO_LOCAL_LLM_WORKFLOW.md` 신규 생성
4. 기준선 테스트 실패(`forced_quarantine_doc_type`)를 먼저 보정

## 3) Fixed Decisions
1. `--no-llm`은 opt-in, 기본 `--llm` 동작 유지
2. `dashboard.py`는 이번 범위 제외
3. `--no-llm` + 문서 미분류는 무조건 quarantine
4. No delete / No rename for Dev / Ledger always / Temp stability 유지

## 4) Interface Changes
- CLI: `--no-llm` 추가
- 함수: `handle_file(..., llm_type="llama_cpp", no_llm=False)`
- Handler: `no_llm` 전달
- ledger reason: `no_llm_ambiguous_doc`

## 5) PR Plan

### PR1. Runtime + Tests
**Files**
- `autosortd_1py.py`
- `tests/test_llm_extension_gate.py`
- `tests/test_no_llm_mode.py` (new)

**Tasks**
1. argparse에 `--no-llm` 추가
2. `main()` warmup: `--no-llm`이면 스킵
3. `handle_file()`에 no_llm 분기 추가
4. 문서 미분류 + no_llm=True면 LLM 미호출, quarantine + ledger
5. 기존 테스트 reason assertion 보정
6. no-llm 신규 테스트 추가 (LLM 미호출/quarantine/ledger reason)

**Done Criteria**
- `pytest -q` 전체 통과
- no-llm 테스트에서 HTTP 호출 0

### PR2. Skill Redefinition
**Files**
- `.cursor/skills/autosort-quarantine-triage/SKILL.md`
- `CURSOR_AUTOSORT_USAGE.md`

**Tasks**
1. triage 스킬을 Cursor + Codex only 워크플로로 재정의
2. `When not to use` 추가
3. human-in-the-loop 및 move+ledger 의무 명시
4. 로컬 LLM 용어 제거

**Done Criteria**
- 위 2개 문서에서 `Ollama|llama.cpp|local LLM API` 문자열 0
- no-LLM triage 단계 명시

### PR3. Docs Consolidation
**Files**
- `docs/NO_LOCAL_LLM_WORKFLOW.md` (new)
- `README.md`
- `RUN_PLAN.md`
- `PLAN_LLM_REPLACEMENT.md`

**Tasks**
1. NO_LOCAL_LLM 워크플로 문서 작성 (run/triage/verify/recovery)
2. README/RUN_PLAN에 no-llm 실행 예시 + 링크 반영
3. 본 계획 문서를 실행 가능 버전으로 유지

**Done Criteria**
- 링크 깨짐 없음
- PR 번호 충돌 없음
- 레거시 함수명 표기 잔존 0

## 6) Verification
1. 자동 테스트
```bash
pytest -q
```
2. 문자열 점검
```bash
rg -n "handle_one\(|Ollama|llama.cpp|no_llm_ambiguous_doc|--no-llm" autosortd_1py.py tests docs README.md RUN_PLAN.md CURSOR_AUTOSORT_USAGE.md .cursor/skills/autosort-quarantine-triage/SKILL.md PLAN_LLM_REPLACEMENT.md
```
3. 수동 스모크 (테스트 디렉터리)
```bash
python autosortd_1py.py --watch <temp_dir> --no-llm --sweep
```
체크: delete 0, Dev rename 0, 미분류 doc->quarantine, ledger line 생성

## 7) Rollback
1. PR1 롤백: `--no-llm` 플래그/분기 제거
2. PR2 롤백: 스킬 문서만 복원
3. PR3 롤백: 신규 문서/링크 복원
4. 롤백 트리거: no-llm에서 quarantine 외 이동, ledger 누락, Dev rename 발생

## 8) Assumptions
1. 대상 데몬은 `autosortd_1py.py`만 수정
2. SSOT 경로 구조 변경 없음
3. 네트워크/의존성 설치 변경 없음
4. 명령어와 reason 키는 영문 고정
