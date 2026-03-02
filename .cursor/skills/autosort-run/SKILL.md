---
name: autosort-run
description: DEV-PRESET Autosort를 안전하게 실행/운영(룰 90% + LLM 10%). watcher 실행, SSOT 트리로 이동, ledger 기록, quarantine/dup 처리. autosort/organize/watcher/ledger 키워드 시 사용.
disable-model-invocation: true
---

# autosort-run (DEV-PRESET)

## When to Use
- "완전자동 정리기", "autosortd 실행", "watcher 돌려", "DEV-PRESET 적용"
- 다운로드/작업 폴더에서 파일이 섞여 있고, **Dev 리네임 금지 + 문서만 선별 분류**가 필요할 때

## Inputs
- Watch 경로(예: `D:\YOUR_WORKDIR`)
- SSOT Output Tree (고정):
  - `C:\_AUTOSORT\out\Dev\Repos\`
  - `C:\_AUTOSORT\out\Dev\Archives\`
  - `C:\_AUTOSORT\out\Dev\Config\`
  - `C:\_AUTOSORT\out\Dev\Notes\`
  - `C:\_AUTOSORT\out\Docs\Ops\`
  - `C:\_AUTOSORT\out\Docs\Other\`
  - `C:\_AUTOSORT\out\Temp\`
  - `C:\_AUTOSORT\quarantine\`
  - `C:\_AUTOSORT\dup\`

## Procedure (must follow)
1) Preflight
   - 삭제 금지, overwrite 금지(dup/quarantine 사용)
   - Dev 분류는 **리네임 금지**
   - `.crdownload/.part/.tmp`는 안정성 확인 전 이동 금지
2) Classify (Rule-first)
   - Rule-only(LLM 금지): dev code ext, archives, temp/incomplete
   - Keyword rule: ops doc 키워드(agi_tr, dpr, mammoet, verification, chartering, duration, comparison)
3) LLM (Docs only, selective)
   - 대상: `.pdf .docx .xlsx` AND 키워드 룰 실패 시
   - 출력 강제: `{doc_type, confidence, suggested_name(optional), reasons[]}`
   - confidence < threshold 또는 실패 → `quarantine\`
4) Move + Ledger
   - move 전/후 경로, decision, confidence, reason, timestamp, run_id 기록
   - 충돌 시 `__{short_hash}` suffix (Dev 제외)
5) Smoke verification
   - ledger 샘플 5건 확인(Dev rename 0, delete 0, temp 안정성 위반 0)

## Output Contract (chat)
1) Decision summary
2) Risk/safety checks
3) Diff plan(영향 파일/함수)
4) Verification plan(테스트/스모크/ledger 샘플)

## Failure Modes
- LLM timeout/unavailable → rule-only 지속 + docs는 quarantine
- Permission denied → quarantine + ledger error
- Name collision → hash suffix, never overwrite
