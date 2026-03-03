# NO LOCAL LLM WORKFLOW

Run `autosortd_1py.py` without local LLM and process ambiguous docs through quarantine triage.

## 1) Daemon (no-llm mode)

```bash
python autosortd_1py.py --root C:\_AUTOSORT --watch "D:\YOUR_WORKDIR" --no-llm --sweep
```

- Rule-based files are still moved immediately.
- `.pdf/.docx/.xlsx` files with no confident rule match are moved to `quarantine/`.
- Ledger reason is always `no_llm_ambiguous_doc`.

## 2) Triage flow

1. Review `quarantine/` files.
2. Create `*.decision.json` for each target in quarantine using Cursor/Codex.
3. Apply decisions:

```bash
python autosort-triage-apply.py --root C:\_AUTOSORT --dry-run
```

Then, when confirmed:

```bash
python autosort-triage-apply.py --root C:\_AUTOSORT
```

## 3) Gate rules

- Only entries passing `should_auto_apply(...)` are applied.
- `action: triage_apply` and `reason: triage_apply` are written to ledger for applied moves.
- Files failing any gate stay in `quarantine/`.

## 4) Recovery

- `quarantine` growth alert is emitted by daemon every 5 minutes when count exceeds threshold.
- If move fails, keep file in `quarantine` and fix source/path issues before retry.
