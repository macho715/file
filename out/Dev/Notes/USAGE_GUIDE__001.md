# 사용 방법 가이드

DEV-PRESET Autosort로 **지정 폴더의 파일을 자동 분류·이동**하는 방법입니다.  
파일은 **삭제하지 않고 이동만** 하며, 모든 이동은 `logs/ledger.jsonl`에 기록됩니다.

---

## 1. 실행 전 확인

| 확인 항목 | 방법 |
|-----------|------|
| Python 3.x | `python --version` |
| 패키지 (데몬용) | `pip install watchdog requests pyyaml` |
| 규칙 파일 | `rules/rules.yaml`, `rules/mapping.yaml` 있음 (또는 `C:\_AUTOSORT\rules\`에 복사) |
| Ollama (LLM 사용 시) | `C:\_ollama\ollama.exe list` 후 서버: `C:\_ollama\ollama.exe serve` |

---

## 2. 데몬 실행 (autosortd_1py.py) — 폴더 실시간 감시

대상 폴더를 **계속 감시**하며, 새 파일이 생기면 분류 후 이동합니다.

### A. Ollama로 실행 (Windows)

1. **Ollama 서버 실행** (별도 터미널 유지)
   ```powershell
   .\run_ollama_serve.ps1
   # 또는
   C:\_ollama\ollama.exe serve
   ```
2. **(최초 1회)** 모델 설치: `ollama pull qwen2:1.5b`
3. **규칙 폴더 준비**  
   `C:\_AUTOSORT\rules\`에 `rules.yaml`, `mapping.yaml` 두기.  
   프로젝트의 `rules/`를 복사하거나, 실행 시 `--rules_dir "프로젝트경로\rules"` 지정.
4. **데몬 실행**
   ```powershell
   cd "프로젝트_경로"
   python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\감시할_폴더" --llm "http://127.0.0.1:11434/v1"
   ```
5. **종료**: `Ctrl+C`

### B. llama.cpp로 실행 (WSL)

1. WSL에서 llama-server 실행 ([INSTALL_NEXT.md](INSTALL_NEXT.md) §2 참고).
2. 규칙 준비 (위와 동일).
3. **데몬 실행** (기본 LLM이 8080이므로 `--llm` 생략 가능)
   ```powershell
   python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\감시할_폴더"
   ```

### 기동 시 기존 파일까지 한 번에 처리

```powershell
python autosortd_1py.py --watch "D:\감시할_폴더" --llm "http://127.0.0.1:11434/v1" --sweep
```

---

## 3. 옵션 요약 (autosortd_1py.py)

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--root` | `C:\_AUTOSORT` | 출력 루트 (out, quarantine, logs 등) |
| `--watch` | 사용자 Downloads | 감시할 폴더 |
| `--llm` | `http://127.0.0.1:8080/v1` | LLM API (Ollama: `http://127.0.0.1:11434/v1`) |
| `--rules_dir` | `C:\_AUTOSORT\rules` | rules.yaml, mapping.yaml 위치 |
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

## 5. 동작 확인

- **ledger**: `{root}/logs/ledger.jsonl`에 기록 생성 여부
- **삭제 없음**: 이동만 있고 덮어쓰기 없음
- **Dev 파일**: 코드/설정은 원본 파일명 유지

---

## 6. 관련 문서

- [RUN_PLAN.md](RUN_PLAN.md) — 실행 조건·단계 (llama.cpp/Ollama)
- [INSTALL_NEXT.md](INSTALL_NEXT.md) — WSL·llama·Ollama 설치
- [AGENTS.md](AGENTS.md) — 원칙·폴더 트리·분류 정책
