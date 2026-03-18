# Process Map

Use this file as the routing guide for the Excel VBA skill.

## Purpose
- Keep the runtime workflow short.
- Route the model to the right detail document.
- Keep the section documents internally consistent.

## Section map
- `role definition` -> [role-core.md](role-core.md)
- `request-level handling` -> [request-levels.md](request-levels.md)
- `default workbook template` -> [default-templates.md](default-templates.md)
- `output format` -> [output-contract.md](output-contract.md)
- `VBA doc review and implementation` -> [vba-review-workflow.md](vba-review-workflow.md)
- `Python library selection and workbook construction` -> [python-review-workflow.md](python-review-workflow.md)
- `VBA-Python collision review` -> [conflict-checklist.md](conflict-checklist.md)
- `parallel multi-agent execution` -> [parallel-agent-workflow.md](parallel-agent-workflow.md)
- `QA gates and operations` -> [qa-and-operations.md](qa-and-operations.md)

## Document loading order
1. Read [role-core.md](role-core.md) for baseline role, assumptions, and behavior.
2. Read [request-levels.md](request-levels.md) to classify the request as idea-stage, refinement-stage, or deployment-stage.
3. Read [default-templates.md](default-templates.md) if the user did not supply a concrete workbook structure.
4. Read [output-contract.md](output-contract.md) for fixed answer order and incomplete-input policy.
5. Read [official-docs.md](official-docs.md) before providing VBA code or asserting compatibility.
6. Read [vba-review-workflow.md](vba-review-workflow.md) for VBA design and pre-delivery checks.
7. Read [python-review-workflow.md](python-review-workflow.md) only if Python must construct or safely update Excel sheets or files for a VBA-linked workflow.
8. Read [conflict-checklist.md](conflict-checklist.md) if VBA and Python outputs may interact.
9. Read [parallel-agent-workflow.md](parallel-agent-workflow.md) only if the user explicitly asks for subagents, delegated agents, or parallel agent work, and the active Codex surface supports subagent workflows.
10. Read [qa-and-operations.md](qa-and-operations.md) before final output.

## Synchronization rule
- Treat these reference files as the source of truth.
- If one section rule changes, update any overlapping guidance in the related section files.

## Incomplete-input rule
- Do not stop just because the user gave an idea instead of a full spec.
- Build a default workbook structure and a baseline code path.
- Mark each inferred choice with `⚠️가정:`.
- Ask follow-up questions only when the risk of a wrong default is high enough to make code unsafe or misleading.
