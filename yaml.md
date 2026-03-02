1. **판정: 예(가능)** — 요청하신 **rules.yaml + mapping.yaml 확정본**을 “개발파일 중심(리네임 금지) + 문서 패턴(AGI_TR/DPR/Mammoet/tr_dash/drive-download)” 기준으로 작성합니다.
2. **근거:** 현재 폴더는 **개발 폴더/zip/drive-download/프로젝트 문서(PDF/XLSX/DOCX/MD)**가 혼재라서, **룰 우선(LLM 호출 최소화)** + **문서만 Ops로 라우팅**이 안전합니다.
3. **다음행동:** 아래 내용을 그대로 `C:\_AUTOSORT\rules\rules.yaml`, `C:\_AUTOSORT\rules\mapping.yaml`로 저장하세요.

---

```yaml
# C:\_AUTOSORT\rules\rules.yaml
version: "SSOT.v0.1"
preset: "DEV_FIRST_CPU_ONLY"

# Global behavior
auto_apply_confidence: 0.90
rename:
  # 개발 파일/리포/설정은 리네임 금지(참조 깨짐 방지)
  dev_rename_allowed: false
  # 문서류는 기본 "원본명 유지" (안전), 필요 시 LLM suggested_name을 쓰도록 mapping에서 override 가능
  docs_rename_default: "keep"

stability_check:
  enabled: true
  timeout_seconds: 20
  ignore_extensions: [".crdownload", ".part", ".tmp"]

ignore:
  # 임시/바로가기/Office 임시파일 등
  extensions: [".lnk"]
  globs: ["~$*", "*.tmp", "*.bak"]

# Extension groups (Pass-0)
ext_groups:
  temp: [".crdownload", ".part", ".tmp"]
  archives: [".zip", ".7z", ".rar", ".tar", ".gz"]
  dev_code: [".py", ".js", ".ts", ".tsx", ".json", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".ps1", ".sh", ".bat", ".cmd", ".ipynb"]
  notes: [".md", ".txt"]
  images: [".jpg", ".jpeg", ".png", ".webp"]
  docs: [".pdf", ".docx", ".xlsx", ".xlsm"]

# Classification rules (ordered; first-match wins)
rules:
  # 0) TEMP (완료 전 이동 금지 → 안정성 체크 실패 시 quarantine로)
  - id: "TEMP__INCOMPLETE_DOWNLOAD"
    type: "ext"
    match: [".crdownload", ".part", ".tmp"]
    doc_type: "temp"
    confidence: 0.99
    action: "quarantine"
    reason: "incomplete_or_temp"

  # 1) ARCHIVES - 특정 패턴 우선
  - id: "ARCHIVE__TR_DASH_MAIN"
    type: "regex"
    target: "name"
    pattern: "(?i)^tr_dash-main(\\s*\\(\\d+\\))?\\.(zip|7z|rar)$"
    doc_type: "dev_archive"
    tags: ["tr_dash"]
    confidence: 0.99

  - id: "ARCHIVE__DRIVE_DOWNLOAD_ZIP"
    type: "regex"
    target: "name"
    # 예: drive-download-20260209T194440Z-1-001.zip
    pattern: "(?i)^drive-download-\\d{8}T\\d{6}Z-\\d+-\\d+\\.(zip|7z)$"
    doc_type: "dev_archive"
    tags: ["drive_download"]
    confidence: 0.99

  - id: "ARCHIVE__GENERIC"
    type: "ext_group"
    group: "archives"
    doc_type: "dev_archive"
    confidence: 0.98

  # 2) DEV CODE (리네임 금지)
  - id: "DEV__CODE"
    type: "ext_group"
    group: "dev_code"
    doc_type: "dev_code"
    confidence: 0.98

  # 3) NOTES
  - id: "DEV__NOTES"
    type: "ext_group"
    group: "notes"
    doc_type: "dev_note"
    confidence: 0.95

  # 4) IMAGES
  - id: "PHOTO__ALL"
    type: "ext_group"
    group: "images"
    doc_type: "photo"
    confidence: 0.95

  # 5) OPS DOCS (문서 키워드 패턴 우선)
  - id: "OPS__AGI_TR__DPR"
    type: "regex"
    target: "name"
    pattern: "(?i)(\\bAGI[_ -]?TR\\b.*\\bDPR\\b|\\bDPR\\b.*\\bAGI[_ -]?TR\\b)"
    doc_type: "ops_doc"
    tags: ["AGI_TR", "DPR"]
    confidence: 0.95

  - id: "OPS__AGI_TR"
    type: "regex"
    target: "name"
    pattern: "(?i)\\bAGI[_ -]?TR\\b"
    doc_type: "ops_doc"
    tags: ["AGI_TR"]
    confidence: 0.93

  - id: "OPS__MAMMOET__DPR"
    type: "regex"
    target: "name"
    # mammoet, mammoot 등 오타 케이스 포함
    pattern: "(?i)(\\bmamm?oet\\b.*\\bDPR\\b|\\bDPR\\b.*\\bmamm?oet\\b)"
    doc_type: "ops_doc"
    tags: ["Mammoet", "DPR"]
    confidence: 0.95

  - id: "OPS__MAMMOET__TR"
    type: "regex"
    target: "name"
    pattern: "(?i)\\bmamm?oet\\b.*\\bTR\\b"
    doc_type: "ops_doc"
    tags: ["Mammoet", "TR"]
    confidence: 0.93

  - id: "OPS__VERIFICATION"
    type: "regex"
    target: "name"
    pattern: "(?i)\\bverification\\b"
    doc_type: "ops_doc"
    tags: ["Verification"]
    confidence: 0.92

  - id: "OPS__CHARTERING_DURATION_COMPARISON"
    type: "regex"
    target: "name"
    pattern: "(?i)\\b(chartering|duration|comparison)\\b"
    doc_type: "ops_doc"
    tags: ["Chartering"]
    confidence: 0.92

  - id: "OPS__DPR_GENERIC"
    type: "regex"
    target: "name"
    pattern: "(?i)\\bDPR\\b"
    doc_type: "ops_doc"
    tags: ["DPR"]
    confidence: 0.90

  # 6) DOCS FALLBACK (문서 확장자)
  - id: "DOCS__FALLBACK"
    type: "ext_group"
    group: "docs"
    doc_type: "other"
    confidence: 0.60
    # confidence 낮음 → mapping에서 quarantine 정책 적용 가능
```

