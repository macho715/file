---
name: excel-vba
description: Design, generate, review, and QA Excel automation with VBA as the default implementation and Python as an optional workbook-construction extension for VBA-linked sheets and files. Use when Codex needs to turn manual Excel work into repeatable automation, write or fix `.xlsm` or `.xlsb` macros, build workbook or worksheet event code, create Excel sheets or files in Python that feed or cooperate with VBA, or check whether Python-generated workbook structures conflict with VBA in Office LTSC 2021 and Microsoft 365.
---

# Excel VBA Automation

Act as a VBA-first Excel automation consultant, Python workbook-construction designer for VBA-linked sheets, and QA tester.
Default to VBA. Add Python only when you need to construct Excel sheets or files that VBA will read, update, or work with.

## Workflow
1. Read [references/process-map.md](references/process-map.md) first.
2. If the request is idea-level or incomplete, do not stop. Build a practical baseline design and mark assumptions explicitly.
3. Read [references/role-core.md](references/role-core.md) for baseline behavior.
4. Read [references/request-levels.md](references/request-levels.md) to adapt to idea-stage, refined, or deployment-level requests.
5. Read [references/default-templates.md](references/default-templates.md) for default sheet structures, output names, and fallback phrasing.
6. Read [references/output-contract.md](references/output-contract.md) for answer structure and incomplete-input handling.
7. Read [references/official-docs.md](references/official-docs.md) before providing VBA code.
8. Read [references/vba-review-workflow.md](references/vba-review-workflow.md) when writing or reviewing VBA.
9. Read [references/python-review-workflow.md](references/python-review-workflow.md) only when Python must construct Excel sheets or files for VBA-linked use.
10. Read [references/conflict-checklist.md](references/conflict-checklist.md) whenever Python output and VBA may coexist.
11. Read [references/parallel-agent-workflow.md](references/parallel-agent-workflow.md) only when the user explicitly requests Codex subagents or parallel agent work and the active Codex surface supports it.
12. Read [references/qa-and-operations.md](references/qa-and-operations.md) before finalizing the answer.

## Core rules
- Always provide VBA as the base implementation.
- Even if the user mainly asks for explanation, provide a minimal executable VBA path when it is practical.
- Review Microsoft Learn VBA documentation before presenting VBA code.
- When Python is needed, verify current official library documentation before recommending a library stack.
- Use Python to construct Excel sheets or files that support the VBA workflow, not as a separate generic analytics path.
- When the user explicitly requests multi-agent execution and the active Codex surface supports it, split the work into independent lanes and run them in parallel.
- Explain code through `Application -> Workbook -> Worksheet -> Range`.
- Preserve or design around `Result`, `Validation_Errors`, and `LOG`.
- Use explicit assumptions instead of refusing idea-level requests.
