# 설치 다음 단계 (수동 1회)

## 지금까지 완료된 것
- WSL2 + Ubuntu 확인
- **llama.cpp** 저장소 클론 완료: `~/llama.cpp` (WSL 홈)
- **C:\_AUTOSORT** 폴더 8개 생성 (inbox, staging, out, quarantine, dup, logs, rules, cache)
- **Python venv** `C:\_AUTOSORT\.venv` + watchdog, pydantic, rapidfuzz 설치

---

## 1) WSL에서 cmake 설치 + llama.cpp 빌드 (필수)

Ubuntu 터미널을 열고 아래 중 하나 실행.

**방법 A — 스크립트 한 번에 (권장)**  
PowerShell에서 스크립트를 WSL로 복사한 뒤, **Ubuntu 터미널**을 열어 실행:

```powershell
wsl -d Ubuntu -e bash -c "cp /mnt/c/Users/minky/Downloads/file/wsl_llama_setup.sh ~/wsl_llama_setup.sh && chmod +x ~/wsl_llama_setup.sh"
```

이후 **Ubuntu**에서: `~/wsl_llama_setup.sh` (sudo 비밀번호 입력 필요)

또는 **방법 B — Ubuntu 터미널에서 직접**:

```bash
sudo apt-get update && sudo apt-get install -y git cmake build-essential
cd ~/llama.cpp
mkdir -p build && cd build
cmake ..
cmake --build . --config Release -j
```

빌드가 끝나면 `~/llama.cpp/build/bin/` 에 `llama-server`, `llama-cli` 가 생깁니다.

---

## 2) 모델 다운로드 + 서버 실행 (빌드 후)

Ubuntu에서:

```bash
cd ~/llama.cpp/build
./bin/llama-server \
  --hf-repo itlwas/Qwen2-1.5B-Instruct-Q4_K_M-GGUF \
  --hf-file qwen2-1.5b-instruct-q4_k_m.gguf \
  -c 2048
```

첫 실행 시 GGUF 다운로드가 이루어지고, 이후 `http://localhost:8080` 로 API 사용 가능.

---

## 3) Ollama ARM64 — **설치 완료**

| 항목 | 값 |
|------|-----|
| 설치 경로 | `C:\_ollama` (ollama.exe) |
| 모델 경로 | `C:\_ollama_models` (User env `OLLAMA_MODELS` 설정됨) |
| 모델 | `qwen2:1.5b` — 풀 진행 중이거나 완료 후 사용 가능 |

**실행 방법**

1. 서버 띄우기 (한 터미널):  
   `C:\_ollama\ollama.exe serve`
2. 다른 터미널에서 채팅:  
   `C:\_ollama\ollama.exe run qwen2:1.5b`  
   또는 먼저 풀만: `C:\_ollama\ollama.exe pull qwen2:1.5b`

새 터미널에서는 `OLLAMA_MODELS`가 자동 적용됨(User 환경변수). 같은 세션에서 쓸 때는 `$env:OLLAMA_MODELS = "C:\_ollama_models"` 후 실행.

---

## 4) 파일정리기 MVP

위 1~2까지 끝났으면 "세팅 완료"라고 하면 Watcher·Rule Router·LLM Classifier·Auto-Apply·Undo Ledger 포함 MVP 코드를 제공합니다.
