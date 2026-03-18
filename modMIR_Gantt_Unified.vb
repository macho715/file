Attribute VB_Name = "modMIR_Gantt_Unified"
Option Explicit

' ============================================================
' MIR Reactor Repair Gantt — UNIFIED (PROD + PTO)
' Office: LTSC 2021 compatible
' 
' Supports two scheduling modes:
'   - PROD Mode (AUTO_SCHEDULE_PTO=OFF): Manual editing + downstream shift
'   - PTO Mode (AUTO_SCHEDULE_PTO=ON): Predecessor + Lag auto-scheduling
' ============================================================

' ---- Sheet constants
Public Const SHEET_PREFIX As String = "Gantt_"
Public Const HEADER_ROW As Long = 3
Public Const FIRST_DATA_ROW As Long = 4

' ---- Columns (A:J meta, K~ date columns) - UNIFIED 10 columns
Public Const COL_STEP As Long = 1
Public Const COL_PHASE As Long = 2
Public Const COL_TASK As Long = 3
Public Const COL_START As Long = 4
Public Const COL_END As Long = 5
Public Const COL_DAYS As Long = 6
Public Const COL_RISK As Long = 7
Public Const COL_NOTE As Long = 8
Public Const COL_PRED As Long = 9
Public Const COL_LAG As Long = 10

Public Const META_COLS As Long = 10
Public Const DATE_COL_START As Long = 11 ' K

' ---- Theme colors (HEX)
Private Const BG_DARK As String = "0D0F14"
Private Const BG_WEEKEND As String = "0D1020"
Private Const BG_SURFACE2 As String = "1A1E2A"
Private Const BG_HEADER As String = "0B1120"
Private Const BORDER_HEX As String = "232840"

Private Const C_AMBER As String = "E8B84B"
Private Const C_BLUE As String = "5EB8FF"
Private Const C_GREEN As String = "6BDFB0"
Private Const C_PINK As String = "F472B6"
Private Const C_ORANGE As String = "FB923C"
Private Const C_PURPLE As String = "A78BFA"
Private Const C_YELLOW As String = "FACC15"
Private Const C_RED As String = "FF5F5F"
Private Const C_DIM As String = "5A6480"

' ---- Previous edit snapshot (for PROD shift mode)
Public gPrevSheet As String
Public gPrevRow As Long
Public gPrevCol As Long
Public gPrevStart As Variant
Public gPrevEnd As Variant
Public gPrevDays As Variant
Public gPrevValue As Variant

' ---- Re-entry prevention flag
Private gEventProcessing As Boolean

Private Type EditSnapshot
    sheetName As String
    rowNum As Long
    colNum As Long
    oldValue As Variant
    ts As Date
End Type

Private gUndoStack(1 To 10) As EditSnapshot
Private gUndoIndex As Long
Private gUndoCount As Long

Private Sub BeginOptimizedBlock(ByRef prevEvents As Boolean, ByRef prevScreenUpdating As Boolean, ByRef prevCalc As XlCalculation)
    prevEvents = Application.EnableEvents
    prevScreenUpdating = Application.ScreenUpdating
    prevCalc = Application.Calculation
    Application.EnableEvents = False
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
End Sub

Private Sub EndOptimizedBlock(ByVal prevEvents As Boolean, ByVal prevScreenUpdating As Boolean, ByVal prevCalc As XlCalculation)
    Application.Calculation = prevCalc
    Application.ScreenUpdating = prevScreenUpdating
    Application.EnableEvents = prevEvents
End Sub

' ============================================================
' PUBLIC MACROS
' ============================================================
Public Sub Init_Unified_System()
    On Error GoTo EH
    
    Dim hadWarning As Boolean
    Dim prevEvents As Boolean
    Dim prevScreenUpdating As Boolean
    Dim prevCalc As XlCalculation
    Dim ws As Worksheet
    
    BeginOptimizedBlock prevEvents, prevScreenUpdating, prevCalc
    
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then
            ' Ensure unprotected for initialization
            On Error Resume Next
            ws.Unprotect
            If Err.Number <> 0 Then
                hadWarning = True
                LogMsg "Init_Unified_System", "Unprotect warning: " & Err.Number & " - " & Err.Description, ws.Name
                Err.Clear
            End If
            On Error GoTo EH
            
            NormalizeSheetDates ws
            RefreshGantt ws, True
            ApplyProtection ws, False
        End If
    Next ws
    
    Set ws = Nothing
    
    EndOptimizedBlock prevEvents, prevScreenUpdating, prevCalc
    
    If hadWarning Then
        LogMsg "Init_Unified_System", "Completed with warnings"
    Else
        LogMsg "Init_Unified_System", "System initialized (PROD + PTO modes available)"
    End If
    Exit Sub
EH:
    hadWarning = True
    LogMsg "Init_Unified_System", "Warning: " & Err.Number & " - " & Err.Description
    Err.Clear
    Resume Next
End Sub

Public Sub Recalculate_Active_Scenario()
    On Error GoTo EH
    Dim ws As Worksheet
    Set ws = ActiveSheet
    If Not IsGanttSheet(ws) Then
        MsgBox "Active sheet is not a Gantt_* sheet.", vbExclamation
        Exit Sub
    End If
    
    If CfgOn("CFG_AUTO_SCHEDULE_PTO", False) Then
        PTO_Recalculate ws
    End If
    
    RefreshGantt ws, True
    LogMsg "Recalculate_Active_Scenario", "OK", ws.Name
    Exit Sub
EH:
    LogMsg "Recalculate_Active_Scenario", Err.Number & " - " & Err.Description
End Sub

Public Sub Recalculate_All_Scenarios()
    On Error GoTo EH
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then
            If CfgOn("CFG_AUTO_SCHEDULE_PTO", False) Then
                PTO_Recalculate ws
            End If
            RefreshGantt ws, True
        End If
    Next ws
    LogMsg "Recalculate_All_Scenarios", "All scenarios recalculated"
    Exit Sub
EH:
    LogMsg "Recalculate_All_Scenarios", Err.Number & " - " & Err.Description
End Sub

Public Sub Reset_Active_Scenario_To_Baseline()
    On Error GoTo EH
    Dim ws As Worksheet
    Set ws = ActiveSheet
    If Not IsGanttSheet(ws) Then
        MsgBox "Active sheet is not a Gantt_* sheet.", vbExclamation
        Exit Sub
    End If
    
    RestoreFromBaseline ws
    RefreshGantt ws, True
    LogMsg "Reset_Active_Scenario_To_Baseline", "OK", ws.Name
    Exit Sub
