# Project Upgrade — Local LLM → Cursor Subagent/Skill + Codex Skill 대체

**Project:** LOCAL-AUTOSORT (autosortd_1py)  
**Date:** 2026-03-03  
**Scope:** LLM 기능을 로컬 LLM(llama.cpp/Ollama) 없이 Cursor 서브에이전트·스킬 및 Codex 스킬로 대체하는 방법  
**Constraints:** AGENTS.md Non-Negotiables 유지, 삭제 0%, Ledger 항상, Quarantine on uncertainty

**환경 정의 (중요)**  
Cursor 서브에이전트·스킬, Codex 스킬은 **API가 아니다.** 별도 서버/엔드포인트 호출이 아니라 **지금 사용하고 있는 IDE 환경**(Cursor 또는 Codex)에서, 사용자가 채팅/에이전트를 열고 해당 스킬·서브에이전트를 로드하면 **같은 환경 안에서** 에이전트가 동작한다. 자동화용 Cursor API·Codex API는 사용하지 않는다.

---

## 1) Executive Summary

- **현재:** 데몬이 `.pdf`/`.docx`/`.xlsx` 중 규칙으로 분류되지 않는 파일에 대해 **로컬 LLM**(WSL llama.cpp 또는 Ollama)을 호출해 `doc_type`/`confidence`/`suggested_name` 등을 받고, 성공 시 목적지로 이동·실패/타임아웃 시 quarantine로 보냄.
- **대체 방향:**  
  (1) **실시간 경로:** 데몬에서는 LLM 호출 제거 → 애매한 문서는 전부 **quarantine**으로 보냄(AGENTS.md “tool fails → quarantine” 준수).  
  (2) **분류 경로:** **지금 쓰는 IDE 환경**에서 Cursor(또는 Codex) 채팅/에이전트를 열고, autosort-quarantine-triage 스킬·Codex doc/pdf/spreadsheet 스킬을 **API 없이** 로드한 뒤, 같은 환경 안에서 에이전트가 quarantine 문서를 읽고 분류·이동·ledger 적용.
- **효과:** WSL/Ollama 의존성 제거, CPU-only에서 데몬 단순화, 문서 분류는 “주기적 triage” 워크플로로 이전.

---

## 2) Current State Snapshot (LLM 사용처)

| 영역 | 현재 상태 | 비고 |
|------|-----------|------|
| **호출 위치** | `autosortd_1py.py` → `handle_one()` 내 | `decision is None or decision.confidence < 0.92` 이고 `ext in {".pdf", ".docx", ".xlsx"}` 일 때만 |
| **입력** | `file_meta` (name, ext, size) + `extract_snippet(p)` (최대 2500자) | PDF/DOCX/XLSX별 추출 로직 존재 |
| **출력** | `LLMDecision`: doc_type, project, vendor, date, suggested_name, confidence, reasons, tags | JSON 고정 스키마 |
| **실패 시** | LLM timeout/error/parse_fail → `quarantine/` + ledger (reason: llm_timeout, llm_error, llm_parse_fail) | 이미 규격화됨 |
| **의존성** | `requests` → `POST .../chat/completions` (llama_cpp) 또는 `.../api/chat` (Ollama) | WSL llama-server 또는 Ollama 기동 필요 |
| **기존 Cursor/Codex** | CURSOR_AUTOSORT_USAGE: autosort-quarantine-triage 스킬이 “규칙 재시도 + Docs-only LLM(선택)” 정의 | 스킬에 “LLM 엔드포인트(있는 경우에만)” 명시 |
| **Codex 스킬** | doc (python-docx, render_docx), pdf (pdfplumber, pypdf, reportlab), spreadsheet (openpyxl, pandas) | 내용 추출·시각 검증용, 분류 로직 없음 |

---

## 3) 대체 방안 Top 아이디어 (Evidence 포함)

