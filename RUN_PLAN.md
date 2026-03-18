# 실행 플랜 (autosortd_1py.py 기준)

**autosortd_1py.py** 실행 조건·단계·검증만 정리. 데몬 + LLM(llama.cpp 또는 Ollama) 사용.

---

## 1. 실행 전제조건 (autosortd_1py.py)

- **Python 3.x**
- **필수 패키지**: `watchdog`, `requests`, `pyyaml`  
  (venv 권장: `C:\_AUTOSORT\.venv` → [INSTALL_NEXT.md](INSTALL_NEXT.md) 참고)
- **출력 루트**: `C:\_AUTOSORT` (또는 `--root` 지정). 하위에 `staging/`, `out/`, `quarantine/`, `dup/`, `logs/`, `cache/` 자동 생성.
- **규칙 YAML 필수**: `--rules_dir`(기본 `C:\_AUTOSORT\rules`) 아래에 **rules.yaml**, **mapping.yaml** 반드시 존재. 없으면 데몬 기동 시 로드 실패.
- **LLM 서버 1개 기동**: llama.cpp(8080) 또는 Ollama(11434). 데몬 기동 시 warmup 호출.

---

## 2. Option A — autosortd_1py.py + llama.cpp (기본 --llm)

**조건:** WSL에서 llama-server 기동 완료 → `http://127.0.0.1:8080/v1` 사용 가능.

**단계:**

1. **LLM 서버 기동 (WSL)**  
   [INSTALL_NEXT.md](INSTALL_NEXT.md) §2 참고. 예:
   ```bash
   cd ~/llama.cpp/build
   ./bin/llama-server --hf-repo itlwas/Qwen2-1.5B-Instruct-Q4_K_M-GGUF --hf-file qwen2-1.5b-instruct-q4_k_m.gguf -c 2048
   ```
2. **규칙 준비**  
   `C:\_AUTOSORT\rules\rules.yaml`, `C:\_AUTOSORT\rules\mapping.yaml` 존재 확인. (프로젝트 `rules/` 내용 복사 또는 `--rules_dir`로 프로젝트 rules 경로 지정)
3. **데몬 실행**
   ```bash
   python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\대상폴더" [--llm "http://127.0.0.1:8080/v1"] [--sweep]
   ```
4. **종료**: Ctrl+C → observer 정리 후 종료.

**인자:** `--root`(기본 `C:\_AUTOSORT`), `--watch`(기본 `~/Downloads`), `--llm`(기본 `http://127.0.0.1:8080/v1`), `--rules_dir`(기본 `C:\_AUTOSORT\rules`), `--sweep`(기동 시 기존 파일 1회 처리).

---

## 3. Option B — autosortd_1py.py + Ollama

**조건:** Windows에서 Ollama 서버 기동 → `http://127.0.0.1:11434/v1` (OpenAI 호환) 사용 가능.

**단계:**

1. **Ollama 서버 기동**  
   `run_ollama_serve.ps1` 또는 `C:\_ollama\ollama.exe serve`
2. (필요 시) 모델: `ollama pull qwen2:1.5b`
3. **데몬 실행 시 --llm 만 Ollama로 지정**
   ```bash
   python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\대상폴더" --llm "http://127.0.0.1:11434/v1" [--sweep]
   ```

동일 코드 경로: `llm_classify` → `POST .../chat/completions`.

---

## 4. 검증 체크리스트

- `{root}/logs/ledger.jsonl` 에 before/after/run_id 등 기록 여부
- 삭제 0: 이동만, overwrite 없음
- Dev 분류 시 원본 파일명 유지 (리네임 금지)

---

**참고:** 1회 스캔만 필요하면 [autosortd.py](autosortd.py) 사용 (`--watch`, `--base`, `--dry-run`).
