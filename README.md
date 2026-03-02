# DEV-PRESET Autosort

룰 우선(90%) 자동 폴더 정리. **삭제 없음**, **Dev 리네임 금지**, **ledger 필수**.

---

## 주요 원칙

- **NO DELETE** — 사용자 파일 삭제 금지. 이동만.
- **NO RENAME for Dev** — 코드/레포/설정 분류는 원본 파일명 유지.
- **Rule-first, LLM-last** — 규칙으로 먼저 분류, 문서만 필요 시 LLM.
- **Ledger always** — 모든 이동을 ledger에 기록 (before/after, decision, confidence, reason, timestamp, run_id).
- **Quarantine on uncertainty** — 불확실·충돌은 `quarantine/`으로.
- **Stability gate** — `.crdownload`/`.part`/`.tmp`는 크기 안정 후에만 이동.

자세한 규칙은 [AGENTS.md](AGENTS.md) 참고.

---

## 요구사항

- Python 3.x
- (선택) PyYAML — YAML 규칙 사용 시: `pip install pyyaml`

---

## 빠른 실행

**배포 환경 (C:\_AUTOSORT, 로그온 자동 기동)**

- **AUTOSORTD**: 작업 스케줄러 `\AUTOSORT\AUTOSORTD` 등록됨 → 로그온 30초 후 `RUN_AUTOSORTD.cmd` 실행. inbox 감시 → 분류 → 이동 → ledger 기록. 중복 실행 방지(lock + 프로세스 체크) 적용.
- **LLM 서버**: 작업 `\AUTOSORT\LLAMA_SERVER` → WSL 시 `start_llama_server.cmd`. Ollama/LM Studio 사용 시 해당 서버만 로그온 후 기동. `--llm`으로 URL 지정(기본 8080).
- 수동 1회 실행: `C:\_AUTOSORT\RUN_AUTOSORTD.cmd` (이미 떠 있으면 skip).

**프로젝트에서 실행 (autosortd_1py.py)**

```powershell
# 1) 프로젝트 폴더로 이동
cd "c:\Users\jichu\Downloads\file-claude-project-upgrade-VsJEE\file-claude-project-upgrade-VsJEE"

# 2) 옵션 확인
python autosortd_1py.py --help

# 3) Ollama 사용 시 (권장 — Ollama 서버 먼저 실행: ollama serve)
python autosortd_1py.py --root . --watch "D:\감시할_폴더" --rules_dir .\rules --llm "http://127.0.0.1:11434/v1" --llm-type ollama --sweep

# 4) WSL llama.cpp 사용 시 (기본 8080)
python autosortd_1py.py --root . --watch "D:\감시할_폴더" --rules_dir .\rules --sweep
```

**LLM이 동작하려면**  
- 프로그램 기본값은 **8080**(llama.cpp/WSL). **Ollama**만 쓸 때는 반드시 `--llm "http://127.0.0.1:11434/v1" --llm-type ollama` 지정.  
- LLM 서버가 꺼져 있으면 PDF/DOCX/XLSX 중 룰로 못 잡는 파일은 **quarantine**으로 이동(LLMERROR 등).  
- 코드·압축·노트 등은 룰만으로 분류되므로 LLM 없이도 이동됨.

- `--root`: 출력 루트 (기본: `C:\_AUTOSORT`). 프로젝트에서 테스트 시 `.` 사용.
- `--watch`: 스캔/감시할 폴더. 여러 개는 `--watch 폴더1 --watch 폴더2` 또는 쉼표 구분.
- `--rules_dir`: `rules.yaml`, `mapping.yaml` 위치 (기본: `C:\_AUTOSORT\rules`).
- `--sweep`: 기동 시 기존 파일 1회 처리 후, 새로 생기는 파일 계속 감시.
- `--llm`: LLM API 주소 (기본: `http://127.0.0.1:8080/v1`). Ollama는 `http://127.0.0.1:11434/v1`.
- 종료: **Ctrl+C**

---

## 문서 인덱스

| 문서 | 설명 |
|------|------|
| [AGENTS.md](AGENTS.md) | 에이전트 규칙·SSOT 폴더 트리·분류 정책 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 시스템 아키텍처·데이터 흐름·구성요소 |
| [LAYOUT.md](LAYOUT.md) | 저장소·런타임 폴더 레이아웃 |
| [CURSOR_AUTOSORT_USAGE.md](CURSOR_AUTOSORT_USAGE.md) | Cursor Subagents/Skills 사용법 |
| [INSTALL_NEXT.md](INSTALL_NEXT.md) | WSL·llama·Ollama·MVP 설치 다음 단계 |
| [RUN_PLAN.md](RUN_PLAN.md) | autosortd_1py.py 실행 조건·단계 (llama.cpp/Ollama) |
| [out/Dev/Notes/SYSTEM_STATUS_2026-02-28.md](out/Dev/Notes/SYSTEM_STATUS_2026-02-28.md) | 장치·WSL·스케줄러·E2E 검증 상태 |
| [yaml.md](yaml.md) | rules.yaml / mapping.yaml 스펙 |

---

## 스크립트 구분

- **autosortd.py** — 1회 스캔(run_once), 내장 룰 + 선택 YAML. LLM·watchdog 없음.
- **autosortd_1py.py** — 풀 데몬(Watchdog, LLM, staging, dup 해시, 캐시). 배포 시 `C:\_AUTOSORT\autosortd_1py.py` 복사 후 `RUN_AUTOSORTD.cmd`로 기동.
- **RUN_AUTOSORTD.cmd** — CIM 프로세스 체크 + lock(`cache\autosortd_watch_inbox.lock`) + stale lock 정리 후 autosortd 1회 기동. 로그: `logs\autosortd_runner.log`.
- **register_autosort_tasks.ps1** — 관리자 실행 시 `\AUTOSORT\LLAMA_SERVER`, `\AUTOSORT\AUTOSORTD` 작업 등록 (AUTOSORTD는 PT30S 지연).

---

기여·안전 규칙은 [AGENTS.md](AGENTS.md) 참고.
