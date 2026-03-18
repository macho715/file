Attribute VB_Name = "modMIR_Gantt_PTO"
Option Explicit

' ============================================================
' MIR Reactor Repair Gantt  PTO Auto-Schedule
' Version : 3.0  (2026-02-16)
' Office  : LTSC 2021 compatible
' ============================================================
' PRODUCTION PATCHES (v2->v3):
'   (A) Column letter helper uses worksheet-qualified Cells
'   (B) LOG sheet auto-create in LogMsg
'   (C) CF formulas use relative header ref (K$3) for robust shifting
'   (D) Risk CF formula quoting fixed  ("?" / "HIGH")
'   (E) PaintBars risk InStr quoting fixed
'   (F) v3: % Done + Actual Start/End columns (K/L/M) auto-stamp
'   (G) v3: DSV_Checklist status CF auto-refresh
'   (H) v3: Jump_To_Today, Export_Summary_Report, Refresh_Cost_Sim added
'   (I) v3: PDF print area / A3 landscape setup added
'   (J) v3: Progress % bar drawn in date track on task rows
'   (K) v3: Variance_Report  -  Planned vs Actual delta table
'   (L) v3: MIR_Debug_Test_RiskLine included as built-in unit test
' ============================================================

' ── Sheet constants ──────────────────────────────────────────
Public Const SHEET_PREFIX   As String = "Gantt_"
Public Const HEADER_ROW     As Long = 3
Public Const FIRST_DATA_ROW As Long = 4

' ── Meta columns (A:M) ───────────────────────────────────────
Public Const COL_STEP   As Long = 1   ' A
Public Const COL_PHASE  As Long = 2   ' B
Public Const COL_TASK   As Long = 3   ' C
Public Const COL_START  As Long = 4   ' D
Public Const COL_END    As Long = 5   ' E
Public Const COL_DAYS   As Long = 6   ' F
Public Const COL_RISK   As Long = 7   ' G
Public Const COL_NOTE   As Long = 8   ' H
Public Const COL_PRED   As Long = 9   ' I
Public Const COL_LAG    As Long = 10  ' J
Public Const COL_PCT    As Long = 11  ' K  [NEW v3]
Public Const COL_ACT_S  As Long = 12  ' L  [NEW v3]
Public Const COL_ACT_E  As Long = 13  ' M  [NEW v3]

Public Const META_COLS      As Long = 13
Public Const DATE_COL_START As Long = 14  ' N

' ── Sheet names ──────────────────────────────────────────────
Private Const SH_SUMMARY    As String = "Summary"
Private Const SH_BASELINE   As String = "Baseline"
Private Const SH_LOG        As String = "LOG"
Private Const SH_CHECKLIST  As String = "DSV_Checklist"
Private Const SH_COST       As String = "Cost_Sim"

' ── Theme colours ────────────────────────────────────────────
Private Const BG_DARK      As String = "0D0F14"
Private Const BG_WEEKEND   As String = "0D1020"
Private Const BG_SURFACE2  As String = "1A1E2A"
Private Const BG_HEADER    As String = "0B1120"
Private Const BORDER_HEX   As String = "232840"

Private Const C_AMBER   As String = "E8B84B"
Private Const C_BLUE    As String = "5EB8FF"
Private Const C_GREEN   As String = "6BDFB0"
Private Const C_PINK    As String = "F472B6"
Private Const C_ORANGE  As String = "FB923C"
Private Const C_PURPLE  As String = "A78BFA"
Private Const C_YELLOW  As String = "FACC15"
Private Const C_RED     As String = "FF5F5F"
Private Const C_DIM     As String = "5A6480"

' ── Global snapshot (Shift mode) ─────────────────────────────
Public gPrevSheet As String
Public gPrevRow   As Long
Public gPrevCol   As Long
Public gPrevStart As Variant
Public gPrevEnd   As Variant
Public gPrevDays  As Variant

' ============================================================
' 1. APP STATE GUARD
' ============================================================
Private Sub AppOn()
    Application.ScreenUpdating  = False
    Application.EnableEvents    = False
    Application.Calculation     = xlCalculationManual
    Application.DisplayAlerts   = False
End Sub

Private Sub AppOff()
    Application.Calculation     = xlCalculationAutomatic
    Application.CalculateFull
    Application.ScreenUpdating  = True
    Application.EnableEvents    = True
    Application.DisplayAlerts   = True
End Sub

' ============================================================
' 2. PUBLIC MACROS
' ============================================================
Public Sub Init_PTO_Automation()
    On Error GoTo EH
    AppOn

    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then
            NormalizeSheetDates ws
            RefreshGantt ws, True
            ApplyProtection ws, False
        End If
    Next ws

    AppOff
    MsgBox "PTO Automation v3.0 initialised." & vbCrLf & _
           "Sheets: Gantt_* normalised + refreshed." & vbCrLf & vbCrLf & _
           "Available macros:" & vbCrLf & _
           "  Recalculate_Active_Scenario" & vbCrLf & _
           "  Recalculate_All_Scenarios" & vbCrLf & _
           "  Reset_Active_Scenario_To_Baseline" & vbCrLf & _
           "  Jump_To_Today" & vbCrLf & _
           "  Export_Summary_Report" & vbCrLf & _
           "  Variance_Report" & vbCrLf & _
           "  Protect_All_Gantt / Unprotect_All_Gantt", vbInformation
    Exit Sub
EH:
    AppOff
    LogMsg "Init_PTO_Automation", Err.Number & " - " & Err.Description
End Sub

' ─────────────────────────────────────────────────────────────
Public Sub Recalculate_Active_Scenario()
    On Error GoTo EH
    Dim ws As Worksheet
    Set ws = ActiveSheet
    If Not IsGanttSheet(ws) Then
        MsgBox "Active sheet is not a Gantt_* sheet.", vbExclamation
        Exit Sub
    End If
    AppOn
    If CfgOn("CFG_AUTO_SCHEDULE_PTO", True) Then PTO_Recalculate ws
    RefreshGantt ws, True
    AppOff
    Exit Sub
EH:
    AppOff
    LogMsg "Recalculate_Active_Scenario", Err.Number & " - " & Err.Description
End Sub

' ─────────────────────────────────────────────────────────────
Public Sub Recalculate_All_Scenarios()
    On Error GoTo EH
    AppOn
    Dim t0 As Double: t0 = Timer
    Dim ws As Worksheet
    Dim cnt As Long
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then
            If CfgOn("CFG_AUTO_SCHEDULE_PTO", True) Then PTO_Recalculate ws
            RefreshGantt ws, True
            cnt = cnt + 1
        End If
    Next ws
    AppOff
    LogMsg "Recalculate_All_Scenarios", cnt & " sheets in " & Format(Timer - t0, "0.00") & "s"
    Exit Sub
EH:
    AppOff
    LogMsg "Recalculate_All_Scenarios", Err.Number & " - " & Err.Description
End Sub

' ─────────────────────────────────────────────────────────────
Public Sub Reset_Active_Scenario_To_Baseline()
    On Error GoTo EH
    Dim ws As Worksheet
    Set ws = ActiveSheet
    If Not IsGanttSheet(ws) Then
        MsgBox "Active sheet is not a Gantt_* sheet.", vbExclamation
        Exit Sub
    End If
    If MsgBox("Reset " & ws.Name & " to Baseline?", vbYesNo + vbQuestion) = vbNo Then Exit Sub
    AppOn
    RestoreFromBaseline ws
    RefreshGantt ws, True
    AppOff
    MsgBox ws.Name & " reset to Baseline.", vbInformation
    Exit Sub
EH:
    AppOff
    LogMsg "Reset_Active_Scenario_To_Baseline", Err.Number & " - " & Err.Description
End Sub

' ─────────────────────────────────────────────────────────────
Public Sub Reset_All_Scenarios_To_Baseline()
    On Error GoTo EH
    If MsgBox("Reset ALL scenarios to Baseline?", vbYesNo + vbQuestion) = vbNo Then Exit Sub
    AppOn
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then
            RestoreFromBaseline ws
            RefreshGantt ws, True
        End If
    Next ws
    AppOff
    MsgBox "All scenarios reset to Baseline.", vbInformation
    Exit Sub
EH:
    AppOff
    LogMsg "Reset_All_Scenarios_To_Baseline", Err.Number & " - " & Err.Description
End Sub

' ─────────────────────────────────────────────────────────────
Public Sub Protect_All_Gantt()
    On Error GoTo EH
    AppOn
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then ApplyProtection ws, True
    Next ws
    AppOff
    MsgBox "Sheets protected (input cells still editable).", vbInformation
    Exit Sub
EH:
    AppOff
    LogMsg "Protect_All_Gantt", Err.Number & " - " & Err.Description
End Sub

' ─────────────────────────────────────────────────────────────
Public Sub Unprotect_All_Gantt()
    On Error GoTo EH
    AppOn
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then
            On Error Resume Next
            ws.Unprotect
            On Error GoTo EH
        End If
    Next ws
    AppOff
    MsgBox "All Gantt sheets unprotected.", vbInformation
    Exit Sub
EH:
    AppOff
    LogMsg "Unprotect_All_Gantt", Err.Number & " - " & Err.Description
End Sub

