# 레이아웃 (저장소·런타임)

저장소 디렉터리 구조와 런타임 출력 폴더 트리.

---

## 1. 저장소 레이아웃 (Repository layout)

프로젝트 루트 기준 디렉터리·주요 파일:

```text
file/
  README.md
  AGENTS.md
  ARCHITECTURE.md
  LAYOUT.md
  CURSOR_AUTOSORT_USAGE.md
  INSTALL_NEXT.md
  yaml.md
  Architecture_OCAL-AUTOSORT SSOT v0.1.md
  OCAL-AUTOSORT SSOT v0.1.md
  patch.md
  setting_plan.md
  autosortd.py              # 메인 실행 스크립트 (run_once, YAML 지원)
  autosortd_1py.py          # 풀 데몬 (watchdog, LLM, staging, dup)
  run_ollama_serve.ps1
  install_ollama_env.ps1
  wsl_llama_setup.sh
  rules/
    rules.yaml
    mapping.yaml
  .cursor/
    agents/
      autosort-research.md
      autosort-terminal.md
      autosort-verifier.md
    skills/
      autosort-run/SKILL.md
      autosort-policy-check/SKILL.md
      autosort-ledger-audit/SKILL.md
      autosort-quarantine-triage/SKILL.md
  .ruff_cache/              # ruff 캐시
```

---

## 2. 런타임 출력 레이아웃 (Runtime output layout)

`--base`(기본 `C:\_AUTOSORT`) 기준 출력 트리. AGENTS.md §1과 동일.

```text
{base}/
  inbox/                    # 감시 대상 (watch)
  out/
    Dev/
      Repos/
      Archives/
      Config/
      Notes/
    Docs/
      Ops/
      Other/
    Temp/
  staging/
  quarantine/
  dup/
  logs/
    ledger.jsonl
    autosortd_runner.log    # RUN_AUTOSORTD.cmd 중복 실행 skip/실행 로그
    register_tasks.log      # register_autosort_tasks.ps1 구조화 로그 (JSONL)
    health_check.log        # health_check.ps1 -WriteLog 시 append
    autosortd_stdout.log
    autosortd_stderr.log
  cache/
    cache.json
    autosortd_watch_inbox.lock/   # 중복 실행 방지 lock (디렉터리)
  rules/                    # rules.yaml, mapping.yaml (배포 시 복사)
  .venv/                    # Python 가상환경
  autosortd_1py.py          # 배포용 데몬 스크립트
  RUN_AUTOSORTD.cmd         # autosortd 기동 (lock + 프로세스 체크 후 1회)
  start_llama_server.cmd    # WSL llama-server 기동 래퍼
  run_llama_server.sh       # WSL용 스크립트 원본
  register_autosort_tasks.ps1   # 작업 스케줄러 등록 (관리자, JSONL 로그)
  health_check.ps1              # 헬스체크 (llama/autosortd/ledger, RC 0/1/2)
  is_autosortd_running.ps1  # autosortd 실행 여부 반환 (1/0)
```

**작업 스케줄러 (폴더 `\AUTOSORT`):**

| 작업 이름 | 실행 | 비고 |
|-----------|------|------|
| `\AUTOSORT\LLAMA_SERVER` | `start_llama_server.cmd` | 로그온 시 즉시 |
| `\AUTOSORT\AUTOSORTD` | `RUN_AUTOSORTD.cmd` | 로그온 시 30초 지연 (PT30S) |

---

## 3. 문서·설정 파일 역할

| 파일 | 역할 |
|------|------|
| README.md | 프로젝트 진입·실행 방법·문서 인덱스 |
| AGENTS.md | 에이전트 규칙·SSOT 폴더 트리·분류 정책 (Non-Negotiables) |
| ARCHITECTURE.md | 시스템 아키텍처 SSOT(통합)·레이어/배포/데이터흐름·머메이드 |
| LAYOUT.md | 저장소·런타임 폴더 레이아웃 (본 문서) |
| CURSOR_AUTOSORT_USAGE.md | Cursor Subagents/Skills 사용법 |
| INSTALL_NEXT.md | WSL·llama.cpp·Ollama·MVP 설치 다음 단계 |
| yaml.md | rules.yaml / mapping.yaml 스펙·확정본 |
| Architecture_OCAL-AUTOSORT SSOT v0.1.md | 레거시 (통합됨 → ARCHITECTURE.md) |
| OCAL-AUTOSORT SSOT v0.1.md | 레거시 복본 (통합됨 → ARCHITECTURE.md) |
| patch.md | MVP 패치·DEV-PRESET 적용 메모 |
| setting_plan.md | 설정·계획 메모 |
| rules/rules.yaml | 분류 규칙 (ext_groups, ordered rules) |
| rules/mapping.yaml | doc_type_map, tag_overrides, apply_gate |
