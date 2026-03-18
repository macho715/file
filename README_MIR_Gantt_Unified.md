# MIR Reactor Repair Gantt — UNIFIED Edition (PROD + PTO)

**통합 버전: PROD 수동 시프트 모드 + PTO 자동 스케줄링 모드**

## 📋 개요

MIR Gantt Unified는 기존의 PROD와 PTO 두 버전을 하나의 시스템으로 통합한 버전입니다.  
Summary 시트에서 `AUTO_SCHEDULE_PTO` 설정을 변경하여 두 가지 스케줄링 방식을 자유롭게 전환할 수 있습니다.

### 주요 특징

- **단일 Excel 파일**: 하나의 `.xlsx` (또는 `.xlsm`) 파일로 모든 기능 제공
- **모드 선택**: Summary 시트에서 실시간 모드 전환 가능
- **10개 메타 컬럼**: # | Phase | Task | Start | End | Days | Risk | Notes | Predecessor | Lag
- **단일 Baseline**: 시나리오별 데이터를 하나의 Baseline 시트에서 관리
- **하위 호환**: 기존 PROD/PTO 사용자 모두 동일한 방식으로 사용 가능

---

## 📦 패키지 구성

```
MIR_Gantt_PTO_Pack/
├── mir_reactor_gantt_unified.py          # 통합 Python 생성기
├── modMIR_Gantt_Unified.bas              # 통합 VBA 모듈
├── ThisWorkbook_MIR_Gantt_Unified.txt    # 이벤트 핸들러 코드
├── README_MIR_Gantt_Unified.md           # 본 문서
├── requirements_unified.txt              # Python 의존성
│
├── legacy/                                # 기존 PROD/PTO 파일 보관
│   ├── mir_reactor_gantt_prod_generator.py
│   ├── mir_reactor_gantt_pto_generator.py
│   └── (기타 개별 파일들)
│
└── MIR_Reactor_Repair_Gantt_Unified.xlsx # 생성된 통합 Excel
```

---

## 🚀 빠른 시작 (5분 설치)

### 1. Excel 파일 생성

```bash
# Python 3.11.x 이상 필요
pip install -r requirements_unified.txt
python mir_reactor_gantt_unified.py
```

생성된 파일: `MIR_Reactor_Repair_Gantt_Unified.xlsx`

### 2. VBA 매크로 추가 (Excel에서)

1. `MIR_Reactor_Repair_Gantt_Unified.xlsx` 열기
2. **다른 이름으로 저장** → **Excel 매크로 사용 통합 문서 (*.xlsm)** 선택
3. **Alt + F11** (VBA 편집기 열기)
4. **파일 → 파일 가져오기...** → `modMIR_Gantt_Unified.bas` 선택
5. VBA Project에서 **ThisWorkbook** 더블클릭
6. `ThisWorkbook_MIR_Gantt_Unified.txt` 내용을 복사하여 붙여넣기
7. VBA 편집기 닫기 → `.xlsm` 저장
8. Excel 닫고 다시 열기 → **매크로 사용** 클릭

### 3. 초기화

매크로 실행: `Init_Unified_System` (자동 실행됨 - Workbook_Open 이벤트)

---

## 🎯 사용 방법

### 모드 선택 (Summary 시트)

| 설정 | 값 | 설명 |
|------|-----|------|
| **AUTO_SCHEDULE_PTO** | **OFF** | **PROD 모드**: 수동 날짜 편집 + 하위 태스크 자동 시프트 |
| **AUTO_SCHEDULE_PTO** | **ON** | **PTO 모드**: Predecessor/Lag 기반 자동 계산 |

### PROD 모드 (AUTO_SCHEDULE_PTO = OFF)

**특징**: 수동으로 날짜를 편집하면 하위 태스크가 자동으로 이동합니다.

**사용 방법**:
1. Gantt_BASE (또는 BEST/WORST) 시트 열기
2. Start (D열) 또는 End (E열) 날짜 직접 편집
3. 하위 태스크들이 자동으로 시프트됨
4. "FIXED" 키워드가 있는 태스크에서 시프트 중단

**예시**:
```
Step 3a의 Start를 2026-02-21 → 2026-02-23으로 변경
→ Step 3b, 4a, 4b... 모두 +2일 자동 시프트
→ Step 1 (FIXED)는 영향 받지 않음
```

**주요 설정** (Summary 시트):
- `AUTO_SHIFT = ON`: 시프트 활성화
- `STOP_AT_FIXED = ON`: FIXED 태스크에서 중단
- `KEEP_DURATION = ON`: Start 편집 시 기간 유지 (End 자동 조정)
- `SHIFT_WORKDAYS_ONLY = OFF`: 달력 날짜 사용 (ON이면 평일만)

---

### PTO 모드 (AUTO_SCHEDULE_PTO = ON)

**특징**: Predecessor와 Lag를 설정하면 날짜가 자동으로 계산됩니다.

**사용 방법**:
1. Summary 시트에서 `AUTO_SCHEDULE_PTO = ON` 설정
2. Gantt 시트에서 Predecessor (I열)와 Lag (J열) 편집
3. 날짜가 자동으로 재계산됨

