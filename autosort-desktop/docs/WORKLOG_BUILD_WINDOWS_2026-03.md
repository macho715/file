# 작업 완료 문서 (상세 이력)

요청하신 "Windows 환경에서 `npm run build` 안정화" 관련 변경을 기준으로, 지금까지의 작업 내역을 **재현 가능한 기록**으로 정리합니다.

---

## 1) 결정 요약

- 대상은 `autosort-desktop` 프로젝트의 빌드 스크립트만 수정.
- 핵심 목표는 `npm run build`의 `build:main`, `build:renderer`가 Node 경로 해석 문제로 깨지는 현상 제거.
- 최종적으로 `package.json`의 스크립트를 **명시적 Node 실행 경로** 기반으로 변경.
- 최종 검증은 `npm run build` 전체 성공을 기준으로 완료.

**블로커 정정:** 초기에는 "autosort-desktop의 npm toolchain 미설치로 npm test/build 차단"으로 기록되었으나, 실제 원인은 **워크스페이스 경로 오인식** 및 **Windows에서 `npm run build` 연쇄 호출 시 tsc PATH 해석 문제**였음. Node/npm은 설치되어 있었고, `for %I in (...) do @"%~sI"` 형태로 node 경로를 short path로 고정하여 해결함.

---

## 2) 작업 대상

- 파일: `autosort-desktop/package.json`

---

## 3) 변경 파일 상세

- **package.json**
  - `scripts.build:main`
  - `scripts.build:renderer`
- 나머지 파일/모듈은 수정 없음.

---

## 4) 변경 이력(시퀀스) 및 판단 근거

### 1차 수정

- **기존**
  - `build:main`: `tsc -p tsconfig.main.json`
  - `build:renderer`: `vite`
- 간접 실행이 Windows 경로/환경에서 불안정할 수 있어 명시 경로로 변경 시도.

### 2차 수정

- `node_modules/.bin` 직접 호출 방식으로 변경
  - `build:main`: `node_modules\.bin\tsc.cmd -p tsconfig.main.json`
  - `build:renderer`: `node_modules\.bin\vite.cmd build`
- 의도: npm PATH 우회.

### 실행 검증(실패)

- `npm run build` 단계에서 `node` 자체가 인식되지 않음.
- 에러: `'node' is not recognized as an internal or external command`
- 원인: `node` 바이너리 PATH 의존성이 낮은 실행환경 존재.

### 3차 수정

- `node`를 절대 경로로 고정하는 형태 적용
  - `"%ProgramFiles%\nodejs\node.exe" ...`
- 실행 검증(실패)
- 에러: `'C:\Program' is not recognized as an internal or external command`
- 이유: `Program Files`의 공백이 cmd에서 분해되어 처리되는 방식 문제.

### 4차 수정(최종 확정)

- cmd의 `%~sI`를 이용해 short path로 변환하여 공백 문제 제거
- 최종 적용값:
  - `build:main`: `for %I in ("%ProgramFiles%\nodejs\node.exe") do @"%~sI" ./node_modules/typescript/bin/tsc -p tsconfig.main.json`
  - `build:renderer`: `for %I in ("%ProgramFiles%\nodejs\node.exe") do @"%~sI" ./node_modules/vite/bin/vite.js build`

---

## 5) 최종 스크립트(반영 상태)

```json
"build:main": "for %I in (\"%ProgramFiles%\\nodejs\\node.exe\") do @\"%~sI\" ./node_modules/typescript/bin/tsc -p tsconfig.main.json",
"build:renderer": "for %I in (\"%ProgramFiles%\\nodejs\\node.exe\") do @\"%~sI\" ./node_modules/vite/bin/vite.js build"
```

---

## 6) 확인 결과(증적)

- **실행 명령:** `npm run build`
- **위치:** `C:\Users\SAMSUNG\Downloads\file-main\autosort-desktop`
- **결과:** 성공 (exit code 0)
- **핵심 동작 로그**
  - `build:main` 수행 완료
  - `build:renderer` 수행 완료
  - Vite 번들 빌드 성공 (`✓ built`)
- **부가 메시지**
  - `ExperimentalWarning: Type Stripping is an experimental feature...` (빌드 자체는 성공)

---

## 7) 리스크/안전 체크 (AGENTS 기준)

- **No delete:** 본 작업은 삭제 없음.
- **No rename:** 파일명 변경 없음.
- **No watcher/런타임 동작 변경 없음.**
- **Ledger/변경 추적:** 실행성 작업 위주라 ledger 항목은 해당 없음(도구 실행 로그 및 이력은 대화 로그로 추적 가능).
- **안정성:** Windows 경로 공백 처리 문제를 short path 변환으로 완화.
- **남은 위험:**
  - Node가 `%ProgramFiles%\nodejs\node.exe`가 아닌 경로에 설치된 환경에서는 재조정 필요.
  - `npm` 스크립트는 Windows cmd 문법 기반이므로 PowerShell 직접 실행에서는 `cmd /c npm run build`가 권장.

---

## 8) 왜 이 변경이 동작하는가

- 기존 실패 원인은 `npm`이 내부적으로 실행하는 Node 커맨드가 환경 PATH 의존이 컸음.
- 직접 `node_modules/bin` 실행기 경로로 변경해도 내부 wrapper(`.cmd`)가 node 실행에 PATH 의존을 남김.
- 최종적으로 `node` 실행 파일 경로를 명시하고, 공백(`Program Files`)을 `for ... %~sI` short-path로 변환해 안정적으로 실행되도록 처리.

---

## 9) 후속 권장 작업

- 필요 시 동일 패턴을 `package` 또는 `start` 경로에도 동일하게 적용 가능성 점검.
- 배포 환경에서 Node 설치 경로가 상이하면, 공용 변수 기반으로 대체 가능:
  - `npm config get prefix` 기반 동적 탐색
  - 또는 Node 경로를 `npm run` 외부에서 주입하는 방식

---

## 10) 사용자용 복붙 요약(팀 공유용)

- **변경 대상:** `autosort-desktop/package.json`
- **변경 포인트:** `build:main`, `build:renderer`를 직접 node 경로 호출로 변경
- **검증 완료:** `npm run build` 성공
- **핵심 이유:** cmd 환경에서 `node` PATH/공백 경로 실패 회피
- **잔여 주의:** Node가 `Program Files` 이외에 설치된 환경은 분기 필요
