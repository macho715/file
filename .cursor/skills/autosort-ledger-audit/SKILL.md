---
name: autosort-ledger-audit
description: autosort ledger.jsonl의 무결성/정책 위반을 감사(audit)한다. before/after, decision, confidence, reason, timestamp, run_id 필드 누락/위반 탐지에 사용.
disable-model-invocation: true
---

# autosort-ledger-audit

## When to Use
- "ledger가 제대로 남았나?", "이동 로그 감사", "정리 결과 리포트"
- 이슈: 누락 필드, overwrite 의심, quarantine 미사용, dev rename 의심

## Inputs
- ledger 파일 경로(예: `C:\_AUTOSORT\logs\ledger.jsonl` 또는 실제 경로)
- 점검 범위: 최근 N라인(기본 200)

## Checks
- 필수 필드: before, after, reason, ts, run_id, action, sha256 (decision/confidence는 cache.json에 있음, ledger 감사 시 참고)
- 금지 패턴: delete/remove/unlink/overwrite/replace
- Dev rename 금지: Dev 분류(코드/레포/설정)에서 `after filename != before filename` 탐지
- Quarantine 규칙: ambiguity/conflict/failure는 quarantine으로 라우팅됐는지

## Outputs
- Summary: total lines / violations count
- Violations table: type | count | sample line numbers | action
- Recommendation: 룰 추가 여부("같은 오류 2회 이상"일 때만)
