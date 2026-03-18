# Excel VBA Skill Deployment Guide

This guide is for installing the same `excel-vba` Codex skill on your other two PCs.

## Files to copy

Copy one of these to the target PC:
- [excel-vba-skill-package-20260318.zip](./excel-vba-skill-package-20260318.zip)
- or the unpacked folder [excel-vba-skill](./excel-vba-skill)

Recommended:
- use the zip file

## Target PC prerequisites

- Codex desktop app installed
- Windows PowerShell available
- write access to `%USERPROFILE%\.codex\skills`

## Install steps

### Option A: install from zip

1. Copy `excel-vba-skill-package-20260318.zip` to the target PC
2. Extract it to any local folder (files land directly in that folder — no sub-folder is created)
3. Open PowerShell and move into the folder where you extracted the zip
4. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install_excel_vba_skill.ps1
```

### Option B: install from copied folder

1. Copy the whole `excel-vba-skill` folder to the target PC
2. Open PowerShell inside that folder
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install_excel_vba_skill.ps1
```

## What the installer does

- detects `%CODEX_HOME%` if set, otherwise uses `%USERPROFILE%\.codex`
- installs the skill to:

```text
%USERPROFILE%\.codex\skills\excel-vba
```

- backs up any existing `excel-vba` skill before overwriting it

## After install

1. Close Codex if it is already running
2. Reopen Codex, or start a new session
3. Confirm the skill is visible or invokable as:

```text
$excel-vba
```

## Expected installed location

Typical path:

```text
C:\Users\<your-user>\.codex\skills\excel-vba
```

## Quick verification

On the target PC, check that these files exist:
- `SKILL.md`
- `agents\openai.yaml`
- `references\process-map.md`
- `references\vba-review-workflow.md`
- `references\python-review-workflow.md`

## If installation fails

### PowerShell execution policy blocks the script

Run exactly:

```powershell
powershell -ExecutionPolicy Bypass -File .\install_excel_vba_skill.ps1
```

### Codex does not see the skill

- verify the folder is under `.codex\skills\excel-vba`
- restart Codex
- start a new conversation

### A previous skill version existed

The installer creates a backup in `.codex\skills` with a timestamped name such as:

```text
excel-vba.backup-YYYYMMDD-HHMMSS
```

## Current skill purpose

This skill is for:
- VBA-first Excel automation
- Python-created Excel sheets or files that support a VBA workflow
- Microsoft Learn VBA review before code
- collision review between VBA and Python workbook structures
- optional parallel multi-agent work only when explicitly requested and supported
