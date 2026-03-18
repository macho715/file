# MIR Gantt Unified - 문제 해결 가이드

**버전**: v1.2  
**최종 업데이트**: 2026-02-17

---

## 🚨 긴급 문제 해결

### 색상이 전혀 표시되지 않음

**빠른 수정**:
1. Gantt 시트 선택 (Gantt_BASE/BEST/WORST)
2. `Alt + F8` (매크로 실행)
3. `Force_Refresh_Colors` 선택
4. "실행" 클릭

**또는**:
1. `Alt + F11` (VBA 편집기)
2. `Ctrl + G` (즉시 실행 창)
3. 입력:
   ```vba
   modMIR_Gantt_Unified.Force_Refresh_Colors
   ```
4. `Enter`

**예상 결과**: "Color formatting refreshed on Gantt_BASE" 메시지

---

### 날짜 변경이 자동 반영되지 않음

#### PROD 모드 (AUTO_SCHEDULE_PTO = OFF)

**확인 사항**:
1. Summary 시트 → `AUTO_SHIFT = ON` 확인
2. 편집한 태스크에 "FIXED" 키워드가 없는지 확인
3. LOG 시트에서 에러 확인

**수동 재계산**:
```vba
modMIR_Gantt_Unified.Recalculate_Active_Scenario
```

#### PTO 모드 (AUTO_SCHEDULE_PTO = ON)

**확인 사항**:
1. Summary 시트 → `AUTO_SCHEDULE_PTO = ON` 확인
2. Predecessor (I열)가 올바른 Step ID인지 확인
3. Predecessor Step이 실제 존재하는지 확인

**수동 재계산**:
```vba
modMIR_Gantt_Unified.Recalculate_All_Scenarios
```

---

### 매크로가 실행되지 않음

**원인 1: 파일 형식**
- 확인: 파일이 `.xlsm`인지 확인 (`.xlsx`는 매크로 불가)
- 수정: 다른 이름으로 저장 → "Excel 매크로 사용 통합 문서 (*.xlsm)" 선택

**원인 2: 매크로 보안**
1. 파일 → 옵션 → 보안 센터 → 보안 센터 설정
2. 매크로 설정: "경고 표시(모든 매크로 제외)" 선택
3. 파일 닫기 → 다시 열기
4. "콘텐츠 사용" 클릭

**원인 3: VBA 모듈 누락**
1. `Alt + F11`
2. VBA Project에서 `modMIR_Gantt_Unified` 확인
3. 없으면: 파일 → 파일 가져오기 → `modMIR_Gantt_Unified.bas`

---

## 📊 진단 도구

### 1. 색상 상태 진단

```vba
modMIR_Gantt_Unified.Diagnostic_Color_Status
```

**출력 예시**:
```
=== COLOR DIAGNOSTIC ===

Active Sheet: Gantt_BASE
Is Gantt Sheet: True

--- Configuration ---
REPAINT_MODE: CF
AUTO_SCHEDULE_PTO: False
AUTO_SHIFT: True

--- Formatting Status ---
Conditional Format Rules: 9
Data Rows: 10
Date Columns: 45
```

**해석**:
- `Conditional Format Rules: 9` → 정상 (주말 1개 + Phase 7개 + Risk 1개)
- `Conditional Format Rules: 0` → 문제! (Force_Refresh_Colors 실행)

---

### 2. LOG 시트 확인

1. **LOG** 시트로 이동
2. 최근 로그 확인 (아래에서 위로)
3. 에러 코드 확인:

| 에러 코드 | 의미 | 해결 방법 |
|-----------|------|-----------|
| 1004 (NumberFormat) | NumberFormat 설정 불가 | AllowFormattingCells:=True 확인 |
| 1004 (병합된 셀) | 병합된 셀에서 실행 불가 | v2.1 패치 적용 (RebuildTimeline UnMerge 추가) |
| 5 | 프로시저 호출/인수 오류 | v1.2.1 패치 적용 (CF 규칙 강건화) |
| 9 | 범위 초과 | 날짜 범위 확인 |
| 13 | 타입 불일치 | 날짜 형식 확인 |
| Re-entry blocked | 재진입 차단 (정상) | 무시 가능 |

---

## 🔧 일반적인 문제

### 문제 A: Gantt 바가 일부만 표시됨

**원인**: 날짜 범위 또는 데이터 오류

**확인**:
1. Start (D열) / End (E열) 날짜가 유효한지 확인
2. Days (F열) 값이 일치하는지 확인
   - 계산: `Days = (End - Start) + 1`
3. Start > End인 경우 LOG에 경고 기록됨

**수정**:
- 잘못된 날짜 수정
- 또는 `Reset_Active_Scenario_To_Baseline` 실행

---

### 문제 B: HIGH Risk가 빨강이 아님

