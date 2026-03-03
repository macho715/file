# 시스템 상태 확인 (기준일: 2026-03-01)

이 문서는 `LLAMA_SERVER` 서브 개발 플랜 실행 결과를 반영한 운영 상태 노트다.

## 1. 장치 사양 (사용자 제공값 반영)

| 항목 | 값 |
|------|-----|
| 장치 이름 | `C` |
| 프로세서 | `Snapdragon(R) X 12-core X1E80100 @ 3.40 GHz (3.42 GHz)` |
| 설치 RAM | `16.0GB (15.6GB 사용 가능)` |
| 시스템 종류 | `64비트 운영 체제, ARM 기반 프로세서` |
| 펜/터치 | `펜, 10개 터치 포인트` |

판정: `Qwen2-1.5B Q4`급 CPU 서빙 가능.

## 2. WSL/llama.cpp 상태

| 항목 | 결과 |
|------|------|
| `.wslconfig` | `memory=8GB`, `processors=6` (유지) |
| `cmake` | **설치 완료** |
| `libssl-dev` | **설치 완료** |
| `~/llama.cpp/build/bin/llama-server` | **생성 완료** |
| 빌드 옵션 | `Release + LLAMA_OPENSSL=ON` |
| 모델 캐시 | `qwen2-1.5b-instruct-q4_k_m.gguf` 다운로드 완료(약 941MB) |

## 3. LLAMA_SERVER 실행 검증

| 검증 항목 | 결과 |
|-----------|------|
| `127.0.0.1:8080` 포트 | `TCP_8080=True` |
| `/v1/models` API | 응답 성공 |
| 실행 프로세스(WSL) | `llama-server` + `tee` 정상 상주 |
| 스크립트 기본값 | `CTX=2048`, `THREADS=5` |

참고 로그:
```text
[INFO] starting llama-server on 0.0.0.0:8080 CTX=2048 THREADS=5
... downloading ... qwen2-1.5b-instruct-q4_k_m.gguf
```

## 4. 작업 스케줄러 상태

| 작업 이름 | 결과 |
|-----------|------|
| `\AUTOSORT\LLAMA_SERVER` | **등록됨** — `C:\_AUTOSORT\start_llama_server.cmd` (로그온 시) |
| `\AUTOSORT\AUTOSORTD` | **등록됨** — `C:\_AUTOSORT\RUN_AUTOSORTD.cmd` (로그온 시, PT30S 지연) |

**등록 완료 (관리자 PS에서 실행):**
```text
성공: 예약된 작업 "\AUTOSORT\LLAMA_SERVER"을(를) 만들었습니다.
성공: 예약된 작업 "\AUTOSORT\AUTOSORTD"을(를) 만들었습니다.
SUCCESS: AUTOSORT tasks registered and verified (including PT30S delay).
```
다음 로그온부터 LLAMA_SERVER 즉시, AUTOSORTD 30초 지연 후 자동 기동.

## 5. autosortd 중복 실행 가드 상태

| 항목 | 결과 |
|------|------|
| 프로세스 총수 (`--watch C:\_AUTOSORT\inbox`) | `TOTAL=2` |
| 논리 인스턴스 수 | `LOGICAL=1` |
| `autosortd_runner.log` | 중복 실행 skip 로그 기록 유지 |

해석: 프로세스 2개는 부모/자식 형태이며, 논리 인스턴스 기준 1개로 정상.

## 6. 플랜 단계별 이행 현황 (2026-03-01)

| 단계 | 상태 | 메모 |
|------|------|------|
| 1) 상태 문서 갱신 | 완료 | 본 문서 기준 |
| 2) WSL 빌드 체인 준비 | 완료 | `cmake`, `libssl-dev`, Release 빌드 완료 |
| 3) llama 서버 스크립트 검증 | 완료 | 8080 및 `/v1/models` 확인 |
| 4) Task Scheduler 등록 | **완료** | 관리자 PS에서 register_autosort_tasks.ps1 실행됨 |
| 5) Ollama 백업 런북 | 완료 | 별도 런북 문서 참조 |
| 6) 등록/헬스체크 로깅 | 완료 | register_tasks.log(JSONL), health_check.ps1 추가 |