' ─────────────────────────────────────────────────────────────
' [NEW v3] Jump_To_Today
' ─────────────────────────────────────────────────────────────
Public Sub Jump_To_Today()
    Dim ws As Worksheet
    Set ws = ActiveSheet
    If Not IsGanttSheet(ws) Then Exit Sub

    Dim lastC As Long: lastC = HeaderLastCol(ws)
    Dim col As Long
    For col = DATE_COL_START To lastC
        If IsDate(ws.Cells(HEADER_ROW, col).Value) Then
            If CDate(ws.Cells(HEADER_ROW, col).Value) = Date Then
                ws.Cells(FIRST_DATA_ROW, col).Select
                ActiveWindow.ScrollColumn = col - 2
                LogMsg "Jump_To_Today", "Scrolled to " & Format(Date, "yyyy-mm-dd"), ws.Name
                Exit Sub
            End If
        End If
    Next col
    MsgBox "TODAY (" & Format(Date, "yyyy-mm-dd") & ") not found in current timeline.", vbInformation
End Sub

' ─────────────────────────────────────────────────────────────
' [NEW v3] Export_Summary_Report  (plain-text sheet)
' ─────────────────────────────────────────────────────────────
Public Sub Export_Summary_Report()
    ' ── [v3] 전체 시나리오 + Checklist 요약 시트 생성 ──────────
    AppOn   ' ← 반드시 최상단 (시트 생성 전)

    On Error GoTo EH
    Dim t0 As Double: t0 = Timer

    Dim rName As String
    rName = "MIR_Report_" & Format(Now(), "YYYYMMDD_HHMMSS")

    ' 기존 동명 시트 삭제
    On Error Resume Next
    ThisWorkbook.Sheets(rName).Delete
    On Error GoTo EH

    ' 새 시트 생성
    Dim wsR As Worksheet
    Set wsR = ThisWorkbook.Sheets.Add( _
        After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
    wsR.Name = rName
    wsR.Tab.Color = HexToLong(C_BLUE)
    wsR.DisplayGridlines = False

    ' ── 헤더 ───────────────────────────────────────────────────
    Dim rw As Long: rw = 1

    With wsR.Cells(rw, 1)
        .Value = "MIR REACTOR REPAIR -- PTO STATUS REPORT"
        .Font.Bold = True
        .Font.Size = 13
    End With
    rw = rw + 1
    wsR.Cells(rw, 1).Value = "Generated: " & Format(Now(), "yyyy-mm-dd hh:mm")
    rw = rw + 1
    wsR.Cells(rw, 1).Value = "Module: modMIR_Gantt_PTO v3.0"
    rw = rw + 2

    ' ── Checklist 요약 ─────────────────────────────────────────
    Dim wsCL As Worksheet
    Dim openCnt As Long, confCnt As Long
    Dim clR As Long, clLast As Long, clSt As String

    On Error Resume Next
    Set wsCL = Nothing
    Set wsCL = ThisWorkbook.Sheets(SH_CHECKLIST)
    On Error GoTo EH

    If Not wsCL Is Nothing Then
        clLast = wsCL.Cells(wsCL.Rows.Count, 2).End(xlUp).Row
        For clR = 4 To clLast
            clSt = UCase$(Trim$(CStr(wsCL.Cells(clR, 5).Value)))
            If clSt = "OPEN"      Then openCnt = openCnt + 1
            If clSt = "CONFIRMED" Then confCnt = confCnt + 1
        Next clR

        With wsR.Cells(rw, 1)
            .Value = "=== DSV CHECKLIST ==="
            .Font.Bold = True
        End With
        rw = rw + 1
        wsR.Cells(rw, 1).Value = "OPEN: " & openCnt & "   CONFIRMED: " & confCnt
        rw = rw + 2
    End If

    ' ── 시나리오별 Gantt 요약 ───────────────────────────────────
    Dim scen As Variant
    Dim wsG As Worksheet
    Dim gR As Long, gLast As Long
    Dim pctStr As String
    Dim hIdx As Long

    Dim hdrArr As Variant
    hdrArr = Array("#", "Phase", "Task", "Start", "End", "Days", "Risk", "%Done")

    For Each scen In Array("BASE", "BEST", "WORST")
        Set wsG = Nothing
        On Error Resume Next
        Set wsG = ThisWorkbook.Sheets(SHEET_PREFIX & scen)
        On Error GoTo EH
        If wsG Is Nothing Then GoTo NextScen

        With wsR.Cells(rw, 1)
            .Value = "=== GANTT_" & scen & " ==="
            .Font.Bold = True
        End With
        rw = rw + 1

        For hIdx = 0 To UBound(hdrArr)
            With wsR.Cells(rw, hIdx + 1)
                .Value = hdrArr(hIdx)
                .Font.Bold = True
            End With
        Next hIdx
        rw = rw + 1

        gLast = LastUsedRow(wsG)
        For gR = FIRST_DATA_ROW To gLast
            If IsGroupRow(wsG, gR) Then GoTo NextGRow
            If Not IsDate(wsG.Cells(gR, COL_START).Value) Then GoTo NextGRow

            pctStr = ""
            If IsNumeric(wsG.Cells(gR, COL_PCT).Value) Then
                pctStr = Format(CDbl(wsG.Cells(gR, COL_PCT).Value) * 100, "0") & "%"
            End If

            wsR.Cells(rw, 1).Value = wsG.Cells(gR, COL_STEP).Value
            wsR.Cells(rw, 2).Value = wsG.Cells(gR, COL_PHASE).Value
            wsR.Cells(rw, 3).Value = wsG.Cells(gR, COL_TASK).Value
            wsR.Cells(rw, 4).Value = Format(wsG.Cells(gR, COL_START).Value, "yyyy-mm-dd")
            wsR.Cells(rw, 5).Value = Format(wsG.Cells(gR, COL_END).Value,   "yyyy-mm-dd")
            wsR.Cells(rw, 6).Value = wsG.Cells(gR, COL_DAYS).Value
            wsR.Cells(rw, 7).Value = wsG.Cells(gR, COL_RISK).Value
            wsR.Cells(rw, 8).Value = pctStr
            rw = rw + 1
NextGRow:
        Next gR
        rw = rw + 1
NextScen:
    Next scen

    wsR.Columns("A:H").AutoFit
    wsR.Cells(1, 1).Select

    AppOff
    LogMsg "Export_Summary_Report", rName & " in " & Format(Timer - t0, "0.00") & "s"
    MsgBox "Report: " & rName & vbCrLf & _
           "Elapsed: " & Format(Timer - t0, "0.00") & "s", vbInformation, "Export"
    Exit Sub

EH:
    AppOff
    LogMsg "Export_Summary_Report", Err.Number & " - " & Err.Description
    MsgBox "Error: " & Err.Description, vbCritical
End Sub

' ─────────────────────────────────────────────────────────────
' [NEW v3] Variance_Report  (Planned vs Actual)
' ─────────────────────────────────────────────────────────────
Public Sub Variance_Report()
    ' ── AppOn 최상단 필수 ─────────────────────────────────────
    AppOn
    On Error GoTo EH

    Dim rName As String
    rName = "Variance_" & Format(Now(), "YYYYMMDD")

    ' 기존 동명 시트 삭제
    On Error Resume Next
    ThisWorkbook.Sheets(rName).Delete
    On Error GoTo EH

    ' 새 시트 생성
    Dim wsV As Worksheet
    Set wsV = ThisWorkbook.Sheets.Add( _
        After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
    wsV.Name = rName
    wsV.Tab.Color = HexToLong(C_AMBER)
    wsV.DisplayGridlines = False

    ' ── 헤더 행 ───────────────────────────────────────────────
    Dim hdrArr As Variant
    hdrArr = Array("Scenario", "#", "Task", "Plan Start", "Plan End", _
                   "Act Start", "Act End", "Start Var(d)", "End Var(d)", _
                   "% Done", "Status")
    Dim hIdx As Long
    For hIdx = 0 To UBound(hdrArr)
        With wsV.Cells(1, hIdx + 1)
            .Value          = hdrArr(hIdx)
            .Font.Bold      = True
            .Font.Size      = 9
            .Interior.Color = HexToLong(BG_SURFACE2)
            .Font.Color     = HexToLong(C_AMBER)
        End With
    Next hIdx

    ' ── 모든 변수 루프 밖 선언 ────────────────────────────────
    Dim rw       As Long: rw = 2
    Dim scen     As Variant
    Dim wsG      As Worksheet
    Dim gR       As Long
    Dim gLast    As Long
    Dim planS    As Date
    Dim planE    As Date
    Dim actS     As Variant
    Dim actE     As Variant
    Dim varS     As Long
    Dim varE     As Long
    Dim pct      As Double
    Dim rowStatus As String

    ' ── 시나리오 순환 ─────────────────────────────────────────
    For Each scen In Array("BASE", "BEST", "WORST")
        Set wsG = Nothing
        On Error Resume Next
        Set wsG = ThisWorkbook.Sheets(SHEET_PREFIX & CStr(scen))
        On Error GoTo EH
        If wsG Is Nothing Then GoTo NextVarScen

        gLast = LastUsedRow(wsG)

        For gR = FIRST_DATA_ROW To gLast
            If IsGroupRow(wsG, gR)                          Then GoTo NextVarRow
            If Not IsDate(wsG.Cells(gR, COL_START).Value)  Then GoTo NextVarRow

            planS = CDate(wsG.Cells(gR, COL_START).Value)
            planE = CDate(wsG.Cells(gR, COL_END).Value)
            actS  = wsG.Cells(gR, COL_ACT_S).Value
            actE  = wsG.Cells(gR, COL_ACT_E).Value
            pct   = 0
            If IsNumeric(wsG.Cells(gR, COL_PCT).Value) Then
                pct = CDbl(wsG.Cells(gR, COL_PCT).Value)
            End If

            ' Variance (양수 = 지연)
            varS = 0 : varE = 0
            If IsDate(actS) Then varS = DateDiff("d", planS, CDate(actS))
            If IsDate(actE) Then varE = DateDiff("d", planE, CDate(actE))

            ' Status 판정
            If pct >= 1 Then
                rowStatus = IIf(varE <= 0, "DONE ON TIME", "DONE LATE")
            ElseIf pct > 0 Then
                rowStatus = "IN PROGRESS"
            ElseIf IsDate(actS) Then
                rowStatus = "STARTED"
            ElseIf planS <= Date Then
                rowStatus = "OVERDUE"
            Else
                rowStatus = "NOT STARTED"
            End If

            ' 값 기록
            wsV.Cells(rw, 1).Value  = CStr(scen)
            wsV.Cells(rw, 2).Value  = wsG.Cells(gR, COL_STEP).Value
            wsV.Cells(rw, 3).Value  = wsG.Cells(gR, COL_TASK).Value
            wsV.Cells(rw, 4).Value  = Format(planS, "yyyy-mm-dd")
            wsV.Cells(rw, 5).Value  = Format(planE, "yyyy-mm-dd")
            wsV.Cells(rw, 6).Value  = IIf(IsDate(actS), Format(CDate(actS), "yyyy-mm-dd"), "")
            wsV.Cells(rw, 7).Value  = IIf(IsDate(actE), Format(CDate(actE), "yyyy-mm-dd"), "")
            wsV.Cells(rw, 8).Value  = varS
            wsV.Cells(rw, 9).Value  = varE
            wsV.Cells(rw, 10).Value = Format(pct, "0%")
            wsV.Cells(rw, 11).Value = rowStatus

            ' Status 셀 색상
            Select Case rowStatus
                Case "DONE ON TIME"
                    wsV.Cells(rw, 11).Interior.Color = HexToLong(C_GREEN)
                Case "DONE LATE", "OVERDUE"
                    wsV.Cells(rw, 11).Interior.Color = HexToLong(C_RED)
                Case "IN PROGRESS", "STARTED"
                    wsV.Cells(rw, 11).Interior.Color = HexToLong(C_AMBER)
            End Select

            ' Variance 글씨 색 (양수=지연=빨강, 음수=조기=녹색)
            If Abs(varS) > 0 Then
                wsV.Cells(rw, 8).Font.Color = HexToLong(IIf(varS > 0, C_RED, C_GREEN))
            End If
            If Abs(varE) > 0 Then
                wsV.Cells(rw, 9).Font.Color = HexToLong(IIf(varE > 0, C_RED, C_GREEN))
            End If

            rw = rw + 1
NextVarRow:
        Next gR
NextVarScen:
    Next scen

    wsV.Columns("A:K").AutoFit
    wsV.Cells(1, 1).Select

    AppOff
    LogMsg "Variance_Report", rName & " created  rows=" & (rw - 2)
    MsgBox "Variance Report: " & rName & vbCrLf & _
           "Rows: " & (rw - 2), vbInformation, "Variance"
    Exit Sub

EH:
    AppOff
    LogMsg "Variance_Report", Err.Number & " - " & Err.Description
    MsgBox "Error: " & Err.Description, vbCritical
End Sub

' ─────────────────────────────────────────────────────────────
' [NEW v3] Refresh_Cost_Sim
' ─────────────────────────────────────────────────────────────
Public Sub Refresh_Cost_Sim()
    AppOn
    Application.Calculation = xlCalculationAutomatic
    Application.CalculateFull
    AppOff
    LogMsg "Refresh_Cost_Sim", SH_COST & " forced recalculate"
    MsgBox "Cost_Sim refreshed.", vbInformation
End Sub

' ─────────────────────────────────────────────────────────────
' [NEW v3] Setup_Print_A3  —  A3 landscape print area for each Gantt
' ─────────────────────────────────────────────────────────────
Public Sub Setup_Print_A3()
    On Error GoTo EH
    AppOn
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then
            Dim lastR As Long: lastR = LastUsedRow(ws)
            Dim lastC As Long: lastC = HeaderLastCol(ws)

            ws.PageSetup.PrintArea = _
                ws.Range(ws.Cells(1, 1), ws.Cells(lastR + 3, lastC)).Address

            With ws.PageSetup
                .Orientation  = xlLandscape
                .PaperSize    = xlPaperA3
                .FitToPagesWide = 1
                .FitToPagesTall = 0
                .Zoom = False
                .LeftMargin   = Application.InchesToPoints(0.4)
                .RightMargin  = Application.InchesToPoints(0.4)
                .TopMargin    = Application.InchesToPoints(0.5)
                .BottomMargin = Application.InchesToPoints(0.5)
            End With

            LogMsg "Setup_Print_A3", "Print area set", ws.Name, lastR, lastC
        End If
    Next ws
    AppOff
    MsgBox "A3 Landscape print area set for all Gantt sheets.", vbInformation
    Exit Sub
EH:
    AppOff
    LogMsg "Setup_Print_A3", Err.Number & " - " & Err.Description
End Sub

' ─────────────────────────────────────────────────────────────
' [NEW v3] Clear_LOG
' ─────────────────────────────────────────────────────────────
Public Sub Clear_LOG()
    If MsgBox("Clear all LOG entries?", vbYesNo + vbQuestion) = vbNo Then Exit Sub
    Dim ws As Worksheet
    On Error Resume Next: Set ws = ThisWorkbook.Sheets(SH_LOG): On Error GoTo 0
    If ws Is Nothing Then Exit Sub
    If ws.Cells(ws.Rows.Count, 1).End(xlUp).Row > 1 Then
        ws.Rows("2:" & ws.Cells(ws.Rows.Count, 1).End(xlUp).Row).Delete
    End If
    LogMsg "Clear_LOG", "LOG cleared"
    MsgBox "LOG cleared.", vbInformation
End Sub

' ============================================================
' 3. EVENT HOOKS (called from ThisWorkbook)
' ============================================================
Public Sub MIR_OnSelectionChange(ByVal ws As Worksheet, ByVal Target As Range)
    On Error GoTo EH
    If Not IsGanttSheet(ws) Then Exit Sub
    If Target Is Nothing Then Exit Sub
    If Target.CountLarge <> 1 Then Exit Sub
    If Target.Row < FIRST_DATA_ROW Then Exit Sub

    If Target.Column = COL_START Or Target.Column = COL_END Or _
       Target.Column = COL_DAYS  Or Target.Column = COL_PRED Or _
       Target.Column = COL_LAG Then

        gPrevSheet = ws.Name
        gPrevRow   = Target.Row
        gPrevCol   = Target.Column
        gPrevStart = ws.Cells(Target.Row, COL_START).Value
        gPrevEnd   = ws.Cells(Target.Row, COL_END).Value
        gPrevDays  = ws.Cells(Target.Row, COL_DAYS).Value
    End If
    Exit Sub
EH:
    LogMsg "MIR_OnSelectionChange", Err.Number & " - " & Err.Description, _
           ws.Name, Target.Row, Target.Column
End Sub

' ─────────────────────────────────────────────────────────────
Public Sub MIR_OnChange(ByVal ws As Worksheet, ByVal Target As Range)
    On Error GoTo EH
    If Not IsGanttSheet(ws) Then
        ' [NEW v3] DSV Checklist CF refresh on status change
        If ws.Name = SH_CHECKLIST Then
            RefreshChecklistCF ws
        End If
        Exit Sub
    End If
    If Target Is Nothing Then Exit Sub
    If Target.Row < FIRST_DATA_ROW Then Exit Sub

    Dim hit As Range
    Set hit = Intersect(Target, ws.Range(ws.Columns(COL_START), ws.Columns(COL_LAG)))
    If hit Is Nothing Then
        ' [NEW v3] PCT change -> auto-stamp actual dates
        If Not Intersect(Target, ws.Columns(COL_PCT)) Is Nothing Then
            HandlePctChange ws, Target
        End If
        Exit Sub
    End If

    Application.EnableEvents    = False
    Application.ScreenUpdating  = False

    ' Multi-cell paste
    If Target.CountLarge <> 1 Then
        NormalizeSheetDates ws
        If CfgOn("CFG_AUTO_SCHEDULE_PTO", True) Then PTO_Recalculate ws
        RefreshGantt ws, True
        GoTo SafeExit
    End If

    If IsGroupRow(ws, Target.Row) Then GoTo SafeExit

    If CfgOn("CFG_AUTO_SCHEDULE_PTO", True) Then
        NormalizeRowDates ws, Target.Row

        Select Case Target.Column
            Case COL_END:   UpdateDaysFromStartEnd ws, Target.Row
            Case COL_DAYS:  UpdateEndFromStartDays ws, Target.Row
            Case COL_START:
                If CfgOn("CFG_KEEP_DURATION", True) Then
                    KeepDurationOnStartChange ws, Target.Row
                Else
                    UpdateEndFromStartDays ws, Target.Row
                End If
        End Select

        PTO_Recalculate ws
        RefreshGantt ws, True
    Else
        HandleShiftMode ws, Target
        RefreshGantt ws, True
    End If

SafeExit:
    Application.ScreenUpdating = True
    Application.EnableEvents   = True
    Exit Sub
EH:
    LogMsg "MIR_OnChange", Err.Number & " - " & Err.Description, _
           ws.Name, Target.Row, Target.Column
    Application.ScreenUpdating = True
    Application.EnableEvents   = True
End Sub

' ─────────────────────────────────────────────────────────────
' [NEW v3] HandlePctChange  (% Done auto-stamps actual dates)
' ─────────────────────────────────────────────────────────────
Private Sub HandlePctChange(ByVal ws As Worksheet, ByVal Target As Range)
    On Error GoTo EH
    Dim r As Long: r = Target.Row
    If Not IsNumeric(ws.Cells(r, COL_PCT).Value) Then Exit Sub

    Dim pct As Double: pct = CDbl(ws.Cells(r, COL_PCT).Value)

    Application.EnableEvents = False
    ' Auto-stamp Actual Start if % > 0 and blank
    If pct > 0 Then
        If Trim$(CStr(ws.Cells(r, COL_ACT_S).Value)) = "" Then
            ws.Cells(r, COL_ACT_S).Value = Format(Now(), "yyyy-mm-dd")
            ws.Cells(r, COL_ACT_S).NumberFormat = "yyyy-mm-dd"
        End If
    End If
    ' Auto-stamp Actual End if % = 1
    If pct >= 1 Then
        If Trim$(CStr(ws.Cells(r, COL_ACT_E).Value)) = "" Then
            ws.Cells(r, COL_ACT_E).Value = Format(Now(), "yyyy-mm-dd")
            ws.Cells(r, COL_ACT_E).NumberFormat = "yyyy-mm-dd"
        End If
    End If
    Application.EnableEvents = True

    LogMsg "HandlePctChange", "PCT=" & pct & " row=" & r, ws.Name, r, COL_PCT
    Exit Sub
EH:
    Application.EnableEvents = True
    LogMsg "HandlePctChange", Err.Number & " - " & Err.Description, ws.Name, Target.Row
End Sub

' ============================================================
' 4. SHIFT MODE (non-PTO)
' ============================================================
Private Sub HandleShiftMode(ByVal ws As Worksheet, ByVal Target As Range)
    Dim r As Long: r = Target.Row
    NormalizeRowDates ws, r

    If Target.Column = COL_START And CfgOn("CFG_KEEP_DURATION", True) Then
        KeepDurationOnStartChange ws, r
    End If

    If Target.Column = COL_END  Then UpdateDaysFromStartEnd ws, r
    If Target.Column = COL_DAYS Then UpdateEndFromStartDays ws, r

    If Not CfgOn("CFG_AUTO_SHIFT", True) Then Exit Sub
    If Target.Column <> COL_START And Target.Column <> COL_END Then Exit Sub

    Dim delta As Long: delta = 0
    If gPrevSheet = ws.Name And gPrevRow = r Then
        If Target.Column = COL_START Then
            If IsDate(gPrevStart) And IsDate(ws.Cells(r, COL_START).Value) Then
                delta = DateDelta(gPrevStart, ws.Cells(r, COL_START).Value)
            End If
        ElseIf Target.Column = COL_END Then
            If IsDate(gPrevEnd) And IsDate(ws.Cells(r, COL_END).Value) Then
                delta = DateDelta(gPrevEnd, ws.Cells(r, COL_END).Value)
            End If
        End If
    End If

    If delta <> 0 Then
        ShiftDownstream ws, r, delta, CfgOn("CFG_STOP_AT_FIXED", True)
    End If
End Sub

' ─────────────────────────────────────────────────────────────
Private Sub ShiftDownstream(ByVal ws As Worksheet, ByVal fromRow As Long, _
                             ByVal delta As Long, ByVal stopAtFixed As Boolean)
    On Error GoTo EH
    Dim lastR As Long: lastR = LastUsedRow(ws)
    Dim r As Long
    Dim st As Date, en As Date
    Dim useWD As Boolean: useWD = CfgOn("CFG_SHIFT_WORKDAYS_ONLY", False)

    For r = fromRow + 1 To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop
        If stopAtFixed And IsFixedRow(ws, r) Then Exit For

        If IsDate(ws.Cells(r, COL_START).Value) And IsDate(ws.Cells(r, COL_END).Value) Then
            st = CDate(ws.Cells(r, COL_START).Value)
            en = CDate(ws.Cells(r, COL_END).Value)
            If useWD Then
                st = AddWorkdays(st, delta)
                en = AddWorkdays(en, delta)
            Else
                st = DateAdd("d", delta, st)
                en = DateAdd("d", delta, en)
            End If
            ws.Cells(r, COL_START).Value = st
            ws.Cells(r, COL_END).Value   = en
            ws.Cells(r, COL_START).NumberFormat = "yyyy-mm-dd"
            ws.Cells(r, COL_END).NumberFormat   = "yyyy-mm-dd"
            UpdateDaysFromStartEnd ws, r
        End If
ContinueLoop:
    Next r
    Exit Sub
EH:
    LogMsg "ShiftDownstream", Err.Number & " - " & Err.Description, ws.Name, fromRow
End Sub

' ─────────────────────────────────────────────────────────────
Private Function DateDelta(ByVal d1 As Date, ByVal d2 As Date) As Long
    If CfgOn("CFG_SHIFT_WORKDAYS_ONLY", False) Then
        DateDelta = WorkdayDiff(d1, d2)
    Else
        DateDelta = DateDiff("d", d1, d2)
    End If
End Function

' ============================================================
' 5. PTO AUTO-SCHEDULE (Predecessor + Lag + Days)
' ============================================================
Private Sub PTO_Recalculate(ByVal ws As Worksheet)
    On Error GoTo EH

    Dim dictEnd As Object
    Set dictEnd = CreateObject("Scripting.Dictionary")

    Dim lastR As Long: lastR = LastUsedRow(ws)
    Dim r As Long
    Dim stepId As String, predStr As String
    Dim lag As Long, days As Long
    Dim st As Date, en As Date
    Dim maxEnd As Date, gotPred As Boolean
    Dim useWD As Boolean: useWD = CfgOn("CFG_SHIFT_WORKDAYS_ONLY", False)

    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop

        stepId = Trim$(CStr(ws.Cells(r, COL_STEP).Value))
        If stepId = "" Then GoTo ContinueLoop

        days = CLng(Nz(ws.Cells(r, COL_DAYS).Value, 1))
        If days < 1 Then days = 1
        ws.Cells(r, COL_DAYS).Value = days

        lag = CLng(Nz(ws.Cells(r, COL_LAG).Value, 0))
        predStr = Trim$(CStr(ws.Cells(r, COL_PRED).Value))

        If IsFixedRow(ws, r) Or predStr = "" Then
            If Not IsDate(ws.Cells(r, COL_START).Value) Then
                LogMsg "PTO_Recalculate", "Missing Start step=" & stepId, ws.Name, r, COL_START
                GoTo ContinueLoop
            End If
            st = CDate(ws.Cells(r, COL_START).Value)
            If useWD Then st = NormalizeToWorkday(st)
        Else
            gotPred = False
            maxEnd = DateSerial(1900, 1, 1)

            Dim preds As Variant, p As Variant, key As String
            preds = SplitPred(predStr)
            For Each p In preds
                key = Trim$(CStr(p))
                If key <> "" Then
                    If dictEnd.Exists(key) Then
                        If Not gotPred Then
                            maxEnd = dictEnd(key): gotPred = True
                        ElseIf dictEnd(key) > maxEnd Then
                            maxEnd = dictEnd(key)
                        End If
                    Else
                        LogMsg "PTO_Recalculate", "Pred not found: " & key & " for " & stepId, _
                               ws.Name, r, COL_PRED
                    End If
                End If
            Next p

            If Not gotPred Then GoTo ContinueLoop

            If useWD Then
                st = AddWorkdays(maxEnd, lag + 1)
            Else
                st = DateAdd("d", lag + 1, maxEnd)
            End If
        End If

        If useWD Then
            en = AddWorkdays(st, days - 1)
        Else
            en = DateAdd("d", days - 1, st)
        End If

        ws.Cells(r, COL_START).Value = st
        ws.Cells(r, COL_END).Value   = en
        ws.Cells(r, COL_START).NumberFormat = "yyyy-mm-dd"
        ws.Cells(r, COL_END).NumberFormat   = "yyyy-mm-dd"
        UpdateDaysFromStartEnd ws, r
        dictEnd(stepId) = en

ContinueLoop:
    Next r
    Exit Sub
EH:
    LogMsg "PTO_Recalculate", Err.Number & " - " & Err.Description, ws.Name
End Sub

' ============================================================
' 6. GANTT REFRESH
' ============================================================
Private Sub RefreshGantt(ByVal ws As Worksheet, ByVal includeToday As Boolean)
    On Error GoTo EH

    Dim minD As Date, maxD As Date
    GetMinMaxDates ws, minD, maxD

    If includeToday Then
        If Date < minD Then minD = Date
        If Date > maxD Then maxD = Date
    End If
    maxD = DateAdd("d", 3, maxD)   ' +3 day buffer (prevents last bar cutoff)

    EnsureTimelineCovers ws, minD, maxD
    BuildDateHeader ws, minD, maxD
    FixHeaderMerges ws, HeaderLastCol(ws)
    DrawLegend ws                          ' [NEW v3] Legend 행 그리기
    WriteBarLabels ws, minD, maxD
    DrawTodayMarker ws, minD, maxD

    ' [NEW v3] Draw progress overlay
    DrawProgressBars ws, minD, maxD

    If UCase$(CfgText("CFG_REPAINT_MODE", "CF")) = "PAINT" Then
        PaintBars ws, minD, maxD
    Else
        ApplyConditionalFormatting ws, minD, maxD
    End If

    Exit Sub
EH:
    LogMsg "RefreshGantt", Err.Number & " - " & Err.Description, ws.Name
End Sub

' ─────────────────────────────────────────────────────────────
Private Sub GetMinMaxDates(ByVal ws As Worksheet, ByRef minD As Date, ByRef maxD As Date)
    Dim r As Long, lastR As Long
    Dim got As Boolean
    lastR = LastUsedRow(ws)
    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop
        If IsDate(ws.Cells(r, COL_START).Value) And IsDate(ws.Cells(r, COL_END).Value) Then
            If Not got Then
                minD = CDate(ws.Cells(r, COL_START).Value)
                maxD = CDate(ws.Cells(r, COL_END).Value)
                got = True
            Else
                If CDate(ws.Cells(r, COL_START).Value) < minD Then minD = CDate(ws.Cells(r, COL_START).Value)
                If CDate(ws.Cells(r, COL_END).Value)   > maxD Then maxD = CDate(ws.Cells(r, COL_END).Value)
            End If
        End If
ContinueLoop:
    Next r
    If Not got Then minD = Date: maxD = Date
End Sub

' ─────────────────────────────────────────────────────────────
Private Sub EnsureTimelineCovers(ByVal ws As Worksheet, ByVal minD As Date, ByVal maxD As Date)
    On Error GoTo EH
    Dim curFirst As Variant, curLast As Variant, lastCol As Long, addCols As Long

    curFirst = HeaderFirstDate(ws)
    If IsDate(curFirst) Then
        If minD < CDate(curFirst) Then
            addCols = DateDiff("d", minD, CDate(curFirst))
            ws.Columns(DATE_COL_START).Resize(, addCols).Insert Shift:=xlToRight
        End If
    End If

    curLast = HeaderLastDate(ws)
    lastCol = HeaderLastCol(ws)
    If IsDate(curLast) Then
        If maxD > CDate(curLast) Then
            addCols = DateDiff("d", CDate(curLast), maxD)
            ws.Columns(lastCol + 1).Resize(, addCols).Insert Shift:=xlToRight
        End If
    End If
    Exit Sub
EH:
    LogMsg "EnsureTimelineCovers", Err.Number & " - " & Err.Description, ws.Name
End Sub

' ─────────────────────────────────────────────────────────────
Private Sub BuildDateHeader(ByVal ws As Worksheet, ByVal firstD As Date, ByVal lastD As Date)
    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim i As Long, d As Date, col As Long
    For i = 0 To totalDays - 1
        d = DateAdd("d", i, firstD)
        col = DATE_COL_START + i
        ws.Columns(col).ColumnWidth = 3.2
        With ws.Cells(HEADER_ROW, col)
            .Value         = d
            .NumberFormat  = "mm/dd"
            .Font.Bold     = True
            .Font.Size     = 7
            .HorizontalAlignment = xlCenter
            .VerticalAlignment   = xlCenter
            .Interior.Color = HexToLong(BG_SURFACE2)
            .Font.Color = IIf(d = Date, HexToLong(C_RED), _
                          IIf(Weekday(d, vbMonday) >= 6, HexToLong(C_AMBER), HexToLong(C_DIM)))
            SetThinBorder ws.Cells(HEADER_ROW, col)
        End With
    Next i
End Sub

' ─────────────────────────────────────────────────────────────
Private Sub FixHeaderMerges(ByVal ws As Worksheet, ByVal endCol As Long)
    On Error Resume Next
    ws.Range(ws.Cells(1, 1), ws.Cells(1, ws.Columns.Count)).UnMerge
    ws.Range(ws.Cells(2, 1), ws.Cells(2, ws.Columns.Count)).UnMerge
    On Error GoTo 0
    ws.Range(ws.Cells(1, 1), ws.Cells(1, endCol)).Merge
    ws.Range(ws.Cells(2, 1), ws.Cells(2, endCol)).Merge
End Sub

' ─────────────────────────────────────────────────────────────
Private Sub WriteBarLabels(ByVal ws As Worksheet, ByVal firstD As Date, ByVal lastD As Date)
    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim endCol As Long: endCol = DATE_COL_START + totalDays - 1
    Dim lastR As Long: lastR = LastUsedRow(ws)
    Dim r As Long, st As Date, phase As String, offset As Long

    ws.Range(ws.Cells(FIRST_DATA_ROW, DATE_COL_START), ws.Cells(lastR, endCol)).ClearContents

    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop
        If Not IsDate(ws.Cells(r, COL_START).Value) Then GoTo ContinueLoop
        st    = CDate(ws.Cells(r, COL_START).Value)
        phase = CStr(ws.Cells(r, COL_PHASE).Value)
        offset = DateDiff("d", firstD, st)
        If offset >= 0 And offset <= totalDays - 1 Then
            With ws.Cells(r, DATE_COL_START + offset)
                .Value = Left$(phase, 12)
                .Font.Bold = True
                .Font.Size = 7
                .HorizontalAlignment = xlLeft
                .VerticalAlignment   = xlCenter
            End With
        End If
ContinueLoop:
    Next r
End Sub

' ─────────────────────────────────────────────────────────────
Private Sub DrawTodayMarker(ByVal ws As Worksheet, ByVal firstD As Date, ByVal lastD As Date)
    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim offset As Long: offset = DateDiff("d", firstD, Date)
    If offset < 0 Or offset > totalDays - 1 Then Exit Sub

    Dim col As Long: col = DATE_COL_START + offset
    Dim lastR As Long: lastR = LastUsedRow(ws)
    Dim r As Long
    For r = HEADER_ROW To lastR
        With ws.Cells(r, col)
            .Borders(xlEdgeLeft).LineStyle  = xlContinuous
            .Borders(xlEdgeLeft).Weight     = xlMedium
            .Borders(xlEdgeLeft).Color      = HexToLong(C_RED)
            .Borders(xlEdgeRight).LineStyle = xlContinuous
            .Borders(xlEdgeRight).Weight    = xlMedium
            .Borders(xlEdgeRight).Color     = HexToLong(C_RED)
        End With
    Next r
End Sub

' ─────────────────────────────────────────────────────────────
' DrawLegend  [NEW v3]
' Row 2 서브타이틀 행의 메타 컬럼(A~M) 에 컬러 칩 + 텍스트 Legend 삽입
' 레이아웃: [■ Label] 칩 2셀 단위, A2~M2 안에 모두 수납
' ─────────────────────────────────────────────────────────────
Private Sub DrawLegend(ByVal ws As Worksheet)
    ' ── Legend v3.2 ────────────────────────────────────────────
    ' 변경: DisplayAlerts=False로 병합 경고 무음
    '       열너비 절대 불변, 셀 1개에 "■ Label" 방식
    '       하단 중복 Legend 행 삭제
    On Error GoTo EH

    Const LEG_ROW As Long = 2

    ' ── 병합 경고 무음 처리 ─────────────────────────────────────
    Application.DisplayAlerts = False
    On Error Resume Next
    ws.Rows(LEG_ROW).UnMerge
    On Error GoTo EH
    Application.DisplayAlerts = True

    ws.Rows(LEG_ROW).RowHeight = 16

    ' ── Row 2 전체 초기화 (열너비 불변) ─────────────────────────
    Dim lastC As Long: lastC = HeaderLastCol(ws)
    If lastC < DATE_COL_START + 5 Then lastC = DATE_COL_START + 30

    Dim ci As Long
    For ci = 1 To lastC
        With ws.Cells(LEG_ROW, ci)
            .ClearContents
            .Interior.Color      = HexToLong(BG_HEADER)
            .Font.Size           = 8
            .Font.Bold           = False
            .Font.Color          = HexToLong(C_DIM)
            .HorizontalAlignment = xlLeft
            .VerticalAlignment   = xlCenter
            .WrapText            = False
            .Borders.LineStyle   = xlNone
        End With
    Next ci

    ' ── 항목 정의: col 1=LEGEND, col 2~13=각 항목(2칸씩) ────────
    ' 칩컬럼:  B(2)  D(4)  F(6)  H(8)  J(10)  L(12)
    ' 항목:    BLUE  PUR   ORG   PNK   GRN    YLW
    Dim cc(5) As Long
    Dim cl(5) As String
    Dim lb(5) As String

    cc(0)=2 : cl(0)=C_BLUE   : lb(0)="Doc/Pickup"
    cc(1)=4 : cl(1)=C_PURPLE : lb(1)="UAE Repair"
    cc(2)=6 : cl(2)=C_ORANGE : lb(2)="Trans.OUT"
    cc(3)=8 : cl(3)=C_PINK   : lb(3)="KSA Repair"
    cc(4)=10: cl(4)=C_GREEN  : lb(4)="Trans.BACK"
    cc(5)=12: cl(5)=C_YELLOW : lb(5)="Final"

    ' ── A2: "LEGEND:" ────────────────────────────────────────────
    With ws.Cells(LEG_ROW, 1)
        .Value               = "LEGEND:"
        .Font.Bold           = True
        .Font.Size           = 8
        .Font.Color          = HexToLong(C_AMBER)
        .Interior.Color      = HexToLong(BG_HEADER)
        .HorizontalAlignment = xlCenter
        .VerticalAlignment   = xlCenter
    End With

    ' ── 칩(1셀) + 텍스트(1셀) 쌍 ────────────────────────────────
    Dim k As Long
    Dim fg As String
    For k = 0 To 5
        Dim chipC As Long: chipC = cc(k)
        Dim txtC  As Long: txtC  = cc(k) + 1

        ' 칩 셀: 색 배경 + ■ 기호
        With ws.Cells(LEG_ROW, chipC)
            .Value               = Chr(9632)
            .Interior.Color      = HexToLong(cl(k))
            .Font.Color          = HexToLong(cl(k))
            .Font.Size           = 9
            .Font.Bold           = True
            .HorizontalAlignment = xlCenter
            .VerticalAlignment   = xlCenter
        End With

        ' 텍스트 셀: 같은 Phase 색 배경 + 대비 글씨
        Select Case cl(k)
            Case C_YELLOW, C_GREEN: fg = "0D0F14"
            Case Else:              fg = "EEFCFF"
        End Select
        With ws.Cells(LEG_ROW, txtC)
            .Value               = lb(k)
            .Interior.Color      = HexToLong(cl(k))
            .Font.Color          = HexToLong(fg)
            .Font.Size           = 7
            .Font.Bold           = True
            .HorizontalAlignment = xlLeft
            .VerticalAlignment   = xlCenter
            .WrapText            = False
        End With
    Next k

    ' ── N2(DATE_COL_START): RED 칩, N2+1: HIGH Risk 텍스트 ───────
    With ws.Cells(LEG_ROW, DATE_COL_START)
        .Value               = Chr(9632)
        .Interior.Color      = HexToLong(C_RED)
        .Font.Color          = HexToLong(C_RED)
        .Font.Size           = 9
        .Font.Bold           = True
        .HorizontalAlignment = xlCenter
        .VerticalAlignment   = xlCenter
    End With
    With ws.Cells(LEG_ROW, DATE_COL_START + 1)
        .Value               = "HIGH Risk"
        .Interior.Color      = HexToLong(C_RED)
        .Font.Color          = HexToLong("EEFCFF")
        .Font.Size           = 7
        .Font.Bold           = True
        .HorizontalAlignment = xlLeft
        .VerticalAlignment   = xlCenter
        .WrapText            = False
    End With

    ' ── 나머지 날짜 트랙 Row 2: BG_HEADER ────────────────────────
    If DATE_COL_START + 2 <= lastC Then
        With ws.Range(ws.Cells(LEG_ROW, DATE_COL_START + 2), _
                      ws.Cells(LEG_ROW, lastC))
            .Interior.Color = HexToLong(BG_HEADER)
            .ClearContents
        End With
    End If

    ' ── 하단 중복 Legend 행 삭제 ─────────────────────────────────
    ' 데이터 마지막 행 이후에 "LEGEND:" 또는 "LEGEND:" 텍스트 있으면 삭제
    Dim lastR  As Long: lastR = LastUsedRow(ws)
    Dim delR   As Long
    Dim delVal As String
    Application.DisplayAlerts = False
    For delR = lastR To FIRST_DATA_ROW + 1 Step -1
        delVal = UCase$(Trim$(CStr(ws.Cells(delR, 1).Value)))
        If InStr(1, delVal, "LEGEND", vbTextCompare) > 0 Then
            ws.Rows(delR).Delete Shift:=xlShiftUp
        End If
    Next delR
    Application.DisplayAlerts = True

    Exit Sub
EH:
    Application.DisplayAlerts = True
    LogMsg "DrawLegend", Err.Number & " - " & Err.Description, ws.Name
End Sub

' ─────────────────────────────────────────────────────────────
' [NEW v3] DrawProgressBars
' Overlays a thin border bottom on cells proportional to % Done
' ─────────────────────────────────────────────────────────────
Private Sub DrawProgressBars(ByVal ws As Worksheet, ByVal firstD As Date, ByVal lastD As Date)
    On Error Resume Next
    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim endCol As Long: endCol = DATE_COL_START + totalDays - 1
    Dim lastR As Long: lastR = LastUsedRow(ws)
    Dim r As Long
    Dim pct As Double
    Dim st As Date, en As Date
    Dim doneEnd As Date
    Dim i As Long, col As Long

    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop
        If Not IsDate(ws.Cells(r, COL_START).Value) Then GoTo ContinueLoop
        If Not IsNumeric(ws.Cells(r, COL_PCT).Value) Then GoTo ContinueLoop

        pct = CDbl(ws.Cells(r, COL_PCT).Value)
        If pct <= 0 Then GoTo ContinueLoop

        st  = CDate(ws.Cells(r, COL_START).Value)
        en  = CDate(ws.Cells(r, COL_END).Value)
        Dim barDays As Long: barDays = DateDiff("d", st, en) + 1
        Dim doneDays As Long: doneDays = CLng(barDays * pct)
        If doneDays < 1 Then doneDays = 1

        doneEnd = DateAdd("d", doneDays - 1, st)
        If doneEnd > en Then doneEnd = en

        Dim offsetS As Long: offsetS = DateDiff("d", firstD, st)
        Dim offsetE As Long: offsetE = DateDiff("d", firstD, doneEnd)
        If offsetS < 0 Then offsetS = 0
        If offsetE > totalDays - 1 Then offsetE = totalDays - 1

        For i = offsetS To offsetE
            col = DATE_COL_START + i
            With ws.Cells(r, col).Borders(xlEdgeBottom)
                .LineStyle = xlContinuous
                .Weight    = xlThick
                .Color     = HexToLong(C_GREEN)
            End With
        Next i
ContinueLoop:
    Next r
End Sub

' ─────────────────────────────────────────────────────────────
Private Sub ApplyConditionalFormatting(ByVal ws As Worksheet, _
                                        ByVal firstD As Date, ByVal lastD As Date)
    On Error GoTo EH

    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim endCol As Long: endCol = DATE_COL_START + totalDays - 1
    Dim lastR  As Long: lastR  = LastUsedRow(ws)

    Dim rng As Range
    Set rng = ws.Range(ws.Cells(FIRST_DATA_ROW, DATE_COL_START), ws.Cells(lastR, endCol))
    rng.FormatConditions.Delete

    Dim fc As FormatCondition

    ' Weekend background  (C) K$3 relative reference
    Set fc = rng.FormatConditions.Add(Type:=xlExpression, _
        Formula1:="=AND($D4<>"""",WEEKDAY(K$3,2)>5)")
    fc.Interior.Color = HexToLong(BG_WEEKEND)

    ' Phase colour rules  (C) K$3
    AddPhaseRule rng, "DOC",        C_BLUE
    AddPhaseRule rng, "PICKUP",     C_BLUE
    AddPhaseRule rng, "UAE_REP",    C_PURPLE
    AddPhaseRule rng, "TRANS_OUT",  C_ORANGE
    AddPhaseRule rng, "KSA_REP",    C_PINK
    AddPhaseRule rng, "TRANS_BACK", C_GREEN
    AddPhaseRule rng, "FINAL",      C_YELLOW

    ' (D) Risk override — first priority
    Dim fRisk As String
    fRisk = "=AND($D4<>"""",K$3>=$D4,K$3<=$E4," & _
            "OR(ISNUMBER(SEARCH(""?"",$G4)),ISNUMBER(SEARCH(""HIGH"",$G4))))"
    Set fc = rng.FormatConditions.Add(Type:=xlExpression, Formula1:=fRisk)
    fc.Interior.Color = HexToLong(C_RED)
    fc.SetFirstPriority

    Exit Sub
EH:
    LogMsg "ApplyConditionalFormatting", Err.Number & " - " & Err.Description, ws.Name
End Sub

' ─────────────────────────────────────────────────────────────
Private Sub AddPhaseRule(ByVal rng As Range, ByVal key As String, ByVal hexColor As String)
    Dim fc As FormatCondition
    Set fc = rng.FormatConditions.Add(Type:=xlExpression, _
        Formula1:="=AND($D4<>"""",ISNUMBER(SEARCH(""" & key & """,$B4)),K$3>=$D4,K$3<=$E4)")
    fc.Interior.Color = HexToLong(hexColor)
End Sub

' ─────────────────────────────────────────────────────────────
Private Sub PaintBars(ByVal ws As Worksheet, ByVal firstD As Date, ByVal lastD As Date)
    On Error GoTo EH
    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim endCol As Long: endCol = DATE_COL_START + totalDays - 1
    Dim lastR  As Long: lastR  = LastUsedRow(ws)

    Dim r As Long, i As Long, col As Long
    Dim st As Date, en As Date
    Dim offsetS As Long, offsetE As Long
    Dim phase As String, risk As String
    Dim curD As Date, barColor As Long

    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then
            ws.Range(ws.Cells(r, DATE_COL_START), ws.Cells(r, endCol)).Interior.Color = _
                HexToLong(BG_SURFACE2)
            GoTo ContinueRow
        End If

        For i = 0 To totalDays - 1
            col  = DATE_COL_START + i
            curD = DateAdd("d", i, firstD)
            ws.Cells(r, col).Interior.Color = HexToLong( _
                IIf(Weekday(curD, vbMonday) >= 6, BG_WEEKEND, BG_DARK))
            SetThinBorder ws.Cells(r, col)
        Next i

        If Not (IsDate(ws.Cells(r, COL_START).Value) And _
                IsDate(ws.Cells(r, COL_END).Value)) Then GoTo ContinueRow

        st      = CDate(ws.Cells(r, COL_START).Value)
        en      = CDate(ws.Cells(r, COL_END).Value)
        offsetS = DateDiff("d", firstD, st)
        offsetE = DateDiff("d", firstD, en)
        If offsetS < 0 Then offsetS = 0
        If offsetE > totalDays - 1 Then offsetE = totalDays - 1

        phase = CStr(ws.Cells(r, COL_PHASE).Value)
        risk  = CStr(ws.Cells(r, COL_RISK).Value)

        ' (E) Risk quoting fixed
        If InStr(1, risk, "?", vbTextCompare) > 0 Or _
           InStr(1, risk, "HIGH", vbTextCompare) > 0 Then
            barColor = HexToLong(C_RED)
        Else
            barColor = PhaseColorLong(phase)
        End If

        For i = offsetS To offsetE
            ws.Cells(r, DATE_COL_START + i).Interior.Color = barColor
        Next i
ContinueRow:
    Next r
    Exit Sub
EH:
    LogMsg "PaintBars", Err.Number & " - " & Err.Description, ws.Name
End Sub

' ============================================================
' 7. DSV CHECKLIST CF REFRESH  [NEW v3]
' ============================================================
Private Sub RefreshChecklistCF(ByVal ws As Worksheet)
    On Error Resume Next
    Dim lastR As Long: lastR = ws.Cells(ws.Rows.Count, 2).End(xlUp).Row
    If lastR < 4 Then Exit Sub

    Dim rng As Range
    Set rng = ws.Range("A4:F" & lastR)
    rng.FormatConditions.Delete

    ' OPEN -> red
    Dim fc As FormatCondition
    Set fc = rng.FormatConditions.Add(Type:=xlExpression, Formula1:="=$E4=""OPEN""")
    fc.Interior.Color = HexToLong(C_RED)

    ' CONFIRMED -> green
    Set fc = rng.FormatConditions.Add(Type:=xlExpression, Formula1:="=$E4=""CONFIRMED""")
    fc.Interior.Color = HexToLong(C_GREEN)

    ' IN PROGRESS -> amber
    Set fc = rng.FormatConditions.Add(Type:=xlExpression, Formula1:="=$E4=""IN PROGRESS""")
    fc.Interior.Color = HexToLong(C_AMBER)
End Sub

' ============================================================
' 8. BASELINE RESTORE
' ============================================================
Private Sub RestoreFromBaseline(ByVal ws As Worksheet)
    On Error GoTo EH
    Dim b As Worksheet
    Set b = ThisWorkbook.Worksheets(SH_BASELINE)
    Dim scenario As String: scenario = Replace(ws.Name, SHEET_PREFIX, "")

    Dim mapRow As Object: Set mapRow = CreateObject("Scripting.Dictionary")
    Dim r As Long, lastR As Long, stepId As String
    lastR = LastUsedRow(ws)
    For r = FIRST_DATA_ROW To lastR
        If Not IsGroupRow(ws, r) Then
            stepId = Trim$(CStr(ws.Cells(r, COL_STEP).Value))
            If stepId <> "" Then mapRow(stepId) = r
        End If
    Next r

    Dim br As Long, lastB As Long: lastB = b.Cells(b.Rows.Count, 1).End(xlUp).Row
    For br = 2 To lastB
        If CStr(b.Cells(br, 1).Value) = scenario Then
            stepId = Trim$(CStr(b.Cells(br, 3).Value))
            If mapRow.Exists(stepId) Then
                r = mapRow(stepId)
                ws.Cells(r, COL_PHASE).Value = b.Cells(br, 4).Value
                ws.Cells(r, COL_TASK).Value  = b.Cells(br, 5).Value
                ws.Cells(r, COL_START).Value = b.Cells(br, 6).Value
                ws.Cells(r, COL_END).Value   = b.Cells(br, 7).Value
                ws.Cells(r, COL_DAYS).Value  = b.Cells(br, 8).Value
                ws.Cells(r, COL_RISK).Value  = b.Cells(br, 9).Value
                ws.Cells(r, COL_NOTE).Value  = b.Cells(br, 10).Value
                ws.Cells(r, COL_PRED).Value  = b.Cells(br, 11).Value
                ws.Cells(r, COL_LAG).Value   = b.Cells(br, 12).Value
                NormalizeRowDates ws, r
            End If
        End If
    Next br
    Exit Sub
EH:
    LogMsg "RestoreFromBaseline", Err.Number & " - " & Err.Description, ws.Name
End Sub

' ============================================================
' 9. DATE NORMALIZATION / FIELD UPDATES
' ============================================================
Private Sub NormalizeSheetDates(ByVal ws As Worksheet)
    Dim r As Long, lastR As Long: lastR = LastUsedRow(ws)
    For r = FIRST_DATA_ROW To lastR
        If Not IsGroupRow(ws, r) Then NormalizeRowDates ws, r
    Next r
End Sub

Private Sub NormalizeRowDates(ByVal ws As Worksheet, ByVal r As Long)
    Dim useWD As Boolean: useWD = CfgOn("CFG_SHIFT_WORKDAYS_ONLY", False)
    If IsDate(ws.Cells(r, COL_START).Value) Then
        Dim st As Date: st = CDate(ws.Cells(r, COL_START).Value)
        If useWD Then st = NormalizeToWorkday(st)
        ws.Cells(r, COL_START).Value         = st
        ws.Cells(r, COL_START).NumberFormat  = "yyyy-mm-dd"
    End If
    If IsDate(ws.Cells(r, COL_END).Value) Then
        Dim en As Date: en = CDate(ws.Cells(r, COL_END).Value)
        If useWD Then en = NormalizeToWorkday(en)
        ws.Cells(r, COL_END).Value           = en
        ws.Cells(r, COL_END).NumberFormat    = "yyyy-mm-dd"
    End If
End Sub

Private Sub UpdateDaysFromStartEnd(ByVal ws As Worksheet, ByVal r As Long)
    If Not (IsDate(ws.Cells(r, COL_START).Value) And IsDate(ws.Cells(r, COL_END).Value)) Then Exit Sub
    ws.Cells(r, COL_DAYS).Value = _
        DateDiff("d", CDate(ws.Cells(r, COL_START).Value), CDate(ws.Cells(r, COL_END).Value)) + 1
End Sub

Private Sub UpdateEndFromStartDays(ByVal ws As Worksheet, ByVal r As Long)
    If Not IsDate(ws.Cells(r, COL_START).Value) Then Exit Sub
    Dim d As Long: d = CLng(Nz(ws.Cells(r, COL_DAYS).Value, 1))
    If d < 1 Then d = 1
    Dim st As Date: st = CDate(ws.Cells(r, COL_START).Value)
    Dim en As Date
    If CfgOn("CFG_SHIFT_WORKDAYS_ONLY", False) Then
        en = AddWorkdays(st, d - 1)
    Else
        en = DateAdd("d", d - 1, st)
    End If
    ws.Cells(r, COL_END).Value           = en
    ws.Cells(r, COL_END).NumberFormat    = "yyyy-mm-dd"
End Sub

Private Sub KeepDurationOnStartChange(ByVal ws As Worksheet, ByVal r As Long)
    If Not (IsDate(ws.Cells(r, COL_START).Value) And IsDate(gPrevStart) And IsDate(gPrevEnd)) Then Exit Sub
    Dim useWD As Boolean: useWD = CfgOn("CFG_SHIFT_WORKDAYS_ONLY", False)
    Dim prevDur As Long: prevDur = DateDiff("d", CDate(gPrevStart), CDate(gPrevEnd))
    Dim st As Date: st = CDate(ws.Cells(r, COL_START).Value)
    Dim en As Date
    If useWD Then
        Dim d As Long: d = CLng(Nz(ws.Cells(r, COL_DAYS).Value, prevDur + 1))
        If d < 1 Then d = 1
        en = AddWorkdays(st, d - 1)
    Else
        en = DateAdd("d", prevDur, st)
    End If
    ws.Cells(r, COL_END).Value           = en
    ws.Cells(r, COL_END).NumberFormat    = "yyyy-mm-dd"
End Sub

' ============================================================
' 10. PROTECTION
' ============================================================
Private Sub ApplyProtection(ByVal ws As Worksheet, ByVal doProtect As Boolean)
    On Error GoTo EH
    ws.Unprotect
    ws.Cells.Locked = True

    Dim r As Long, lastR As Long: lastR = LastUsedRow(ws)
    For r = FIRST_DATA_ROW To lastR
        If Not IsGroupRow(ws, r) Then
            ws.Cells(r, COL_START).Locked  = False
            ws.Cells(r, COL_END).Locked    = False
            ws.Cells(r, COL_DAYS).Locked   = False
            ws.Cells(r, COL_PRED).Locked   = False
            ws.Cells(r, COL_LAG).Locked    = False
            ws.Cells(r, COL_PCT).Locked    = False    ' [NEW v3] % Done editable
            ws.Cells(r, COL_ACT_S).Locked  = False   ' [NEW v3] Actual Start editable
            ws.Cells(r, COL_ACT_E).Locked  = False   ' [NEW v3] Actual End editable
        End If
    Next r

    If doProtect Then
        ws.Protect DrawingObjects:=True, Contents:=True, Scenarios:=True, _
                   AllowFormattingCells:=False, AllowFormattingColumns:=False, _
                   AllowFormattingRows:=False, AllowInsertingColumns:=False, _
                   AllowInsertingRows:=False, AllowDeletingColumns:=False, _
                   AllowDeletingRows:=False, AllowSorting:=True, AllowFiltering:=True, _
                   AllowUsingPivotTables:=False
        ws.EnableSelection = xlUnlockedCells
    End If
    Exit Sub
EH:
    LogMsg "ApplyProtection", Err.Number & " - " & Err.Description, ws.Name
End Sub

' ============================================================
' 11. HELPERS
' ============================================================
Private Function IsGanttSheet(ByVal ws As Worksheet) As Boolean
    IsGanttSheet = (Left$(ws.Name, Len(SHEET_PREFIX)) = SHEET_PREFIX)
End Function

Private Function IsGroupRow(ByVal ws As Worksheet, ByVal r As Long) As Boolean
    IsGroupRow = (ws.Cells(r, COL_START).Value = "" And ws.Cells(r, COL_END).Value = "")
End Function

Private Function IsFixedRow(ByVal ws As Worksheet, ByVal r As Long) As Boolean
    Dim s As String
    s = UCase$(CStr(ws.Cells(r, COL_PHASE).Value) & " " & CStr(ws.Cells(r, COL_TASK).Value))
    IsFixedRow = (InStr(1, s, "FIXED", vbTextCompare) > 0)
End Function

Private Function LastUsedRow(ByVal ws As Worksheet) As Long
    Dim r As Long: r = ws.Cells(ws.Rows.Count, COL_PHASE).End(xlUp).Row
    If r < FIRST_DATA_ROW Then r = FIRST_DATA_ROW
    LastUsedRow = r
End Function

Private Function HeaderLastCol(ByVal ws As Worksheet) As Long
    Dim c As Long: c = ws.Cells(HEADER_ROW, ws.Columns.Count).End(xlToLeft).Column
    If c < DATE_COL_START Then c = DATE_COL_START
    HeaderLastCol = c
End Function

Private Function HeaderFirstDate(ByVal ws As Worksheet) As Variant
    HeaderFirstDate = ws.Cells(HEADER_ROW, DATE_COL_START).Value
End Function

Private Function HeaderLastDate(ByVal ws As Worksheet) As Variant
    HeaderLastDate = ws.Cells(HEADER_ROW, HeaderLastCol(ws)).Value
End Function

' (A) worksheet-qualified column letter
Private Function ColLetterWs(ByVal ws As Worksheet, ByVal colNum As Long) As String
    ColLetterWs = Split(ws.Cells(1, colNum).Address(True, False), "$")(1)
End Function

Private Sub SetThinBorder(ByVal cell As Range)
    With cell.Borders
        .LineStyle = xlContinuous
        .Weight    = xlThin
        .Color     = HexToLong(BORDER_HEX)
    End With
End Sub

Private Function PhaseColorLong(ByVal phase As String) As Long
    Dim s As String: s = UCase$(phase)
    Select Case True
        Case InStr(1, s, "DOC",        vbTextCompare) > 0: PhaseColorLong = HexToLong(C_BLUE)
        Case InStr(1, s, "PICKUP",     vbTextCompare) > 0: PhaseColorLong = HexToLong(C_BLUE)
        Case InStr(1, s, "UAE_REP",    vbTextCompare) > 0: PhaseColorLong = HexToLong(C_PURPLE)
        Case InStr(1, s, "TRANS_OUT",  vbTextCompare) > 0: PhaseColorLong = HexToLong(C_ORANGE)
        Case InStr(1, s, "KSA_REP",    vbTextCompare) > 0: PhaseColorLong = HexToLong(C_PINK)
        Case InStr(1, s, "TRANS_BACK", vbTextCompare) > 0: PhaseColorLong = HexToLong(C_GREEN)
        Case InStr(1, s, "FINAL",      vbTextCompare) > 0: PhaseColorLong = HexToLong(C_YELLOW)
        Case Else:                                           PhaseColorLong = HexToLong(C_AMBER)
    End Select
End Function

Private Function HexToLong(ByVal hex As String) As Long
    hex = Replace(hex, "#", "")
    HexToLong = RGB(CLng("&H" & Mid$(hex, 1, 2)), _
                    CLng("&H" & Mid$(hex, 3, 2)), _
                    CLng("&H" & Mid$(hex, 5, 2)))
End Function

Private Function Nz(ByVal v As Variant, ByVal defaultValue As Variant) As Variant
    Nz = IIf(IsError(v) Or IsEmpty(v) Or v = "", defaultValue, v)
End Function

Private Function SplitPred(ByVal s As String) As Variant
    s = Replace(Replace(s, ";", ","), " ", "")
    If s = "" Then SplitPred = Array() Else SplitPred = Split(s, ",")
End Function

Private Function NormalizeToWorkday(ByVal d As Date) As Date
    Do While Weekday(d, vbMonday) >= 6: d = DateAdd("d", 1, d): Loop
    NormalizeToWorkday = d
End Function

Private Function AddWorkdays(ByVal d As Date, ByVal n As Long) As Date
    If n = 0 Then AddWorkdays = NormalizeToWorkday(d): Exit Function
    Dim stepDir As Long: stepDir = IIf(n > 0, 1, -1)
    Dim i As Long, cur As Date: cur = d
    Do While i <> n
        cur = DateAdd("d", stepDir, cur)
        If Weekday(cur, vbMonday) <= 5 Then i = i + stepDir
    Loop
    AddWorkdays = cur
End Function

Private Function WorkdayDiff(ByVal d1 As Date, ByVal d2 As Date) As Long
    If d2 = d1 Then WorkdayDiff = 0: Exit Function
    Dim n As Long, cur As Date: cur = d1
    Dim dir As Long: dir = IIf(d2 > d1, 1, -1)
    Do While cur <> d2
        cur = DateAdd("d", dir, cur)
        If Weekday(cur, vbMonday) <= 5 Then n = n + dir
        If Abs(n) > 4000 Then Exit Do
    Loop
    WorkdayDiff = n
End Function

' ============================================================
' 12. CONFIG READERS (named ranges on Summary sheet)
' ============================================================
Private Function CfgText(ByVal cfgName As String, ByVal defaultValue As String) As String
    On Error GoTo Safe
    CfgText = CStr(ThisWorkbook.Names(cfgName).RefersToRange.Value)
    If Trim$(CfgText) = "" Then CfgText = defaultValue
    Exit Function
Safe:
    CfgText = defaultValue
End Function

Private Function CfgOn(ByVal cfgName As String, ByVal defaultValue As Boolean) As Boolean
    Dim v As String: v = UCase$(Trim$(CfgText(cfgName, IIf(defaultValue, "ON", "OFF"))))
    CfgOn = (v = "ON" Or v = "TRUE" Or v = "1" Or v = "YES")
End Function

' ============================================================
' 13. LOG  (B) auto-create LOG sheet if missing
' ============================================================
Public Sub LogMsg(ByVal proc As String, ByVal msg As String, _
                   Optional ByVal sheetName As String = "", _
                   Optional ByVal rowNum As Long = 0, _
                   Optional ByVal colNum As Long = 0)
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = Nothing
    Set ws = ThisWorkbook.Worksheets(SH_LOG)

    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add( _
            After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = SH_LOG
        ws.Range("A1:F1").Value = Array("Timestamp","Proc","Sheet","Row","Col","Message")
        ws.Columns("A:F").AutoFit
    End If

    Dim n As Long: n = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
    ws.Cells(n, 1).Value = Now()
    ws.Cells(n, 2).Value = proc
    ws.Cells(n, 3).Value = sheetName
    ws.Cells(n, 4).Value = rowNum
    ws.Cells(n, 5).Value = colNum
    ws.Cells(n, 6).Value = msg
End Sub

' ============================================================
' 14. UNIT TEST
' ============================================================
Public Sub MIR_Debug_Test_RiskLine()
    ' (L) built-in unit test — run from macro list to verify InStr quoting
    Dim risk As String: risk = "? HIGH"
    If InStr(1, risk, "?", vbTextCompare) > 0 Or _
       InStr(1, risk, "HIGH", vbTextCompare) > 0 Then
        MsgBox "PASS: Risk detected OK (" & risk & ")", vbInformation, "UnitTest"
    Else
        MsgBox "FAIL: Risk NOT detected", vbCritical, "UnitTest"
    End If
End Sub