**예시**:
```
Step 3a: Predecessor = "2", Lag = 0
→ Start = Step 2의 End + 1일
→ End = Start + Days - 1

Step 3b: Predecessor = "3a", Lag = -1
→ Start = Step 3a의 End + (-1 + 1) = Step 3a의 End와 동일
```

**계산 규칙**:
- `Start = max(Predecessor의 End) + (Lag + 1)`
- `End = Start + Days - 1`
- Predecessor가 여러 개인 경우: 쉼표로 구분 (`"3a,3b"`)
- Predecessor가 없거나 FIXED인 경우: Start 날짜 유지

**주요 설정**:
- Days (F열): 작업 기간
- Predecessor (I열): 선행 태스크 ID (쉼표 구분)
- Lag (J열): 추가 대기 일수 (음수 가능)

**수동 재계산**:
- 매크로 실행: `Recalculate_Active_Scenario` 또는 `Recalculate_All_Scenarios`

---

## 🔄 모드 전환

### PROD → PTO 전환

1. PROD 모드에서 날짜를 수동으로 조정
2. Summary 시트에서 `AUTO_SCHEDULE_PTO = ON` 변경
3. Predecessor와 Lag 컬럼 작성
4. 매크로 실행: `Recalculate_All_Scenarios`

### PTO → PROD 전환

1. PTO 모드에서 자동 계산된 날짜 확인
2. Summary 시트에서 `AUTO_SCHEDULE_PTO = OFF` 변경
3. 날짜를 직접 편집하면 하위 시프트 동작
4. Predecessor/Lag 컬럼은 무시됨 (비워도 됨)

---

## ⚙️ Summary 시트 설정 전체

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `AUTO_SCHEDULE_PTO` | OFF | PTO 모드 활성화 (ON=PTO, OFF=PROD) |
| `AUTO_SHIFT` | ON | 날짜 편집 시 하위 태스크 시프트 (PROD only) |
| `STOP_AT_FIXED` | ON | FIXED 태스크에서 시프트 중단 |
| `KEEP_DURATION` | ON | Start 편집 시 기간 유지 (End 자동 조정) |
| `SHIFT_WORKDAYS_ONLY` | OFF | 평일만 사용 (주말 건너뜀) |
| `REPAINT_MODE` | CF | 렌더링 모드 (CF=빠름, PAINT=스냅샷용) |

---

## 🎨 Gantt 바 렌더링

### CF 모드 (권장)

- **조건부 서식**을 사용하여 Gantt 바 렌더링
- 빠르고 안정적
- Excel 기본 기능 사용

### PAINT 모드

- VBA가 셀을 직접 칠함
- PDF 출력 또는 스냅샷 용도
- 느리지만 이식성 좋음

**전환 방법**: Summary 시트에서 `REPAINT_MODE` 변경 후 `Refresh_All` 매크로 실행

---

## 🔧 유용한 매크로

| 매크로 이름 | 기능 |
|-------------|------|
| `Init_Unified_System` | 통합 시스템 초기화 (자동 실행) |
| `Recalculate_Active_Scenario` | 현재 시트만 재계산 |
| `Recalculate_All_Scenarios` | 모든 시나리오 재계산 |
| `Reset_Active_Scenario_To_Baseline` | 현재 시나리오를 Baseline으로 초기화 |
| `Reset_All_Scenarios_To_Baseline` | 모든 시나리오 초기화 |
| `Protect_All_Gantt` | 모든 Gantt 시트 보호 (입력 셀은 편집 가능) |
| `Unprotect_All_Gantt` | 모든 Gantt 시트 보호 해제 |

**실행 방법**: Alt + F8 → 매크로 이름 선택 → 실행

---

## 📊 시트 구조

### Summary

- 모드 선택 및 설정
- KPI 요약 (향후 추가 가능)
- 사용 방법 안내

### Gantt_BASE / BEST / WORST

- 10개 메타 컬럼 + 날짜 타임라인
- 3가지 시나리오 (기본/최선/최악)
- 조건부 서식으로 Gantt 바 렌더링

### Baseline

- 모든 시나리오의 초기 데이터 저장
- Scenario 컬럼으로 구분
- Reset 매크로가 이 데이터 참조

### LOG

- VBA 실행 로그
- 디버깅 및 추적 용도

---

## 🔄 마이그레이션 가이드

### 기존 PROD 사용자

기존 PROD 버전 사용자는 별도 작업 없이 바로 사용 가능합니다:

1. 통합 `.xlsx` 열기
2. Summary 시트에서 `AUTO_SCHEDULE_PTO = OFF` 확인 (기본값)
3. 기존과 동일하게 Start/End 편집
4. (선택) Predecessor/Lag 활용 원하면 PTO 모드로 전환

**차이점**:
- 메타 컬럼이 8개에서 10개로 증가 (Predecessor, Lag 추가)
- Predecessor/Lag 컬럼은 비워두면 됨 (영향 없음)

### 기존 PTO 사용자

기존 PTO 버전 사용자도 바로 사용 가능합니다:

1. 통합 `.xlsx` 열기
2. Summary 시트에서 `AUTO_SCHEDULE_PTO = ON` 설정
3. 기존과 동일하게 Predecessor/Lag 사용
4. (선택) 수동 편집 필요 시 PROD 모드로 전환

**차이점**:
- Baseline 구조가 단일 시트로 통합
- 시나리오별 `BASELINE_*` 시트 → 단일 `Baseline` 시트 (Scenario 컬럼)

---

## 🎓 학습 시나리오

### 시나리오 1: PROD 모드 수동 조정

```
목표: Step 3a를 2일 연기

1. Gantt_BASE 시트 열기
2. Step 3a의 Start (D열) 클릭
3. 2026-02-21 → 2026-02-23으로 변경
4. Enter 키
5. Step 3b, 4a, 4b... 자동으로 +2일 이동 확인
6. Step 1 (FIXED)는 변경되지 않음 확인
```

### 시나리오 2: PTO 모드 자동 계산

```
목표: Step 3a를 Step 2 완료 후 즉시 시작

1. Summary 시트 → AUTO_SCHEDULE_PTO = ON
2. Gantt_BASE → Step 3a의 Predecessor (I열) = "2"
3. Lag (J열) = 0
4. Enter 키
5. Step 3a의 Start가 Step 2 End + 1일로 자동 계산됨
6. Step 2의 End 변경 시 Step 3a도 자동으로 변경됨 확인
```

### 시나리오 3: 모드 전환

```
목표: PROD로 수동 조정 후 PTO로 전환

1. AUTO_SCHEDULE_PTO = OFF (PROD 모드)
2. Step 3a를 2026-02-25로 수동 변경
3. 하위 태스크들이 시프트됨 확인
4. Summary → AUTO_SCHEDULE_PTO = ON (PTO 모드 전환)
5. Predecessor/Lag 설정
6. Alt + F8 → Recalculate_All_Scenarios 실행
7. Predecessor 관계에 따라 전체 일정 재계산됨
```

---

## 🐛 문제 해결

### 매크로가 실행되지 않음

- Excel 매크로 보안 설정 확인
- 파일이 `.xlsm` 형식인지 확인
- 매크로 사용 클릭했는지 확인

### 날짜가 자동으로 변경되지 않음

**PROD 모드**:
- Summary → `AUTO_SHIFT = ON` 확인
- 편집한 태스크가 FIXED가 아닌지 확인

**PTO 모드**:
- Summary → `AUTO_SCHEDULE_PTO = ON` 확인
- Predecessor가 올바르게 입력되었는지 확인
- 수동으로 `Recalculate_Active_Scenario` 실행

### Gantt 바가 표시되지 않음

- `REPAINT_MODE = CF` 확인
- 조건부 서식이 삭제되었다면 `Refresh_All` 매크로 실행
- Start/End 날짜가 유효한지 확인

### LOG 시트에 오류 메시지

- LOG 시트의 Message 컬럼 확인
- 해당 Sheet/Row/Col 위치에서 데이터 검증
- Predecessor가 존재하지 않는 Step을 참조하는지 확인

---

## 📝 개발자 노트

### 코드 구조

- **Python 생성기** (`mir_reactor_gantt_unified.py`):
  - 10개 컬럼 레이아웃
  - 단일 Baseline 시트
  - 통합 Summary 설정
  
- **VBA 모듈** (`modMIR_Gantt_Unified.bas`):
  - 모드 분기: `CfgOn("CFG_AUTO_SCHEDULE_PTO")`
  - PROD 로직: `HandleShiftMode`, `ShiftDownstream`
  - PTO 로직: `PTO_Recalculate`
  - 공통 함수: `HexToLong`, `LogMsg`, 날짜 헬퍼

### 확장성

- 새로운 모드 추가 시: Summary에 설정 추가 + VBA에 분기 추가
- 새로운 시나리오 추가 시: `get_tasks_unified()` 함수에 케이스 추가
- 새로운 컬럼 추가 시: `META_COLS` 상수 변경 + 컬럼 상수 추가

---

## 🔗 관련 문서

- **PROD 버전 README**: `legacy/README_MIR_Gantt_PROD.md`
- **PTO 버전 README**: `legacy/README_MIR_Gantt_PTO.md`
- **Python 코드**: `mir_reactor_gantt_unified.py`
- **VBA 코드**: `modMIR_Gantt_Unified.bas`

---

## 📄 라이선스 및 크레딧

- **프로젝트**: MIR Reactor Repair (HVDC Logistics)
- **버전**: Unified 1.0
- **날짜**: 2026-02-17
- **환경**: Office LTSC 2021, Python 3.11.x

---

## 🎉 완료!

이제 MIR Gantt Unified를 사용할 준비가 되었습니다.

**다음 단계**:
1. Python 스크립트 실행하여 Excel 생성
2. VBA 모듈 임포트하여 .xlsm 저장
3. Summary 시트에서 모드 선택
4. Gantt 시트에서 일정 편집

**질문이나 문제가 있으면** LOG 시트를 확인하거나 VBA 코드의 LogMsg를 참조하세요.

Happy Gantt Charting! 📊✨