EH:
    LogMsg "Reset_Active_Scenario_To_Baseline", Err.Number & " - " & Err.Description
End Sub

Public Sub Reset_All_Scenarios_To_Baseline()
    On Error GoTo EH
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then
            RestoreFromBaseline ws
            RefreshGantt ws, True
        End If
    Next ws
    LogMsg "Reset_All_Scenarios_To_Baseline", "All scenarios reset"
    Exit Sub
EH:
    LogMsg "Reset_All_Scenarios_To_Baseline", Err.Number & " - " & Err.Description
End Sub

Public Sub Protect_All_Gantt()
    On Error GoTo EH
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then ApplyProtection ws, True
    Next ws
    MsgBox "Sheets protected (inputs still editable).", vbInformation
    Exit Sub
EH:
    LogMsg "Protect_All_Gantt", Err.Number & " - " & Err.Description
End Sub

Public Sub Unprotect_All_Gantt()
    On Error GoTo EH
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If IsGanttSheet(ws) Then
            On Error Resume Next
            ws.Unprotect
            On Error GoTo EH
        End If
    Next ws
    MsgBox "Sheets unprotected.", vbInformation
    Exit Sub
EH:
    LogMsg "Unprotect_All_Gantt", Err.Number & " - " & Err.Description
End Sub

' ============================================================
' EVENT HOOKS (called from ThisWorkbook)
' ============================================================
Public Sub MIR_OnSelectionChange(ByVal ws As Worksheet, ByVal Target As Range)
    On Error GoTo EH
    
    If Not IsGanttSheet(ws) Then Exit Sub
    If Target Is Nothing Then Exit Sub
    If Target.CountLarge <> 1 Then Exit Sub
    If Target.Row < FIRST_DATA_ROW Then Exit Sub
    
    ' Capture previous values for shift mode
    If Target.Column >= COL_START And Target.Column <= COL_LAG Then
        gPrevSheet = ws.Name
        gPrevRow = Target.Row
        gPrevCol = Target.Column
        gPrevStart = ws.Cells(Target.Row, COL_START).Value2
        gPrevEnd = ws.Cells(Target.Row, COL_END).Value2
        gPrevDays = ws.Cells(Target.Row, COL_DAYS).Value2
        gPrevValue = ws.Cells(Target.Row, Target.Column).Value2
    End If
    
    Exit Sub
EH:
    LogMsg "MIR_OnSelectionChange", Err.Number & " - " & Err.Description, ws.Name, Target.Row, Target.Column
End Sub

Public Sub MIR_OnChange(ByVal ws As Worksheet, ByVal Target As Range)
    On Error GoTo EH
    Dim prevEvents As Boolean, prevScreen As Boolean, prevCalc As XlCalculation
    Dim optimizationOn As Boolean
    
    If Not IsGanttSheet(ws) Then Exit Sub
    If Target Is Nothing Then Exit Sub
    If Target.Row < FIRST_DATA_ROW Then Exit Sub
    
    ' Re-entry prevention
    If gEventProcessing Then
        LogMsg "MIR_OnChange", "Re-entry blocked", ws.Name, Target.Row, Target.Column
        Exit Sub
    End If
    
    Dim hit As Range
    Set hit = Intersect(Target, ws.Range(ws.Columns(COL_START), ws.Columns(COL_LAG)))
    If hit Is Nothing Then
        Set hit = Nothing
        Exit Sub
    End If
    
    gEventProcessing = True
    BeginOptimizedBlock prevEvents, prevScreen, prevCalc
    optimizationOn = True
    
    ' Multi-cell paste: just normalize + recalc + refresh
    If Target.CountLarge <> 1 Then
        NormalizeSheetDates ws
        ValidateSheetRows ws
        If CfgOn("CFG_AUTO_SCHEDULE_PTO", False) Then
            PTO_Recalculate ws
        End If
        RefreshGantt ws, True
        GoTo SafeExit
    End If
    
    If IsGroupRow(ws, Target.Row) Then GoTo SafeExit

    If gPrevSheet = ws.Name And gPrevRow = Target.Row And gPrevCol = Target.Column Then
        CaptureSnapshot ws, Target.Row, Target.Column, gPrevValue
    End If

    If Not ValidateTaskRow(ws, Target.Row) Then GoTo SafeExit
    
    ' MODE BRANCHING: PTO vs PROD
    If CfgOn("CFG_AUTO_SCHEDULE_PTO", False) Then
        ' ===== PTO MODE =====
        NormalizeRowDates ws, Target.Row
        
        If Target.Column = COL_END Then
            UpdateDaysFromStartEnd ws, Target.Row
        ElseIf Target.Column = COL_DAYS Then
            UpdateEndFromStartDays ws, Target.Row
        ElseIf Target.Column = COL_START Then
            If CfgOn("CFG_KEEP_DURATION", True) Then
                KeepDurationOnStartChange ws, Target.Row
            Else
                UpdateEndFromStartDays ws, Target.Row
            End If
        End If
        
        PTO_Recalculate ws
        RefreshGantt ws, True
    Else
        ' ===== PROD MODE =====
        HandleShiftMode ws, Target
        RefreshGantt ws, True
    End If
    
SafeExit:
    If optimizationOn Then EndOptimizedBlock prevEvents, prevScreen, prevCalc
    gEventProcessing = False
    Set hit = Nothing
    Exit Sub
    
EH:
    LogMsg "MIR_OnChange", Err.Number & " - " & Err.Description, ws.Name, Target.Row, Target.Column
    If optimizationOn Then EndOptimizedBlock prevEvents, prevScreen, prevCalc
    gEventProcessing = False
    Set hit = Nothing
End Sub

Private Sub CaptureSnapshot(ByVal ws As Worksheet, ByVal r As Long, ByVal c As Long, ByVal oldValue As Variant)
    gUndoIndex = (gUndoIndex Mod 10) + 1
    gUndoCount = WorksheetFunction.Min(gUndoCount + 1, 10)
    With gUndoStack(gUndoIndex)
        .sheetName = ws.Name
        .rowNum = r
        .colNum = c
        .oldValue = oldValue
        .ts = Now
    End With
End Sub

