---
name: autosort-quarantine-triage
description: quarantine 폴더의 파일을 재분류한다. rule-first로 확장자/키워드 재시도 후, 문서(pdf/docx/xlsx)에 한해 LLM로 doc_type/confidence만 반환받아 안전 이동. quarantine/ambiguous/conflict triage 시 사용.
disable-model-invocation: true
---

# autosort-quarantine-triage

## When to Use
- "quarantine 정리", "불확실 파일 재분류", "conflict 해결"

## Inputs
- `C:\_AUTOSORT\quarantine\` 내 파일 목록
- 키워드 룰 리스트(SSOT)
- LLM 엔드포인트(있는 경우에만) + confidence threshold

## Steps
1) Rule-only 재시도
   - 확장자 기반(Dev/Archive/Temp/Notes)
   - ops 키워드 재매칭(파일명 기준)
2) Docs-only LLM(선택)
   - 대상: `.pdf .docx .xlsx`만
   - 출력 스키마 고정: `{doc_type, confidence, suggested_name(optional), reasons[]}`
   - confidence 미달/실패 → quarantine 유지
3) Move + ledger
   - overwrite 금지, 충돌 시 hash suffix(Dev 제외)

## Output
- moved count / stayed count
- top reasons(불확실 원인)
- rule 개선 제안("같은 오류 2회 이상"일 때만)
