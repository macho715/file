# MIR Reactor Repair Gantt - Unified Edition

Unified workbook for MIR reactor repair scheduling with two runtime modes:
- `PROD` mode: manual date editing with downstream auto-shift
- `PTO` mode: predecessor and lag driven auto-scheduling

This package is designed for Windows Excel with VBA enabled and is compatible with Office LTSC 2021 style workflows.

## Package Contents

Files in this folder that matter for the unified workbook:
- `mir_reactor_gantt_unified.py`: Python generator for the workbook
- `modMIR_Gantt_Unified.bas`: VBA module
- `ThisWorkbook_MIR_Gantt_Unified.txt`: ThisWorkbook event code
- `README_MIR_Gantt_Unified.md`: this document
- `requirements_unified.txt`: Python dependency list
- `MIR_Reactor_Repair_Gantt_Unified.xlsx`: generated workbook template

## Workbook Structure

Generated workbook sheets:
- `Summary`
- `Baseline`
- `LOG`
- `Gantt_BASE`
- `Gantt_BEST`
- `Gantt_WORST`

Core layout:
- Meta columns `A:J`
  - `#`, `Phase`, `Task Description`, `Start`, `End`, `Days`, `Risk`, `Notes`, `Predecessor`, `Lag`
- Timeline starts at column `K`
- Header row is `3`
- First data row is `4`

## Quick Start

### 1. Generate the workbook

```bash
pip install -r requirements_unified.txt
python mir_reactor_gantt_unified.py
```

Output:
- `MIR_Reactor_Repair_Gantt_Unified.xlsx`

### 2. Convert to macro-enabled workbook

1. Open `MIR_Reactor_Repair_Gantt_Unified.xlsx`
2. Save as `Excel Macro-Enabled Workbook (*.xlsm)`
3. Press `Alt + F11`
4. Import `modMIR_Gantt_Unified.bas`
5. Open `ThisWorkbook`
6. Paste the contents of `ThisWorkbook_MIR_Gantt_Unified.txt`
7. Save the workbook
8. Close and reopen Excel
9. Enable macros

### 3. Initial event flow

When the workbook opens:
1. `Workbook_Open`
2. `Init_Unified_System`
3. each `Gantt_*` sheet is normalized and refreshed
4. initialization result is written to `LOG`

## Mode Selection

Mode is controlled in the `Summary` sheet.

| Setting | Value | Meaning |
| --- | --- | --- |
| `AUTO_SCHEDULE_PTO` | `OFF` | PROD mode |
| `AUTO_SCHEDULE_PTO` | `ON` | PTO mode |

### PROD mode

Use when planners want to edit dates directly.

Behavior:
- edit `Start` or `End`
- `Days` is recalculated
- downstream tasks can shift automatically
- shift can stop at rows treated as fixed

Main Summary settings:
- `AUTO_SHIFT`
- `STOP_AT_FIXED`
- `KEEP_DURATION`
- `SHIFT_WORKDAYS_ONLY`

### PTO mode

Use when the schedule should be driven by predecessor logic.

Behavior:
- `Predecessor` and `Lag` drive recalculation
- `Start = max(predecessor end) + lag + 1`
- `End = Start + Days - 1`
- rows without predecessor or marked fixed keep their own start

## Available Public Macros

Public macros currently exposed by `modMIR_Gantt_Unified.bas`:

| Macro | Purpose |
| --- | --- |
| `Init_Unified_System` | normalize and refresh all Gantt sheets |
| `Recalculate_Active_Scenario` | recalculate only the active Gantt sheet |
| `Recalculate_All_Scenarios` | recalculate all Gantt sheets |
| `Reset_Active_Scenario_To_Baseline` | restore active Gantt sheet from Baseline |
| `Reset_All_Scenarios_To_Baseline` | restore all Gantt sheets from Baseline |
| `Protect_All_Gantt` | protect all Gantt sheets while keeping input workflow usable |
| `Unprotect_All_Gantt` | remove protection from all Gantt sheets |
| `Undo_LastEdit` | revert the last tracked edit snapshot |
| `Force_Refresh_Colors` | manually rebuild color formatting for the active Gantt sheet |
| `Diagnostic_Color_Status` | show diagnostic information about formatting and mode settings |

## Workbook Event Hooks

ThisWorkbook event code forwards Excel events into the VBA module:
- `Workbook_Open`
- `Workbook_SheetSelectionChange`
- `Workbook_SheetChange`