| # | 아이디어 | 버킷 | Impact | Effort | Risk | Conf | Score | Evidence |
|---|----------|------|--------|--------|------|------|-------|----------|
| 1 | **데몬에 `--no-llm` 모드 추가** — LLM 호출 생략, 미분류 문서 전부 quarantine | Architecture | 4 | 1 | 1 | 5 | **20** | AGENTS §2.2 “tool fails → quarantine” |
| 2 | **autosort-quarantine-triage 스킬을 “로컬 LLM 없이 Cursor+Codex”로 재정의** — 규칙 재시도 후 문서는 Agent가 Codex doc/pdf/spreadsheet로 읽고 분류 JSON 반환 | DX/Process | 4 | 2 | 2 | 4 | **4** | CURSOR_AUTOSORT_USAGE, .cursor/skills/autosort-quarantine-triage |
| 3 | **triage 실행 스크립트/체크리스트** — quarantine 목록 → Cursor에서 “quarantine triage” 실행 → 이동·ledger 적용 방법 문서화 | Docs/Process | 3 | 1 | 1 | 5 | **15** | RUN_PLAN, INSTALL_NEXT (운영 절차 패턴) |
| 4 | **키워드/확장자 규칙 강화** — ops 키워드·문서용 규칙 확대해 LLM 필요 건수 감소 | Reliability | 3 | 2 | 1 | 4 | **6** | AGENTS §2.3, yaml.md rules |
| 5 | **API/자동화 미사용** — 서브에이전트·스킬·Codex 스킬은 API가 아니며, 현재 IDE 환경에서만 사용. triage는 사용자가 Cursor/Codex에서 세션 열어 실행. | Docs/Process | — | — | — | — | — | 본 문서 Scope |

**Score:** `(Impact × Confidence) / (Effort × Risk)`.  
**Evidence:** 1·3·4는 레포 문서; 2는 레포 스킬 정의; 5는 “API 아님, 현재 환경 사용” 원칙 명시.

---

## 4) Best 3 Deep (대체 구현 초점)

### Best 1: 데몬 `--no-llm` 모드

**Goal**  
`autosortd_1py.py`에서 로컬 LLM 호출을 선택적으로 제거한다. `--no-llm`(또는 `--llm=""`)일 때는 `.pdf`/`.docx`/`.xlsx` 중 규칙으로 분류되지 않는 파일을 **즉시 quarantine**으로 보내고, ledger에는 `reason=no_llm_ambiguous_doc` 등으로 기록한다.

**Non-goals**  
- 기존 `--llm` 경로 제거 아님. 기본값은 유지하거나, 기본을 `--no-llm`로 바꾸고 `--llm URL`을 주면 기존 동작 유지.
- extract_snippet/LLMDecision 스키마는 triage·테스트·Electron 등에서 재사용 가능하므로 유지.

**Design**  
- **구현:** `handle_one()` 내 `llm_docs_exts` 분기에서 `llm_base_url`이 비어 있거나 `--no-llm`이면 `llm_classify_with_retry` 호출 없이, `decision is None or confidence < 0.92`인 문서를 quarantine으로 이동 + ledger.
- **인자:** `argparse`에 `--no-llm` (store_true) 또는 `--llm` 기본값을 `None`으로 하고 `None`이면 LLM 미호출.
- **호환:** 기존 `--llm http://...` 사용자 행동 변경 없음.

**PR Plan**  
- PR-1: `--no-llm` 추가 및 `handle_one()` 분기 (LLM 호출 생략 시 quarantine + ledger).  
- PR-2: README/RUN_PLAN에 “로컬 LLM 없이 사용: `--no-llm` → 문서 미분류는 quarantine, Cursor triage로 정리” 문구 추가.  
- PR-3: (선택) dashboard.py의 LLM 통계에서 “no_llm” 모드일 때 표시 처리.

**Tests**  
- 기존 `test_llm_extension_gate.py` 유지. `--no-llm` 시 `.pdf`/`.docx`/`.xlsx`가 quarantine으로 가는지 한 건 이상 단위/통합 테스트 (temp dir, 실제 경로 미사용).

