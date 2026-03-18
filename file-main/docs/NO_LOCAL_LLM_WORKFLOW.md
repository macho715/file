# NO_LOCAL_LLM_WORKFLOW

로컬 LLM 없이(`--no-llm`) autosort 데몬을 운영하고, 미분류 문서를 quarantine triage로 처리하는 표준 운영 가이드입니다.

## Scope
- 대상 데몬: `autosortd_1py.py`
- 정책 기준: `AGENTS.md`
- 핵심 원칙: No delete, No rename for Dev, Ledger always, Quarantine on uncertainty

## Step 1. Run Daemon Without Local LLM
```bash
python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\YOUR_WORKDIR" --no-llm --sweep
```

동작 요약:
- 규칙으로 분류 가능한 파일은 기존대로 이동
- `.pdf/.docx/.xlsx` 미분류 건은 LLM 호출 없이 `quarantine/` 이동
- ledger reason: `no_llm_ambiguous_doc`

## Step 2. Quarantine Triage (Cursor + Codex)
1. Cursor에서 `autosort-quarantine-triage` 스킬 실행
2. Codex doc/pdf/spreadsheet 스킬로 문서 확인
3. 확실한 경우에만 SSOT 경로로 이동
4. 불확실하면 quarantine 유지

## Step 3. Verify Ledger
확인 항목:
- 모든 이동에 ledger line 존재
- `reason=no_llm_ambiguous_doc` 기록 확인
- Dev 분류 파일명 유지
- delete 이벤트 0

예시 점검:
```bash
rg -n "no_llm_ambiguous_doc|forced_quarantine_doc_type|auto_apply" C:\_AUTOSORT\logs\ledger.jsonl
```

## Recovery
| 상황 | 대응 |
|---|---|
| quarantine 증가 | triage 주기 단축, 키워드 규칙 개선 후보 수집 |
| 이동 실패(권한/잠금) | 파일 잠금 해제 후 재시도, 실패 건은 quarantine 유지 |
| 잘못된 버킷 이동 의심 | 즉시 중지 후 ledger 기준 역추적, 최근 변경 롤백 |

## Links
- `AGENTS.md`
- `CURSOR_AUTOSORT_USAGE.md`
- `README.md`
- `RUN_PLAN.md`
