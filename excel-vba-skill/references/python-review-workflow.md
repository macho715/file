# Python Review Workflow

Use this file only when Python is needed to construct Excel sheets or files that VBA will consume, update, or coexist with.

## Mandatory pre-delivery review
- Search current official docs before claiming a library is the best fit.
- Compare the request against the current roles of `pandas`, `openpyxl`, `XlsxWriter`, `xlwings`, and `polars`.
- Explain why the chosen combination is right for the requested Excel deliverable and its VBA touchpoints.
- Decide whether Python writes a new workbook, modifies an existing workbook, or drives a live Excel session.
- Check whether the output must preserve macros or avoid touching an existing `.xlsm`.
- Check whether a safer default is to keep the original `.xlsm` untouched and write a separate result workbook.

## Selection rules
- New workbook generation for a VBA workflow: check `XlsxWriter` first. Add `pandas` if tabular preprocessing is part of the job.
- Existing workbook edits for a VBA workflow: check `openpyxl` first.
- Multi-sheet table export for VBA-linked input sheets: check `pandas` first, then pair with `openpyxl` or `XlsxWriter`.
- Live Excel control or VBA-adjacent integration: check `xlwings`.
- High-volume table processing with Excel output for a VBA workflow: consider `polars`, but only after verifying that its Excel-writing path fits the task.

## Decision order
1. decide whether the task creates a new workbook or edits an existing workbook
2. check whether macro preservation is required
3. check how important styling, charts, and conditional formatting are
4. check how much high-volume table output is involved
5. check whether live Excel application control is required

## Code contract
- Use `main()`.
- Use `argparse`.
- Use structured exception handling.
- Use logging.
- Create explicit sheet names.
- Keep output paths separate from the source path unless the user explicitly wants in-place modification.
- If Python touches an existing macro-enabled file, state how macro preservation is handled.
- State how the Python-created structure lines up with the VBA sheet names, headers, and start rows.
- Validate the saved workbook structure after writing it.
- Apply the default workbook finish unless the user explicitly asks for plain output:
- header styling
- autofilter
- number format `#,##0.00`
- date format `yyyy-mm-dd`
- auto-fit or best-fit column sizing
- professional readable layout

## What to explain in the answer
- why Python is needed to create or shape the Excel structure for VBA
- why the chosen library stack fits the workbook goal and the VBA integration point
- whether the Python path edits an existing file or creates a new file
- whether macro preservation, sheet naming, or file format choices introduce risk

## Safe defaults
- If direct `.xlsm` modification is unclear, prefer writing a separate `.xlsx` result file.
- If in-place editing is necessary, state exactly which sheets or ranges are modified.
- Prefer copy-save output over overwrite when there is any macro-preservation uncertainty.
