1. **판정: 예(가능)** — 지금 상태에서 “완전 자동 실행” 여부는 **3가지 증거(이벤트 감지·파일 이동·ledger/cache 기록)**로 5분 안에 검증 가능합니다.
2. **근거:** MVP는 `watchdog` 이벤트(`on_created/on_moved`) → `move_with_ledger()` 실행 → `logs/ledger.jsonl` append + `cache/cache.json` 업데이트가 **자동 실행의 SSOT 증거**입니다.
3. **다음행동:** 아래 **검증 시나리오 6개**를 순서대로 실행하고, 각 단계에서 “PASS/FAIL”만 확인하세요.

---

## 0) 검증 전제(SSOT 체크 3개)

| No | 체크       | PASS 기준                       | FAIL 시 원인 후보         |
| -: | -------- | ----------------------------- | -------------------- |
|  1 | 데몬 실행 중  | PowerShell 창이 살아있고 에러 없이 대기   | venv 미활성/모듈 누락       |
|  2 | LLM 서버   | `http://127.0.0.1:8080/v1` 응답 | WSL 포트포워딩/서버 미기동     |
|  3 | watch 경로 | `--watch`가 실제 폴더              | 경로 오타/권한/OneDrive 충돌 |

---

## 1) “완전 자동” 1차 판정: 로그 2개만 보면 끝

### (A) ledger가 쌓이는지

```powershell
Get-Content C:\_AUTOSORT\logs\ledger.jsonl -Tail 5
```

**PASS:** 새 파일을 넣을 때마다 `action:"move"` 레코드가 1줄 이상 추가
**FAIL:** 변화 없음 → 이벤트 미감지/이동 실패/권한 문제

### (B) cache가 업데이트되는지

**A) 파일 갱신 여부(가장 빠름):**
```powershell
(Get-Item C:\_AUTOSORT\cache\cache.json).LastWriteTime
```

**B) SHA 키 개수·샘플 확인:**
```powershell
python -c "import json; d=json.load(open(r'C:\_AUTOSORT\cache\cache.json','r',encoding='utf-8')); print('keys:', len(d)); print('sample:', next(iter(d.items())) if d else None)"
```

**PASS:** LastWriteTime이 파일 추가 시 갱신되고, SHA 키가 늘며 `decision/reason/after` 누적
**FAIL:** cache 파일이 비거나 갱신 안 됨 → 처리 함수 미호출 가능성

---

## 2) 테스트 파일 6개로 “완전 자동” 검증 (가장 확실)

> **주의:** 테스트는 반드시 “watch 폴더”에 넣어야 합니다.

### Test-1: 소스코드(리네임 금지 + Dev\Repos 이동)

1. watch 폴더에 `test1.py` 만들기:

```powershell
Set-Content "$env:USERPROFILE\Downloads\test1.py" "print('hi')"
```

**PASS 기대**

* 파일이 `C:\_AUTOSORT\out\Dev\Repos\test1.py`로 이동
* ledger reason: `auto_apply` 또는 `rule:*`

### Test-2: 압축파일(tr_dash-main 패턴)

```powershell
New-Item "$env:USERPROFILE\Downloads\tr_dash-main.zip" -ItemType File | Out-Null
```

**PASS 기대**

* `out\Dev\Archives\tr_dash-main\...` 또는 `out\Dev\Archives\...`로 이동(당신 mapping 기준)
* `tag_overrides` 적용되면 하위 폴더로 들어감

### Test-3: drive-download 패턴 zip

```powershell
New-Item "$env:USERPROFILE\Downloads\drive-download-20260209T194440Z-1-001.zip" -ItemType File | Out-Null
```

**PASS 기대**

* `out\Dev\Archives\drive-download\...`로 이동

### Test-4: 문서 키워드(AGI_TR + DPR)

```powershell
New-Item "$env:USERPROFILE\Downloads\15111578 - DPR - AGI TR Units.pdf" -ItemType File | Out-Null
```

**PASS 기대**