**원인**: Risk 값이 "HIGH" 또는 "WARNING"이 아님

**확인**:
1. Risk 열 (G열) 값 확인
2. 유효한 값: `OK`, `AMBER`, `HIGH`, `WARNING`
3. 대소문자 구분 없음 (VBA SEARCH는 case-insensitive)

**수정**:
- 드롭다운에서 `HIGH` 또는 `WARNING` 선택
- 또는 직접 입력 (자동 완성 지원)

---

### 문제 C: 주말이 회색이 아님

**원인**: 주말 조건부 서식 규칙 누락

**확인**:
1. 날짜 헤더 (3행)의 날짜가 올바른지 확인
2. K3, L3... 셀에 날짜 값 확인 (예: 2026-02-17)

**수정**:
```vba
modMIR_Gantt_Unified.Force_Refresh_Colors
```

---

### 문제 D: 파일 열 때마다 색상 사라짐

**원인**: `Workbook_Open` 이벤트 미실행

**확인**:
1. ThisWorkbook에 코드가 있는지 확인:
   - Alt + F11
   - VBA Project → ThisWorkbook 더블클릭
   - `Workbook_Open` 서브루틴 확인

**수정**:
- `ThisWorkbook_MIR_Gantt_Unified.txt` 내용을 ThisWorkbook에 붙여넣기
- 저장 후 파일 다시 열기

---

### 문제 E: Predecessor가 작동하지 않음

**원인**: PTO 모드가 비활성화됨

**확인**:
1. Summary 시트 → `AUTO_SCHEDULE_PTO` 값 확인
2. `OFF`이면 Predecessor/Lag는 무시됨 (PROD 모드)

**수정**:
- `AUTO_SCHEDULE_PTO = ON` 설정
- 매크로 실행: `Recalculate_Active_Scenario`

---

### 문제 F: FIXED 태스크가 시프트됨

**원인**: STOP_AT_FIXED 설정 확인

**확인**:
1. Summary 시트 → `STOP_AT_FIXED` 값 확인
2. Task 열 (C열)에 "FIXED" 키워드 확인

**동작**:
- PROD 모드 + `STOP_AT_FIXED=ON`: FIXED 태스크 이후는 시프트 안 됨
- PTO 모드: FIXED는 Predecessor 무시하고 Start 날짜 유지

---

## 🎨 색상 규칙 참조

### Phase 색상 (우선순위 2-8)

| Phase 키워드 | 색상 | Hex |
|--------------|------|-----|
| DOC | 파랑 | 5EB8FF |
| PICKUP | 파랑 | 5EB8FF |
| UAE_REP | 보라 | A78BFA |
| TRANS_OUT | 주황 | FB923C |
| KSA_REP | 분홍 | F472B6 |
| TRANS_BACK | 초록 | 6BDFB0 |
| FINAL | 노랑 | FACC15 |

### 특수 색상

| 조건 | 색상 | 우선순위 |
|------|------|----------|
| **주말** (토/일) | 회색 (0D1020) | 1 (낮음) |
| **HIGH/WARNING Risk** | 빨강 (FF5F5F) | 9 (최상) |
| **오늘 날짜** | 빨간 테두리 | - |

### 색상 우선순위 규칙

Excel 조건부 서식은 **마지막에 추가된 규칙이 우선**합니다:

1. 주말 (회색 배경)
2. DOC Phase (파랑)
3. PICKUP Phase (파랑)
4. UAE_REP Phase (보라)
5. TRANS_OUT Phase (주황)
6. KSA_REP Phase (분홍)
7. TRANS_BACK Phase (초록)
8. FINAL Phase (노랑)
9. **HIGH/WARNING Risk (빨강)** ← `SetFirstPriority`로 최우선

따라서 Risk가 HIGH면 Phase 색상을 덮어씁니다.

---

## 🔍 고급 진단

### 조건부 서식 수동 확인

1. Gantt 시트에서 날짜 셀 선택 (K4 이후)
2. 홈 → 조건부 서식 → 규칙 관리
3. 규칙 개수 확인: **9개** 있어야 정상
4. 각 규칙의 수식 확인:
   - 주말: `=AND($D4<>"",WEEKDAY(K$3,2)>5)`
   - Phase: `=AND($D4<>"",ISNUMBER(SEARCH("DOC",$B4)),K$3>=$D4,K$3<=$E4)`
   - Risk: `=AND($D4<>"",K$3>=$D4,K$3<=$E4,OR(ISNUMBER(SEARCH("HIGH",$G4)),ISNUMBER(SEARCH("WARNING",$G4))))`

### 수식 문법 확인

**올바른 수식**:
- `$D4` ✅ (D열 고정, 4행 상대)
- `K$3` ✅ (K열 상대, 3행 고정)

