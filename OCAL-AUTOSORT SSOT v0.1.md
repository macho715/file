# 전체 아키텍처 문서 — LOCAL-AUTOSORT SSOT v0.1 (Surface Pro 11 / ARM64 / CPU-only)

> **통합 안내:** 설계·구현·배포·머메이드 다이어그램은 **[ARCHITECTURE.md](ARCHITECTURE.md)** 로 통합되었습니다. 이 파일은 레거시 참조용으로 유지합니다.

## 1) Executive Summary

* 목표: 로컬 폴더(주로 개발 파일 + 일부 문서)를 **완전자동**으로 분류/이동(필요 시 리네임)하고, **실수 복구(Undo)** 및 **감사로그(ledger)**를 남긴다.
* 핵심 원칙: **(1) 삭제 0.00%**, **(2) 개발 파일/폴더 리네임 금지**, **(3) 룰 우선(90%)**, **(4) 불확실=격리(Quarantine)**, **(5) 모든 변경은 ledger로 롤백 가능**.
* 런타임 SSOT: WSL2 Ubuntu에서 `llama-server` 상주 + Windows에서 Python Watcher 데몬(파일 이벤트 처리). ([Llama.cpp - Run LLM Inference in C/C++][1])

---

## 2) EN Sources (≤3)

* llama.cpp: OpenAI API 호환 엔드포인트(/v1/chat/completions 등) 설명 ([Llama.cpp - Run LLM Inference in C/C++][1])
* Qwen2-1.5B Instruct Q4_K_M GGUF: `llama-server --hf-repo --hf-file -c 2048` 사용 예시 ([huggingface.co][2])
* n8n 로컬 파일 트리거 기반 자동 정리 워크플로우(고빈도 시 타이머 전환 권장) ([n8n.io][3])

---

## 3) 시스템 범위 / 비범위

### 범위(In-Scope)

* 로컬 폴더 감시(다운로드/작업 폴더) → 자동 분류 → 목적지 폴더로 이동
* 개발 파일 중심 최적화: **소스/설정/프로젝트 폴더는 리네임 금지**
* 문서(PDF/DOCX/XLSX/MD/TXT)는 규칙+선별 LLM로 분류, 필요 시 파일명 규칙 적용
* 중복(해시 기반) 분리: `dup/`
* 불확실/오류/충돌 분리: `quarantine/`
* 모든 조작 기록: `logs/ledger.jsonl` + 롤백 스크립트

### 비범위(Out-of-Scope)

* 파일 내용 “정정/편집”(예: PDF 내용 수정)
* 외부 클라우드 업로드/동기화
* 자동 삭제/정리(삭제는 금지)
* 전체 디스크 인덱싱(초기 MVP는 watch 폴더 범위만)

---

## 4) 제약(Constraints)

| No | Item  | Value                        | Risk        | Evidence    |
| -: | ----- | ---------------------------- | ----------- | ----------- |
|  1 | HW    | ARM64, CPU-only, RAM 16.00GB | Medium(속도)  | 사용자 제공      |
|  2 | 파일 유형 | 개발 파일 비중↑ + 문서 혼재            | Medium(오분류) | 사용자 제공/스크린샷 |
|  3 | 완전자동  | 사용자 승인 없이 move/rename 수행     | Medium(사고)  | 요구사항        |
|  4 | 안전    | 삭제 0.00%, Undo 필수            | Low         | SSOT 원칙     |

---

## 5) 목표 KPI(운영 지표)

* 자동 적용률(Auto-Apply Rate) ≥ 85.00%
* 격리 비율(Quarantine Rate) ≤ 15.00%
* 중복 탐지율(Dup Hit Rate) 추적(기준선 설정)
* 처리 지연(TAT) 평균 ≤ 5.00s/파일(문서 LLM 호출 제외)
* 롤백 성공률 100.00%

---

## 6) 상위 아키텍처(High-Level)

### 6.1 컴포넌트

1. **LLM Serve Layer (WSL2)**

* `llama-server` 상주
* 모델: Qwen2-1.5B Instruct Q4_K_M (CTX 2048 시작) ([huggingface.co][2])
* 인터페이스: `POST http://127.0.0.1:8080/v1/chat/completions` ([Llama.cpp - Run LLM Inference in C/C++][1])

2. **Autosort Daemon (Windows)**

* 폴더 감시(Watcher)
* 규칙 기반 분류(Rule Router)
* 문서 내용 스니펫 추출(Extractor)
* LLM 분류(선별 호출)
* 조작 실행(Actuator: move/rename)
* 로그/캐시/롤백( Ledger + Cache + Rollback tool)

3. **Storage Layer**

* `out/` (정상 정리 결과)
* `quarantine/` (불확실/실패)
* `dup/` (중복)
* `logs/ledger.jsonl` (append-only)
* `cache/cache.json` (sha256 → decision/result)

### 6.2 데이터 흐름(Sequence)