Public Sub Undo_LastEdit()
    On Error GoTo EH
    If gUndoCount = 0 Or gUndoIndex = 0 Then
        MsgBox "No undo history.", vbInformation
        Exit Sub
    End If
    
    Dim ws As Worksheet
    Dim prevEvents As Boolean, prevScreen As Boolean, prevCalc As XlCalculation
    Dim optimizationOn As Boolean
    BeginOptimizedBlock prevEvents, prevScreen, prevCalc
    optimizationOn = True
    
    Set ws = ThisWorkbook.Worksheets(gUndoStack(gUndoIndex).sheetName)
    ws.Cells(gUndoStack(gUndoIndex).rowNum, gUndoStack(gUndoIndex).colNum).Value2 = gUndoStack(gUndoIndex).oldValue
    EndOptimizedBlock prevEvents, prevScreen, prevCalc
    optimizationOn = False
    
    MsgBox "Undo applied: " & ws.Name & " R" & gUndoStack(gUndoIndex).rowNum & "C" & gUndoStack(gUndoIndex).colNum, vbInformation
    gUndoIndex = gUndoIndex - 1
    gUndoCount = gUndoCount - 1
    Exit Sub
EH:
    If optimizationOn Then EndOptimizedBlock prevEvents, prevScreen, prevCalc
    LogMsg "Undo_LastEdit", Err.Number & " - " & Err.Description
End Sub

' ============================================================
' PROD MODE: SHIFT LOGIC
' ============================================================
Private Sub HandleShiftMode(ByVal ws As Worksheet, ByVal Target As Range)
    Dim r As Long: r = Target.Row
    
    NormalizeRowDates ws, r
    
    ' Keep duration on start edit
    If Target.Column = COL_START And CfgOn("CFG_KEEP_DURATION", True) Then
        KeepDurationOnStartChange ws, r
    End If
    
    ' Update dependent fields
    If Target.Column = COL_END Then UpdateDaysFromStartEnd ws, r
    If Target.Column = COL_DAYS Then UpdateEndFromStartDays ws, r
    
    ' Auto shift downstream?
    If Not CfgOn("CFG_AUTO_SHIFT", True) Then Exit Sub
    If Target.Column <> COL_START And Target.Column <> COL_END Then Exit Sub
    
    Dim delta As Long
    delta = 0
    
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

Private Sub ShiftDownstream(ByVal ws As Worksheet, ByVal fromRow As Long, ByVal delta As Long, ByVal stopAtFixed As Boolean)
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
            
            st = AddDays(st, delta, useWD)
            en = AddDays(en, delta, useWD)
            
            ws.Cells(r, COL_START).Value2 = st
            ws.Cells(r, COL_END).Value2 = en
            SafeSetNumberFormat ws.Cells(r, COL_START), "yyyy-mm-dd"
            SafeSetNumberFormat ws.Cells(r, COL_END), "yyyy-mm-dd"
            UpdateDaysFromStartEnd ws, r
        End If
        
ContinueLoop:
    Next r
    
    Exit Sub
EH:
    LogMsg "ShiftDownstream", Err.Number & " - " & Err.Description, ws.Name, fromRow
End Sub

Private Function DateDelta(ByVal d1 As Date, ByVal d2 As Date) As Long
    If CfgOn("CFG_SHIFT_WORKDAYS_ONLY", False) Then
        DateDelta = WorkdayDiff(d1, d2)
    Else
        DateDelta = DateDiff("d", d1, d2)
    End If
End Function

' ============================================================
' PTO MODE: AUTO-SCHEDULE (Predecessor + Lag + Days)
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
        
        ' Days
        days = CLng(Nz(ws.Cells(r, COL_DAYS).Value, 1))
        If days < 1 Then days = 1
        ws.Cells(r, COL_DAYS).Value = days
        
        ' Lag
        lag = CLng(Nz(ws.Cells(r, COL_LAG).Value, 0))
        
        predStr = Trim$(CStr(ws.Cells(r, COL_PRED).Value))
        
        If IsFixedRow(ws, r) Or predStr = "" Then
            If Not IsDate(ws.Cells(r, COL_START).Value) Then
                LogMsg "PTO_Recalculate", "Missing Start on step=" & stepId, ws.Name, r, COL_START
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
                            maxEnd = dictEnd(key)
                            gotPred = True
                        Else
                            If dictEnd(key) > maxEnd Then maxEnd = dictEnd(key)
                        End If
                    Else
                        LogMsg "PTO_Recalculate", "Predecessor not found: " & key & " for step=" & stepId, ws.Name, r, COL_PRED
                    End If
                End If
            Next p
            
            If Not gotPred Then GoTo ContinueLoop
            
            st = AddDays(maxEnd, lag + 1, useWD)
        End If
        
        ' End from start + days
        en = AddDays(st, days - 1, useWD)
        
        ws.Cells(r, COL_START).Value2 = st
        ws.Cells(r, COL_END).Value2 = en
        SafeSetNumberFormat ws.Cells(r, COL_START), "yyyy-mm-dd"
        SafeSetNumberFormat ws.Cells(r, COL_END), "yyyy-mm-dd"
        UpdateDaysFromStartEnd ws, r
        
        dictEnd(stepId) = en
        
ContinueLoop:
    Next r
    
    Set dictEnd = Nothing
    Exit Sub
EH:
    LogMsg "PTO_Recalculate", Err.Number & " - " & Err.Description, ws.Name
    Set dictEnd = Nothing
End Sub

' ============================================================
' GANTT REFRESH (timeline expand + labels + CF/PAINT)
' ============================================================
Private Sub RefreshGantt(ByVal ws As Worksheet, ByVal includeToday As Boolean)
    On Error GoTo EH
    
    Dim minD As Date, maxD As Date
    GetMinMaxDates ws, minD, maxD
    
    If includeToday Then
        If Date < minD Then minD = Date
        If Date > maxD Then maxD = Date
    End If
    
    EnsureTimelineCovers ws, minD, maxD
    BuildDateHeader ws, minD, maxD
    FixHeaderMerges ws, HeaderLastCol(ws)
    
    WriteBarLabels ws, minD, maxD
    DrawTodayMarker ws, minD, maxD
    
    If UCase$(CfgText("CFG_REPAINT_MODE", "CF")) = "PAINT" Then
        PaintBars ws, minD, maxD
    Else
        ApplyConditionalFormatting ws, minD, maxD
    End If
    
    Exit Sub
EH:
    LogMsg "RefreshGantt", Err.Number & " - " & Err.Description, ws.Name
End Sub

Private Sub GetMinMaxDates(ByVal ws As Worksheet, ByRef minD As Date, ByRef maxD As Date)
    Dim r As Long, lastR As Long
    Dim got As Boolean
    lastR = LastUsedRow(ws)
    
    got = False
    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop
        If IsDate(ws.Cells(r, COL_START).Value) And IsDate(ws.Cells(r, COL_END).Value) Then
            If Not got Then
                minD = CDate(ws.Cells(r, COL_START).Value)
                maxD = CDate(ws.Cells(r, COL_END).Value)
                got = True
            Else
                If CDate(ws.Cells(r, COL_START).Value) < minD Then minD = CDate(ws.Cells(r, COL_START).Value)
                If CDate(ws.Cells(r, COL_END).Value) > maxD Then maxD = CDate(ws.Cells(r, COL_END).Value)
            End If
        End If