**잘못된 수식**:
- `$D$4` ❌ (모두 고정, 상대 참조 불가)
- `$D & FIRST_DATA_ROW` ❌ (변수 결합, 텍스트 처리)

---

## 📋 체크리스트

색상 문제 발생 시:

- [ ] Gantt 시트 선택 확인 (Gantt_BASE/BEST/WORST)
- [ ] `Diagnostic_Color_Status` 실행
- [ ] `Force_Refresh_Colors` 실행
- [ ] Summary 시트 `REPAINT_MODE = CF` 확인
- [ ] 시트 보호 해제 후 재시도
- [ ] Start/End 날짜 유효성 확인
- [ ] Risk 값 유효성 확인 (HIGH/WARNING)
- [ ] LOG 시트에서 에러 확인
- [ ] 매크로 보안 설정 확인
- [ ] VBA 모듈 버전 확인 (v1.2)

날짜 자동 변경 문제 시:

- [ ] AUTO_SHIFT (PROD) 또는 AUTO_SCHEDULE_PTO (PTO) 설정 확인
- [ ] 편집 대상 셀 확인 (Start/End/Days/Pred/Lag)
- [ ] 그룹 행이 아닌지 확인
- [ ] FIXED 태스크 여부 확인
- [ ] Predecessor 존재성 확인 (PTO 모드)
- [ ] `Recalculate_Active_Scenario` 수동 실행
- [ ] LOG 시트 에러 확인

---

## 🛠️ 유용한 매크로

### 진단 및 수정

```vba
' 색상 상태 진단
modMIR_Gantt_Unified.Diagnostic_Color_Status

' 색상 강제 새로고침
modMIR_Gantt_Unified.Force_Refresh_Colors

' 시스템 초기화
modMIR_Gantt_Unified.Init_Unified_System

' 현재 시트 재계산
modMIR_Gantt_Unified.Recalculate_Active_Scenario

' 모든 시트 재계산
modMIR_Gantt_Unified.Recalculate_All_Scenarios

' 초기화 (Baseline으로 복원)
modMIR_Gantt_Unified.Reset_Active_Scenario_To_Baseline
modMIR_Gantt_Unified.Reset_All_Scenarios_To_Baseline

' 시트 보호 관리
modMIR_Gantt_Unified.Protect_All_Gantt
modMIR_Gantt_Unified.Unprotect_All_Gantt
```

**실행 방법**:
- `Alt + F8` → 매크로 선택 → 실행
- 또는 `Alt + F11` → `Ctrl + G` → 명령어 입력 → `Enter`

---

## 🔍 상세 문제별 해결

### 1. "5 - 프로시저 호출 또는 인수가 잘못되었습니다" (ApplyConditionalFormatting)

**원인**: 조건부 서식 수식이 너무 복잡하거나 Excel 버전/언어 설정 문제

**증상**:
- LOG 시트에 "ApplyConditionalFormatting ... 5 - 프로시저 호출..." 메시지
- 색상이 부분적으로 또는 전혀 표시되지 않음
- 파일 열 때마다 반복 발생

**확인**:
1. LOG 시트에서 에러 5 확인
2. Excel 버전 확인 (Office LTSC 2021 권장)
3. 시스템 언어/지역 설정 확인

**수정 (v1.2.1에서 해결)**:
- VBA 모듈에 에러 처리 강화
- 수식을 변수로 분리하여 가독성 향상
- `On Error Resume Next`로 안전장치 추가

**임시 해결책**:
```vba
' 수동으로 색상 적용
modMIR_Gantt_Unified.Force_Refresh_Colors
```

---

### 2. "1004 - Range 클래스 중 NumberFormat 속성을 설정할 수 없습니다"

**원인**: 시트 보호 설정에서 `AllowFormattingCells:=False`

**확인**:
1. LOG 시트에서 1004 에러 확인
2. VBA 코드 Line 945 확인:
   ```vba
   AllowFormattingCells:=True  ' 이 값이 True여야 함
   ```

**수정 (v1.1에서 해결됨)**:
- v1.2 이상 버전 사용
- 또는 VBA 모듈 재임포트

---

### 3. "컴파일 오류" (Unicode 문자)

**원인**: VBA 소스 코드에 Unicode 문자 `⚠` 포함

**확인**:
1. VBA 편집기에서 컴파일 (Debug → Compile)
2. 에러 라인 확인

**수정 (v1.1에서 해결됨)**:
- v1.1 이상 버전 사용
- 모든 `⚠` 문자 제거됨
- Risk 값: `HIGH` 또는 `WARNING` 사용

---

### 3. "Ambiguous name detected"

**원인**: PROD와 PTO 모듈을 동시에 임포트

**확인**:
- VBA Project에 `modMIR_Gantt_PROD`와 `modMIR_Gantt_PTO`가 동시에 존재

**수정**:
- 기존 PROD/PTO 모듈 모두 삭제
- `modMIR_Gantt_Unified.bas`만 임포트

