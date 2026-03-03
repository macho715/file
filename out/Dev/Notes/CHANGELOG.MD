# WORKLOG: --no-llm · Electron 빌드 · 대시보드 · 문서 (2026-03)

- 작성일: 2026-03-03
- 범위: LLM 대체(PR1~3), autosort-desktop 빌드/실행, Python 대시보드, Changelog 갱신

## 변경 요약

- **autosortd_1py.py**: `--no-llm` 옵션 추가. 미분류 문서(.pdf/.docx/.xlsx) → quarantine, ledger reason `no_llm_ambiguous_doc`. warmup 스킵.
- **autosort-triage-apply.py**: 트리아지 적용 브릿지 스크립트 신규. `move_with_ledger(..., action='triage_apply')` 사용.
- **규칙/매핑**: rules 확장, mapping `allow_auto_apply` 추가. no-llm 테스트·reason 보정.
- **autosort-desktop**: build 스크립트를 `for %I in ("%ProgramFiles%\nodejs\node.exe") do @"%~sI"` 형태로 변경(Program Files 공백 회피). Electron 재설치 후 `npm start` 정상 기동.
- **문서**: NO_LOCAL_LLM_WORKFLOW.md, PLAN_LLM_REPLACEMENT.md 등. README 문서 인덱스 갱신.
- **대시보드**: Python `dashboard.py` — `--root`, `--refresh` 로 ledger/cache 현황 터미널 출력.

## 검증

- `pytest -q` 통과. `autosortd_1py.py --no-llm --help` / `autosort-triage-apply.py --dry-run` 확인.
- `npm run build` (build:main + build:renderer) 성공. `npm start`로 Electron 앱 기동 확인.
- Windows에서 npm run build 실패 원인은 툴체인 미설치가 아니라 **경로/PATH 해석 이슈**. `package.json` build 스크립트에 `for %I in (...) do @"%~sI"` 적용으로 해결. 상세: autosort-desktop/docs/WORKLOG_BUILD_WINDOWS_2026-03.md.

## 안전성

- 삭제 없음, Dev 리네임 유지, Ledger 필수, Quarantine 정책 준수.

---

# WORKLOG: Task Scheduler 안정화 + autosortd 중복실행 방지
2

3
- 작성일: 2026-02-28
4
- 범위: 계획서 기준 `1 + 2 + 4`
5
  - (1) Task Scheduler 재등록 안정화
6
  - (2) `/DELAY` 30초 포맷 확정
7
  - (4) `RUN_AUTOSORTD.cmd` 중복 실행 방지
8

9
---
10

11
## 1) 작업 배경 및 목표
12

13
초기 상태에서 확인된 문제는 아래 4가지였다.
14

15
1. `LLAMA_SERVER`, `AUTOSORTD` 작업 등록/재등록 실패
16
2. `/DELAY` 30초 표기 형식 혼선
17
3. `llama-server` 미빌드 (이번 범위 제외)
18
4. `RUN_AUTOSORTD.cmd`가 상주 프로세스 중복 실행 가능
19

20
이번 작업의 목표는:
21

22
- 표준 작업명으로 통일: `\AUTOSORT\LLAMA_SERVER`, `\AUTOSORT\AUTOSORTD`
23
- 지연 시간 표준: `/DELAY 0000:30` (`mmmm:ss`)
24
- `RUN_AUTOSORTD.cmd`에 중복 실행 방지 구현
25

26
---
27

28
## 2) 사실 확인(진단) 결과
29

30
### 2.1 Task Scheduler 현재 상태
31

32
아래 조회 결과, 현재 작업은 존재하지 않는다.
33

34
- `schtasks /Query /TN "\AUTOSORT\LLAMA_SERVER"` -> `The system cannot find the file specified.`
35
- `schtasks /Query /TN "\AUTOSORT\AUTOSORTD"` -> `The system cannot find the file specified.`
36

37
레거시 이름도 삭제 시도 결과 모두 `MISSING`:
38

39
- `\LLAMA_SERVER`
40
- `\AUTOSORTD`
41
- `\AUTOSORTD_OCAL`
42
- `\AUTOSORT\LLAMA_SERVER`
43
- `\AUTOSORT\AUTOSORTD`
44

45
### 2.2 `/DELAY` 포맷 확정
46

47
도움말로 형식 확인:
48

49
- `schtasks /Create /?` 출력: `mmmm:ss`
50
- 확정값: `/DELAY 0000:30`
51

52
### 2.3 권한 상태
53

54
현재 세션 관리자 권한 확인 결과:
55

56
- `([WindowsPrincipal][WindowsIdentity]::GetCurrent()).IsInRole(Administrator)` -> `False`
57

58
즉, `schtasks /Create ...`는 현재 세션에서 `Access is denied` 발생.
59

60
---
61

62
## 3) 실제 변경 사항
63

64
## 3.1 변경 파일 요약
65

66
- `C:\_AUTOSORT\RUN_AUTOSORTD.cmd` (중복 실행 방지 핵심)
67
- `C:\_AUTOSORT\is_autosortd_running.ps1` (프로세스 검사 스크립트 추가)
68
- `C:\_AUTOSORT\register_autosort_tasks.ps1` (관리자 권한 재등록 자동화 추가)
69

