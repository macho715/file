1. **판정: 예(가능)** — **HP OMEN 16 (x64, Intel i5-13500HX, 32GB RAM)**에서 로컬 LLM/에이전트(파일정리) 구축 가능합니다.
2. **근거:** Ollama는 **Windows ARM64 바이너리(zip)**를 릴리즈 자산으로 제공하며, llama.cpp는 **CPU 빌드/실행**을 공식 README에서 안내합니다. ([GitHub][1])
3. **다음행동:** 아래 **A(WSL2+llama.cpp) SSOT**로 먼저 세팅 → 이후 **B(Ollama ARM64)**는 편의 레이어로 추가하세요.

---

## EN Sources (≤3)

* llama.cpp 빌드/사용(공식 README) ([GitHub][2])
* Ollama GitHub Releases에 **ollama-windows-arm64.zip** 제공 ([GitHub][1])
* Qwen2 1.5B Instruct GGUF(Q4_K_M) + llama.cpp CLI/Server 사용 예시 ([huggingface.co][3])

---

## 현재 환경 SSOT (확정)

| No | Item   | Value                  | Risk             | Evidence |
| -: | ------ | ---------------------- | ---------------- | -------- |
|  1 | Device | HP OMEN by HP Gaming Laptop 16-wf0xxx | Low              | 로컬 확인 |
|  2 | Arch   | AMD64 (x64)            | Low              | 로컬 확인 |
|  3 | CPU    | 13th Gen Intel Core i5-13500HX (20 logical) | Low | 로컬 확인 |
|  4 | RAM    | 32 GB                  | Low              | 로컬 확인 |
|  5 | GPU    | Intel UHD Graphics (내장) | Medium(속도)    | 로컬 확인 |
|  6 | 목표   | 로컬 LLM + 완전자동 파일정리기 | Low              | 사용자 요청   |

---

# 옵션 3개(세팅 경로)

## Option A (추천, SSOT) — **WSL2 + Ubuntu + llama.cpp**

* Pros: CPU-only에서 가장 예측 가능, GGUF 생태계 풍부
* Cons: 최초 1회 빌드 필요
* Cost: 0.00 AED
* Risk: Low
* Time: Medium

## Option B — **Ollama Windows (x64/ARM64)**

* Pros: 설치/서빙 쉬움, 모델 관리 편함
* Cons: CPU-only라 모델/CTX 보수적으로
* Cost: 0.00 AED
* Risk: Low~Medium
* Time: Short
* Evidence: Windows x64/ARM64 바이너리 제공 ([GitHub][1]). **현재 PC: x64.**

## Option C — **LM Studio(GUI)**

* Pros: GUI로 다운로드/실행 편함
* Cons: CPU-only에서 무거운 모델은 느림
* ⚠️AMBER: 이번 답변은 LM Studio 공식 요구사항 인용을 Sources 3개 제한 때문에 제외(원하면 다음 턴에 근거 포함해 세팅 절차 제공)

---

# 세팅 Step-by-Step (A: WSL2 + llama.cpp 기준)

## 1) Windows 기본 준비(필수)

1. **Windows 업데이트 완료**
2. 전원 모드: **최고 성능(Best performance)** 권장(콜드/웜 변동 줄임)
3. 저장공간: 모델/캐시 포함 **여유 20GB+** 확보

## 2) WSL2 설치(필수)

PowerShell(관리자 권장)에서:

```powershell
wsl --install -d Ubuntu
wsl --update
```

설치 후 재부팅(필요 시) → Ubuntu 실행

## 3) Ubuntu(WSL) 빌드 환경 설치

Ubuntu 터미널에서:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git cmake build-essential
```

## 4) llama.cpp 빌드

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
mkdir -p build && cd build
cmake ..
cmake --build . --config Release -j
```

(빌드 방식은 공식 README에 `make`/`CMake` 옵션이 안내되어 있습니다. ([GitHub][2]))

## 5) 모델 설치(추천: Qwen2 1.5B Q4_K_M)

llama.cpp는 Hugging Face repo/file을 직접 받는 예시가 제공됩니다. ([huggingface.co][3])
빌드 디렉토리에서:

```bash
./bin/llama-cli \
  --hf-repo itlwas/Qwen2-1.5B-Instruct-Q4_K_M-GGUF \
  --hf-file qwen2-1.5b-instruct-q4_k_m.gguf \
  -p "한국어로 3줄 요약해줘: 오늘 해야 할 일은..."
```

## 6) 로컬 서버로 띄우기(에이전트 연동용)

```bash
./bin/llama-server \
  --hf-repo itlwas/Qwen2-1.5B-Instruct-Q4_K_M-GGUF \
  --hf-file qwen2-1.5b-instruct-q4_k_m.gguf \
  -c 2048
```

* CPU-only는 **CTX 2048**부터 시작 권장(속도/메모리 안정)
* 워밍업: 서버 뜬 직후 더미 1회 질의(콜드스타트 감소)

## 7) 스레드(성능) 튜닝(권장)

Ubuntu에서 코어 확인:

```bash
lscpu
```

그 후 `-t`(threads)를 코어에 맞춰 지정:

```bash
./bin/llama-server ... -c 2048 -t <코어수-1 또는 -2>
```

---

# 세팅 Step-by-Step (B: Ollama Windows ARM64 추가 설치)

**목표:** WSL 없이 Windows에서 바로 `ollama serve`/`ollama run` 사용

1. Ollama GitHub Releases에서 **ollama-windows-arm64.zip** 다운로드/압축해제 ([GitHub][1])
2. PowerShell에서 폴더로 이동 후:

```powershell
.\ollama.exe serve
```

3. 별도 창에서:

```powershell
.\ollama.exe pull qwen2:1.5b
.\ollama.exe run qwen2:1.5b
```

4. 모델 저장 경로 이슈 방지(과거에 404 경험이 있었으니) → **OLLAMA_MODELS**를 고정 경로로 지정:

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_MODELS","C:\_ollama_models","User")
```

---

# “완전자동 파일정리기”를 위한 최소 시스템 세팅(LLM 다음 단계)

(코드 작성은 다음 턴에서 바로 들어가면 됨. 지금은 시스템만 준비)

## 폴더(SSOT) 생성

```powershell
mkdir C:\_AUTOSORT\inbox, C:\_AUTOSORT\staging, C:\_AUTOSORT\out, C:\_AUTOSORT\quarantine, C:\_AUTOSORT\dup, C:\_AUTOSORT\logs, C:\_AUTOSORT\rules, C:\_AUTOSORT\cache
```

## Python 가상환경(Windows)

```powershell
py -m venv C:\_AUTOSORT\.venv
C:\_AUTOSORT\.venv\Scripts\activate
pip install -U pip
pip install watchdog pydantic rapidfuzz
```

---

## CmdRec (3)

* `/redo step` : “WSL2+llama.cpp 설치 완료 체크”용 점검 리스트 생성
* `/logi-master report` : 파일정리기 로그(JSONL) 스키마/리포트 포맷 확정
* `/switch_mode ORACLE + /logi-master kpi-dash` : 자동적용률/격리비율/처리시간 KPI 게이트 설정

---

## 다음 턴(코드로 바로 진행)

당신이 “세팅 완료”라고만 말하면, **완전자동 정리기 MVP**를 바로 내려드립니다:

* Watcher(폴더 감시)
* Rule Router(확장자/패턴 1차 분류)
* LLM Classifier(애매한 것만 Qwen2 호출)
* Auto-Apply(확신도 ≥0.90) + Quarantine
* Undo Ledger(run_id 기반 롤백)

[1]: https://github.com/ollama/ollama/releases?utm_source=chatgpt.com "Releases · ollama/ollama · GitHub"
[2]: https://github.com/NousResearch/llama.cpp?utm_source=chatgpt.com "GitHub - NousResearch/llama.cpp"
[3]: https://huggingface.co/itlwas/Qwen2-1.5B-Instruct-Q4_K_M-GGUF?utm_source=chatgpt.com "itlwas/Qwen2-1.5B-Instruct-Q4_K_M-GGUF · Hugging Face"
