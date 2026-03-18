# MIR Gantt 통합 - 빠른 시작 가이드

**5분 안에 시작하기**

---

## 1. Python 환경 설정 (1분)

```bash
cd "C:\Users\SAMSUNG\Downloads\CONVERT\MIR_Gantt_PTO_Pack"
pip install -r requirements_unified.txt
```

---

## 2. Excel 파일 생성 (30초)

```bash
python mir_reactor_gantt_unified.py
```

생성됨: `MIR_Reactor_Repair_Gantt_Unified.xlsx`

---

## 3. VBA 매크로 설치 (3분)

### 3.1 Excel 열기
- `MIR_Reactor_Repair_Gantt_Unified.xlsx` 더블클릭

### 3.2 .xlsm으로 저장
1. 파일 → 다른 이름으로 저장
2. 파일 형식: **Excel 매크로 사용 통합 문서 (*.xlsm)**
3. 파일명: `MIR_Reactor_Repair_Gantt_Unified.xlsm`
4. 저장

### 3.3 VBA 모듈 가져오기
1. **Alt + F11** (VBA 편집기 열기)
2. 파일 → 파일 가져오기...
3. `modMIR_Gantt_Unified.bas` 선택
4. 열기

### 3.4 ThisWorkbook 이벤트 코드 추가
1. VBA Project Explorer에서 **ThisWorkbook** 더블클릭
2. `ThisWorkbook_MIR_Gantt_Unified.txt` 파일을 메모장으로 열기
3. 전체 내용 복사 (Ctrl + A, Ctrl + C)
4. VBA 편집기의 ThisWorkbook 창에 붙여넣기 (Ctrl + V)
5. VBA 편집기 닫기

### 3.5 저장 및 재실행
1. Excel 저장 (Ctrl + S)
2. Excel 닫기
3. `MIR_Reactor_Repair_Gantt_Unified.xlsm` 다시 열기
4. **매크로 사용** 클릭

---

## 4. 사용 시작 (30초)

### PROD 모드 (기본)
1. **Summary** 시트 열기
2. `AUTO_SCHEDULE_PTO` = **OFF** 확인 (기본값)
3. **Gantt_BASE** 시트로 이동
4. Start (D열) 또는 End (E열) 날짜 편집
5. 하위 태스크가 자동으로 이동하는지 확인

### PTO 모드 (자동 스케줄링)
1. **Summary** 시트 열기
2. `AUTO_SCHEDULE_PTO` = **ON**으로 변경
3. **Gantt_BASE** 시트로 이동
4. Predecessor (I열)와 Lag (J열) 편집
5. 날짜가 자동으로 계산되는지 확인

---

## 주요 매크로

| 매크로 | 단축키 | 기능 |
|--------|--------|------|
| `Recalculate_Active_Scenario` | Alt+F8 | 현재 시트 재계산 |
| `Recalculate_All_Scenarios` | Alt+F8 | 모든 시나리오 재계산 |
| `Reset_Active_Scenario_To_Baseline` | Alt+F8 | 초기화 |
| `Protect_All_Gantt` | Alt+F8 | 시트 보호 |
| `Unprotect_All_Gantt` | Alt+F8 | 보호 해제 |

---

## 문제 해결

### 매크로가 실행 안 됨
- 매크로 사용 클릭 안 했음 → 파일 다시 열고 매크로 사용 클릭
- .xlsx 파일임 → .xlsm으로 저장 필요

### 날짜 자동 변경 안 됨
- PROD 모드: Summary → AUTO_SHIFT = ON 확인
- PTO 모드: Summary → AUTO_SCHEDULE_PTO = ON 확인
- 수동 재계산: Alt+F8 → Recalculate_Active_Scenario

### Gantt 바가 안 보임
- REPAINT_MODE = CF 확인
- LOG 시트에서 오류 확인

---

## 완료!

이제 MIR Gantt Unified를 사용할 준비가 되었습니다.

**더 자세한 내용**: `README_MIR_Gantt_Unified.md` 참조
