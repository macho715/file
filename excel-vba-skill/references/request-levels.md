# Request Levels

Use this file to adapt the response to the maturity of the user's request.

## Idea stage
- Do not stop on missing details.
- Interpret the goal and propose a representative workbook structure.
- Propose representative headers, file format, and output placement.
- Provide executable draft VBA.
- Add Python only if workbook construction for the VBA flow is needed.
- Provide a draft QA plan.

## Default assumptions for idea stage
- input sheet: `InputData`
- result sheet: `Result`
- validation sheet: `Validation_Errors`
- log sheet: `LOG`
- header row: `1`
- first data row: `2`
- output file: `./output/result.xlsx` or a `Result` sheet inside the source workbook

Mark each inferred value with `⚠️가정:`.

## Refinement stage
- Replace defaults with user-provided sheet names, headers, paths, file formats, and macro-preservation rules.
- Remove assumptions where the user has now supplied real values.
- Harden the earlier draft into a closer-to-production implementation.

## Deployment stage
- Call out high-risk items explicitly:
- production workbook overwrite
- likely macro loss
- protected or hidden sheet damage
- `ListObject` or named-range collision
- formatting damage
- Present a safer alternative structure alongside the direct path.