ContinueLoop:
    Next r
    
    If Not got Then
        minD = Date
        maxD = Date
    End If
End Sub

Private Sub EnsureTimelineCovers(ByVal ws As Worksheet, ByVal minD As Date, ByVal maxD As Date)
    On Error GoTo EH
    
    Dim curFirst As Date, curLast As Date
    Dim lastCol As Long
    Dim addCols As Long
    
    curFirst = HeaderFirstDate(ws)
    curLast = HeaderLastDate(ws)
    
    If IsDate(curFirst) Then
        If minD < curFirst Then
            addCols = DateDiff("d", minD, curFirst)
            ws.Columns(DATE_COL_START).Resize(, addCols).Insert Shift:=xlToRight
        End If
    End If
    
    curFirst = HeaderFirstDate(ws)
    curLast = HeaderLastDate(ws)
    lastCol = HeaderLastCol(ws)
    
    If IsDate(curLast) Then
        If maxD > curLast Then
            addCols = DateDiff("d", curLast, maxD)
            ws.Columns(lastCol + 1).Resize(, addCols).Insert Shift:=xlToRight
        End If
    End If
    
    Exit Sub
EH:
    LogMsg "EnsureTimelineCovers", Err.Number & " - " & Err.Description, ws.Name
End Sub

Private Sub BuildDateHeader(ByVal ws As Worksheet, ByVal firstD As Date, ByVal lastD As Date)
    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim i As Long, d As Date, col As Long
    For i = 0 To totalDays - 1
        d = DateAdd("d", i, firstD)
        col = DATE_COL_START + i
        
        ws.Columns(col).ColumnWidth = 3.2
        
        With ws.Cells(HEADER_ROW, col)
            .Value = d
            SafeSetNumberFormat ws.Cells(HEADER_ROW, col), "mm/dd"
            .Font.Bold = True
            .Font.Size = 7
            .HorizontalAlignment = xlCenter
            .VerticalAlignment = xlCenter
            .Interior.Color = HexToLong(BG_SURFACE2)
            
            If d = Date Then
                .Font.Color = HexToLong(C_RED)
            ElseIf Weekday(d, vbMonday) >= 6 Then
                .Font.Color = HexToLong(C_AMBER)
            Else
                .Font.Color = HexToLong(C_DIM)
            End If
            
            SetThinBorder ws.Cells(HEADER_ROW, col)
        End With
    Next i
End Sub

Private Sub FixHeaderMerges(ByVal ws As Worksheet, ByVal endCol As Long)
    On Error Resume Next
    ws.Range(ws.Cells(1, 1), ws.Cells(1, ws.Columns.Count)).UnMerge
    ws.Range(ws.Cells(2, 1), ws.Cells(2, ws.Columns.Count)).UnMerge
    On Error GoTo 0
    
    ws.Range(ws.Cells(1, 1), ws.Cells(1, endCol)).Merge
    ws.Range(ws.Cells(2, 1), ws.Cells(2, endCol)).Merge
End Sub

Private Sub WriteBarLabels(ByVal ws As Worksheet, ByVal firstD As Date, ByVal lastD As Date)
    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim endCol As Long: endCol = DATE_COL_START + totalDays - 1
    Dim lastR As Long: lastR = LastUsedRow(ws)
    Dim r As Long, c As Long
    Dim st As Date, phase As String, offset As Long
    
    ws.Range(ws.Cells(FIRST_DATA_ROW, DATE_COL_START), ws.Cells(lastR, endCol)).ClearContents
    
    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop
        If Not IsDate(ws.Cells(r, COL_START).Value) Then GoTo ContinueLoop
        st = CDate(ws.Cells(r, COL_START).Value)
        phase = CStr(ws.Cells(r, COL_PHASE).Value)
        
        offset = DateDiff("d", firstD, st)
        If offset >= 0 And offset <= totalDays - 1 Then
            With ws.Cells(r, DATE_COL_START + offset)
                .Value = Left$(phase, 12)
                .Font.Bold = True
                .Font.Size = 7
                .HorizontalAlignment = xlLeft
                .VerticalAlignment = xlCenter
            End With
        End If
ContinueLoop:
    Next r
End Sub

Private Sub DrawTodayMarker(ByVal ws As Worksheet, ByVal firstD As Date, ByVal lastD As Date)
    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim offset As Long: offset = DateDiff("d", firstD, Date)
    If offset < 0 Or offset > totalDays - 1 Then Exit Sub
    
    Dim col As Long: col = DATE_COL_START + offset
    Dim lastR As Long: lastR = LastUsedRow(ws)
    Dim r As Long
    
    For r = HEADER_ROW To lastR
        With ws.Cells(r, col)
            .Borders(xlEdgeLeft).LineStyle = xlContinuous
            .Borders(xlEdgeLeft).Weight = xlMedium
            .Borders(xlEdgeLeft).Color = HexToLong(C_RED)
            .Borders(xlEdgeRight).LineStyle = xlContinuous
            .Borders(xlEdgeRight).Weight = xlMedium
            .Borders(xlEdgeRight).Color = HexToLong(C_RED)
        End With
    Next r
End Sub