70
### 3.2 `RUN_AUTOSORTD.cmd` 상세
71

72
다음 동작을 추가했다.
73

74
1. 프로세스 기반 중복 확인
75
- `is_autosortd_running.ps1` 호출
76
- `autosortd_1py.py` + `--watch C:\_AUTOSORT\inbox` 실행 중이면 즉시 `exit /b 0`
77

78
2. lock fallback
79
- lock 디렉터리: `C:\_AUTOSORT\cache\autosortd_watch_inbox.lock`
80
- 프로세스 조회 실패/권한 이슈에서도 lock으로 중복 차단
81

82
3. stale lock 복구
83
- lock 생성 실패 시 기존 lock 정리 후 1회 재시도
84
- stale lock이 남아 실행이 막히는 케이스 복구
85

86
4. 로그 분리
87
- skip/runner 로그: `C:\_AUTOSORT\logs\autosortd_runner.log`
88
- 메인 stdout/stderr 로그와 충돌하지 않게 분리
89

90
### 3.3 `is_autosortd_running.ps1` 상세
91

92
- 입력: `-WatchPath` (기본 `C:\_AUTOSORT\inbox`)
93
- `Win32_Process`의 `Name + CommandLine` 기반 매칭
94
- 매칭 성공 시 `1`, 아니면 `0`
95
- 예외 발생 시 `0` 반환 (런처 전체 중단 방지)
96

97
### 3.4 `register_autosort_tasks.ps1` 상세
98

99
- 관리자 권한 강제 체크 (`Assert-Admin`)
100
- 레거시 작업 삭제 후 표준 작업 재생성
101
  - `\AUTOSORT\LLAMA_SERVER`
102
  - `\AUTOSORT\AUTOSORTD` (`/DELAY 0000:30`)
103
- 생성 후 조회 검증 + XML에서 `PT30S` 확인
104

105
---
106

107
## 4) 검증 결과
108

109
### 4.1 중복 실행 방지 검증
110

111
검증 명령(요지):
112

113
- `RUN_AUTOSORTD.cmd` 연속 2회 실행
114
- 실행 전후 논리 인스턴스 수 비교
115

116
결과:
117

118
- `LOGICAL_BEFORE=1 LOGICAL_AFTER=1 DELTA=0`
119
- 즉, 2회 연속 실행해도 신규 논리 인스턴스 증가 없음
120

121
참고:
122

123
- 프로세스 총수는 `TOTAL=2`일 수 있음
124
- 부모/자식 형태로 떠서 `LOGICAL=1`이면 단일 런 인스턴스로 판단
125

126
### 4.2 runner 로그 확인
127

128
`C:\_AUTOSORT\logs\autosortd_runner.log`에서 아래 동작 확인:
129

130
- `autosortd already running ... Skip duplicate launch.`
131
- `removed stale autosortd lock and continued.`
132

133
즉, 중복 방지 및 stale lock 복구 모두 실제 작동 확인.
134

135
### 4.3 스케줄러 등록 검증
136

137
현재 세션에서는 미완료(권한 제한):
138

139
- `schtasks /Create ...` -> `Access is denied`
140
- 따라서 `\AUTOSORT\LLAMA_SERVER`, `\AUTOSORT\AUTOSORTD`는 아직 미등록 상태
141

142
---
143

144
## 5) 남은 작업(권한 필요)
145

146
관리자 PowerShell에서 아래 1회 실행:
147

148
```powershell
149
powershell -NoProfile -ExecutionPolicy Bypass -File C:\_AUTOSORT\register_autosort_tasks.ps1
150
```
151

152
성공 시 기대 결과:
153

154
1. `\AUTOSORT\LLAMA_SERVER` 생성
155
2. `\AUTOSORT\AUTOSORTD` 생성
156
3. `AUTOSORTD` XML에 `PT30S` 포함
157

158
수동 확인:
159

160
```powershell
161
schtasks /Query /TN "\AUTOSORT\LLAMA_SERVER" /V /FO LIST
162
schtasks /Query /TN "\AUTOSORT\AUTOSORTD" /V /FO LIST
163
schtasks /Query /TN "\AUTOSORT\AUTOSORTD" /XML
164
```
165

166
---
167

168
## 6) 안전성 체크(요구사항 준수)
169

170
- 사용자 파일 삭제 없음
171
- 분류기 본체(`autosortd_1py.py`) 로직 변경 없음
172
- 스케줄러/런처 레이어만 변경
173
- Dev rename/no-delete/ledger 정책에 영향 없음
174

175
---
176

177
## 7) 이번 범위 밖 항목
178

179
`llama-server` 빌드 이슈(WSL `cmake` 미설치)는 이번 범위에서 제외했다.
180

181
- `~/llama.cpp/build/bin/llama-server` 미존재
182
- `cmake` 미설치 상태 확인됨
183

184
이 상태에서 `LLAMA_SERVER` 작업 실행 시 실패코드는 의존성 미충족에 따른 정상 신
