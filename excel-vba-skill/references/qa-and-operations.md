# QA and Operations

Use this file before final output.

## QA sequence
1. 10-row test
2. total and count validation
3. edge-case validation
4. full-run recommendation
5. save and reopen validation

## Edge cases to check
- hidden rows
- text-form numbers
- text-form dates
- duplicate keys
- leading zeros
- blank cells
- whitespace-only cells
- error values
- merged cells
- active filters
- header typos
- missing sheet
- missing file

## Silent-failure rule
- Do not allow silent failure.
- Record issues in `Validation_Errors` and `LOG`.
- Use visible execution feedback when appropriate, such as `MsgBox` or `Application.StatusBar`.

## Failure handling
- If a draft-stage solution fails, suggest an updated assumption set.
- If a deployment-stage solution fails, present a safer alternative structure.

## Operating modes
- `A: VBA manual`
- `B: VBA + Python workbook construction`
- `C: VBA + Python existing-workbook update (explicit request only)`
- `D: shared-folder operation`

Python-only reporting is out of scope.
Python is allowed only when it builds, reshapes, or safely updates Excel sheets or files for the VBA workflow.

## Final objective
- reduce manual work by about 80 percent
- keep the automation reproducible
- keep the workbook maintainable for Excel users
- keep the result auditable through logs and validation outputs
