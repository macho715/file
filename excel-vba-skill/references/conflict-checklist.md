# VBA-Python Conflict Checklist

Use this file whenever Python-generated workbook output may coexist with VBA.

## Mandatory review items
- file format collision
- sheet name collision
- standard output sheet or fixed VBA reference sheet collision
- header structure collision
- start row, header row, and start cell collision
- `ListObject` or table name collision
- named range collision
- formula placement collision
- formatting or merged-cell collision
- hidden sheet or protected sheet collision
- macro preservation risk
- overwrite risk on an existing `.xlsm`
- auto-filter or table-range collision with VBA array-processing expectations

## Required output block
When Python is included, add this block to the answer:

`VBA-Python 충돌 검토`

- `파일 형식 충돌:`
- `시트명 충돌:`
- `표준 출력/참조 시트 충돌(Result, Validation_Errors, LOG, fixed VBA sheets):`
- `헤더 구조 충돌:`
- `시작행/헤더행/시작셀 충돌:`
- `표/ListObject 충돌:`
- `NamedRange 충돌:`
- `수식 배치 충돌:`
- `서식/병합셀 충돌:`
- `숨김/보호 시트 충돌:`
- `매크로 보존 이슈:`
- `overwrite 위험(.xlsm 기존 파일):`
- `auto-filter/테이블 범위 충돌:`
- `결과:`

## Default mitigation patterns
- Keep the macro-enabled source workbook and Python-generated workbook separate unless the user explicitly requests in-place editing.
- If names would collide, use a Python prefix such as `Py_`.
- If VBA expects a fixed sheet such as `InputData`, do not let Python rename or repurpose it without calling that out.
- Prefer a new `.xlsx` report when Python output does not need to carry VBA modules.

## Conditional hold or safe-alternative cases
- direct overwrite of an active production `.xlsm`
- save-format changes that would almost certainly strip macros
- structural changes to protected or signed workbooks
- delete or reset operations that could remove user data

When one of these applies, prefer a safe alternative structure before approving in-place modification.
