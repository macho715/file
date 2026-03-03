# WORKLOG: Task Scheduler 안정화 + autosortd 중복실행 방지

- 작성일: 2026-02-28
- 범위: 계획서 기준 `1 + 2 + 4`
  - (1) Task Scheduler 재등록 안정화
  - (2) `/DELAY` 30초 포맷 확정
  - (4) `RUN_AUTOSORTD.cmd` 중복 실행 방지

---

## 1) 작업 배경 및 목표

초기 상태에서 확인된 문제는 아래 4가지였다.

1. `LLAMA_SERVER`, `AUTOSORTD` 작업 등록/재등록 실패
2. `/DELAY` 30초 표기 형식 혼선
3. `llama-server` 미빌드 (이번 범위 제외)
4. `RUN_AUTOSORTD.cmd`가 상주 프로세스 중복 실행 가능

이번 작업의 목표는:

- 표준 작업명으로 통일: `\AUTOSORT\LLAMA_SERVER`, `\AUTOSORT\AUTOSORTD`
- 지연 시간 표준: `/DELAY 0000:30` (`mmmm:ss`)
- `RUN_AUTOSORTD.cmd`에 중복 실행 방지 구현

---

## 2) 사실 확인(진단) 결과

### 2.1 Task Scheduler 현재 상태

아래 조회 결과, 현재 작업은 존재하지 않는다.

- `schtasks /Query /TN "\AUTOSORT\LLAMA_SERVER"` -> `The system cannot find the file specified.`
- `schtasks /Query /TN "\AUTOSORT\AUTOSORTD"` -> `The system cannot find the file specified.`

레거시 이름도 삭제 시도 결과 모두 `MISSING`:

- `\LLAMA_SERVER`
- `\AUTOSORTD`
- `\AUTOSORTD_OCAL`
- `\AUTOSORT\LLAMA_SERVER`
- `\AUTOSORT\AUTOSORTD`

### 2.2 `/DELAY` 포맷 확정

도움말로 형식 확인:

- `schtasks /Create /?` 출력: `mmmm:ss`
- 확정값: `/DELAY 0000:30`

### 2.3 권한 상태

현재 세션 관리자 권한 확인 결과:

- `([WindowsPrincipal][WindowsIdentity]::GetCurrent()).IsInRole(Administrator)` -> `False`

즉, `schtasks /Create ...`는 현재 세션에서 `Access is denied` 발생.

---

## 3) 실제 변경 사항

## 3.1 변경 파일 요약

- `C:\_AUTOSORT\RUN_AUTOSORTD.cmd` (중복 실행 방지 핵심)
- `C:\_AUTOSORT\is_autosortd_running.ps1` (프로세스 검사 스크립트 추가)
- `C:\_AUTOSORT\register_autosort_tasks.ps1` (관리자 권한 재등록 자동화 추가)

### 3.2 `RUN_AUTOSORTD.cmd` 상세

다음 동작을 추가했다.

1. 프로세스 기반 중복 확인
- `is_autosortd_running.ps1` 호출
- `autosortd_1py.py` + `--watch C:\_AUTOSORT\inbox` 실행 중이면 즉시 `exit /b 0`

2. lock fallback
- lock 디렉터리: `C:\_AUTOSORT\cache\autosortd_watch_inbox.lock`
- 프로세스 조회 실패/권한 이슈에서도 lock으로 중복 차단

3. stale lock 복구
- lock 생성 실패 시 기존 lock 정리 후 1회 재시도
- stale lock이 남아 실행이 막히는 케이스 복구

4. 로그 분리
- skip/runner 로그: `C:\_AUTOSORT\logs\autosortd_runner.log`
- 메인 stdout/stderr 로그와 충돌하지 않게 분리

### 3.3 `is_autosortd_running.ps1` 상세

- 입력: `-WatchPath` (기본 `C:\_AUTOSORT\inbox`)
- `Win32_Process`의 `Name + CommandLine` 기반 매칭
- 매칭 성공 시 `1`, 아니면 `0`
- 예외 발생 시 `0` 반환 (런처 전체 중단 방지)

### 3.4 `register_autosort_tasks.ps1` 상세

- 관리자 권한 강제 체크 (`Assert-Admin`)
- 레거시 작업 삭제 후 표준 작업 재생성
  - `\AUTOSORT\LLAMA_SERVER`
  - `\AUTOSORT\AUTOSORTD` (`/DELAY 0000:30`)
- 생성 후 조회 검증 + XML에서 `PT30S` 확인

---

## 4) 검증 결과

### 4.1 중복 실행 방지 검증

검증 명령(요지):

- `RUN_AUTOSORTD.cmd` 연속 2회 실행
- 실행 전후 논리 인스턴스 수 비교

결과:

- `LOGICAL_BEFORE=1 LOGICAL_AFTER=1 DELTA=0`
- 즉, 2회 연속 실행해도 신규 논리 인스턴스 증가 없음

참고:

- 프로세스 총수는 `TOTAL=2`일 수 있음
- 부모/자식 형태로 떠서 `LOGICAL=1`이면 단일 런 인스턴스로 판단

### 4.2 runner 로그 확인

`C:\_AUTOSORT\logs\autosortd_runner.log`에서 아래 동작 확인:

- `autosortd already running ... Skip duplicate launch.`
- `removed stale autosortd lock and continued.`

즉, 중복 방지 및 stale lock 복구 모두 실제 작동 확인.

### 4.3 스케줄러 등록 검증

현재 세션에서는 미완료(권한 제한):

- `schtasks /Create ...` -> `Access is denied`
- 따라서 `\AUTOSORT\LLAMA_SERVER`, `\AUTOSORT\AUTOSORTD`는 아직 미등록 상태

---

## 5) 남은 작업(권한 필요)

관리자 PowerShell에서 아래 1회 실행:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\_AUTOSORT\register_autosort_tasks.ps1
```

성공 시 기대 결과:

1. `\AUTOSORT\LLAMA_SERVER` 생성
2. `\AUTOSORT\AUTOSORTD` 생성
3. `AUTOSORTD` XML에 `PT30S` 포함

수동 확인:

```powershell
schtasks /Query /TN "\AUTOSORT\LLAMA_SERVER" /V /FO LIST
schtasks /Query /TN "\AUTOSORT\AUTOSORTD" /V /FO LIST
schtasks /Query /TN "\AUTOSORT\AUTOSORTD" /XML
```

---

## 6) 안전성 체크(요구사항 준수)

- 사용자 파일 삭제 없음
- 분류기 본체(`autosortd_1py.py`) 로직 변경 없음
- 스케줄러/런처 레이어만 변경
- Dev rename/no-delete/ledger 정책에 영향 없음

---

## 7) 이번 범위 밖 항목

`llama-server` 빌드 이슈(WSL `cmake` 미설치)는 이번 범위에서 제외했다.

- `~/llama.cpp/build/bin/llama-server` 미존재
- `cmake` 미설치 상태 확인됨

이 상태에서 `LLAMA_SERVER` 작업 실행 시 실패코드는 의존성 미충족에 따른 정상 신호로 해석한다.
