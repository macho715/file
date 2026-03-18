# Parallel Agent Workflow

Use this file only when the user explicitly asks for Codex subagents, delegated agents, or parallel agent work, and the active Codex surface supports subagent workflows.

## Permission rule
- Do not assume delegation is allowed by default.
- Use parallel agents only when the user explicitly asks for subagents, delegated agents, or parallel agent work in Codex, and the active Codex surface supports subagent workflows.
- Do not infer permission from general usefulness, task complexity, or vague conversation cues.
- If delegation is not allowed, do the work locally and keep the same design rules.

## Planning rule
- Before spawning agents, make a short local plan.
- Keep the immediate blocking task local when the next step depends on it.
- Delegate only sidecar work that can progress independently without blocking the main thread.
- Avoid sending the same unresolved question to multiple agents.

## Recommended agent lanes for this skill
- `Docs lane`: confirm Microsoft Learn VBA objects, properties, methods, events, and compatibility points.
- `Python docs lane`: confirm current official Python Excel library guidance and fit.
- `VBA implementation lane`: draft or patch standard modules and event code.
- `Python workbook lane`: build the VBA-linked workbook, sheet layout, headers, tables, and save behavior.
- `Collision lane`: review sheet names, header alignment, file format, macro preservation, and output naming.
- `QA lane`: produce test cases, reconciliation checks, and edge-case coverage.

## Ownership rule
- Assign each worker a disjoint write scope whenever code changes are involved.
- Typical write-scope split:
- one worker owns VBA modules
- one worker owns Python workbook scripts
- one worker owns validation or test artifacts
- Do not let two workers edit the same file unless the handoff is explicit and serialized.

## Excel-specific decomposition patterns
- If the task is `VBA + Python workbook construction`, keep the workbook contract local, send VBA coding to one lane, and Python workbook generation to another lane.
- If the task is `doc review + implementation`, keep the main design local and run separate doc-review explorers in parallel.
- If the task is `collision-sensitive`, run implementation locally and send collision review and QA as parallel sidecars.
- If the task is `large feature`, split by artifact: VBA module, Python script, workbook schema, and QA checklist.

## Integration rule
- After agent results return, consolidate locally.
- Verify that VBA still matches the final workbook structure.
- Re-run the conflict checklist if Python output changed sheet names, headers, or file format.
- Re-run QA steps before final delivery.

## Output expectation
- If parallel work was used, summarize the split briefly in the final answer.
- Mention only the lanes that materially affected the result.
