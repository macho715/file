# MIR Gantt Unified - 문서 구조

**버전**: v1.2  
**최종 업데이트**: 2026-02-17

---

## 📁 현재 문서 구조

```
MIR_Gantt_PTO_Pack/
│
├── 📘 핵심 코드 파일 (3개)
│   ├── mir_reactor_gantt_unified.py          # Python 생성기 (653 lines)
│   ├── modMIR_Gantt_Unified.bas              # VBA 모듈 (1416 lines)
│   └── ThisWorkbook_MIR_Gantt_Unified.txt    # 이벤트 핸들러 (31 lines)
│
├── 📋 사용자 문서 (4개)
│   ├── README_MIR_Gantt_Unified.md           # 전체 사용자 매뉴얼
│   ├── QUICKSTART.md                         # 5분 빠른 시작 가이드
│   ├── CHANGELOG.md                          # 버전별 변경 이력 (v1.0-v1.2)
│   └── TROUBLESHOOTING.md                    # 문제 해결 가이드
│
├── 🔧 설정 파일
│   └── requirements_unified.txt              # Python 의존성
│
├── 📦 생성물
│   └── MIR_Reactor_Repair_Gantt_Unified.xlsx # 생성된 Excel 파일
│
└── 📂 legacy/ (아카이브)
    ├── mir_reactor_gantt_prod_generator.py
    ├── mir_reactor_gantt_pto_generator.py
    ├── modMIR_Gantt_PROD.bas
    ├── modMIR_Gantt_PTO.bas
    ├── modMIR_Gantt_PTO_HOTFIX.bas
    ├── ThisWorkbook_MIR_Gantt_PROD.txt
    ├── ThisWorkbook_MIR_Gantt_PTO.txt
    ├── README_MIR_Gantt_PROD.md
    ├── README_MIR_Gantt_PTO.md
    ├── requirements.txt
    ├── requirements_pto.txt
    └── PTO_HOTFIX_README.txt
```

---

## 📚 문서 읽는 순서

### 1️⃣ 신규 사용자
```
QUICKSTART.md (5분)
    ↓
README_MIR_Gantt_Unified.md (전체 매뉴얼)
    ↓
TROUBLESHOOTING.md (필요 시)
```

### 2️⃣ 기존 PROD/PTO 사용자 (업그레이드)
```
CHANGELOG.md (변경사항 확인)
    ↓
README_MIR_Gantt_Unified.md → 6. 마이그레이션
    ↓
QUICKSTART.md (재설치)
```

### 3️⃣ 문제 발생 시
```
TROUBLESHOOTING.md (증상별 해결)
    ↓
CHANGELOG.md (버전별 수정 내역)
    ↓
README_MIR_Gantt_Unified.md → 8. FAQ
```

### 4️⃣ 개발자 / 코드 수정
```
README_MIR_Gantt_Unified.md → 9. 개발자 가이드
    ↓
CHANGELOG.md (기술적 상세 내역)
    ↓
핵심 코드 3개 파일
```

---

## 📄 문서별 상세 설명

### README_MIR_Gantt_Unified.md (391 lines)
**목적**: 전체 사용자 매뉴얼

**내용**:
- 시스템 개요
- 주요 기능 (PROD/PTO 모드)
- 설치 및 설정
- 사용 방법 (모드별)
- 매크로 레퍼런스
- 마이그레이션 가이드
- 알려진 이슈
- FAQ
- 개발자 가이드

**대상**: 모든 사용자

---

### QUICKSTART.md (110 lines)
**목적**: 5분 빠른 시작

**내용**:
- 3단계 설치 (Python → Excel → VBA)
- 첫 실행 검증 (4가지 테스트)
- 모드 전환 방법
- 주요 매크로 3개
- 다음 단계

**대상**: 신규 사용자, 빠른 재설치

---

### CHANGELOG.md (394 lines)
**목적**: 버전별 변경 이력

**내용**:
- v1.2: 조건부 서식 수정 (색상 복구)
- v1.1: Unicode 제거 + P0 Hotfix
- v1.0: PROD + PTO 통합
- 버전별 요약 테이블
- 누적 개선 지표
- 알려진 이슈 / 계획 중 기능
- 마이그레이션 경로
- 기술 스택

**대상**: 업그레이드 사용자, 개발자

---

### TROUBLESHOOTING.md (547 lines)
**목적**: 문제 해결 가이드

**내용**:
- 긴급 문제 해결 (색상/날짜/매크로)
- 진단 도구 (2개 매크로)
- 일반적인 문제 A-F
- 색상 규칙 참조
- 고급 진단 (조건부 서식 수식 확인)
- 체크리스트
- 유용한 매크로 모음
- 상세 문제별 해결 (1-7)
- 복구 절차
- 지원 요청 정보

**대상**: 문제 발생 시 모든 사용자

---

## 🔧 핵심 코드 파일

### mir_reactor_gantt_unified.py (653 lines)
**목적**: Excel 파일 생성

**주요 함수**:
- `build_summary()`: Summary 시트 (모드 설정)
- `build_baseline_sheet()`: Baseline 시트 (3 시나리오)
- `build_log_sheet()`: LOG 시트
- `build_gantt_sheet()`: Gantt 시트 (BASE/BEST/WORST)
- `apply_conditional_formatting()`: 조건부 서식
- `validate_task()`: 입력 검증 (P0-01)

