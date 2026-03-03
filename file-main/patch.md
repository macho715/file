1. **판정: 예(가능)** — 현재 폴더 구성(개발 파일 비중↑)이면 **LLM 호출 최소화(규칙 90% + LLM 10%)**로 “완전자동 정리기”가 더 안정/빠릅니다.
2. **근거:** n8n도 로컬 파일 트리거로 “파일명/확장자 기반 AI 분류→폴더 이동” 워크플로우를 제시하며, 파일 생성 이벤트가 많으면 타이머 전환을 권장합니다(동시성 이슈). ([n8n.io][1])
3. **다음행동:** 아래 **DEV-PRESET**(개발 우선 룰 + 문서만 LLM)으로 MVP를 바로 적용하세요.

---

## 0) 스크린샷 기준 “지금 폴더에 있는 것” (관찰)

* 개발/자동화 관련 폴더: `Agents/`, `AgentSkill/`, `Code/`, `Cursor_project_setting/`, `Prompt_Lab/`, `logi cowork/`
* 다운로드/압축/임시: `tr_dash-main*.zip`, `drive-download-*.zip`, `*.crdownload`
* 문서 혼재: PDF/XLSX/DOCX/MD(예: `AGI_TR_중간보고서`, `Mammoet_DPR_Verification.xlsx`, `일정.MD`)

→ 결론: **개발 파일은 “이름 변경 금지(참조 깨짐)”**, 문서만 “정리+필요 시 리네임”이 맞습니다.

---

## 1) DEV-PRESET 폴더 트리(추천)

`C:\_AUTOSORT\out\` 아래를 이렇게 고정하세요.

| 구분          | 경로                  | 자동 처리 원칙                       |
| ----------- | ------------------- | ------------------------------ |
| Dev-Repo    | `out\Dev\Repos\`    | 폴더/소스코드(리네임 금지)                |
| Dev-Archive | `out\Dev\Archives\` | zip/7z/tar.gz                  |
| Dev-Config  | `out\Dev\Config\`   | `.cursor`, 설정파일                |
| Dev-Notes   | `out\Dev\Notes\`    | `.md`, `.txt`                  |
| Docs-Ops    | `out\Docs\Ops\`     | PDF/XLSX/DOCX (LLM 선별)         |
| Temp        | `out\Temp\`         | `.crdownload`, `.part`, `.tmp` |
| Quarantine  | `quarantine\`       | 불확실/충돌/실패                      |
| Dup         | `dup\`              | 해시 중복                          |

---

## 2) 룰(90%) + LLM(10%) 전략

### Pass-0(룰)에서 끝내는 것(LLM **호출 금지**)

* 소스코드: `.py .js .ts .tsx .json .yml .yaml .toml .ini .ps1 .sh .bat .cmd .ipynb`
* 압축: `.zip .7z .rar .tar .gz`
* 임시: `.crdownload .part .tmp`

### LLM 호출(선별)

* `.pdf .docx .xlsx` 중에서 **키워드 룰이 못 잡는 것만**
  (예: “DPR, TR, AGI_TR, Mammoet, Verification” 같은 프로젝트 문서)

> CPU-only에서는 이 구조가 체감 성능을 좌우합니다.

---

## 3) MVP 코드 “최소 패치” (autosortd.py에 반영)

아래 3블록만 바꾸면 DEV-PRESET이 됩니다.

### (1) doc_type 확장 + 폴더 매핑 추가

```python
DOC_ROOTS = {
    # Dev
    "dev_repo": r"Dev\Repos",
    "dev_code": r"Dev\Repos",     # 소스 파일은 repos로(리네임 금지)
    "dev_archive": r"Dev\Archives",
    "dev_config": r"Dev\Config",
    "dev_note": r"Dev\Notes",

    # Docs
    "ops_doc": r"Docs\Ops",
    "other": r"Docs\Other",
}
```

### (2) 확장자 기반 즉시 분류 추가(LLM 호출 차단)

```python
DEV_CODE_EXTS = {".py",".js",".ts",".tsx",".json",".yml",".yaml",".toml",".ini",".cfg",".ps1",".sh",".bat",".cmd",".ipynb"}
ARCHIVE_EXTS = {".zip",".7z",".rar",".tar",".gz"}
TEMP_EXTS = {".crdownload",".part",".tmp"}

def rule_classify(filename: str, ext: str):
    if ext in TEMP_EXTS:
        return ("other", 0.99)  # 또는 Temp 폴더를 별도로 만들면 "temp"
    if ext in ARCHIVE_EXTS:
        return ("dev_archive", 0.98)
    if ext in DEV_CODE_EXTS:
        return ("dev_code", 0.98)
    if ext in {".md",".txt"}:
        return ("dev_note", 0.95)

    s = filename
    # 문서 키워드 룰(LLM 호출 줄이기)
    if re.search(r"\b(agi_tr|dpr|mammoet|verification|chartering|duration|comparison)\b", s, re.I):
        return ("ops_doc", 0.92)

    return None