## 7. 스케줄러 등록 완료 및 확인

### 7.1 등록 명령 (이미 실행됨)
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\_AUTOSORT\register_autosort_tasks.ps1
```

### 7.2 등록 후 확인
```powershell
schtasks /Query /TN "\AUTOSORT\LLAMA_SERVER" /V /FO LIST
schtasks /Query /TN "\AUTOSORT\AUTOSORTD" /V /FO LIST
schtasks /Query /TN "\AUTOSORT\AUTOSORTD" /XML
```

### 7.3 등록 스크립트 구조화 로그
- **로그 파일**: `C:\_AUTOSORT\logs\register_tasks.log` (JSONL)
- **필드**: ts, level, step, result, message, task_name(optional), run_id
- **단계**: legacy 삭제 → create → query → XML PT30S 검증. 예외 시 ERROR 기록 후 throw.

## 8. 헬스체크 (health_check.ps1)

### 8.1 기본 실행
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\_AUTOSORT\health_check.ps1
```

### 8.2 옵션
| 옵션 | 기본값 | 설명 |
|------|--------|------|
| -LedgerFreshMinutes | 30 | ledger 최근 갱신 허용 분(분) |
| -LlamaPrimaryUrl | 8080 /v1/models | Primary LLM endpoint |
| -LlamaBackupUrl | 11434 /v1/models | Backup(Ollama) endpoint |
| -WriteLog | — | 로그 append (`logs\health_check.log`) |
| -AsJson | — | JSON 출력 |

### 8.3 종료 코드
| 코드 | 의미 |
|------|------|
| 0 | PASS |
| 1 | FAIL (운영 대응 필요) |
| 2 | 스크립트 예외 |

### 8.4 판정 규칙
- **llama**: Primary 또는 Backup 중 하나라도 응답 시 PASS. Primary down + Backup up → overall_pass=true, note "backup active". 양쪽 실패 → overall_pass=false, RC=1.
- **autosortd**: `--watch C:\_AUTOSORT\inbox` 논리 인스턴스 ≥1 → PASS. &gt;1 → WARN(note).
- **ledger**: inbox 비어 있으면 freshness 정보성(note) + PASS. inbox에 파일 있으면 최근 갱신(LedgerFreshMinutes 이내) 필요.

### 8.5 로그 (옵션)
- `C:\_AUTOSORT\logs\health_check.log` — `-WriteLog` 사용 시 생성/append.

### 8.6 검증 결과 (참고)
- health_check.ps1 기본 실행: PASS, RC=0.
- health_check.ps1 -AsJson -WriteLog: PASS, RC=0, health_check.log 생성/기록 확인.
- 백업 시나리오(Primary down, Backup up): overall_pass=true, note "backup active".
- 양쪽 실패: overall_pass=false, RC=1.
- register_tasks.log: 단계별 성공 JSONL(create_task, verify_xml 등) 기록 확인.

## 9. E2E 검증 (2026-03-01)

| 항목 | 결과 |
|------|------|
| 테스트 파일 | `C:\_AUTOSORT\inbox\AUTOSORTD_TEST_20260301_082624.txt` 생성 |
| ledger.jsonl | 갱신 성공 (1920 → 2250 bytes) |
| 이동 | `inbox` → `out\Dev\Notes\AUTOSORTD_TEST_20260301_082624.txt` |
| reason | `auto_apply` |
| 실제 파일 위치 | `C:\_AUTOSORT\out\Dev\Notes\AUTOSORTD_TEST_20260301_082624.txt` 확인 |

**판정:** AUTOSORTD 감시 → 분류 → 이동 → ledger 기록 파이프라인 **end-to-end 정상 동작**.
