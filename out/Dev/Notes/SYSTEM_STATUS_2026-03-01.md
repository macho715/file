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
| `\AUTOSORT\LLAMA_SERVER` | 등록 완료 |
| `\AUTOSORT\AUTOSORTD` | 등록 완료 |

등록 스크립트 실행/단계 결과는 아래 파일에 JSONL로 기록됨:
- `C:\_AUTOSORT\logs\register_tasks.log`

검증 명령:
```powershell
schtasks /Query /TN "\AUTOSORT\LLAMA_SERVER" /V /FO LIST
schtasks /Query /TN "\AUTOSORT\AUTOSORTD" /V /FO LIST
schtasks /Query /TN "\AUTOSORT\AUTOSORTD" /XML | findstr /I PT30S
```

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
| 4) Task Scheduler 등록 | 완료 | LLAMA_SERVER/AUTOSORTD 등록 및 PT30S 검증 완료 |
| 5) Ollama 백업 런북 | 완료 | 별도 런북 문서 참조 |
| 6) 등록/헬스체크 로깅 | 완료 | `register_tasks.log`, `health_check.ps1` 추가 |

## 7. 운영 안정화 스크립트 (신규)

### 7.1 헬스체크 실행
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\_AUTOSORT\health_check.ps1
```

### 7.2 JSON 출력 + 로그 기록
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\_AUTOSORT\health_check.ps1 -AsJson -WriteLog
```

헬스 로그 파일:
- `C:\_AUTOSORT\logs\health_check.log` (`-WriteLog` 사용 시 생성/append)