```

### (3) “개발 파일은 리네임 금지” 규칙

`move_with_ledger()` 호출 전에 이름을 결정할 때:

```python
if decision.doc_type in {"dev_code","dev_repo","dev_config"}:
    new_name = p.name  # 원본명 유지(참조 깨짐 방지)
else:
    new_name = decision.suggested_name
```

---

## 4) 실행(완전자동)

* **watch 폴더를 “현재 작업 폴더”로 지정**하세요(다운로드가 아니라 개발 폴더를 정리하려면).

```powershell
C:\_AUTOSORT\.venv\Scripts\activate
python C:\_AUTOSORT\autosortd.py --watch "D:\당신_작업폴더" --llm "http://127.0.0.1:8080/v1"
```

---

## 5) QA 체크리스트(실수 방지용, 필수)

* [ ] **삭제는 0.00%**: dup/quarantine로만 이동
* [ ] 소스코드/설정은 **리네임 금지**
* [ ] `.crdownload/.part`는 **완료 전 이동 금지**(현재 코드의 `wait_until_stable`로 커버)
* [ ] zip은 `Dev\Archives\`로만
* [ ] `logs\ledger.jsonl`에 before/after가 찍히는지 확인
* [ ] 1회 테스트 후 이상 없으면 상주 실행

---

## 옵션 3개

### Option A (추천) DEV-PRESET(룰 90% + LLM 10%)

* Pros: CPU-only에서 빠름/안정, 오분류 감소
* Cons: 문서 케이스는 키워드 룰 보강 필요
* Risk: Low~Medium

### Option B 완전 LLM 분류(모든 파일)

* Pros: 분류 유연
* Cons: CPU-only에서 느림, 불필요 비용
* Risk: Medium

### Option C n8n로 완전자동(로컬 트리거)

* Pros: 워크플로우/노드로 관리 쉬움, 트리거/타이머 전환 가능 ([n8n.io][1])
* Cons: 셋업이 더 큼
* Risk: Medium

---

## CmdRec (3)

* `/redo step` : DEV-PRESET 룰 세트(확장자/키워드 50개) 생성
* `/switch_mode ORACLE + /logi-master kpi-dash` : 자동적용률/격리비율/중복률 KPI
* `/logi-master report` : 일일 정리 리포트(정리/격리/dup/rollback)

---

원하면, 지금 스크린샷에 있는 파일명 패턴(예: `tr_dash-main`, `drive-download-*`, `AGI_TR_*`, `Mammoet_*`)을 기준으로 **“룰 20개 확정본”**을 바로 만들어 드리겠습니다(LLM 호출률을 더 낮추는 방향).

[1]: https://n8n.io/workflows/2334-organise-your-local-file-directories-with-ai/?utm_source=chatgpt.com "Organise your local file directories with AI | n8n workflow template"


1. **판정: 조건부(가능)** — 지금 메시지 내용만으로도 **“룰 20개 확정본(LLM 호출률↓)”**을 바로 만들 수 있습니다.
2. **근거:** 이미 DEV-PRESET(확장자/키워드/리네임 금지/폴더 매핑) 구조가 완성돼 있어, 남은 건 **파일명 패턴 기반 룰 고정**입니다.
3. **다음행동:** 아래 **RULE-20**을 `rule_classify()`에 그대로 추가하고, `Temp`는 `DOC_ROOTS["temp"]`로 분리하세요.

---

## RULE-20 (파일명 패턴/확장자 보강 — LLM 호출 더 줄이기)

| No | Match(정규식/조건)                                                                                                        | Route(doc_type) | Action         |                                                                            |                                      |                             |                        |                        |             |             |
| -: | -------------------------------------------------------------------------------------------------------------------- | --------------- | -------------- | -------------------------------------------------------------------------- | ------------------------------------ | --------------------------- | ---------------------- | ---------------------- | ----------- | ----------- |
| 01 | `ext in {".crdownload",".part",".tmp",".download"}`                                                                  | `temp`          | 이동(리네임 금지)     |                                                                            |                                      |                             |                        |                        |             |             |
| 02 | `re.search(r"\.zip(\.\d+)?$", name, re.I)`                                                                           | `dev_archive`   | 이동(리네임 금지)     |                                                                            |                                      |                             |                        |                        |             |             |
| 03 | `re.search(r".(7z                                                                                                    | rar             | tar            | gz                                                                         | tgz                                  | bz2                         | xz)$", name, re.I)`    | `dev_archive`          | 이동(리네임 금지)  |             |
| 04 | `re.search(r"^drive-download-", name, re.I)`                                                                         | `dev_archive`   | 이동(리네임 금지)     |                                                                            |                                      |                             |                        |                        |             |             |
| 05 | `re.search(r"^tr_dash-main", name, re.I)`                                                                            | `dev_archive`   | 이동(리네임 금지)     |                                                                            |                                      |                             |                        |                        |             |             |
| 06 | `re.search(r"\b(cursor                                                                                               | .cursor         | cursorrules    | cursor_project_setting)\b", path_or_name, re.I)`                           | `dev_config`                         | **리네임 금지**                  |                        |                        |             |             |
| 07 | `re.search(r"\b(agent                                                                                                | agents          | subagent       | skills                                                                     | agentskill)\b", path_or_name, re.I)` | `dev_repo`                  | **리네임 금지**             |                        |             |             |
| 08 | `ext in {".py",".js",".ts",".tsx",".json",".yml",".yaml",".toml",".ini",".cfg",".ps1",".sh",".bat",".cmd",".ipynb"}` | `dev_code`      | **리네임 금지**     |                                                                            |                                      |                             |                        |                        |             |             |
| 09 | `ext in {".md",".txt"}` AND `re.search(r"\b(readme                                                                   | notes?          | todo           | changelog                                                                  | design                               | spec                        | plan)\b", name, re.I)` | `dev_note`             | (선택) 리네임 허용 |             |
| 10 | `re.search(r"\bagi[_-]?tr\b", name, re.I)`                                                                           | `ops_doc`       | (선택) 리네임 허용    |                                                                            |                                      |                             |                        |                        |             |             |
| 11 | `re.search(r"\bdpr\b", name, re.I)`                                                                                  | `ops_doc`       | (선택) 리네임 허용    |                                                                            |                                      |                             |                        |                        |             |             |
| 12 | `re.search(r"\bmammoet\b", name, re.I)`                                                                              | `ops_doc`       | (선택) 리네임 허용    |                                                                            |                                      |                             |                        |                        |             |             |
| 13 | `re.search(r"\bverification\b", name, re.I)`                                                                         | `ops_doc`       | (선택) 리네임 허용    |                                                                            |                                      |                             |                        |                        |             |             |
| 14 | `re.search(r"\bcharter(ing)?\b", name, re.I)`                                                                        | `ops_doc`       | (선택) 리네임 허용    |                                                                            |                                      |                             |                        |                        |             |             |
| 15 | `re.search(r"\b(eta                                                                                                  | etd             | berth          | stowage                                                                    | mooring                              | ballast                     | roro                   | lolo)\b", name, re.I)` | `ops_doc`   | (선택) 리네임 허용 |
| 16 | `ext in {".xlsx",".xlsm",".csv"}` AND `re.search(r"\b(dpr                                                            | verification    | comparison     | cost                                                                       | rate                                 | invoice                     | dem                    | det)\b", name, re.I)`  | `ops_doc`   | (선택) 리네임 허용 |
| 17 | `ext in {".pdf",".docx",".pptx"}` AND `re.search(r"\b(report                                                         | minutes         | summary        | memo                                                                       | proposal                             | quotation)\b", name, re.I)` | `ops_doc`              | (선택) 리네임 허용            |             |             |
| 18 | `re.search(r"\b(hvdc                                                                                                 | adnoc           | dsv            | adopt)\b", name, re.I)`AND`ext in {".pdf",".xlsx",".docx",".csv",".pptx"}` | `ops_doc`                            | (선택) 리네임 허용                 |                        |                        |             |             |
| 19 | `re.search(r"\b(template                                                                                             | logo            | brand          | ci(pl)?                                                                    | packing                              | bl                          | boe                    | do)\b", name, re.I)`   | `ops_doc`   | (선택) 리네임 허용 |
| 20 | 위 조건 모두 불일치 AND `ext in {".pdf",".xlsx",".docx"}`                                                                    | `other`         | **LLM 후보**(최후) |                                                                            |                                      |                             |                        |                        |             |             |

> 핵심: **Temp/Archive/Dev는 100% 룰로 종료**, `pdf/xlsx/docx`만 “ops_doc vs other” 구분이 안 될 때 **LLM 호출**.

---

## 코드에 바로 넣을 최소 패치(요지)

* `DOC_ROOTS`에 `temp` 추가 (권장):

```python
"temp": r"Temp",
```

* `rule_classify()`에서 RULE-20을 순서대로 적용(상위 룰 우선).
* “개발 파일 리네임 금지”는 지금처럼 `dev_code/dev_repo/dev_config`에 고정 유지.

---

## CmdRec (3)

* `/redo step` : RULE-20을 **실제 autosortd.py 코드 블록**으로 합쳐서 “붙여넣기 완성본” 생성
* `/switch_mode PRIME + /logi-master report` : **정리 결과(Temp/Archive/Ops/Other/Quarantine/Dup) 집계 리포트** 포맷 고정
* `/logi-master kpi-dash` : **LLM 호출률(%), Quarantine 비율(%), Dup률(%)** KPI 추가

원하면 다음 턴에 **“autosortd.py에 넣는 완성 코드(함수/상수/룰 순서 포함)”**를 그대로 출력하겠습니다.
