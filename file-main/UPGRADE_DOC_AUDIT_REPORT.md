# LOCAL-AUTOSORT Upgrade Doc Audit Report

**Project:** LOCAL-AUTOSORT (repository root: file-main)  
**Role:** upgrade-doc-auditor (document-first diagnosis only)  
**Scope:** README, AGENTS, ARCHITECTURE, LAYOUT, RUN_PLAN, INSTALL_NEXT, CURSOR_AUTOSORT_USAGE, IMPLEMENTATION_PLAN, UPGRADE_*, docs/*.md; code used only to confirm entrypoints and tests.  
**Date:** 2026-03-03

---

## 1) Current State Snapshot (table)

| 영역 | 현재 상태 | 비고 |
|------|-----------|------|
| **Stack** | Python 3.x, watchdog, requests, PyYAML; optional pydantic/rapidfuzz (INSTALL_NEXT). Single main script: `autosortd_1py.py`. | RUN_PLAN: rules_dir에 rules.yaml, mapping.yaml 필수. LLM: llama.cpp(8080) or Ollama(11434). |
| **Deployment** | Windows Task Scheduler `\AUTOSORT\LLAMA_SERVER`, `\AUTOSORT\AUTOSORTD` (PT30S); RUN_AUTOSORTD.cmd + lock; base `C:\_AUTOSORT`. | RUN_AUTOSORTD.cmd, health_check.ps1, register_autosort_tasks.ps1는 LAYOUT 런타임에만 문서화; repo 루트에는 없음. |
| **CI** | 없음 | .github/workflows 없음. IMPLEMENTATION_PLAN PR-9에서 CI 추가 예정. |
| **Tests** | pytest 2개: `tests/test_ledger_smoke.py` (ledger 필수 키), `tests/test_llm_extension_gate.py` (.xlsm no-LLM → quarantine). 둘 다 temp/fixture 사용. | 규칙 분류·rollback 단위 테스트는 없음(IMPLEMENTATION_PLAN PR-6, PR-7). |
| **Observability** | logs/ledger.jsonl, logs/autosortd_runner.log, health_check.ps1 (RC 0/1/2). ARCHITECTURE: Denylist 문서화. | 메트릭/대시보드 없음. Ledger 집계(건수/run_id/ts)는 PR-10 예정. |
| **Security** | 로컬만; watch allowlist; AGENTS.md no-secrets; PII 최소(스니펫). ARCHITECTURE §17 Denylist. | |
| **Docs** | README, AGENTS, ARCHITECTURE, LAYOUT, RUN_PLAN, INSTALL_NEXT, CURSOR_AUTOSORT_USAGE, IMPLEMENTATION_PLAN, yaml.md, UPGRADE_*, docs(BASELINE, BENCHMARK_SCOUT, PLAN_VERIFIER_REPORT). | README "빠른 실행"은 autosortd.py 기준; LAYOUT에 autosortd.py "메인 실행 스크립트"로 기재. |
| **Pain points** | README/LAYOUT에 autosortd.py 레거시 문구; requirements.txt 부재; CI 없음; 테스트 적음; LLM 의존성. | UPGRADE_DOC_AUDIT_SUMMARY와 동일 방향. |
| **Quick wins** | requirements.txt, README 실행 예시를 autosortd_1py.py로 통일, health_check 문서화, 규칙/rollback 테스트 1개씩. | IMPLEMENTATION_PLAN 30일·60일과 UPGRADE_TOP10에 명시. |

---

## 2) evidence_paths

- README.md
- AGENTS.md
- ARCHITECTURE.md
- LAYOUT.md
- RUN_PLAN.md
- INSTALL_NEXT.md
- CURSOR_AUTOSORT_USAGE.md
- IMPLEMENTATION_PLAN.md
- UPGRADE_DOC_AUDIT_SUMMARY.md
- UPGRADE_TOP10_AND_ROADMAP.md
- UPGRADE_VERIFIER_REPORT.md
- UPGRADE_PROJECT_UPGRADE_V1.1.md
- UPGRADE_BEST3_DEEP_SYNTH.md
- UPGRADE_LLM_TO_CURSOR_CODEX_REPLACEMENT.md
- UPGRADE_LLM_DEEP_SYNTH_REPORT.md
- UPGRADE_LLM_VERIFIER_REPORT.md
- docs/PLAN_VERIFIER_REPORT.md
- docs/BASELINE.md
- docs/BENCHMARK_SCOUT.md
- autosortd_1py.py
- tests/test_ledger_smoke.py
- tests/test_llm_extension_gate.py
- .cursor/skills/autosort-run/SKILL.md
- .cursor/agents/ (autosort-research, autosort-terminal, autosort-verifier)

---

## 3) Constraints

- **AGENTS.md Non-Negotiables:** NO DELETE; NO RENAME for dev assets; Rule-first LLM-last; Ledger always; Quarantine on uncertainty; Stability gate for .crdownload/.part/.tmp; No internal secrets.
- **Build/run:** Python 3.x; watchdog, requests, pyyaml 필수(RUN_PLAN); `--base`/`--root` 기본 `C:\_AUTOSORT`; `--rules_dir` 기본 `C:\_AUTOSORT\rules`에 rules.yaml, mapping.yaml 필수.
- **Deploy:** Windows; Task Scheduler `\AUTOSORT\LLAMA_SERVER`, `\AUTOSORT\AUTOSORTD` PT30S; RUN_AUTOSORTD.cmd; lock `cache\autosortd_watch_inbox.lock`.
- **Tests/CI:** 테스트는 temp dir 또는 fixture만 사용; 실제 `C:\_AUTOSORT`/watch 경로 사용 금지(UPGRADE_VERIFIER_REPORT Apply Gates).
- **autosortd.py:** 삭제 금지(정책 확정 전); 문서에 "미구현, autosortd_1py로 대체"만 반영(IMPLEMENTATION_PLAN PR-5, PR-11).
- **Ledger 집계:** 출력에 경로·파일 내용·API 키/시크릿 금지; 건수, run_id, timestamp만 허용(PR-10 Gate).

---

## 4) Pain points

- README "빠른 실행"에 `autosortd.py --watch ... --dry-run` 예시가 있음. 실제 단일 진입점은 `autosortd_1py.py`로 문서와 불일치.
- **requirements.txt** 없음 → 설치 재현성·CI 연동 어려움.
- **CI 없음** → PR 시 자동 테스트/린트 없음.
- **테스트**는 ledger smoke + LLM extension gate 2개뿐 → 규칙 분류(first_match_rule/ext→doc_type), rollback(after→before) 검증 부족.
- **LLM** 의존성(WSL llama / Ollama) → 서버 미기동 시 문서 분류 실패·quarantine 증가 가능(문서화됨).
- RUN_AUTOSORTD.cmd, health_check.ps1는 런타임(LAYOUT)에만 기술되어 있고, repo 루트에는 없음 → 배포/검증 시 별도 복사·위치 가정 필요.

---

## 5) Quick wins (docs/로드맵에 이미 명시된 것만)

- **requirements.txt** 작성 (watchdog, requests, pyyaml, pytest).
- README 실행 예시를 `autosortd_1py.py --root ... --dry-run` / `--once` 기준으로 통일.
- **health_check.ps1** 역할을 README 또는 ARCHITECTURE에 한 줄 요약.
- **규칙 분류 테스트 1개** 추가 (first_match_rule 또는 ext→doc_type, temp dir만).
- **Rollback 테스트 1개** 추가 (ledger 기반 after→before 이동, temp/fixture만).
- **버전/날짜 필드** 정리 (문서 내 2026-02/03 또는 version 필드 통일).
- **autosortd.py 레거시 문구** 고정: "미구현, autosortd_1py로 대체" 문서 반영, 파일 삭제 금지.

---

## 6) AMBER / Gaps

- **autosortd.py:** LAYOUT/README에는 "메인 실행 스크립트 (run_once)"로 되어 있으나, repo 루트에는 `autosortd_1py.py`만 존재. autosortd.py 존재 여부·역할·삭제/유지 정책이 문서와 코드베이스 간에 불명확함.
- **날짜/버전:** 문서에 2026-02, 2026-03 등 혼재; 공식 version 필드 없음.
- **배포 스크립트 위치:** RUN_AUTOSORTD.cmd, health_check.ps1, register_autosort_tasks.ps1가 LAYOUT 런타임 트리에만 나옴. repo에 포함 여부·경로가 명시되지 않음.

---

## 7) JSON block

```json
{
  "stack": {
    "runtime": "Python 3.x",
    "deps": ["watchdog", "requests", "pyyaml"],
    "optional_deps": ["pydantic", "rapidfuzz"],
    "entrypoint": "autosortd_1py.py",
    "llm": "llama.cpp (8080) or Ollama (11434)",
    "rules": "rules/rules.yaml, rules/mapping.yaml (--rules_dir)"
  },
  "risks": [
    "README/LAYOUT reference autosortd.py; repo has only autosortd_1py.py",
    "No requirements.txt for reproducible install/CI",
    "No CI; tests not run on PR",
    "LLM dependency; server down increases quarantine",
    "Deploy scripts (RUN_AUTOSORTD.cmd, health_check.ps1) documented in LAYOUT but not present in repo root"
  ],
  "quick_wins": [
    "Add requirements.txt",
    "Align README run examples to autosortd_1py.py",
    "Document health_check.ps1 in README or ARCHITECTURE",
    "Add rule classification test (temp dir only)",
    "Add rollback test (temp/fixture only)",
    "Version/date field consistency in docs",
    "Document autosortd.py as legacy/replaced (no file delete)"
  ],
  "evidence_paths": [
    "README.md",
    "AGENTS.md",
    "ARCHITECTURE.md",
    "LAYOUT.md",
    "RUN_PLAN.md",
    "INSTALL_NEXT.md",
    "CURSOR_AUTOSORT_USAGE.md",
    "IMPLEMENTATION_PLAN.md",
    "UPGRADE_DOC_AUDIT_SUMMARY.md",
    "UPGRADE_TOP10_AND_ROADMAP.md",
    "UPGRADE_VERIFIER_REPORT.md",
    "UPGRADE_LLM_TO_CURSOR_CODEX_REPLACEMENT.md",
    "UPGRADE_LLM_DEEP_SYNTH_REPORT.md",
    "UPGRADE_LLM_VERIFIER_REPORT.md",
    "docs/PLAN_VERIFIER_REPORT.md",
    "docs/BASELINE.md",
    "docs/BENCHMARK_SCOUT.md",
    "autosortd_1py.py",
    "tests/test_ledger_smoke.py",
    "tests/test_llm_extension_gate.py",
    ".cursor/skills/autosort-run/SKILL.md"
  ]
}
```

---

*Refs: upgrade-doc-auditor output. No repo files modified by auditor.*
