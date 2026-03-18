---
name: autosort-policy-check
description: AGENTS.md(DEV-PRESET Autosort SSOT) 정책 준수 여부를 체크리스트로 점검. no delete, no dev rename, ledger, quarantine, temp stability, LLM 제한을 확인할 때 사용.
disable-model-invocation: true
---

# autosort-policy-check

## When to Use
- "정책 위반 있나?", "SSOT 준수 확인", "안전 점검", "LLM 호출 제한 확인"

## Inputs
- AGENTS.md의 Non-Negotiables
- 변경된 코드/설정 파일 목록(가능하면 diff)
- 샘플 ledger(가능하면 20라인)

## Steps
1) 정책 매핑표 작성
   - Rule 항목 → 구현 위치(파일/함수) → 증거(코드/로그)
2) 위험 신호 탐지
   - delete/remove/unlink/overwrite 존재 여부
   - Dev 분류에서 rename 수행 여부
   - LLM이 비문서 확장자에 호출되는지
   - temp 안정성 체크 누락 여부
3) 결과
   - PASS/FAIL + 위반 항목별 "최소 수정" 제시

## Outputs
- 표: Rule | Status(PASS/FAIL) | Evidence | Fix
- 최종 Verdict