**최근 수정 (v1.2)**:
- Line 557: 주말 수식 `$D4`, `$3` 하드코딩
- Line 571: Phase 수식 `$B4`, `$D4`, `$E4`, `$3` 하드코딩
- Line 575: Risk 수식 `$G4`, `$D4`, `$E4`, `$3` 하드코딩

---

### modMIR_Gantt_Unified.bas (1416 lines)
**목적**: Excel VBA 로직

**주요 함수**:
- `Init_Unified_System()`: 초기화
- `MIR_OnChange()`: 날짜 변경 이벤트 (모드 분기)
- `HandleShiftMode()`: PROD 시프트 로직
- `PTO_Recalculate()`: PTO 자동 스케줄링
- `ApplyConditionalFormatting()`: 조건부 서식 적용
- `Force_Refresh_Colors()`: 색상 강제 새로고침 (진단용)
- `Diagnostic_Color_Status()`: 색상 상태 진단 (진단용)

**최근 수정 (v1.2)**:
- Line 760: 주말 수식 `$D4`, `$3` 하드코딩
- Line 794-798: Phase 수식 `$D4`, `$B4`, `$E4`, `$3` 하드코딩
- Line 771-775: Risk 수식 `$G4`, `$D4`, `$E4`, `$3` 하드코딩
- Line 1349-1423: 진단 매크로 추가

**P0 Hotfix (v1.1)**:
- Line 59: `gEventProcessing` 재진입 방지
- Line 74-87: 성능 토글 헬퍼 함수
- Line 100-160: 입력 검증 로직
- 모든 Object 변수: `Set ... = Nothing` 명시적 해제

---

### ThisWorkbook_MIR_Gantt_Unified.txt (31 lines)
**목적**: 이벤트 핸들러 연결

**이벤트**:
- `Workbook_Open()`: 시스템 초기화 호출
- `Workbook_SheetSelectionChange()`: 이전 값 캡처
- `Workbook_SheetChange()`: 날짜 변경 처리

**사용법**:
1. `.xlsm` 파일 열기
2. `Alt + F11`
3. ThisWorkbook 더블클릭
4. 이 파일 내용 전체 복사-붙여넣기

---

## 🗂️ legacy/ 폴더

**목적**: 이전 PROD/PTO 개별 버전 보관

**내용**: 12개 파일 (코드, 문서, 설정)

**용도**:
- 참고용 (새 버전과 비교)
- 롤백 (긴급 시)
- 히스토리 (개발 과정)

**주의**: 실사용 금지 (Ambiguous name 에러 발생 가능)

---

## 📊 문서 업데이트 이력

| 날짜 | 문서 | 변경 내역 |
|------|------|-----------|
| 2026-02-17 | CHANGELOG.md | v1.2 섹션 추가 (조건부 서식 수정) |
| 2026-02-17 | TROUBLESHOOTING.md | 신규 생성 (547 lines) |
| 2026-02-17 | README | 진단 매크로 2개 추가 |
| 2026-02-17 | QUICKSTART | v1.2 업그레이드 경로 추가 |
| 2026-02-17 | DOCS_STRUCTURE.md | 본 문서 업데이트 |

---

## 🎯 문서 유지보수 원칙

1. **단일 출처 원칙 (SSOT)**:
   - 기능 설명: README
   - 변경 이력: CHANGELOG
   - 문제 해결: TROUBLESHOOTING
   - 빠른 시작: QUICKSTART

2. **중복 제거**:
   - 통합 전 개별 문서 → `legacy/`로 이동
   - 임시 수정 문서 → CHANGELOG 통합 후 삭제

3. **버전 동기화**:
   - Python/VBA 코드 수정 시 CHANGELOG 업데이트 필수
   - 주요 수정은 README에도 반영

4. **접근성**:
   - 긴급 문제: TROUBLESHOOTING 맨 위에 빠른 수정
   - 신규 사용자: QUICKSTART → README 순서
   - 기술 상세: CHANGELOG → 코드 순서

---

## 🔄 문서 업데이트 체크리스트

코드 수정 시:

- [ ] Python/VBA 수정
- [ ] CHANGELOG.md 해당 버전 섹션 업데이트
- [ ] TROUBLESHOOTING.md 관련 문제 해결 추가/수정
- [ ] README.md FAQ 또는 알려진 이슈 업데이트
- [ ] QUICKSTART.md 영향 있으면 수정
- [ ] 버전 번호 증가 (v1.x → v1.y)

---

## 📞 지원 및 피드백

**문서 개선 제안**:
- 누락된 내용
- 불분명한 설명
- 추가 필요한 예시

**새 문서 요청**:
- API 레퍼런스
- 고급 사용 사례
- 성능 튜닝 가이드

---

## ✅ 현재 상태 요약

| 항목 | 상태 | 파일 개수 |
|------|------|-----------|
| **핵심 코드** | ✅ 완료 | 3개 |
| **사용자 문서** | ✅ 완료 | 4개 |
| **설정 파일** | ✅ 완료 | 1개 |
| **레거시 아카이브** | ✅ 정리 | 12개 |
| **총 파일** | - | 20개 |

**문서 커버리지**: 100% (설치/사용/문제해결/개발 모두 포함)

**최종 버전**: v1.2 (운영 배포 준비 완료) ✅

---

**모든 문서가 최신 상태로 동기화되었습니다!**