**Rollback**  
`--no-llm` 제거 및 해당 분기 제거 시 기존 동작으로 복귀.

**Evidence**  
- AGENTS.md §2.2: “If LLM confidence < threshold **OR tool fails**: route to `quarantine/`” → LLM을 “사용 안 함”으로 두면 “tool 없음”으로 간주해 quarantine 라우팅이 정책 합치.

---

### Best 2: autosort-quarantine-triage 스킬을 “Cursor + Codex only”로 재정의

**Goal**  
autosort-quarantine-triage 스킬 문서를 수정해, “로컬 LLM 엔드포인트” 대신 **지금 사용 중인 IDE 환경**(Cursor 또는 Codex)에서 에이전트가 Codex doc/pdf/spreadsheet 스킬을 로드해 문서 내용을 읽고, 고정 JSON 스키마(doc_type, confidence, suggested_name, reasons)로 분류한 뒤 이동·ledger를 적용하는 워크플로를 SSOT로 둔다. **API 호출 없음** — 같은 환경 안에서 스킬·서브에이전트가 동작한다.

**Non-goals**  
- Cursor/Codex **API**로 자동화(데몬이 Agent 호출)는 사용하지 않음. “사람이 Cursor에서 세션을 열고 triage 요청”만 대상.

**Design**  
- **Steps (스킬 내):**  
  1) Rule-only 재시도 (기존 유지).  
  2) **Docs 분류:** 로컬 LLM·API 대신 **현재 IDE 환경**에서 에이전트가 quarantine 내 `.pdf`/`.docx`/`.xlsx` 목록과 SSOT 스키마를 받고, Codex doc/pdf/spreadsheet 스킬(API 아님, 같은 환경에 로드된 스킬)로 내용을 읽은 뒤, doc_type/confidence/suggested_name/reasons를 JSON으로 반환.  
  3) Move + ledger (overwrite 금지, hash suffix 등 기존 유지).  
- **입력:** `quarantine/` 목록, 키워드 룰, **고정 출력 스키마** (AGENTS §2.2와 동일).  
- **출력:** moved/stayed count, top reasons, (선택) rule 개선 제안.

**PR Plan**  
- PR-1: `.cursor/skills/autosort-quarantine-triage/SKILL.md` 수정 — “LLM 엔드포인트(있는 경우에만)” 문구를 “로컬 LLM 없이: Cursor Agent + Codex doc/pdf/spreadsheet 스킬로 문서 읽기 → Agent가 분류 JSON 반환”으로 교체.  
- PR-2: CURSOR_AUTOSORT_USAGE.md에 “로컬 LLM 없이 사용 시: 데몬은 `--no-llm`, 주기적으로 quarantine triage(위 스킬) 실행” 워크플로 추가.  
- PR-3: (선택) 스킬 내 "출력 형식(JSON)" 명시. 이동·ledger는 같은 환경에서 에이전트가 수행하거나, 사용자가 결과를 복사해 스크립트에 넣는 방식(API 연동 아님). “출력 형식(JSON)” 
**Tests**  
- 스킬 문서/문구 리뷰. 자동 테스트는 스킬이 “파일 이동”을 유발하므로 기존 정책대로 수동/선택.

**Evidence**  
- CURSOR_AUTOSORT_USAGE.md §3: autosort-quarantine-triage “규칙/키워드/LLM으로 재분류” → LLM을 “Cursor Agent + Codex 스킬”로 재해석 가능.  
- Codex doc/pdf/spreadsheet SKILL.md: 내용 추출·검증 워크플로 명시 → Agent가 이 스킬을 사용해 읽고, 분류는 Agent(모델)가 담당.

---

### Best 3: 문서 “로컬 LLM 없이” 운영 가이드 (triage 체크리스트)

