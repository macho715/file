# LLAMA_SERVER Runbook (2026-03-01)

## 목적
- 기본 경로: `llama.cpp` (`http://127.0.0.1:8080/v1`)
- 백업 경로: `Ollama` (`http://127.0.0.1:11434/v1`)
- 운영 목표: CPU-only 환경에서 안정적으로 자동 분류를 지속

## 기본 설정
1. 표준 작업명
- `\AUTOSORT\LLAMA_SERVER`
- `\AUTOSORT\AUTOSORTD`

2. 지연 설정
- `AUTOSORTD`는 `/DELAY 0000:30` 사용
- Task XML 검증값: `PT30S`

3. llama 서버 기본 파라미터
- `PORT=8080`
- `CTX=2048`
- `THREADS=5` (WSL processors=6 기준)

## 정상 기동 절차 (llama.cpp 우선)
1. Ubuntu에서 빌드/준비
```bash
bash /mnt/c/Users/minky/Downloads/file/wsl_llama_setup.sh
```

2. 서버 수동 기동 확인
```bash
~/svc/run_llama_server.sh
```

3. Windows에서 포트 확인
```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 8080
```

4. 스케줄러 등록(관리자 PowerShell)
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\_AUTOSORT\register_autosort_tasks.ps1
```
등록 스크립트는 단계별(legacy 삭제, create, query, XML PT30S 검증) 결과를 **구조화 로그**로 기록한다. 예외 시 ERROR 기록 후 throw.
- **로그 파일**: `C:\_AUTOSORT\logs\register_tasks.log` (JSONL)
- **필드**: ts, level, step, result, message, task_name(optional), run_id

## 헬스체크 실행법 (health_check.ps1)
1. 기본 점검
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\_AUTOSORT\health_check.ps1
```

2. JSON 출력 + 로그 기록
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\_AUTOSORT\health_check.ps1 -AsJson -WriteLog
```

3. 옵션
| 옵션 | 기본값 | 설명 |
|------|--------|------|
| -LedgerFreshMinutes | 30 | ledger 최근 갱신 허용(분) |
| -LlamaPrimaryUrl | 8080 /v1/models | Primary LLM |
| -LlamaBackupUrl | 11434 /v1/models | Backup(Ollama) |
| -WriteLog | — | 로그 append |
| -AsJson | — | JSON 출력 |

4. 판정 규칙
- **llama**: Primary 또는 Backup 중 하나라도 `/v1/models` 응답 시 PASS. Primary down + Backup up → overall_pass=true, note "backup active". 양쪽 실패 → overall_pass=false, RC=1.
- **autosortd**: `--watch C:\_AUTOSORT\inbox` 논리 인스턴스 ≥1 → PASS. &gt;1 → WARN(note).
- **ledger**: inbox 비어 있으면 freshness 정보성(note) + PASS. inbox에 파일 있으면 최근 갱신(LedgerFreshMinutes 이내) 필요.

5. 종료 코드
- `0`: PASS
- `1`: FAIL (운영 대응 필요)
- `2`: 스크립트 예외

6. 로그 경로
- 등록: `C:\_AUTOSORT\logs\register_tasks.log` (JSONL, 단계별 create_task / verify_xml 등)
- 헬스체크: `C:\_AUTOSORT\logs\health_check.log` (`-WriteLog` 사용 시)

## 장애 대응: 8080 실패 시 Ollama 백업
상황:
- `127.0.0.1:8080` 미리스닝
- `~/llama.cpp/build/bin/llama-server` 미존재
- 빌드 실패 또는 서버 즉시 종료

전환 절차:
1. Ollama 서버 실행
```powershell
C:\_ollama\ollama.exe serve
```

2. 모델 준비
```powershell
C:\_ollama\ollama.exe pull qwen2:1.5b
```

3. autosortd LLM URL을 백업 경로로 전환
```powershell
python C:\_AUTOSORT\autosortd_1py.py --root C:\_AUTOSORT --watch "C:\_AUTOSORT\inbox" --rules_dir C:\_AUTOSORT\rules --llm "http://127.0.0.1:11434/v1" --sweep
```

## 운영 체크리스트
1. `8080` 또는 `11434` 중 최소 1개 endpoint 응답 가능
2. `C:\_AUTOSORT\logs\autosortd_runner.log`에 duplicate skip 로그 기록
3. `C:\_AUTOSORT\logs\ledger.jsonl`이 계속 증가
4. 같은 watch 경로의 autosortd 논리 인스턴스가 1개 유지

## 자동 점검 옵션 (선택)
기본 정책은 수동 실행이다. 자동 주기 점검이 필요하면 아래 예시로 별도 작업을 추가한다.

```powershell
schtasks /Create /TN "\AUTOSORT\HEALTH_CHECK" /SC MINUTE /MO 15 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\_AUTOSORT\health_check.ps1 -WriteLog" /RU "$env:USERNAME" /RL LIMITED /F
```

## known limits
1. Task Scheduler 등록은 관리자 세션 필요
2. Ubuntu `sudo` 비밀번호가 필요한 경우 자동 설치 파이프라인은 중단될 수 있음
3. 자동 fallback 코드는 이번 범위 밖이며, 현재는 운영자 수동 전환 방식