Expected behavior:
- selection on a `Gantt_*` sheet captures previous values for shift logic
- edits on a `Gantt_*` sheet trigger validation, normalization, recalculation, and refresh
- errors are logged instead of being silently swallowed during open

## Recommended Manual Test Scenario

Use this sequence for real Excel validation.

### Test 1: Open event

1. Open the `.xlsm`
2. Confirm no startup error dialog appears
3. Open `LOG`
4. Confirm a row exists for `Init_Unified_System`

Pass criteria:
- workbook opens cleanly
- `LOG` contains initialization output

### Test 2: PROD mode edit

1. In `Summary`, set `AUTO_SCHEDULE_PTO = OFF`
2. Open `Gantt_BASE`
3. Change one `Start` value in column `D`
4. Confirm downstream rows shift when `AUTO_SHIFT = ON`
5. Confirm `Days` remains consistent if `KEEP_DURATION = ON`

Pass criteria:
- edited row normalizes dates
- dependent tasks move as expected
- no event loop lock-up occurs

### Test 3: PTO mode recalc

1. In `Summary`, set `AUTO_SCHEDULE_PTO = ON`
2. Edit `Predecessor` and `Lag` on one or more task rows
3. Run `Recalculate_Active_Scenario`
4. Confirm `Start` and `End` follow predecessor logic

Pass criteria:
- predecessor links resolve
- invalid predecessor references are logged

### Test 4: Full workbook recalc

1. Run `Recalculate_All_Scenarios`
2. Confirm `Gantt_BASE`, `Gantt_BEST`, and `Gantt_WORST` refresh
3. Check `LOG` for completion

Pass criteria:
- all scenario sheets recalc
- no sheets remain stuck in protected or half-refreshed state

### Test 5: Protection cycle

1. Run `Protect_All_Gantt`
2. Confirm intended input cells remain workable
3. Run `Unprotect_All_Gantt`
4. Confirm sheet protection is removed

Pass criteria:
- protection is applied consistently
- sort and filter remain usable where intended

## LOG Interpretation Guide

The `LOG` sheet is the first place to inspect when something feels wrong.

Columns:
- `Timestamp`
- `Proc`
- `Sheet`
- `Row`
- `Col`
- `Message`

What healthy logs look like:
- `Init_Unified_System` after open
- `Recalculate_Active_Scenario` or `Recalculate_All_Scenarios` after manual recalc
- short informative messages rather than repeated identical error bursts

What to treat as warnings:
- unprotect or formatting warnings during init
- invalid predecessor references
- invalid start or end date rows

What to treat as blockers:
- repeated `SheetChange` errors on the same row and column
- errors during workbook open
- errors that prevent recalculation from finishing

## Operational Notes

- `LOG` is not optional. Keep it visible during testing.
- `Baseline` is a reset source. Do not edit it casually.
- `REPAINT_MODE` controls rendering strategy:
  - `CF` is the default and preferred mode
  - `PAINT` is for cases where direct cell painting is needed
- For manual visual recovery, use `Force_Refresh_Colors`
- For manual troubleshooting, use `Diagnostic_Color_Status`

## Known Environment Constraints

- Automatic VBA import through COM may fail if Excel Trust Center blocks access to the VBA project object model.
- In that case, import `modMIR_Gantt_Unified.bas` and paste `ThisWorkbook_MIR_Gantt_Unified.txt` manually.
- Manual import is still sufficient for normal use.

## Troubleshooting

### Workbook opens but nothing initializes

Check:
- macros are enabled
- `ThisWorkbook` code was pasted correctly
- `LOG` contains a `Workbook_Open` or `Init_Unified_System` entry

### Dates do not recalculate

Check:
- active mode in `Summary`
- whether you are on a `Gantt_*` sheet
- whether predecessors are valid in PTO mode
- whether `AUTO_SHIFT` is enabled in PROD mode

### Colors or bars look stale

Run:
- `Force_Refresh_Colors`

Then inspect:
- `Diagnostic_Color_Status`

### Reset does not behave as expected

Check:
- `Baseline` still contains valid source data
- scenario rows exist for the target sheet

## Current Status

Latest verified points in this folder:
- Python generation runs successfully
- workbook file is generated successfully
- public macro list in this README matches the current VBA module
- ThisWorkbook event forwarding matches the current VBA module names

Still recommended before full operational sign-off:
- one manual `.xlsm` run with macros enabled
- one open-cycle test to confirm `Workbook_Open`
- one edit-cycle test in PROD mode
- one recalc-cycle test in PTO mode
