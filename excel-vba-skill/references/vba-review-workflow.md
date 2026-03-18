# VBA Review Workflow

Use this file before delivering VBA code.

## Mandatory pre-delivery review
- Check the relevant Microsoft Learn page for the objects, methods, properties, or events you plan to use.
- Confirm the code path is reasonable under `Application -> Workbook -> Worksheet -> Range`.
- Check LTSC 2021 and Microsoft 365 compatibility.
- Check whether the pattern depends on a newer Microsoft 365 feature and mark it if so.
- Check whether save behavior, `SaveAs`, output sheet creation, or rerun behavior can damage an existing workbook.

## Review order
1. identify the target objects such as `Application`, `Workbook`, `Worksheet`, `Range`, `ListObject`, `PivotTable`, or `Workbook.SaveAs`
2. confirm methods and properties in Microsoft Learn
3. check LTSC 2021 and Microsoft 365 compatibility
4. check error handling and state-restore needs
5. check save format and rerun safety
6. write code
7. define the test basis

## VBA design rules
- Always include `Option Explicit`.
- Always use `On Error GoTo`.
- Always restore `Application.ScreenUpdating`, `Application.EnableEvents`, and `Application.Calculation`.
- Do not use `Select` or `Activate` in normal logic.
- Prefer arrays over cell-by-cell loops.
- Prefer late binding such as `CreateObject("Scripting.Dictionary")`.
- Prefer `Config` sheet or named ranges instead of hardcoded paths, row indexes, or sheet settings.
- Keep `Result`, `Validation_Errors`, and `LOG` as the default output structure.
- Apply the default finish unless the user explicitly requests plain output:
- header row styled and frozen
- autofilter on the output range
- number format `#,##0.00`
- date format `yyyy-mm-dd`
- column auto-fit
- row auto-fit when feasible in Excel
- professional readable sheet styling

## What to explain in the answer
- which objects are used
- why those objects fit the task
- whether the Microsoft documentation review found any compatibility concern
- whether any Microsoft 365-only or version-sensitive behavior exists

## Default response pattern
- purpose
- assumptions
- input sheets and output sheets
- code
- entry procedure
- test points
- operating cautions

## Suggested implementation flow
1. validate workbook and sheet existence
2. validate headers or infer a safe default header row with `⚠️가정:`
3. read data into arrays
4. process in memory
5. write outputs in blocks
6. apply the formatting finish to all user-facing sheets
7. log rows in, rows out, duration, and validation failures