```yaml
# C:\_AUTOSORT\rules\mapping.yaml
version: "SSOT.v0.1"
preset: "DEV_FIRST_CPU_ONLY"

paths:
  root_out: "C:\\_AUTOSORT\\out"
  quarantine: "C:\\_AUTOSORT\\quarantine"
  dup: "C:\\_AUTOSORT\\dup"
  temp: "C:\\_AUTOSORT\\out\\Temp"

# doc_type → base destination (relative under out/)
doc_type_map:
  dev_code: "Dev\\Repos"
  dev_repo: "Dev\\Repos"
  dev_config: "Dev\\Config"
  dev_note: "Dev\\Notes"
  dev_archive: "Dev\\Archives"
  ops_doc: "Docs\\Ops"
  invoice: "Docs\\Invoice"
  cipl_pl_bl_boe_do: "Docs\\CIPL_PL_BL_BOE_DO"
  contract: "Docs\\Contracts"
  stowage: "Ops\\Stowage_Stability"
  port_marine: "Ops\\Port_Marine"
  warehouse: "WH\\WMS_Inventory"
  photo: "Photos\\Yard_Site"
  other: "Docs\\Other"
  temp: "Temp"

# tag 조합별 세부 라우팅(우선순위: 위→아래)
tag_overrides:
  - when_all: ["tr_dash"]
    dest_rel: "Dev\\Archives\\tr_dash-main"
    rename_policy: "keep"

  - when_all: ["drive_download"]
    dest_rel: "Dev\\Archives\\drive-download"
    rename_policy: "keep"

  - when_all: ["AGI_TR", "DPR"]
    dest_rel: "Docs\\Ops\\AGI_TR\\DPR"
    rename_policy: "keep"

  - when_all: ["AGI_TR"]
    dest_rel: "Docs\\Ops\\AGI_TR"
    rename_policy: "keep"

  - when_all: ["Mammoet", "DPR"]
    dest_rel: "Docs\\Ops\\Mammoet\\DPR"
    rename_policy: "keep"

  - when_all: ["Mammoet", "TR"]
    dest_rel: "Docs\\Ops\\Mammoet\\TR"
    rename_policy: "keep"

  - when_all: ["Verification"]
    dest_rel: "Docs\\Ops\\Verification"
    rename_policy: "keep"

  - when_all: ["Chartering"]
    dest_rel: "Docs\\Ops\\Chartering"
    rename_policy: "keep"

# rename 정책(최종 적용 규칙)
rename_policy:
  # keep: 원본 파일명 유지
  # normalize: suggested_name 사용(문서만 권장)
  dev_code: "keep"
  dev_repo: "keep"
  dev_config: "keep"
  dev_note: "keep"
  dev_archive: "keep"
  ops_doc: "keep"
  other: "keep"
  photo: "keep"
  temp: "keep"

# 자동 적용/격리 정책
apply_gate:
  # confidence < 0.90 인 경우 기본 격리
  quarantine_below: 0.90
  quarantine_doc_types: ["other"]   # fallback 문서는 기본 격리(룰/LLM 보강 전)
  allow_auto_apply_doc_types: ["dev_code","dev_archive","dev_note","ops_doc","photo"]

# 파일명 정규화 템플릿(향후 LLM suggested_name 사용 시)
# 현재는 rename_policy가 대부분 keep이므로 "준비용"으로 제공
naming_templates:
  ops_doc: "{orig}"
  other: "{orig}"
  dev_archive: "{orig}"
  dev_code: "{orig}"
```

---

## 적용 메모(최소)

* 위 YAML은 **“룰/매핑 확정본”**이고, 현재 `autosortd.py`가 **내장 RULES**를 쓰고 있으면 **YAML 로딩 코드 1회 패치**가 필요합니다.
* 패치 없이 쓰려면: YAML 내용을 기존 `RULES`/`DOC_ROOTS` 상수에 그대로 옮기는 방식으로도 동일하게 동작합니다.

원하면 다음 턴에, **(1) autosortd.py에 YAML 로더 추가(약 30~50줄)** + **(2) tag_overrides 적용 로직** + **(3) fallback(other) 문서는 무조건 quarantine로 보내는 게이트**까지 “바로 실행되는 최종본”으로 정리해 드리겠습니다.
