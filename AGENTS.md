# AGENTS.md — DEV-PRESET Autosort (Rules 90% + LLM 10%)

You are an AI coding assistant for this repository.
Your primary goal: implement/maintain an automated folder organizer that is safe, fast on CPU-only, and avoids breaking developer references.

## 0) Non-Negotiables (Hard Rules)
1) **NO DELETE.** Never delete user files. Move only.
2) **NO RENAME for dev assets.** If a file is classified as Dev (code/repo/config), keep original name.
3) **Rule-first, LLM-last.** Use deterministic rules first; call LLM only when rules cannot classify Docs reliably.
4) **Ledger always.** Every move must write a ledger entry (before/after, decision, confidence, reason, timestamp/run_id).
5) **Quarantine on uncertainty.** When classification is ambiguous or conflicts occur, move to `Quarantine/` not “guess”.
6) **Stability gate for downloads.** Never move `.crdownload/.part/.tmp` before stable (size unchanged over time).
7) **No internal secrets.** Never print or exfiltrate API keys, tokens, credentials, personal paths.

## 1) Target Folder Tree (SSOT)
All outputs must be placed under this fixed tree (Windows paths shown):

- `C:\_AUTOSORT\out\Dev\Repos\`      # dev repos / source folders (rename forbidden)
- `C:\_AUTOSORT\out\Dev\Archives\`   # zip/7z/tar/gz etc.
- `C:\_AUTOSORT\out\Dev\Config\`     # .cursor / config files
- `C:\_AUTOSORT\out\Dev\Notes\`      # md/txt notes
- `C:\_AUTOSORT\out\Docs\Ops\`       # PDF/XLSX/DOCX (LLM selective)
- `C:\_AUTOSORT\out\Docs\Other\`     # other docs
- `C:\_AUTOSORT\out\Temp\`           # crdownload/part/tmp (optional; otherwise quarantine)
- `C:\_AUTOSORT\quarantine\`         # uncertainty/conflicts/failures
- `C:\_AUTOSORT\dup\`                # hash duplicates

## 2) Classification Policy (90% Rules / 10% LLM)
### 2.1 Must NOT call LLM (Rule-only)
- Source code/extensions:
  `.py .js .ts .tsx .json .yml .yaml .toml .ini .cfg .ps1 .sh .bat .cmd .ipynb`
- Archives:
  `.zip .7z .rar .tar .gz`
- Temp/incomplete:
  `.crdownload .part .tmp`

### 2.2 LLM allowed (Selective, Docs only)
- Only for: `.pdf .docx .xlsx`
- Only if keyword rules fail to assign a Doc bucket
- LLM output must be constrained to: `{doc_type, confidence, suggested_name(optional), reasons[]}`
- If LLM confidence < threshold OR tool fails: route to `quarantine/`

### 2.3 Keyword rules (reduce LLM calls)
If filename matches (case-insensitive), classify as `Docs\Ops`:
- `agi_tr`, `dpr`, `mammoet`, `verification`, `chartering`, `duration`, `comparison`

(Extend this list only after repeated real misclassification events.)

## 3) Rename Policy (Critical)
- If `doc_type in {dev_code, dev_repo, dev_config}`:
  - **new_name = original filename** (do not rename)
- Else (docs/other):
  - rename allowed using safe normalization (but avoid changing file extensions)
  - if name collision: append suffix `__{short_hash}`

## 4) Safety & Permissions (Human Approval)
### Allowed without asking
- Read/list files
- Compute file hash
- Move files into the SSOT tree (out/dup/quarantine) with ledger logging
- Run unit tests / lint (see commands)

### Ask first (approval required)
- Installing packages / changing dependencies
- Deleting any file (normally forbidden)
- Modifying watcher behavior that could touch broad directories (e.g., whole drive root)
- Any network calls (LLM endpoint changes, external requests)
- Changing the SSOT folder tree

## 5) Dev Commands (Exact)
> If these commands do not exist in the repo, do not invent them. Use the closest available commands or document the gap.

### Run (example)
- Activate venv:
  - `C:\_AUTOSORT\.venv\Scripts\activate`
- Start watcher:
  - `python C:\_AUTOSORT\autosortd.py --watch "D:\YOUR_WORKDIR" --llm "http://127.0.0.1:8080/v1"`

### QA (required before shipping changes)
- Minimal smoke run (dry-run if supported) + check ledger writes
- Ensure **0 deletions**, **no rename on Dev**, **Temp stability respected**

## 6) Output Contract (What to return in chat)
When asked for changes or analysis, respond with:
1) Decision summary (what will change)
2) Risk / safety checks (rename/delete/ledger/stability)
3) Diff plan (files/functions impacted)
4) Verification plan (tests / smoke / ledger sample)

Keep it concise; no speculative architecture.

## 7) Failure Modes → Recovery
- LLM timeout/unavailable → `quarantine/` + log error + continue rule-only
- Permission denied on move → `quarantine/` + log + skip
- Name collision → suffix with hash; never overwrite
- Partial download detected → keep in place; retry after stable window
- Unexpected extension → `Docs\Other` if safe else `quarantine/`

## 8) Notes for Contributors
- This project optimizes for CPU-only stability.
- Add a new rule only after the same error occurs twice.
- Treat `AGENTS.md` as SSOT for agent behavior.
```

---

