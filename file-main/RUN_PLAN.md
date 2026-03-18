# RUN_PLAN (autosortd_1py.py)

`autosortd_1py.py` 실행 조건, 옵션, 검증 절차를 정리합니다.

## Prerequisites
- Python 3.x
- 필수 패키지: `watchdog`, `requests`, `pyyaml`
- rules 경로: `--rules_dir` 아래 `rules.yaml`, `mapping.yaml`

## Option A: LLM endpoint (existing)
```bash
python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\YOUR_WORKDIR" --llm "http://127.0.0.1:8080/v1" --sweep
```

## Option B: Alternative LLM endpoint (existing)
```bash
python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\YOUR_WORKDIR" --llm "http://127.0.0.1:11434/v1" --sweep
```

## Option C: No Local LLM (new)
```bash
python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\YOUR_WORKDIR" --no-llm --sweep
```

동작:
- 규칙 분류 성공 건은 기존대로 이동
- `.pdf/.docx/.xlsx` 미분류 건은 LLM 호출 없이 quarantine 이동
- ledger reason: `no_llm_ambiguous_doc`

## Verification Checklist
- delete 0
- Dev rename 0
- move마다 ledger 기록
- `--no-llm` 실행 시 문서 미분류 건이 quarantine으로만 이동

## Related Docs
- `docs/NO_LOCAL_LLM_WORKFLOW.md`
- `CURSOR_AUTOSORT_USAGE.md`
- `AGENTS.md`
