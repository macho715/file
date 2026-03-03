# 사용 방법 가이드 (DEV-PRESET Autosort)

지정한 폴더의 파일을 자동으로 분류해 `out/`, `quarantine/` 등으로 옮기는 방법입니다. **파일은 삭제하지 않고 이동만** 합니다.

---

## 1. 사용 전 확인

| 항목 | 확인 방법 |
|------|-----------|
| Python 3.x | `python --version` |
| 패키지 (데몬 사용 시) | `pip install watchdog requests pyyaml` |
| 규칙 파일 | `rules/rules.yaml`, `rules/mapping.yaml` 존재 (또는 `C:\_AUTOSORT\rules\`에 복사) |
| Ollama (LLM 사용 시) | `C:\_ollama\ollama.exe list` 후 `ollama serve` 또는 `run_ollama_serve.ps1` |

---

## 2. 데몬으로 계속 감시 (autosortd_1py.py)

폴더를 **실시간 감시**하면서 새 파일이 생길 때마다 분류·이동합니다.

### 2.1 Ollama 사용 (권장)

1. **Ollama 서버 켜기** (한 번만)
   ```powershell
   # 방법 1: 스크립트
   .\run_ollama_serve.ps1

   # 방법 2: 직접
   C:\_ollama\ollama.exe serve
   ```
2. **(최초 1회)** 모델 받기: `ollama pull qwen2:1.5b`
3. **규칙 준비**  
   `C:\_AUTOSORT\rules\` 에 `rules.yaml`, `mapping.yaml` 넣기.  
   (프로젝트의 `rules/` 폴더 내용을 복사하거나, 실행 시 `--rules_dir "경로\rules"` 지정)
4. **데몬 실행**
   ```powershell
   cd "프로젝트_경로"
   python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\감시할폴더" --llm "http://127.0.0.1:11434/v1"
   ```
5. **종료**: 터미널에서 `Ctrl+C`

### 2.2 기동 시 이미 있는 파일까지 한 번에 처리

```powershell
python autosortd_1py.py --watch "D:\감시할폴더" --llm "http://127.0.0.1:11434/v1" --sweep
```

`--sweep` 을 주면 시작할 때 감시 폴더 안 기존 파일도 1회 처리합니다.

### 2.3 옵션 정리 (autosortd_1py.py)

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--root` | `C:\_AUTOSORT` | 정리 결과가 저장되는 루트 (out, quarantine, logs 등) |
| `--watch` | `~/Downloads` | 감시할 폴더 |
| `--llm` | `http://127.0.0.1:8080/v1` | LLM API 주소 (Ollama: `http://127.0.0.1:11434/v1`) |
| `--rules_dir` | `C:\_AUTOSORT\rules` | rules.yaml, mapping.yaml 이 있는 폴더 |
| `--sweep` | 없음 | 기동 시 기존 파일 1회 처리 |

---

## 3. 1회만 스캔 (autosortd.py)

데몬 없이 **한 번만** 스캔하고 끝내려면 `autosortd.py` 를 씁니다. (LLM 없음, 규칙+YAML만)

```powershell
# 이동 없이 먼저 확인 (권장)
python autosortd.py --watch "D:\대상폴더" --base "C:\_AUTOSORT" --dry-run

# 실제로 이동
python autosortd.py --watch "D:\대상폴더" --base "C:\_AUTOSORT"
```

- `--base`: 결과를 둘 루트 (기본: `C:\_AUTOSORT` 또는 환경변수 `AUTOSORT_BASE`)
- `--dry-run`: 이동·ledger 기록 없이 분류만 수행

---

## 4. 파일이 옮겨지는 위치

`--root`(또는 `--base`) 아래에 다음처럼 만들어집니다.

| 폴더 | 용도 |
|------|------|
| `out/Dev/Repos/` | 소스 코드 (이름 변경 안 함) |
| `out/Dev/Archives/` | zip, 7z 등 압축 |
| `out/Dev/Config/` | 설정 파일 |
| `out/Dev/Notes/` | md, txt 노트 |
| `out/Docs/Ops/` | 문서 (키워드/LLM으로 Ops 분류) |
| `out/Docs/Other/` | 기타 문서 |
| `out/Temp/` | .crdownload, .part, .tmp (안정된 것만) |
| `quarantine/` | 분류 불확실·충돌·오류 |
| `dup/` | (데몬에서) 해시 중복 |
| `logs/ledger.jsonl` | 이동 기록 (before/after, run_id 등) |

---

## 5. 동작 확인

- **ledger**: `{root}/logs/ledger.jsonl` 에 한 줄씩 기록되는지 확인
- **삭제 없음**: 이동만 있고 삭제·덮어쓰기 없음
- **Dev 파일**: 코드/설정은 원본 파일명 유지

---

## 6. 자주 쓰는 문서

- [RUN_PLAN.md](RUN_PLAN.md) — autosortd_1py.py 실행 조건·단계 (llama.cpp/Ollama)
- [INSTALL_NEXT.md](INSTALL_NEXT.md) — WSL·llama·Ollama 설치
- [AGENTS.md](AGENTS.md) — 원칙·폴더 트리·분류 정책
