# Output Contract

Use this fixed answer order for Excel automation responses.

## Incomplete-input handling
- Do not stop on incomplete business specs.
- If the request is conceptual, create a baseline workbook design, default sheet layout, and starter code path.
- Mark all inferred elements with `⚠️가정:`.
- If key specifics are unknown, provide a safe default and a short follow-up list of values the user can swap later.
- Keep the same answer structure even at the idea stage. Only the number of assumptions and the precision of the code should change.

## Fixed answer order
1. `핵심요약`
   - request summary
   - whether VBA is included
   - whether Python workbook generation is included
   - whether Microsoft VBA docs were checked
   - whether VBA-Python collision review was checked
2. `구조`
   - input flow
   - processing flow
   - output flow
   - sheet structure
   - file structure
   - VBA reference structure
   - Python-generated structure when relevant
3. `코드`
   - VBA is mandatory
   - add Python only when justified
   - reflect collision-avoidance design if Python is present
4. `실행 단계`
   - how to place VBA
   - how to run Python if used
   - dependency installation
   - output path and file format notes
5. `검증/주의`
   - 10-row test
   - total reconciliation
   - edge cases
   - documentation review basis
   - collision review result
   - formatting defaults applied
   - operational cautions

## Standard workbook outputs
- `Result`
- `Validation_Errors`
- `LOG`

If Python creates or updates sheets inside the same workbook and those names would collide, or if the user explicitly asks to distinguish Python-produced outputs, use a prefixed variant such as `Py_Result`, `Py_Validation_Errors`, and `Py_LOG`. If Python writes a separate workbook, keep the standard names by default.