**Goal**  
README 또는 RUN_PLAN/INSTALL_NEXT에 “로컬 LLM을 쓰지 않고 Cursor·Codex 스킬로만 문서 분류하는 방법”을 한 페이지 분량으로 정리한다. 데몬 `--no-llm`, quarantine triage 주기, Cursor에서 사용할 스킬·트리거 문구를 나열한다.

**Design**  
- **포함:**  
  - 데몬 실행: `autosortd_1py.py --no-llm ...` (및 기존 `--llm` 옵션은 유지).  
  - Quarantine triage: **지금 쓰는 Cursor(또는 Codex) 환경**에서 채팅/에이전트 열기 → “quarantine 정리” / “quarantine triage” 등 트리거 → autosort-quarantine-triage + (필요 시) Codex doc/pdf/spreadsheet 스킬 로드. API 없이 같은 환경에서만 동작.  
  - Codex 스킬: doc, pdf, spreadsheet는 같은 환경에 로드된 스킬로, 에이전트가 내용 읽기에 사용.  
- **위치:** README “문서 인덱스”에 링크하거나, `docs/NO_LOCAL_LLM_WORKFLOW.md` 신규.

**PR Plan**  
- PR-1: `docs/NO_LOCAL_LLM_WORKFLOW.md` 생성 (또는 README 하위 섹션).  
- PR-2: README/RUN_PLAN에서 “WSL/Ollama 없이” 참조 링크 추가.

**Evidence**  
- RUN_PLAN, INSTALL_NEXT: 운영 절차·옵션 문서화 패턴.  
- AGENTS.md: Rule-first, Quarantine on uncertainty → “미분류 문서 quarantine 후 triage”가 정책과 일치.

---

## 5) Options A/B/C

| Option | 내용 | 기간 | 리스크 |
|--------|------|------|--------|
| **A — 최소** | Best 1만: `--no-llm` 추가 + 문서 한 줄. triage는 기존 스킬 문서에 의존. | ~1주 | 낮음 |
| **B — 권장** | Best 1 + Best 2 + Best 3: `--no-llm`, 스킬 재정의, NO_LOCAL_LLM 워크플로 문서. | ~2–3주 | 낮음 |
| **C — 확장** | B + 키워드/규칙 강화(아이디어 4)로 quarantine 유입 감소. | ~4주 | 낮음 |

---

## 6) 30일 로드맵 (PR 단위)

| 순서 | Task | 산출물 | Gate |
|------|------|--------|------|
| 1 | 데몬 `--no-llm` 추가, 미분류 문서 → quarantine + ledger | autosortd_1py.py, 테스트 1개 | temp dir만, 0 delete |
| 2 | autosort-quarantine-triage 스킬 “Cursor + Codex only” 워크플로로 수정 | .cursor/skills/autosort-quarantine-triage/SKILL.md | AGENTS no-secrets, move+ledger 유지 |
| 3 | NO_LOCAL_LLM 워크플로 문서 추가, README/RUN_PLAN 링크 | docs/NO_LOCAL_LLM_WORKFLOW.md, README 등 | — |

---

## 7) Apply Gates (머지 전)

| 변경 | Gate | 검증 |
|------|------|------|
| `--no-llm` 분기 | 테스트가 실제 watch 경로/C:\_AUTOSORT 사용 안 함. temp dir 또는 fixture만. | pytest 경로 검색, CI에서 경로 제한 |
| 스킬 재정의 | 이동·ledger 시 overwrite 금지, Dev 리네임 금지, 출력에 경로/시크릿 무포함 유지. | 스킬 문서 리뷰 |
| 문서 | “로컬 LLM 없음” 시에도 Quarantine on uncertainty, Ledger always 유지 문구 명시. | README/AGENTS 일치 확인 |

---

## 8) 요약 (Cursor Subagent/Skill + Codex Skill로의 대체)