---

### 4. Predecessor 순환 참조

**원인**: Step A의 Predecessor가 Step B이고, Step B의 Predecessor가 Step A

**증상**:
- PTO 재계산 시 무한 루프
- Excel 응답 없음

**수정**:
- Predecessor 관계 검토
- 순환 참조 제거
- LOG에 "Re-entry blocked" 메시지 확인

---

### 5. Days 값이 Start/End와 불일치

**원인**: 수동 편집 또는 계산 오류

**확인**:
```
Days = (End - Start) + 1

예: Start=2026-02-17, End=2026-02-19
    → Days = (19-17) + 1 = 3 (2/17, 2/18, 2/19)
```

**수정 (v1.1 입력 검증)**:
- Python 생성 시 자동 검증
- VBA에서 `ValidateTaskRow()` 호출
- LOG에 경고 기록

---

### 6. 주말이 스킵되지 않음

**원인**: `SHIFT_WORKDAYS_ONLY = OFF`

**확인**:
1. Summary 시트 → `SHIFT_WORKDAYS_ONLY` 값 확인
2. `OFF`: 달력 날짜 사용 (주말 포함)
3. `ON`: 평일만 사용 (토/일 건너뜀)

**동작 예시**:
```
SHIFT_WORKDAYS_ONLY = OFF:
  2026-02-21 (금) + 2일 = 2026-02-23 (일)

SHIFT_WORKDAYS_ONLY = ON:
  2026-02-21 (금) + 2일 = 2026-02-25 (화)
  (토, 일 건너뜀)
```

---

### 7. "개체 변수 또는 With 블록 변수가 설정되지 않았습니다" (91 에러)

**원인**: 잘못된 Summary 시트 참조 또는 Named Range 누락

**확인**:
1. Summary 시트가 존재하는지 확인
2. 수식 → 이름 관리자 → Named Range 확인:
   - `CFG_AUTO_SCHEDULE_PTO`
   - `CFG_AUTO_SHIFT`
   - `CFG_STOP_AT_FIXED`
   - `CFG_KEEP_DURATION`
   - `CFG_SHIFT_WORKDAYS_ONLY`
   - `CFG_REPAINT_MODE`

**수정**:
- Python 스크립트로 Excel 재생성
- 또는 Summary 시트 복원

---

## 🔄 복구 절차

### 전체 초기화 (마지막 수단)

1. **백업**: 현재 `.xlsm` 파일 복사
2. **재생성**:
   ```bash
   python mir_reactor_gantt_unified.py
   ```
3. **VBA 재설치**:
   - 새 `.xlsx` 열기
   - `.xlsm`으로 저장
   - Alt + F11
   - `modMIR_Gantt_Unified.bas` 임포트
   - ThisWorkbook 코드 붙여넣기
4. **데이터 복원** (필요 시):
   - 백업 파일의 Gantt 시트에서 데이터 복사
   - 새 파일의 Gantt 시트에 붙여넣기

---

## 📞 지원 요청 시 제공 정보

문제 해결이 안 될 경우, 다음 정보를 제공해주세요:

1. **버전 정보**:
   - Python: `python --version`
   - openpyxl: `pip show openpyxl`
   - Excel 버전

2. **LOG 시트 최근 5줄**:
   ```
   (타임스탬프 | Proc | Sheet | Row | Col | Message)
   ```

3. **Diagnostic 출력**:
   ```vba
   modMIR_Gantt_Unified.Diagnostic_Color_Status
   ```
   실행 결과 전체

4. **증상 설명**:
   - 어떤 작업을 했는지
   - 예상 결과
   - 실제 결과
   - 재현 단계

---

## 📚 관련 문서

- **CHANGELOG.md**: 버전별 변경 이력
- **README_MIR_Gantt_Unified.md**: 전체 사용자 매뉴얼
- **QUICKSTART.md**: 5분 설치 가이드
- **legacy/**: 기존 PROD/PTO 문서 (참고용)

---

## ✅ 빠른 참조

### 가장 흔한 3가지 문제

1. **색상 안 보임** → `Force_Refresh_Colors`
2. **날짜 안 바뀜** → Summary 설정 확인 + `Recalculate_Active_Scenario`
3. **매크로 안 됨** → `.xlsm` 형식 확인 + 매크로 사용 클릭

### 긴급 복구

```vba
' 1. 색상 복구
modMIR_Gantt_Unified.Force_Refresh_Colors

' 2. 전체 재계산
modMIR_Gantt_Unified.Recalculate_All_Scenarios

' 3. 초기화
modMIR_Gantt_Unified.Reset_All_Scenarios_To_Baseline
```

---

**문제가 해결되지 않으면 LOG 시트를 확인하고 위의 지원 요청 정보를 수집하세요.**
