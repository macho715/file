# 프로젝트 전체 설명 — DEV-PRESET Autosort

아키텍처·배포·문서 인덱스 요약.

---

## 1. 목적

- **로컬 폴더**(다운로드/작업 디렉터리)를 자동으로 **분류·이동**하는 시스템.
- 개발 파일(소스/설정)은 **이름 변경 없이** 보존, 문서는 **규칙 우선 + 필요 시 LLM**으로 분류.
- **파일 삭제 없음**. 모든 이동은 **ledger**에 기록해 **Undo(롤백)** 가능.

---

## 2. 핵심 원칙 (Non-Negotiables)

| 원칙 | 내용 |
|------|------|
| **NO DELETE** | 사용자 파일 삭제 금지. 이동만. |
| **NO RENAME for Dev** | 코드/레포/설정은 원본 파일명 유지 (참조 깨짐 방지). |
| **Rule-first, LLM-last** | 확장자·키워드 룰로 먼저 분류, 문서만 애매할 때 LLM. |
| **Ledger always** | 모든 이동을 `logs/ledger.jsonl`에 기록 (before/after, reason, run_id 등). |
| **Quarantine on uncertainty** | 분류 불확실·충돌은 `quarantine/`으로 이동. |
| **Stability gate** | `.crdownload`/`.part`/`.tmp`는 크기 안정 후에만 이동. |

---

## 3. 대상 환경

| 항목 | 내용 |
|------|------|
| 장치 | HP OMEN 16-wf0xxx (x64, Intel i5-13500HX, 32GB RAM) |
| OS | Windows. LLM은 다음 중 선택: WSL2 Ubuntu(llama-server), Windows Ollama, LM Studio 등. |
| 모델 | Qwen2-1.5B급 권장. llama.cpp / Ollama / LM Studio 등 OpenAI 호환 엔드포인트 사용. |

---

## 4. 시스템 구성 (3레이어)

| 레이어 | 설명 |
|--------|------|
| **LLM Serve** | 선택: WSL2 `llama-server` :8080, Windows Ollama :11434, LM Studio 등. `--llm`으로 URL 지정. |
| **Autosort Daemon (Windows)** | inbox 감시 → 규칙/키워드(90%) → LLM(10%) → 이동 → ledger·캐시. `RUN_AUTOSORTD.cmd`(lock+프로세스 체크), `autosortd_1py.py`. |
| **Storage** | inbox, out/, quarantine/, dup/, logs/, cache/ (AGENTS.md §1 트리). |

---

## 5. 배포/실행 (C:\_AUTOSORT 기준)

| 구분 | 내용 |
|------|------|
| 작업 스케줄러 | `\AUTOSORT\LLAMA_SERVER` 로그온 즉시, `\AUTOSORT\AUTOSORTD` 30초 지연. 등록: 관리자 PS `register_autosort_tasks.ps1`. |
| 수동 1회 | `C:\_AUTOSORT\RUN_AUTOSORTD.cmd` (이미 실행 중이면 skip). |
| 헬스체크 | `health_check.ps1` (llama/autosortd/ledger, RC 0/1/2). 선택: 15분마다 `\AUTOSORT\HEALTH_CHECK` 작업. |

---

## 6. 저장소 vs 런타임

| 구분 | 내용 |
|------|------|
| **저장소 (file/)** | `autosortd.py`, `autosortd_1py.py`, `rules/`, WSL/Ollama 스크립트, Cursor 에이전트/스킬, 아키텍처 문서. |
| **런타임 (C:\_AUTOSORT)** | SSOT 트리 + `.venv`, `RUN_AUTOSORTD.cmd`, `start_llama_server.cmd`, `register_autosort_tasks.ps1`, `health_check.ps1` 등. 배포 시 저장소 규칙/스크립트 복사. |

---

## 7. 문서·역할

| 문서 | 역할 |
|------|------|
| **README.md** | 진입·실행 방법·문서 인덱스 |
| **AGENTS.md** | 에이전트 규칙, SSOT 폴더 트리, 분류·리네임 정책 |
| **ARCHITECTURE.md** | 아키텍처 SSOT(통합), 레이어/배포/데이터흐름, 머메이드 |
| **LAYOUT.md** | 저장소·런타임 폴더 레이아웃 |
| **out/Dev/Notes/SYSTEM_STATUS_2026-02-28.md** | 장치·WSL·스케줄러·헬스체크·E2E 검증 상태 |
| **out/Dev/Notes/LLAMA_SERVER_RUNBOOK_2026-03-01.md** | LLM/데몬 기동·헬스체크·장애 대응 런북 |
| **CURSOR_AUTOSORT_USAGE.md** | Cursor Subagents/Skills 사용법 |
| **yaml.md** | rules.yaml / mapping.yaml 스펙 |

---

## 8. 요약

룰 90% + LLM 10%로 로컬 폴더를 자동 정리. 삭제 없이 이동만, 모든 이동은 ledger 기록·롤백 가능. 로컬 PC(HP OMEN 16, x64) 자동 분류·이동 시스템.
