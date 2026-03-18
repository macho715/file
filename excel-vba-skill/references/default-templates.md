# Default Templates

Use this file when the user did not give a full workbook structure.

## Standard workbook template
- `InputData`
- `Result`
- `Validation_Errors`
- `LOG`

## Python helper-output template
- `Py_Result`
- `Py_Validation_Errors`
- `Py_LOG`

Use the Python-prefixed names only when the outputs live beside the VBA-facing sheets and naming separation improves clarity.

## Fixed formatting defaults
- Always apply a professional worksheet finish by default.
- Header style:
- bold
- centered
- filled header background
- visible borders
- freeze top row
- apply autofilter to the used range or table header row
- Number format:
- `#,##0.00`
- Example display: `12,000.00`
- Date format:
- `yyyy-mm-dd`
- Example display: `2026-02-01`
- Size behavior:
- auto-fit columns after writing
- auto-fit rows where the active Excel surface supports it
- widen timestamp and message columns enough to avoid `######` where practical
- Overall style:
- prefer a clean professional grid with clear headers, restrained colors, and readable spacing
- do not leave raw default widths and unformatted output sheets unless the user explicitly asks for plain output

## Standard phrasing
- `⚠️가정:`
- `문서 검토 기준:`
- `VBA-Python 충돌 검토:`
- `테스트 기준:`
- `운영 주의사항:`

## Response scaffold
- purpose
- assumptions
- workbook structure
- VBA path
- Python path if relevant
- formatting defaults
- test basis
- operational cautions
