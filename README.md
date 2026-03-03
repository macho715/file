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
- **LLAMA_SERVER**: 작업 `\AUTOSORT\LLAMA_SERVER` → `start_llama_server.cmd` (WSL `~/svc/run_llama_server.sh`). 로그온 시 즉시 기동.
- 수동 1회 실행: `C:\_AUTOSORT\RUN_AUTOSORTD.cmd` (이미 떠 있으면 skip).

**프로젝트/1회 스캔 (autosortd.py 또는 autosortd_1py.py)**

```bash
# 1회 스캔, 이동 없이 확인 (권장)
python autosortd.py --watch "D:\대상폴더" --base "C:\_AUTOSORT" --dry-run

# 실제 이동
python autosortd.py --watch "D:\대상폴더" [--base C:\_AUTOSORT]

# 로컬 LLM 없이 사용 (미분류 문서는 quarantine + ledger reason: no_llm_ambiguous_doc)
python autosortd_1py.py --watch "D:\대상폴더" --base "C:\_AUTOSORT" --no-llm
```

- `--watch`: 스캔할 폴더 (1회 스캔 후 종료).
- `--base`: 출력 루트 (기본: `C:\_AUTOSORT` 또는 환경변수 `AUTOSORT_BASE`).
- `--dry-run`: 이동·ledger 기록 없이 분류만 수행.
- **로컬 LLM 없이 사용**: `autosortd_1py.py --no-llm`으로 실행하면 LLM 호출을 생략하고, 규칙으로 분류 불가한 문서는 quarantine으로 보내며 ledger에 `no_llm_ambiguous_doc`로 기록한다.

---

## 대시보드

`dashboard.py`로 ledger·cache 현황을 터미널에서 확인할 수 있다.

- 한 번만 보기: `python dashboard.py --root C:\_AUTOSORT`
- 5초마다 자동 갱신: `python dashboard.py --root C:\_AUTOSORT --refresh 5`
- 경로 직접 지정: `python dashboard.py --ledger logs/ledger.jsonl --cache cache/cache.json`

---

## Electron 앱 (autosort-desktop)

데스크톱 GUI는 `autosort-desktop` 폴더에서 빌드·실행한다.

```bash
cd autosort-desktop
npm run build
npm start
```

Electron 재설치 오류가 나면 `node_modules\electron`을 삭제한 뒤 `npm install electron`으로 다시 설치한다.

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
| [docs/NO_LOCAL_LLM_WORKFLOW.md](docs/NO_LOCAL_LLM_WORKFLOW.md) | 로컬 LLM 없이 autosort 사용 워크플로우 |
| [file-main/PLAN_LLM_REPLACEMENT.md](file-main/PLAN_LLM_REPLACEMENT.md) | LLM 교체/대안 계획 |
| [autosort-desktop/docs/WORKLOG_BUILD_WINDOWS_2026-03.md](autosort-desktop/docs/WORKLOG_BUILD_WINDOWS_2026-03.md) | Windows npm run build 안정화 상세 이력 |

---

## 스크립트 구분

- **autosortd.py** — 1회 스캔(run_once), 내장 룰 + 선택 YAML. LLM·watchdog 없음.
- **autosortd_1py.py** — 풀 데몬(Watchdog, LLM, staging, dup 해시, 캐시). 배포 시 `C:\_AUTOSORT\autosortd_1py.py` 복사 후 `RUN_AUTOSORTD.cmd`로 기동.
- **RUN_AUTOSORTD.cmd** — CIM 프로세스 체크 + lock(`cache\autosortd_watch_inbox.lock`) + stale lock 정리 후 autosortd 1회 기동. 로그: `logs\autosortd_runner.log`.
- **register_autosort_tasks.ps1** — 관리자 실행 시 `\AUTOSORT\LLAMA_SERVER`, `\AUTOSORT\AUTOSORTD` 작업 등록 (AUTOSORTD는 PT30S 지연).

---

기여·안전 규칙은 [AGENTS.md](AGENTS.md) 참고.
