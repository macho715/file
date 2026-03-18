# Cursor Autosort Usage

DEV-PRESET Autosort를 Cursor + Codex 스킬 조합으로 운영하는 방법입니다.

## Components
- Subagent: `autosort-research`, `autosort-terminal`, `autosort-verifier`
- Skill: `autosort-run`, `autosort-policy-check`, `autosort-ledger-audit`, `autosort-quarantine-triage`

## No Local LLM Workflow
1. 데몬 실행
- `python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\YOUR_WORKDIR" --no-llm --sweep`

2. Quarantine triage
- Cursor에서 `autosort-quarantine-triage` 스킬을 사용
- Codex의 doc/pdf/spreadsheet 스킬로 문서 내용을 확인한 뒤 이동 결정
- 불확실한 파일은 quarantine 유지

3. Safety checks
- Delete 0
- Dev rename 0
- Move마다 ledger 기록

## Recommended Trigger Prompts
- "quarantine triage 해줘"
- "rule-first로 분류하고 불확실하면 quarantine 유지"
- "ledger 기준으로 이동 결과 점검해줘"

## Human-in-the-loop Rules
- 스킬은 제안/분류 보조 역할
- 최종 이동은 AGENTS.md 기준 준수 확인 후 적용
- 대량 이동 전에는 샘플 5건을 먼저 검증

## Links
- `AGENTS.md`
- `docs/NO_LOCAL_LLM_WORKFLOW.md`
- `README.md`