```mermaid
flowchart LR
  A[File Created in WATCH folder] --> B[Stability Check\n(crdownload/size stable)]
  B -->|Fail| Q[Quarantine\nreason=unstable]
  B --> C[Fingerprint\nSHA256 + size + mtime]
  C --> D{Dup?}
  D -->|Yes| DP[Move to dup/ + ledger]
  D -->|No| E[Rule Router (90%)]
  E -->|Confident| F[Actuator\nMove (rename?)]
  E -->|Ambiguous| G[Extractor\n(snippet/meta)]
  G --> H[LLM Classifier\nJSON output]
  H --> I{confidence>=0.90?}
  I -->|Yes| F
  I -->|No| Q2[Quarantine\nreason=low_conf]
  F --> L[Ledger Append + Cache Write]
  Q --> L
  Q2 --> L
```

---

## 7) 폴더/데이터 구조(SSOT)

### 7.1 폴더 트리(고정)

```text
C:\_AUTOSORT\
  inbox\            (선택: 수동 투입)
  staging\          (원자적 이동용)
  out\
    Dev\
      Repos\
      Archives\
      Config\
      Notes\
    Docs\
      Ops\
      Other\
  quarantine\
  dup\
  logs\
    ledger.jsonl
  cache\
    cache.json
  rules\
    rules.yaml
    mapping.yaml
```

### 7.2 카테고리 정책(개발 파일 중심)

* **리네임 금지(doc_type=dev_code/dev_repo/dev_config)**

  * 이유: 참조/임포트/경로 의존성 깨짐 위험
* 문서류만 리네임 허용(doc_type=ops_doc/other)
* zip/압축은 `Dev/Archives`로 이동(리네임 선택)

---

## 8) 분류 엔진 설계(룰 90% + LLM 10%)

### 8.1 Pass-0 Rule Router (LLM 호출 금지 대상)

* 확장자 기반:

  * 소스/설정: `.py .js .ts .tsx .json .yml .yaml .toml .ini .ps1 .sh .bat .cmd .ipynb` → `Dev/Repos` (리네임 금지)
  * 압축: `.zip .7z .rar .tar .gz` → `Dev/Archives`
  * 임시: `.crdownload .part .tmp` → **완료 전 이동 금지(Stable check)**, 실패 시 quarantine
  * 노트: `.md .txt` → `Dev/Notes`

* 키워드 기반(문서 빠른 분류):

  * `AGI_TR`, `DPR`, `Mammoet`, `Verification`, `Chartering`, `Duration` 등 → `Docs/Ops`

### 8.2 Pass-1 LLM Classifier (선별 호출)

* 호출 대상: Pass-0에서 확신(confidence) 낮은 **PDF/DOCX/XLSX**
* 입력: `file_meta + content_snippet(앞 2500자) + naming_rule`
* 출력: **JSON 고정 스키마(결정론/파싱 안정)**

---

## 9) LLM 인터페이스 계약

### 9.1 Endpoint

* `POST {base_url}/chat/completions` (예: `http://127.0.0.1:8080/v1/chat/completions`) ([Llama.cpp - Run LLM Inference in C/C++][1])

### 9.2 Output JSON Schema(고정)

```json
{
  "doc_type": "invoice|cipl_pl_bl_boe_do|contract|stowage|port_marine|warehouse|photo|other|dev_code|dev_repo|dev_config|dev_archive|dev_note|ops_doc",
  "project": "string|null",
  "vendor": "string|null",
  "date": "YYYY-MM-DD|null",
  "suggested_name": "string",
  "confidence": 0.0,
  "reasons": ["string"]
}
```

### 9.3 결정론(재현성) 규칙

* `temperature=0` 고정(가능 시)
* 입력 스니펫 절단 규칙 고정(예: 2500 chars)
* 프롬프트 템플릿 고정(키/순서 고정)
* 가능하면 `llama-server`에 JSON grammar 적용(분류 전용 서버 운영 시)

---

## 10) Actuator(파일 조작) 설계

### 10.1 원자적 이동(Atomic-ish)

* `watch 폴더 → staging → out/quarantine/dup`
* 실패 시 원복(best-effort)

### 10.2 충돌 처리(Name collision)

* 동일 파일명 존재 시 `__001` suffix로 회피(최대 999)

### 10.3 삭제 금지(0.00%)

* 삭제 없음
* 중복은 `dup/`
* 불확실은 `quarantine/`

---

## 11) 감사로그/Undo 설계

### 11.1 Ledger(JSONL, append-only)

레코드 필드(최소):

* `ts`(UTC ISO)
* `run_id`
* `action=move`
* `sha256`
* `reason`(auto_apply/low_confidence/duplicate_hash/unstable/exception 등)
* `before`(원경로)
* `after`(대상경로)

### 11.2 Rollback(런 단위)

* `run_id` 기준으로 ledger에서 `after→before` 역순 이동
* 성공/실패 건수 출력

---

## 12) 운영/배포(Deployment)

