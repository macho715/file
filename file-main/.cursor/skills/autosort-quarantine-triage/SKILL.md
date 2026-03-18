---
name: autosort-quarantine-triage
description: Triage files in quarantine using rule-first classification and Cursor + Codex only workflow. No local LLM runtime dependency.
disable-model-invocation: true
---

# autosort-quarantine-triage

## When to Use
- "quarantine 정리"
- "미분류 문서 triage"
- "ambiguous/conflict 파일 분류"

## When Not to Use
- 드라이브 루트나 대규모 재귀 이동을 한 번에 처리할 때
- ledger 기록 경로를 확인할 수 없을 때
- 삭제/강제 덮어쓰기가 필요한 요청일 때

## Inputs
- `C:\_AUTOSORT\quarantine\` 파일 목록
- SSOT 대상 경로 (`out/`, `dup/`, `quarantine/`)
- AGENTS.md 규칙 (NO DELETE, NO RENAME for Dev, Ledger always)

## Workflow (Cursor + Codex only)
1. Rule-first pass
- 확장자 기반으로 Dev/Archive/Temp/Notes 우선 분류
- 문서 키워드 규칙(`agi_tr`, `dpr`, `mammoet`, `verification`, `chartering`, `duration`, `comparison`) 우선 적용

2. Docs triage (human-in-the-loop)
- 대상: `.pdf`, `.docx`, `.xlsx`
- Codex doc/pdf/spreadsheet 스킬로 내용 확인 후 문서 유형 결정
- 불확실하면 quarantine 유지 (추정 이동 금지)

3. Move + Ledger
- 이동만 허용, 삭제 금지
- Dev 분류는 원본 파일명 유지 (rename 금지)
- 이름 충돌 시 hash suffix 또는 기존 충돌 정책 적용
- 모든 이동은 ledger(before/after/reason/run_id/ts/sha256) 기록

## Output Contract
- moved count
- stayed count
- top uncertainty reasons
- policy check summary (delete 0, dev rename 0, ledger recorded)
