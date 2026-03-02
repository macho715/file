# 사용 방법 가이드

DEV-PRESET Autosort로 **지정 폴더의 파일을 자동 분류·이동**하는 방법입니다.  
파일은 **삭제하지 않고 이동만** 하며, 모든 이동은 `logs/ledger.jsonl`에 기록됩니다.

---

## 1. 실행 전 확인

| 확인 항목 | 방법 |
|-----------|------|
| Python 3.x | `python --version` |
| 패키지 (데몬용) | `pip install watchdog requests pyyaml` |
| 규칙 파일 | 프로젝트 `rules/rules.yaml`, `rules/mapping.yaml` 있음 |
| Ollama (LLM 사용 시) | `C:\_ollama\ollama.exe list` 후 서버: `C:\_ollama\ollama.exe serve` |

---

## 2. 데몬 실행 (autosortd_1py.py)

### A. Ollama로 실행 (권장)

1. **Ollama 서버 실행** (별도 터미널)
   ```powershell
   .\run_ollama_serve.ps1
   # 또는
   C:\_ollama\ollama.exe serve
   ```
2. **(최초 1회)** 모델: `ollama pull qwen2:1.5b`
3. **데몬 실행 — 반드시 `--rules_dir` 지정**  
   규칙을 프로젝트 `rules/`에서 쓰려면:
   ```powershell
   cd "프로젝트_경로"
   python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\감시할_폴더" --llm "http://127.0.0.1:11434/v1" --rules_dir ".\rules"
   ```
4. **종료**: `Ctrl+C`

또는 `C:\_AUTOSORT\rules\`에 `rules.yaml`, `mapping.yaml`을 복사해 두면 `--rules_dir` 생략 가능 (기본값 사용).

### B. llama.cpp (WSL)

1. WSL에서 llama-server 실행 ([INSTALL_NEXT.md](INSTALL_NEXT.md) §2).
2. 실행 시 `--rules_dir ".\rules"` 로 프로젝트 규칙 지정:
   ```powershell
   python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\감시할_폴더" --rules_dir ".\rules"
   ```

### 기동 시 기존 파일까지 1회 처리

```powershell
python autosortd_1py.py --watch "D:\감시할_폴더" --llm "http://127.0.0.1:11434/v1" --rules_dir ".\rules" --sweep
```

---

## 3. 옵션 요약 (autosortd_1py.py)

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--root` | `C:\_AUTOSORT` | 출력 루트 (out, quarantine, logs 등) |
| `--watch` | 사용자 Downloads | 감시할 폴더 |
| `--llm` | `http://127.0.0.1:8080/v1` | LLM API (Ollama: `http://127.0.0.1:11434/v1`) |
| `--rules_dir` | `C:\_AUTOSORT\rules` | rules.yaml, mapping.yaml 위치. **프로젝트에서 실행 시 `.\rules` 지정 권장** |
| `--sweep` | 없음 | 기동 시 기존 파일 1회 처리 |

---

## 4. 결과 폴더 구조

`--root`(또는 `C:\_AUTOSORT`) 아래:

```
out/
  Dev/Repos/      ← 소스 코드 (이름 변경 안 함)
  Dev/Archives/   ← zip, 7z 등
  Dev/Config/     ← 설정
  Dev/Notes/      ← md, txt
  Docs/Ops/       ← 문서 (키워드/LLM)
  Docs/Other/
  Temp/            ← .crdownload, .part, .tmp (안정된 것만)
quarantine/        ← 분류 불확실·오류
dup/               ← 해시 중복 (데몬)
logs/
  ledger.jsonl    ← 이동 기록
```

---

## 5. 정상 기동 확인

콘솔에 다음이 순서대로 나오면 정상 기동된 것입니다.

- `Rules loaded: N rules from ...`
- `LLM: http://127.0.0.1:11434/v1` (또는 사용한 URL)
- `Watching: D:\...`

---

## 6. 안 될 때 (점검 순서)

| 현상 | 확인·조치 |
|------|------------|
| `Error: rules.yaml not found or empty` | `--rules_dir`에 `rules.yaml`이 있는지 확인. 프로젝트에서 실행 시 **`--rules_dir ".\rules"`** 또는 **`--rules_dir "프로젝트경로\rules"`** 지정. |
| `Error: --watch path is not a directory` | `--watch`에 적은 경로가 실제 폴더인지 확인. |
| 데몬은 뜨는데 파일이 안 옮겨짐 | watch 폴더에 **새로 생성된** 파일만 처리됨. 기존 파일까지 처리하려면 **`--sweep`** 추가. |
| LLM 오류 / 문서만 분류 안 됨 | Ollama 실행 여부: `C:\_ollama\ollama.exe serve`. 포트: `netstat -an \| findstr 11434`. 규칙으로 분류되는 파일은 LLM 없이도 이동됨. |

---

## 7. 관련 문서

- [RUN_PLAN.md](RUN_PLAN.md) — 실행 조건·단계 (llama.cpp/Ollama)
- [INSTALL_NEXT.md](INSTALL_NEXT.md) — WSL·llama·Ollama 설치
- [AGENTS.md](AGENTS.md) — 원칙·폴더 트리·분류 정책