### 12.1 LLM 서버(WSL2)

* 기본 모델: Qwen2-1.5B Instruct Q4_K_M
* CTX: 2048 시작 ([huggingface.co][2])

### 12.2 Windows 데몬

* 실행 방식:

  * 개발/다운로드 폴더 1개를 `--watch`로 지정
  * 시작 시 warmup 1회(ping)로 콜드스타트 감소
* 자동 시작:

  * Windows 작업 스케줄러(Task Scheduler)로 “로그온 시 실행” 권장

### 12.3 고빈도 이벤트(동시성) 대응

* 파일 생성 이벤트 폭주 시:

  * 이벤트 기반에서 **타이머 배치(예: 30s 스윕)**로 전환 권장 ([n8n.io][3])

---

## 13) 보안/안전 정책

* 기본: 로컬 파일만 처리(외부 업로드 없음)
* 허용 목록(Allowlist) 폴더만 watch
* 금지 목록(Denylist):

  * 시스템 폴더, OneDrive 동기화 루트(충돌 가능), 대용량 백업 폴더
* 개인/업무 PII: MVP는 “정리”만 수행, 내용 추출은 최소(앞 1~2페이지/상단 20행 등)

---

## 14) 테스트 전략

* 단위 테스트:

  * 확장자/키워드 룰 분류 정확도
  * safe_filename(윈도우 금지문자 처리)
  * ledger 기록 누락 없는지
  * rollback 성공 여부(샘플 파일 세트)
* 회귀 테스트:

  * 샘플 100개 파일로 “자동 적용률/격리율/충돌율” 비교

---

## 15) Options (A/B/C)

### Option A — DEV-PRESET(룰 90% + LLM 10%) **추천**

* Pros: CPU-only에서 빠름, 개발파일 안전(리네임 금지), 사고 비용 최소
* Cons: 문서 분류 정확도는 룰/키워드 보강 필요
* Cost: 0.00 AED
* Risk: Low~Medium
* Time: 즉시

### Option B — Full-LLM(모든 파일 LLM)

* Pros: 분류 유연
* Cons: CPU-only에서 느림, 불필요 호출 증가
* Cost: 0.00 AED
* Risk: Medium
* Time: 즉시(비권장)

### Option C — n8n 기반 워크플로우(로컬 트리거)

* Pros: GUI 워크플로우/노드 관리, 트리거/타이머 전환 쉬움 ([n8n.io][3])
* Cons: n8n 셋업/권한/바인드 마운트 등 초기 비용
* Cost: 0.00 AED
* Risk: Medium
* Time: Short~Medium

---

## 16) 실행 체크리스트(Prepare→Pilot→Build→Operate→Scale)

### Prepare

* [ ] WSL2에서 `llama-server` 상주
* [ ] `C:\_AUTOSORT\*` 트리 생성
* [ ] watch 대상 폴더 1개 지정(다운로드 또는 작업폴더)

### Pilot

* [ ] 샘플 50개 투입 → 자동 적용률/격리율 측정
* [ ] 개발 파일 리네임 0.00건 확인

### Build

* [ ] rules.yaml 외부화(키워드/확장자/경로 룰)
* [ ] 문서 스니펫 추출 안정화(PDF/DOCX/XLSX 실패 시 quarantine)

### Operate

* [ ] 일일 리포트(정리/격리/dup/rollback) 자동 생성
* [ ] 고빈도 폴더는 타이머 스윕 모드로 전환

### Scale

* [ ] 카테고리 확장(프로젝트/벤더별 하위 폴더)
* [ ] 유사중복(내용 유사도) 확장(선택)

---

## 17) CmdRec (3)

* `/redo step` : rules.yaml(확장자/키워드 50개) + 폴더 매핑 확정
* `/switch_mode ORACLE + /logi-master kpi-dash` : 자동적용률/격리비율/중복률 KPI 포맷 고정
* `/logi-master report` : 일일 정리 리포트 템플릿(표+요약) 생성

---

## 18) ZERO(중단) 로그 (해당 없음)

현재 요청은 규정/통관/HS 등 고위험 판단이 아니므로 중단 조건 없음.

---

원하면, 이 문서를 기준으로 **rules.yaml + mapping.yaml “확정본(당신 파일명 패턴 반영: tr_dash-main, drive-download, AGI_TR, DPR, Mammoet 등)”**을 바로 작성해 드리겠습니다.

[1]: https://llama-cpp.com/?utm_source=chatgpt.com "Llama.cpp - Run LLM Inference in C/C++"
[2]: https://huggingface.co/itlwas/Qwen2-1.5B-Instruct-Q4_K_M-GGUF?utm_source=chatgpt.com "itlwas/Qwen2-1.5B-Instruct-Q4_K_M-GGUF · Hugging Face"
[3]: https://n8n.io/workflows/2334-organise-your-local-file-directories-with-ai/?utm_source=chatgpt.com "Organise your local file directories with AI | n8n workflow template"