- **API 미사용:** Cursor 서브에이전트·스킬, Codex 스킬은 **API가 아니며**, **지금 사용하고 있는 IDE 환경**에서만 동작한다. 별도 엔드포인트·자동화 서버는 사용하지 않는다.
- **실시간(데몬):** 로컬 LLM 제거 옵션 `--no-llm` → 규칙으로 분류 안 된 문서는 전부 **quarantine**. (데몬은 Cursor/Codex를 호출하지 않음.)
- **분류(같은 환경):** 사용자가 Cursor(또는 Codex)에서 **autosort-quarantine-triage** 스킬로 “quarantine 정리” 요청 → 같은 환경에 로드된 **Codex doc/pdf/spreadsheet** 스킬로 에이전트가 문서 내용을 읽고, 고정 스키마로 **doc_type/confidence/suggested_name/reasons** 반환 → 이동·ledger 적용(에이전트가 스킬 지시에 따라 수행).
- **서브에이전트:** autosort-research, autosort-verifier, autosort-terminal 역시 **같은 환경**에서 트리거로 호출되며, 분류 로직 교체와 독립적으로 triage 전후 정책·테스트 검증에 사용.
- **Codex 스킬:** “분류” 자체는 Codex 스킬이 아니라 **Cursor Agent(모델)**가 수행하고, **Codex doc/pdf/spreadsheet**는 문서 **읽기/추출**만 담당 — 즉, 로컬 LLM의 “스니펫 추출 + 분류”를 “Codex로 추출 + Cursor Agent로 분류”로 나눈 구조.

---

## 9) Evidence Table (Cursor/Codex Skills)

**Source:** upgrade-web-scout (Cursor/Codex skills only). EN-only, 2025-06+ where date available. accessed_date: 2026-03-03.

### TOP_HITS (4건)

| id | platform | title | url | published_date | why_relevant |
|----|----------|--------|-----|----------------|--------------|
| 1 | Cursor | Subagents, Skills, and Image Generation (Changelog 2.4) | https://cursor.com/changelog/2-4 | 2026-01-22 | 에이전트 스킬·에디터/CLI 지원, SKILL.md, 슬래시 호출, 동적 컨텍스트 vs 상시 규칙 |
| 2 | Skilllm | Supercharging Cursor: The Ultimate Guide to Adding Agent Skills | https://skilllm.com/blog/custom-agent-skills-cursor | 2026-01-17 | .cursor/skills/, YAML frontmatter, 동적 발견, GitHub 설치 — 스킬 작성·사용법 |
| 3 | Cursor | Dynamic context discovery | https://cursor.com/blog/dynamic-context-discovery | 2026-01 | 스킬 오픈 스탠다드, 필요 시 로드(grep/시맨틱), 별도 LLM 서버 없음 |
| 4 | InfoQ | AI-Powered Code Editor Cursor Introduces Dynamic Context Discovery | https://www.infoq.com/news/2026/01/cursor-dynamic-context-discovery/ | 2026-01 | 동적 컨텍스트·도메인별 스킬, “IDE 에이전트 + 스킬” 요약 |

### AMBER_BUCKET (날짜 미확인)

| platform | title | url | reason |
|----------|--------|-----|--------|
| Cursor | Context / Skills (docs) | https://cursor.com/docs/context/skills | published_date/updated_date 없음 (2.4·2026-01 내용과 일치) |
| OpenAI | Codex Agent Skills | https://developers.openai.com/codex/skills/ | 날짜 없음 — SKILL.md, 명시/암시 호출, $skill-installer, ~/.codex/config.toml |
| dev.to | Cursor rules vs skills — what’s the actual difference | https://dev.to/nedcodes/cursor-rules-vs-skills-whats-the-actual-difference-383b | 게시일 미확인 — rules vs skills 우선순위 |

---

*Refs: AGENTS.md, CURSOR_AUTOSORT_USAGE.md, autosortd_1py.py, .cursor/skills/autosort-quarantine-triage/SKILL.md, Codex skills (doc, pdf, spreadsheet).*