Private Sub ApplyConditionalFormatting(ByVal ws As Worksheet, ByVal firstD As Date, ByVal lastD As Date)
    On Error GoTo EH
    
    ' Temporarily unprotect for CF operations
    Dim wasProtected As Boolean
    wasProtected = ws.ProtectContents
    If wasProtected Then ws.Unprotect
    
    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim endCol As Long: endCol = DATE_COL_START + totalDays - 1
    Dim lastR As Long: lastR = LastUsedRow(ws)
    Dim rng As Range
    Set rng = ws.Range(ws.Cells(FIRST_DATA_ROW, DATE_COL_START), ws.Cells(lastR, endCol))
    
    On Error Resume Next
    rng.FormatConditions.Delete
    On Error GoTo EH
    
    Dim colL As String: colL = ColLetter(DATE_COL_START)
    Dim fc As FormatCondition
    
    ' Weekend background
    On Error Resume Next
    Set fc = rng.FormatConditions.Add(Type:=xlExpression, Formula1:="=AND($D4<>"""",WEEKDAY(" & colL & "$3,2)>5)")
    If Err.Number = 0 Then
        fc.Interior.Color = HexToLong(BG_WEEKEND)
    Else
        LogMsg "AddWeekendRule", "Error " & Err.Number & ": " & Err.Description, ws.Name
    End If
    On Error GoTo EH
    
    AddPhaseRule rng, colL, "DOC", C_BLUE
    AddPhaseRule rng, colL, "PICKUP", C_BLUE
    AddPhaseRule rng, colL, "UAE_REP", C_PURPLE
    AddPhaseRule rng, colL, "TRANS_OUT", C_ORANGE
    AddPhaseRule rng, colL, "KSA_REP", C_PINK
    AddPhaseRule rng, colL, "TRANS_BACK", C_GREEN
    AddPhaseRule rng, colL, "FINAL", C_YELLOW
    
    ' Risk override - split into simpler formula
    Dim riskFormula As String
    riskFormula = "=AND($D4<>""""," & colL & "$3>=$D4," & colL & "$3<=$E4," & _
                  "OR(ISNUMBER(SEARCH(""HIGH"",$G4)),ISNUMBER(SEARCH(""WARNING"",$G4))))"
    
    On Error Resume Next
    Set fc = rng.FormatConditions.Add(Type:=xlExpression, Formula1:=riskFormula)
    If Err.Number = 0 Then
        fc.Interior.Color = HexToLong(C_RED)
        fc.SetFirstPriority
    Else
        LogMsg "AddRiskRule", "Error " & Err.Number & ": " & Err.Description, ws.Name
    End If
    On Error GoTo EH
    
    ' Restore protection
    If wasProtected Then ApplyProtection ws, True
    
    Set rng = Nothing
    Set fc = Nothing
    Exit Sub
EH:
    LogMsg "ApplyConditionalFormatting", Err.Number & " - " & Err.Description, ws.Name
    ' Restore protection even on error
    If wasProtected Then
        On Error Resume Next
        ApplyProtection ws, True
    End If
    Set rng = Nothing
    Set fc = Nothing
End Sub

Private Sub AddPhaseRule(ByVal rng As Range, ByVal colL As String, ByVal key As String, ByVal hexColor As String)
    On Error Resume Next
    Dim fc As FormatCondition
    Dim phaseFormula As String
    phaseFormula = "=AND($D4<>"""",ISNUMBER(SEARCH(""" & key & """,$B4))," & colL & "$3>=$D4," & colL & "$3<=$E4)"
    
    Set fc = rng.FormatConditions.Add(Type:=xlExpression, Formula1:=phaseFormula)
    If Err.Number = 0 Then
        fc.Interior.Color = HexToLong(hexColor)
    End If
    Set fc = Nothing
    On Error GoTo 0
End Sub

Private Sub PaintBars(ByVal ws As Worksheet, ByVal firstD As Date, ByVal lastD As Date)
    On Error GoTo EH
    
    Dim totalDays As Long: totalDays = DateDiff("d", firstD, lastD) + 1
    Dim endCol As Long: endCol = DATE_COL_START + totalDays - 1
    Dim lastR As Long: lastR = LastUsedRow(ws)
    
    Dim r As Long, i As Long, col As Long
    Dim st As Date, en As Date, offsetS As Long, offsetE As Long
    Dim phase As String, risk As String
    Dim curD As Date
    
    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then
            ws.Range(ws.Cells(r, DATE_COL_START), ws.Cells(r, endCol)).Interior.Color = HexToLong(BG_SURFACE2)
            GoTo ContinueRow
        End If
        
        For i = 0 To totalDays - 1
            col = DATE_COL_START + i
            curD = DateAdd("d", i, firstD)
            ws.Cells(r, col).Interior.Color = HexToLong(IIf(Weekday(curD, vbMonday) >= 6, BG_WEEKEND, BG_DARK))
            SetThinBorder ws.Cells(r, col)
        Next i
        
        If Not (IsDate(ws.Cells(r, COL_START).Value) And IsDate(ws.Cells(r, COL_END).Value)) Then GoTo ContinueRow
        
        st = CDate(ws.Cells(r, COL_START).Value)
        en = CDate(ws.Cells(r, COL_END).Value)
        offsetS = DateDiff("d", firstD, st)
        offsetE = DateDiff("d", firstD, en)
        If offsetS < 0 Then offsetS = 0
        If offsetE > totalDays - 1 Then offsetE = totalDays - 1
        
        phase = CStr(ws.Cells(r, COL_PHASE).Value)
        risk = CStr(ws.Cells(r, COL_RISK).Value)
        
        Dim barColor As Long
        If InStr(1, risk, "HIGH", vbTextCompare) > 0 Or InStr(1, risk, "WARNING", vbTextCompare) > 0 Then
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
' BASELINE RESTORE
' ============================================================
Private Sub RestoreFromBaseline(ByVal ws As Worksheet)
    On Error GoTo EH
    
    ' Ensure unprotected
    ws.Unprotect
    
    Dim b As Worksheet
    Set b = ThisWorkbook.Worksheets("Baseline")
    
    Dim scenario As String
    scenario = Replace(ws.Name, SHEET_PREFIX, "")
    
    Dim mapRow As Object
    Set mapRow = CreateObject("Scripting.Dictionary")
    
    Dim r As Long, lastR As Long, stepId As String
    lastR = LastUsedRow(ws)
    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop
        stepId = Trim$(CStr(ws.Cells(r, COL_STEP).Value))
        If stepId <> "" Then mapRow(stepId) = r
ContinueLoop:
    Next r
    
    Dim br As Long, lastB As Long
    lastB = b.Cells(b.Rows.Count, 1).End(xlUp).Row
    For br = 2 To lastB
        If CStr(b.Cells(br, 1).Value) = scenario Then
            stepId = Trim$(CStr(b.Cells(br, 2).Value))
            If mapRow.Exists(stepId) Then
                r = mapRow(stepId)
                ws.Cells(r, COL_PHASE).Value = b.Cells(br, 3).Value
                ws.Cells(r, COL_TASK).Value = b.Cells(br, 4).Value
                ws.Cells(r, COL_START).Value = b.Cells(br, 5).Value
                ws.Cells(r, COL_END).Value = b.Cells(br, 6).Value
                ws.Cells(r, COL_DAYS).Value = b.Cells(br, 7).Value
                ws.Cells(r, COL_RISK).Value = b.Cells(br, 8).Value
                ws.Cells(r, COL_NOTE).Value = b.Cells(br, 9).Value
                ws.Cells(r, COL_PRED).Value = b.Cells(br, 10).Value
                ws.Cells(r, COL_LAG).Value = b.Cells(br, 11).Value
                NormalizeRowDates ws, r
            End If
        End If
    Next br
    
    Set b = Nothing
    Set mapRow = Nothing
    Exit Sub
EH:
    LogMsg "RestoreFromBaseline", Err.Number & " - " & Err.Description, ws.Name
    Set b = Nothing
    Set mapRow = Nothing
End Sub

' ============================================================
' DATE NORMALIZATION / FIELD UPDATES
' ============================================================
Private Sub NormalizeSheetDates(ByVal ws As Worksheet)
    Dim r As Long, lastR As Long
    lastR = LastUsedRow(ws)
    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop
        NormalizeRowDates ws, r
ContinueLoop:
    Next r
End Sub

Private Function ValidateTaskRow(ByVal ws As Worksheet, ByVal r As Long) As Boolean
    On Error GoTo ValidationFailed
    ValidateTaskRow = True
    If IsGroupRow(ws, r) Then Exit Function
    
    If Not IsDate(ws.Cells(r, COL_START).Value2) Then
        LogMsg "ValidateTaskRow", "Invalid Start date", ws.Name, r, COL_START
        ValidateTaskRow = False
        Exit Function
    End If
    If Not IsDate(ws.Cells(r, COL_END).Value2) Then
        LogMsg "ValidateTaskRow", "Invalid End date", ws.Name, r, COL_END
        ValidateTaskRow = False
        Exit Function
    End If
    
    Dim st As Date, en As Date, d As Long
    st = CDate(ws.Cells(r, COL_START).Value2)
    en = CDate(ws.Cells(r, COL_END).Value2)
    
    If st > en Then
        LogMsg "ValidateTaskRow", "Start > End", ws.Name, r, COL_START
        MsgBox "Validation failed: Start date is after End date (Row " & r & ").", vbExclamation
        ValidateTaskRow = False
        Exit Function
    End If
    
    d = DateDiff("d", st, en) + 1
    If CLng(Nz(ws.Cells(r, COL_DAYS).Value2, 0)) <> d Then
        ws.Cells(r, COL_DAYS).Value2 = d
    End If
    
    Dim predStr As String, preds As Variant, p As Variant
    predStr = Trim$(CStr(ws.Cells(r, COL_PRED).Value2))
    If predStr <> "" Then
        preds = SplitPred(predStr)
        For Each p In preds
            If Trim$(CStr(p)) <> "" Then
                If UCase$(Trim$(CStr(p))) = UCase$(Trim$(CStr(ws.Cells(r, COL_STEP).Value2))) Then
                    LogMsg "ValidateTaskRow", "Self predecessor not allowed: " & CStr(p), ws.Name, r, COL_PRED
                    ValidateTaskRow = False
                    Exit Function
                End If
                If Not StepExists(ws, CStr(p)) Then
                    LogMsg "ValidateTaskRow", "Invalid predecessor: " & CStr(p), ws.Name, r, COL_PRED
                    ValidateTaskRow = False
                    Exit Function
                End If
            End If
        Next p
    End If
    
    Exit Function
ValidationFailed:
    LogMsg "ValidateTaskRow", "Error: " & Err.Description, ws.Name, r
    ValidateTaskRow = False
End Function

Private Sub ValidateSheetRows(ByVal ws As Worksheet)
    Dim r As Long, lastR As Long
    lastR = LastUsedRow(ws)
    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop
        Call ValidateTaskRow(ws, r)
ContinueLoop:
    Next r
End Sub

Private Sub NormalizeRowDates(ByVal ws As Worksheet, ByVal r As Long)
    On Error Resume Next
    Dim useWD As Boolean: useWD = CfgOn("CFG_SHIFT_WORKDAYS_ONLY", False)
    
    If IsDate(ws.Cells(r, COL_START).Value) Then
        Dim st As Date: st = CDate(ws.Cells(r, COL_START).Value)
        If useWD Then st = NormalizeToWorkday(st)
        ws.Cells(r, COL_START).Value2 = st
        SafeSetNumberFormat ws.Cells(r, COL_START), "yyyy-mm-dd"
    End If
    
    If IsDate(ws.Cells(r, COL_END).Value) Then
        Dim en As Date: en = CDate(ws.Cells(r, COL_END).Value)
        If useWD Then en = NormalizeToWorkday(en)
        ws.Cells(r, COL_END).Value2 = en
        SafeSetNumberFormat ws.Cells(r, COL_END), "yyyy-mm-dd"
    End If
    
    If Err.Number <> 0 Then
        LogMsg "NormalizeRowDates", "Format error: " & Err.Description, ws.Name, r
        Err.Clear
    End If
End Sub

Private Sub UpdateDaysFromStartEnd(ByVal ws As Worksheet, ByVal r As Long)
    If Not (IsDate(ws.Cells(r, COL_START).Value) And IsDate(ws.Cells(r, COL_END).Value)) Then Exit Sub
    ws.Cells(r, COL_DAYS).Value = DateDiff("d", CDate(ws.Cells(r, COL_START).Value), CDate(ws.Cells(r, COL_END).Value)) + 1
End Sub

Private Sub UpdateEndFromStartDays(ByVal ws As Worksheet, ByVal r As Long)
    If Not IsDate(ws.Cells(r, COL_START).Value) Then Exit Sub
    Dim d As Long: d = CLng(Nz(ws.Cells(r, COL_DAYS).Value, 1))
    If d < 1 Then d = 1
    Dim st As Date: st = CDate(ws.Cells(r, COL_START).Value)
    Dim useWD As Boolean: useWD = CfgOn("CFG_SHIFT_WORKDAYS_ONLY", False)
    
    Dim en As Date: en = AddDays(st, d - 1, useWD)
    ws.Cells(r, COL_END).Value2 = en
    SafeSetNumberFormat ws.Cells(r, COL_END), "yyyy-mm-dd"
End Sub

Private Sub KeepDurationOnStartChange(ByVal ws As Worksheet, ByVal r As Long)
    If Not (IsDate(ws.Cells(r, COL_START).Value) And IsDate(gPrevStart) And IsDate(gPrevEnd)) Then Exit Sub
    
    Dim useWD As Boolean: useWD = CfgOn("CFG_SHIFT_WORKDAYS_ONLY", False)
    
    Dim prevDur As Long
    prevDur = DateDiff("d", CDate(gPrevStart), CDate(gPrevEnd))
    
    Dim st As Date: st = CDate(ws.Cells(r, COL_START).Value)
    Dim en As Date
    
    If useWD Then
        Dim d As Long: d = CLng(Nz(ws.Cells(r, COL_DAYS).Value, prevDur + 1))
        If d < 1 Then d = 1
        en = AddDays(st, d - 1, True)
    Else
        en = AddDays(st, prevDur, False)
    End If
    
    ws.Cells(r, COL_END).Value2 = en
    SafeSetNumberFormat ws.Cells(r, COL_END), "yyyy-mm-dd"
End Sub

' ============================================================
' PROTECTION
' ============================================================
Private Sub SafeSetNumberFormat(ByVal targetCell As Range, ByVal fmt As String)
    On Error GoTo FirstFail
    targetCell.NumberFormat = fmt
    Exit Sub
    
FirstFail:
    Dim ws As Worksheet
    Dim wasProtected As Boolean
    Dim firstErrNo As Long
    Dim firstErrMsg As String
    
    firstErrNo = Err.Number
    firstErrMsg = Err.Description
    Err.Clear
    
    Set ws = targetCell.Worksheet
    wasProtected = ws.ProtectContents
    
    If Not wasProtected Then
        LogMsg "SafeSetNumberFormat", firstErrNo & " - " & firstErrMsg, ws.Name, targetCell.Row, targetCell.Column
        Exit Sub
    End If
    
    On Error Resume Next
    ws.Unprotect
    targetCell.NumberFormat = fmt
    
    If Err.Number <> 0 Then
        LogMsg "SafeSetNumberFormat", firstErrNo & "/" & Err.Number & " - " & firstErrMsg & " / " & Err.Description, ws.Name, targetCell.Row, targetCell.Column
        Err.Clear
    End If
    
    If ws.ProtectContents = False Then
        ApplyProtection ws, True
    End If
    On Error GoTo 0
End Sub

Private Sub ApplyProtection(ByVal ws As Worksheet, ByVal doProtect As Boolean)
    On Error GoTo EH
    
    ws.Unprotect
    
    ws.Cells.Locked = True
    
    Dim r As Long, lastR As Long
    lastR = LastUsedRow(ws)
    For r = FIRST_DATA_ROW To lastR
        If IsGroupRow(ws, r) Then GoTo ContinueLoop
        ws.Cells(r, COL_START).Locked = False
        ws.Cells(r, COL_END).Locked = False
        ws.Cells(r, COL_DAYS).Locked = False
        ws.Cells(r, COL_RISK).Locked = False
        ws.Cells(r, COL_NOTE).Locked = False
        ws.Cells(r, COL_PRED).Locked = False
        ws.Cells(r, COL_LAG).Locked = False
ContinueLoop:
    Next r
    
    If doProtect Then
        ws.Protect DrawingObjects:=True, Contents:=True, Scenarios:=True, UserInterfaceOnly:=True, _
                   AllowFormattingCells:=True, AllowFormattingColumns:=False, AllowFormattingRows:=False, _
                   AllowInsertingColumns:=False, AllowInsertingRows:=False, AllowInsertingHyperlinks:=False, _
                   AllowDeletingColumns:=False, AllowDeletingRows:=False, AllowSorting:=True, AllowFiltering:=True, _
                   AllowUsingPivotTables:=False
        ws.EnableSelection = xlUnlockedCells
    End If
    
    Exit Sub
EH:
    LogMsg "ApplyProtection", Err.Number & " - " & Err.Description, ws.Name
End Sub

' ============================================================
' HELPERS
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

Private Function StepExists(ByVal ws As Worksheet, ByVal stepId As String) As Boolean
    Dim r As Long, lastR As Long
    lastR = LastUsedRow(ws)
    For r = FIRST_DATA_ROW To lastR
        If Not IsGroupRow(ws, r) Then
            If UCase$(Trim$(CStr(ws.Cells(r, COL_STEP).Value2))) = UCase$(Trim$(stepId)) Then
                StepExists = True
                Exit Function
            End If
        End If
    Next r
    StepExists = False
End Function

Private Function LastUsedRow(ByVal ws As Worksheet) As Long
    Dim r As Long
    r = ws.Cells(ws.Rows.Count, COL_PHASE).End(xlUp).Row
    If r < FIRST_DATA_ROW Then r = FIRST_DATA_ROW
    LastUsedRow = r
End Function

Private Function HeaderLastCol(ByVal ws As Worksheet) As Long
    Dim c As Long
    c = ws.Cells(HEADER_ROW, ws.Columns.Count).End(xlToLeft).Column
    If c < DATE_COL_START Then c = DATE_COL_START
    HeaderLastCol = c
End Function

Private Function HeaderFirstDate(ByVal ws As Worksheet) As Variant
    HeaderFirstDate = ws.Cells(HEADER_ROW, DATE_COL_START).Value
End Function

Private Function HeaderLastDate(ByVal ws As Worksheet) As Variant
    HeaderLastDate = ws.Cells(HEADER_ROW, HeaderLastCol(ws)).Value
End Function

Private Function ColLetter(ByVal colNum As Long) As String
    ColLetter = Split(Cells(1, colNum).Address(True, False), "$")(1)
End Function

Private Sub SetThinBorder(ByVal cell As Range)
    With cell.Borders
        .LineStyle = xlContinuous
        .Weight = xlThin
        .Color = HexToLong(BORDER_HEX)
    End With
End Sub

Private Function PhaseColorLong(ByVal phase As String) As Long
    Dim s As String: s = UCase$(phase)
    Select Case True
        Case InStr(1, s, "DOC", vbTextCompare) > 0
            PhaseColorLong = HexToLong(C_BLUE)
        Case InStr(1, s, "PICKUP", vbTextCompare) > 0
            PhaseColorLong = HexToLong(C_BLUE)
        Case InStr(1, s, "UAE_REP", vbTextCompare) > 0
            PhaseColorLong = HexToLong(C_PURPLE)
        Case InStr(1, s, "TRANS_OUT", vbTextCompare) > 0
            PhaseColorLong = HexToLong(C_ORANGE)
        Case InStr(1, s, "KSA_REP", vbTextCompare) > 0
            PhaseColorLong = HexToLong(C_PINK)
        Case InStr(1, s, "TRANS_BACK", vbTextCompare) > 0
            PhaseColorLong = HexToLong(C_GREEN)
        Case InStr(1, s, "FINAL", vbTextCompare) > 0
            PhaseColorLong = HexToLong(C_YELLOW)
        Case Else
            PhaseColorLong = HexToLong(C_AMBER)
    End Select
End Function

Public Function HexToLong(ByVal hex As String) As Long
    hex = Replace(hex, "#", "")
    Dim r As Long, g As Long, b As Long
    r = CLng("&H" & Mid$(hex, 1, 2))
    g = CLng("&H" & Mid$(hex, 3, 2))
    b = CLng("&H" & Mid$(hex, 5, 2))
    HexToLong = RGB(r, g, b)
End Function

Private Function Nz(ByVal v As Variant, ByVal defaultValue As Variant) As Variant
    If IsError(v) Or IsEmpty(v) Or v = "" Then
        Nz = defaultValue
    Else
        Nz = v
    End If
End Function

Private Function SplitPred(ByVal s As String) As Variant
    s = Replace(s, ";", ",")
    s = Replace(s, " ", "")
    If s = "" Then
        SplitPred = Array()
    Else
        SplitPred = Split(s, ",")
    End If
End Function

Private Function NormalizeToWorkday(ByVal d As Date) As Date
    Do While Weekday(d, vbMonday) >= 6
        d = DateAdd("d", 1, d)
    Loop
    NormalizeToWorkday = d
End Function

Private Function AddWorkdays(ByVal d As Date, ByVal n As Long) As Date
    Dim stepDir As Long
    Dim i As Long
    Dim cur As Date: cur = d
    
    If n = 0 Then
        AddWorkdays = NormalizeToWorkday(cur)
        Exit Function
    End If
    
    stepDir = IIf(n > 0, 1, -1)
    i = 0
    Do While i <> n
        cur = DateAdd("d", stepDir, cur)
        If Weekday(cur, vbMonday) <= 5 Then
            i = i + stepDir
        End If
    Loop
    AddWorkdays = cur
End Function

Private Function AddDays(ByVal d As Date, ByVal n As Long, ByVal useWorkdays As Boolean) As Date
    If useWorkdays Then
        AddDays = AddWorkdays(d, n)
    Else
        AddDays = DateAdd("d", n, d)
    End If
End Function

Private Function WorkdayDiff(ByVal d1 As Date, ByVal d2 As Date) As Long
    Dim n As Long: n = 0
    Dim cur As Date: cur = d1
    Dim dir As Long
    
    If d2 = d1 Then
        WorkdayDiff = 0
        Exit Function
    End If
    
    dir = IIf(d2 > d1, 1, -1)
    Do While cur <> d2
        cur = DateAdd("d", dir, cur)
        If Weekday(cur, vbMonday) <= 5 Then
            n = n + dir
        End If
        If Abs(n) > 4000 Then Exit Do
    Loop
    
    WorkdayDiff = n
End Function

' ============================================================
' CONFIG READERS (named ranges)
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
    Dim v As String
    v = UCase$(Trim$(CfgText(cfgName, IIf(defaultValue, "ON", "OFF"))))
    CfgOn = (v = "ON" Or v = "TRUE" Or v = "1" Or v = "YES")
End Function

' ============================================================
' LOG
' ============================================================
Public Sub LogMsg(ByVal proc As String, ByVal msg As String, Optional ByVal sheetName As String = "", Optional ByVal rowNum As Long = 0, Optional ByVal colNum As Long = 0)
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("LOG")
    Dim userName As String
    userName = Environ$("USERNAME")
    
    Dim n As Long
    n = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
    
    ws.Cells(n, 1).Value2 = Now
    ws.Cells(n, 2).Value2 = proc
    ws.Cells(n, 3).Value2 = sheetName
    ws.Cells(n, 4).Value2 = rowNum
    ws.Cells(n, 5).Value2 = colNum
    ws.Cells(n, 6).Value2 = "[" & userName & "] " & msg
End Sub

' ============================================================
' DIAGNOSTIC & MANUAL REFRESH UTILITIES
' ============================================================
Public Sub Force_Refresh_Colors()
    ' Manual color refresh for active Gantt sheet
    On Error GoTo EH
    Dim ws As Worksheet
    Set ws = ActiveSheet
    
    If Not IsGanttSheet(ws) Then
        MsgBox "Active sheet is not a Gantt_* sheet.", vbExclamation
        Exit Sub
    End If
    
    Dim minD As Date, maxD As Date
    GetMinMaxDates ws, minD, maxD
    
    ' Clear existing formatting
    On Error Resume Next
    ws.Unprotect
    Dim lastR As Long: lastR = LastUsedRow(ws)
    Dim endCol As Long: endCol = HeaderLastCol(ws)
    ws.Range(ws.Cells(FIRST_DATA_ROW, DATE_COL_START), ws.Cells(lastR, endCol)).Interior.ColorIndex = xlNone
    ws.Range(ws.Cells(FIRST_DATA_ROW, DATE_COL_START), ws.Cells(lastR, endCol)).FormatConditions.Delete
    On Error GoTo EH
    
    ' Re-apply conditional formatting
    ApplyConditionalFormatting ws, minD, maxD
    
    MsgBox "Color formatting refreshed on " & ws.Name, vbInformation
    LogMsg "Force_Refresh_Colors", "Manual refresh completed", ws.Name
    Exit Sub
EH:
    MsgBox "Error: " & Err.Description, vbCritical
    LogMsg "Force_Refresh_Colors", Err.Number & " - " & Err.Description, ws.Name
End Sub

Public Sub Diagnostic_Color_Status()
    ' Show current color configuration status
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ActiveSheet
    
    Dim msg As String
    msg = "=== COLOR DIAGNOSTIC ===" & vbCrLf & vbCrLf
    msg = msg & "Active Sheet: " & ws.Name & vbCrLf
    msg = msg & "Is Gantt Sheet: " & IsGanttSheet(ws) & vbCrLf & vbCrLf
    
    msg = msg & "--- Configuration ---" & vbCrLf
    msg = msg & "REPAINT_MODE: " & CfgText("CFG_REPAINT_MODE", "CF") & vbCrLf
    msg = msg & "AUTO_SCHEDULE_PTO: " & CfgOn("CFG_AUTO_SCHEDULE_PTO", False) & vbCrLf
    msg = msg & "AUTO_SHIFT: " & CfgOn("CFG_AUTO_SHIFT", True) & vbCrLf & vbCrLf
    
    If IsGanttSheet(ws) Then
        Dim lastR As Long: lastR = LastUsedRow(ws)
        Dim endCol As Long: endCol = HeaderLastCol(ws)
        Dim cfCount As Long
        On Error Resume Next
        cfCount = ws.Range(ws.Cells(FIRST_DATA_ROW, DATE_COL_START), ws.Cells(lastR, endCol)).FormatConditions.Count
        On Error GoTo 0
        
        msg = msg & "--- Formatting Status ---" & vbCrLf
        msg = msg & "Conditional Format Rules: " & cfCount & vbCrLf
        msg = msg & "Data Rows: " & (lastR - FIRST_DATA_ROW + 1) & vbCrLf
        msg = msg & "Date Columns: " & (endCol - DATE_COL_START + 1) & vbCrLf
    End If
    
    MsgBox msg, vbInformation, "Color Diagnostic"
End Sub