* `out\Docs\Ops\AGI_TR\DPR\...`로 이동(룰 매칭만으로 처리 → LLM 호출 없음 가능)

### Test-5: fallback(other) 강제 quarantine (게이트 검증)

룰에 안 걸리게 일부러 만들기:

```powershell
New-Item "$env:USERPROFILE\Downloads\random_unknown_doc.pdf" -ItemType File | Out-Null
```

**PASS 기대**

* 무조건 `C:\_AUTOSORT\quarantine\...`로 이동
* ledger reason: `forced_quarantine_doc_type` 또는 `not_in_allowlist_doc_type` 류

### Test-6: 미완료 다운로드(.crdownload) — 안정화 후 처리

```powershell
New-Item "$env:USERPROFILE\Downloads\zzz_incomplete.crdownload" -ItemType File | Out-Null
```

**PASS 기대**

* **안정성 체크 통과**(크기 2회 연속 동일): `out\Temp\`로 이동 (reason: auto_apply, doc_type: temp)
* **안정성 체크 실패**(타임아웃 20초 내 미안정): `quarantine\`으로 이동, reason: `unstable_file`

---

## 3) LLM 호출이 실제로 되나? (선별 호출 검증)

LLM 호출은 “PDF/DOCX/XLSX + 룰 확신도 낮음”에서만 발생.

### 방법(가장 단순)

* watch 폴더에 **내용이 있는 .txt/.md가 아니라**, **.docx/.xlsx**를 하나 넣고(룰에 안 걸리게 이름을 random으로)
* 그때 ledger에 `reason`이 `llm_parse_fail`이 뜨면 실패(LLM이 JSON을 못 줬거나 서버 연결 불가)
* 정상이라면 `cache.json`에 `decision`이 들어가고 `confidence`가 기록됨

### 서버 연결 체크(즉시)

```powershell
# PowerShell에서 8080 열려있는지 확인
Test-NetConnection 127.0.0.1 -Port 8080
```

**PASS:** `TcpTestSucceeded : True`
**FAIL:** WSL 포트/서버 미기동/방화벽

---

## 4) “정말 완전 자동” 운영 상태 점검 4가지

| 점검     | PASS 기준               | 확인 위치                |
| ------ | --------------------- | -------------------- |
| 이벤트 처리 | 새 파일 생성 즉시 이동         | out/quarantine/dup   |
| 규칙 우선  | dev_code/zip은 즉시 처리   | ledger reason에 rule  |
| 게이트    | other는 무조건 quarantine | quarantine 폴더        |
| 감사/복구  | run_id로 롤백 가능         | ledger + `rollback.py` (제공됨. `python rollback.py --run_id <id> [--dry_run]`) |

---

## 5) 가장 흔한 FAIL 원인 TOP 5 (즉시 해결)

1. **watch 경로가 다름**: Downloads에 넣었는데 `--watch D:\...`로 실행
2. **OneDrive 폴더**: 동기화/잠금으로 move 실패 → watch는 로컬 고정 폴더 권장
3. **권한 문제**: 회사 정책 폴더/보호 폴더
4. **WSL 서버 미기동**: 8080 포트 안 열림
5. **파일이 너무 빨리 생성/이동**: 브라우저 다운로드 완료 이벤트가 `on_moved`로 오므로, 현재 코드가 `on_moved` 처리하는지 확인(최종본은 포함됨)

---

## CmdRec (3)

* `/redo step` : “테스트 파일 6종 자동 생성 + PASS/FAIL 체크” 스크립트로 묶기
* `/logi-master report` : ledger.jsonl 기반 검증 리포트 자동 생성
* `/switch_mode ORACLE + /logi-master kpi-dash` : 자동적용률/격리율/dup율 대시보드 KPI

---

원하면, 당신이 지금 사용 중인 `--watch` 경로(예: Downloads vs 작업폴더) 기준으로 **테스트 스크립트를 1개(ps1)**로 만들어서 “한 번 실행하면 6개 케이스 자동 검증 + 결과 PASS/FAIL 출력”까지 고정해 드릴 수 있습니다.
