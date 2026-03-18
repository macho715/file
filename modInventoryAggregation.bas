Attribute VB_Name = "modInventoryAggregation"
Option Explicit

Public Sub RunInventoryAggregation()
    Dim startedAt As Double
    Dim rowsIn As Long
    Dim rowsOut As Long
    Dim prevCalc As XlCalculation

    startedAt = Timer
    prevCalc = Application.Calculation

    On Error GoTo EH

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual
    Application.StatusBar = "Running inventory aggregation..."

    EnsureBaseSheets ThisWorkbook

    Dim inputSheetName As String
    Dim resultSheetName As String
    Dim itemSummarySheetName As String
    Dim locationSummarySheetName As String
    Dim alertSheetName As String
    Dim errorSheetName As String
    Dim logSheetName As String
    Dim headerRow As Long
    Dim firstDataRow As Long
    Dim lowStockThreshold As Double
    Dim strictDuplicateCheck As Boolean

    inputSheetName = ReadConfigValue("InputSheet", "InputData")
    resultSheetName = ReadConfigValue("ResultSheet", "Result")
    itemSummarySheetName = ReadConfigValue("ItemSummarySheet", "ItemSummary")
    locationSummarySheetName = ReadConfigValue("LocationSummarySheet", "LocationSummary")
    alertSheetName = ReadConfigValue("AlertSheet", "LowStockAlerts")
    errorSheetName = ReadConfigValue("ErrorSheet", "Validation_Errors")
    logSheetName = ReadConfigValue("LogSheet", "LOG")
    headerRow = CLng(Val(ReadConfigValue("HeaderRow", "1")))
    If headerRow < 1 Then headerRow = 1
    firstDataRow = CLng(Val(ReadConfigValue("FirstDataRow", CStr(headerRow + 1))))
    If firstDataRow <= headerRow Then
        Err.Raise vbObjectError + 1002, , "FirstDataRow must be greater than HeaderRow."
    End If
    lowStockThreshold = ReadConfigDouble("LowStockThreshold", 20)
    If lowStockThreshold < 0 Then
        Err.Raise vbObjectError + 1004, , "LowStockThreshold must be zero or greater."
    End If
    strictDuplicateCheck = (UCase$(ReadConfigValue("StrictDuplicateCheck", "Y")) <> "N")

    Dim wsInput As Worksheet
    Dim wsResult As Worksheet
    Dim wsItemSummary As Worksheet
    Dim wsLocationSummary As Worksheet
    Dim wsAlert As Worksheet
    Dim wsError As Worksheet
    Dim wsLog As Worksheet

    Set wsInput = RequireSheet(inputSheetName)
    Set wsResult = RequireSheet(resultSheetName)
    Set wsItemSummary = RequireSheet(itemSummarySheetName)
    Set wsLocationSummary = RequireSheet(locationSummarySheetName)
    Set wsAlert = RequireSheet(alertSheetName)
    Set wsError = RequireSheet(errorSheetName)
    Set wsLog = RequireSheet(logSheetName)

    Dim dataRange As Range
    Set dataRange = wsInput.Cells(headerRow, 1).CurrentRegion

    Dim data As Variant
    data = dataRange.Value

    If UBound(data, 1) < 2 Then
        Err.Raise vbObjectError + 1000, , "InputData has no data rows to aggregate."
    End If

    Dim firstDataIndex As Long
    firstDataIndex = firstDataRow - dataRange.Row + 1
    If firstDataIndex < 2 Or firstDataIndex > UBound(data, 1) Then
        Err.Raise vbObjectError + 1003, , "FirstDataRow is outside the input data range."
    End If

    rowsIn = UBound(data, 1) - firstDataIndex + 1

    Dim headerMap As Object
    Set headerMap = BuildHeaderMap(data)

    Dim colItemCode As Long
    Dim colItemName As Long
    Dim colCategory As Long
    Dim colLocation As Long
    Dim colQty As Long
    Dim colCost As Long

    colItemCode = RequireHeader(headerMap, "ItemCode")
    colItemName = RequireHeader(headerMap, "ItemName")
    colCategory = RequireHeader(headerMap, "Category")
    colLocation = RequireHeader(headerMap, "Location")
    colQty = RequireHeader(headerMap, "QtyOnHand")
    colCost = RequireHeader(headerMap, "UnitCost")

    ResetSheet wsResult, Array("ItemCode", "ItemName", "Category", "Location", "QtyOnHand", "UnitCost", "InventoryValue", "SourceRows")
    ResetSheet wsItemSummary, Array("ItemCode", "ItemName", "Category", "TotalQtyOnHand", "TotalInventoryValue", "LocationCount", "SourceRows")
    ResetSheet wsLocationSummary, Array("Location", "ItemBucketCount", "TotalQtyOnHand", "TotalInventoryValue", "SourceRows")
    ResetSheet wsAlert, Array("ItemCode", "ItemName", "Category", "TotalQtyOnHand", "LowStockThreshold", "ShortfallQty", "LocationCount", "TotalInventoryValue")
    ResetSheet wsError, Array("RowNum", "ItemCode", "FieldName", "Issue", "RawValue")
    EnsureLogHeader wsLog

    Dim dict As Object
    Set dict = CreateObject("Scripting.Dictionary")

    Dim invalidKeys As Object
    Set invalidKeys = CreateObject("Scripting.Dictionary")

    Dim errors As Collection
    Set errors = New Collection

    Dim i As Long
    For i = firstDataIndex To UBound(data, 1)
        Dim sheetRow As Long
        sheetRow = dataRange.Row + i - 1

        Dim itemCode As String
        Dim itemName As String
        Dim category As String
        Dim location As String
        Dim qtyRaw As Variant
        Dim costRaw As Variant

        itemCode = SafeCellText(data(i, colItemCode))
        itemName = SafeCellText(data(i, colItemName))
        category = SafeCellText(data(i, colCategory))
        location = SafeCellText(data(i, colLocation))
        qtyRaw = data(i, colQty)
        costRaw = data(i, colCost)

        If itemCode = vbNullString Then
            AddValidationError errors, sheetRow, itemCode, "ItemCode", "Missing item code", itemCode
            GoTo NextRow
        End If

        If IsError(qtyRaw) Or Not IsNumeric(qtyRaw) Or SafeCellText(qtyRaw) = vbNullString Then
            AddValidationError errors, sheetRow, itemCode, "QtyOnHand", "QtyOnHand must be numeric", qtyRaw
            GoTo NextRow
        End If

        If IsError(costRaw) Or Not IsNumeric(costRaw) Or SafeCellText(costRaw) = vbNullString Then
            AddValidationError errors, sheetRow, itemCode, "UnitCost", "UnitCost must be numeric", costRaw
            GoTo NextRow
        End If

        Dim qtyValue As Double
        Dim costValue As Double
        qtyValue = CDbl(qtyRaw)
        costValue = CDbl(costRaw)

        Dim key As String
        key = itemCode & "|" & location

        Dim bucket As Variant
        If dict.Exists(key) Then
            bucket = dict(key)
            If strictDuplicateCheck Then
                If Not SameText(CStr(bucket(1)), itemName) Then
                    AddValidationError errors, sheetRow, itemCode, "ItemName", "Duplicate key has conflicting ItemName. Key excluded from Result.", itemName
                    invalidKeys(key) = True
                End If

                If Not SameText(CStr(bucket(2)), category) Then
                    AddValidationError errors, sheetRow, itemCode, "Category", "Duplicate key has conflicting Category. Key excluded from Result.", category
                    invalidKeys(key) = True
                End If

                If Round(CDbl(bucket(5)), 4) <> Round(costValue, 4) Then
                    AddValidationError errors, sheetRow, itemCode, "UnitCost", "Duplicate key has conflicting UnitCost. Key excluded from Result.", costRaw
                    invalidKeys(key) = True
                End If
            ElseIf Round(CDbl(bucket(5)), 4) <> Round(costValue, 4) Then
                AddValidationError errors, sheetRow, itemCode, "UnitCost", "Mixed UnitCost detected for same ItemCode and Location. First value retained.", costRaw
            End If

            bucket(4) = CDbl(bucket(4)) + qtyValue
            bucket(7) = CLng(bucket(7)) + 1
        Else
            bucket = Array(itemCode, itemName, category, location, qtyValue, costValue, qtyValue * costValue, 1&)
        End If

        bucket(6) = CDbl(bucket(4)) * CDbl(bucket(5))
        dict(key) = bucket

NextRow:
    Next i

    rowsOut = ValidResultCount(dict, invalidKeys)
    WriteResult wsResult, dict, invalidKeys
    WriteItemSummary wsItemSummary, wsAlert, dict, invalidKeys, errors, lowStockThreshold, strictDuplicateCheck
    WriteLocationSummary wsLocationSummary, dict, invalidKeys
    WriteValidationErrors wsError, errors
    WriteLogRow wsLog, "RunInventoryAggregation", "Complete", "OK", _
        "Inventory aggregation completed | ResultRows=" & rowsOut, rowsIn, rowsOut, TimerElapsed(startedAt)
    ApplyStandardFinish wsInput, Array(5, 6), Array(7), 1
    ApplyStandardFinish wsResult, Array(5, 6, 7), Empty, 1
    ApplyStandardFinish wsItemSummary, Array(4, 5), Empty, 1
    ApplyStandardFinish wsLocationSummary, Array(3, 4), Empty, 1
    ApplyStandardFinish wsAlert, Array(4, 5, 6, 8), Empty, 1
    ApplyStandardFinish wsError, Empty, Empty, 1
    ApplyStandardFinish wsLog, Array(6, 7, 8), Array(1), 1

CleanUp:
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    Application.Calculation = prevCalc
    Application.StatusBar = False
    Exit Sub

EH:
    On Error Resume Next
    EnsureBaseSheets ThisWorkbook
    WriteLogRow RequireSheet(ReadConfigValue("LogSheet", "LOG")), "RunInventoryAggregation", "Fail", "ERROR", _
        Err.Number & " - " & Err.Description, rowsIn, rowsOut, TimerElapsed(startedAt)
    MsgBox "Inventory aggregation failed: " & Err.Description, vbExclamation
    Resume CleanUp
End Sub

Private Sub EnsureBaseSheets(ByVal wb As Workbook)
    Dim ws As Worksheet

    Set ws = GetOrCreateSheet(wb, "Config")
    If Trim$(CStr(ws.Range("A1").Value)) = vbNullString Then
        ws.Range("A1:B11").ClearContents
        ws.Range("A1").Value = "InputSheet"
        ws.Range("B1").Value = "InputData"
        ws.Range("A2").Value = "ResultSheet"
        ws.Range("B2").Value = "Result"
        ws.Range("A3").Value = "ItemSummarySheet"
        ws.Range("B3").Value = "ItemSummary"
        ws.Range("A4").Value = "LocationSummarySheet"
        ws.Range("B4").Value = "LocationSummary"
        ws.Range("A5").Value = "AlertSheet"
        ws.Range("B5").Value = "LowStockAlerts"
        ws.Range("A6").Value = "ErrorSheet"
        ws.Range("B6").Value = "Validation_Errors"
        ws.Range("A7").Value = "LogSheet"
        ws.Range("B7").Value = "LOG"
        ws.Range("A8").Value = "HeaderRow"
        ws.Range("B8").Value = 1
        ws.Range("A9").Value = "FirstDataRow"
        ws.Range("B9").Value = 2
        ws.Range("A10").Value = "LowStockThreshold"
        ws.Range("B10").Value = 20
        ws.Range("A11").Value = "StrictDuplicateCheck"
        ws.Range("B11").Value = "Y"
    End If

    Set ws = GetOrCreateSheet(wb, "InputData")
    Set ws = GetOrCreateSheet(wb, "Result")
    Set ws = GetOrCreateSheet(wb, "ItemSummary")
    Set ws = GetOrCreateSheet(wb, "LocationSummary")
    Set ws = GetOrCreateSheet(wb, "LowStockAlerts")
    Set ws = GetOrCreateSheet(wb, "Validation_Errors")
    Set ws = GetOrCreateSheet(wb, "LOG")
End Sub

Private Function GetOrCreateSheet(ByVal wb As Workbook, ByVal sheetName As String) As Worksheet
    On Error Resume Next
    Set GetOrCreateSheet = wb.Worksheets(sheetName)
    On Error GoTo 0

    If GetOrCreateSheet Is Nothing Then
        Set GetOrCreateSheet = wb.Worksheets.Add(After:=wb.Worksheets(wb.Worksheets.Count))
        GetOrCreateSheet.Name = sheetName
    End If
End Function

Private Function RequireSheet(ByVal sheetName As String) As Worksheet
    Set RequireSheet = ThisWorkbook.Worksheets(sheetName)
End Function

Private Function ReadConfigValue(ByVal keyName As String, ByVal defaultValue As String) As String
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("Config")

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    Dim i As Long
    For i = 1 To lastRow
        If StrComp(Trim$(CStr(ws.Cells(i, 1).Value)), keyName, vbTextCompare) = 0 Then
            ReadConfigValue = Trim$(CStr(ws.Cells(i, 2).Value))
            If ReadConfigValue = vbNullString Then ReadConfigValue = defaultValue
            Exit Function
        End If
    Next i

    ReadConfigValue = defaultValue
End Function

Private Function ReadConfigDouble(ByVal keyName As String, ByVal defaultValue As Double) As Double
    Dim rawValue As String
    rawValue = ReadConfigValue(keyName, CStr(defaultValue))

    If Not IsNumeric(rawValue) Then
        Err.Raise vbObjectError + 1005, , keyName & " must be numeric."
    End If

    ReadConfigDouble = CDbl(rawValue)
End Function

Private Function BuildHeaderMap(ByVal data As Variant) As Object
    Dim dict As Object
    Set dict = CreateObject("Scripting.Dictionary")

    Dim col As Long
    For col = 1 To UBound(data, 2)
        dict(Trim$(CStr(data(1, col)))) = col
    Next col

    Set BuildHeaderMap = dict
End Function

Private Function RequireHeader(ByVal headerMap As Object, ByVal headerName As String) As Long
    If Not headerMap.Exists(headerName) Then
        Err.Raise vbObjectError + 1001, , "Missing required header: " & headerName
    End If
    RequireHeader = CLng(headerMap(headerName))
End Function

Private Function SameText(ByVal leftValue As String, ByVal rightValue As String) As Boolean
    SameText = (StrComp(Trim$(leftValue), Trim$(rightValue), vbTextCompare) = 0)
End Function

Private Sub ResetSheet(ByVal ws As Worksheet, ByVal headers As Variant)
    ws.Cells.Clear

    Dim i As Long
    For i = LBound(headers) To UBound(headers)
        ws.Cells(1, i - LBound(headers) + 1).Value = headers(i)
    Next i
End Sub

Private Sub EnsureLogHeader(ByVal ws As Worksheet)
    If Trim$(CStr(ws.Cells(1, 1).Value)) = vbNullString Then
        ResetSheet ws, Array("RunTS", "Proc", "Step", "Status", "Message", "RowsIn", "RowsOut", "DurationSec")
    End If
End Sub

Private Sub AddValidationError(ByRef errors As Collection, ByVal rowNum As Long, ByVal itemCode As String, _
    ByVal fieldName As String, ByVal issue As String, ByVal rawValue As Variant)
    errors.Add Array(rowNum, itemCode, fieldName, issue, SafeCellText(rawValue))
End Sub

Private Sub WriteValidationErrors(ByVal ws As Worksheet, ByVal errors As Collection)
    If errors.Count = 0 Then Exit Sub

    Dim outArr() As Variant
    ReDim outArr(1 To errors.Count, 1 To 5)

    Dim i As Long
    Dim item As Variant
    For i = 1 To errors.Count
        item = errors(i)
        outArr(i, 1) = item(0)
        outArr(i, 2) = item(1)
        outArr(i, 3) = item(2)
        outArr(i, 4) = item(3)
        outArr(i, 5) = item(4)
    Next i

    ws.Range("A2").Resize(errors.Count, 5).Value = outArr
End Sub

Private Sub WriteResult(ByVal ws As Worksheet, ByVal dict As Object, ByVal invalidKeys As Object)
    Dim validCount As Long
    validCount = ValidResultCount(dict, invalidKeys)
    If validCount = 0 Then Exit Sub

    Dim outArr() As Variant
    ReDim outArr(1 To validCount, 1 To 8)

    Dim keys As Variant
    keys = dict.Keys

    Dim i As Long
    Dim bucket As Variant
    Dim outRow As Long
    For i = 0 To dict.Count - 1
        If invalidKeys.Exists(CStr(keys(i))) Then
            GoTo NextResultKey
        End If

        bucket = dict(keys(i))
        outRow = outRow + 1
        outArr(outRow, 1) = bucket(0)
        outArr(outRow, 2) = bucket(1)
        outArr(outRow, 3) = bucket(2)
        outArr(outRow, 4) = bucket(3)
        outArr(outRow, 5) = bucket(4)
        outArr(outRow, 6) = bucket(5)
        outArr(outRow, 7) = bucket(6)
        outArr(outRow, 8) = bucket(7)
NextResultKey:
    Next i

    ws.Range("A2").Resize(validCount, 8).Value = outArr
End Sub

Private Sub WriteItemSummary(ByVal wsSummary As Worksheet, ByVal wsAlert As Worksheet, ByVal resultDict As Object, _
    ByVal invalidKeys As Object, ByRef errors As Collection, ByVal lowStockThreshold As Double, _
    ByVal strictDuplicateCheck As Boolean)
    Dim itemDict As Object
    Dim invalidItems As Object
    Dim keys As Variant
    Dim i As Long

    Set itemDict = CreateObject("Scripting.Dictionary")
    Set invalidItems = CreateObject("Scripting.Dictionary")
    keys = resultDict.Keys

    For i = 0 To resultDict.Count - 1
        If invalidKeys.Exists(CStr(keys(i))) Then
            GoTo NextKey
        End If

        Dim bucket As Variant
        bucket = resultDict(keys(i))

        Dim itemKey As String
        itemKey = CStr(bucket(0))

        Dim itemBucket As Variant
        If itemDict.Exists(itemKey) Then
            itemBucket = itemDict(itemKey)

            If strictDuplicateCheck Then
                If Not SameText(CStr(itemBucket(1)), CStr(bucket(1))) Then
                    AddValidationError errors, 0, itemKey, "ItemName", "ItemCode has conflicting ItemName across locations. Item excluded from ItemSummary and LowStockAlerts.", bucket(1)
                    invalidItems(itemKey) = True
                End If

                If Not SameText(CStr(itemBucket(2)), CStr(bucket(2))) Then
                    AddValidationError errors, 0, itemKey, "Category", "ItemCode has conflicting Category across locations. Item excluded from ItemSummary and LowStockAlerts.", bucket(2)
                    invalidItems(itemKey) = True
                End If
            End If

            itemBucket(3) = CDbl(itemBucket(3)) + CDbl(bucket(4))
            itemBucket(4) = CDbl(itemBucket(4)) + CDbl(bucket(6))
            itemBucket(5) = CLng(itemBucket(5)) + 1
            itemBucket(6) = CLng(itemBucket(6)) + CLng(bucket(7))
        Else
            itemBucket = Array(bucket(0), bucket(1), bucket(2), bucket(4), bucket(6), 1&, bucket(7))
        End If

        itemDict(itemKey) = itemBucket
NextKey:
    Next i

    WriteItemSummaryRows wsSummary, itemDict, invalidItems
    WriteLowStockAlerts wsAlert, itemDict, invalidItems, lowStockThreshold
End Sub

Private Sub WriteItemSummaryRows(ByVal ws As Worksheet, ByVal itemDict As Object, ByVal invalidItems As Object)
    Dim validCount As Long
    validCount = ValidResultCount(itemDict, invalidItems)
    If validCount = 0 Then Exit Sub

    Dim outArr() As Variant
    ReDim outArr(1 To validCount, 1 To 7)

    Dim keys As Variant
    Dim i As Long
    Dim outRow As Long
    Dim itemBucket As Variant

    keys = itemDict.Keys
    For i = 0 To itemDict.Count - 1
        If invalidItems.Exists(CStr(keys(i))) Then
            GoTo NextItemKey
        End If

        itemBucket = itemDict(keys(i))
        outRow = outRow + 1
        outArr(outRow, 1) = itemBucket(0)
        outArr(outRow, 2) = itemBucket(1)
        outArr(outRow, 3) = itemBucket(2)
        outArr(outRow, 4) = itemBucket(3)
        outArr(outRow, 5) = itemBucket(4)
        outArr(outRow, 6) = itemBucket(5)
        outArr(outRow, 7) = itemBucket(6)
NextItemKey:
    Next i

    ws.Range("A2").Resize(validCount, 7).Value = outArr
End Sub

Private Sub WriteLowStockAlerts(ByVal ws As Worksheet, ByVal itemDict As Object, ByVal invalidItems As Object, _
    ByVal lowStockThreshold As Double)
    Dim alertCount As Long
    alertCount = LowStockAlertCount(itemDict, invalidItems, lowStockThreshold)
    If alertCount = 0 Then Exit Sub

    Dim outArr() As Variant
    ReDim outArr(1 To alertCount, 1 To 8)

    Dim keys As Variant
    Dim i As Long
    Dim outRow As Long
    Dim itemBucket As Variant
    Dim totalQty As Double

    keys = itemDict.Keys
    For i = 0 To itemDict.Count - 1
        If invalidItems.Exists(CStr(keys(i))) Then
            GoTo NextAlertKey
        End If

        itemBucket = itemDict(keys(i))
        totalQty = CDbl(itemBucket(3))
        If totalQty >= lowStockThreshold Then
            GoTo NextAlertKey
        End If

        outRow = outRow + 1
        outArr(outRow, 1) = itemBucket(0)
        outArr(outRow, 2) = itemBucket(1)
        outArr(outRow, 3) = itemBucket(2)
        outArr(outRow, 4) = totalQty
        outArr(outRow, 5) = lowStockThreshold
        outArr(outRow, 6) = lowStockThreshold - totalQty
        outArr(outRow, 7) = itemBucket(5)
        outArr(outRow, 8) = itemBucket(4)
NextAlertKey:
    Next i

    ws.Range("A2").Resize(alertCount, 8).Value = outArr
End Sub

Private Sub WriteLocationSummary(ByVal ws As Worksheet, ByVal resultDict As Object, ByVal invalidKeys As Object)
    Dim locationDict As Object
    Dim keys As Variant
    Dim i As Long

    Set locationDict = CreateObject("Scripting.Dictionary")
    keys = resultDict.Keys

    For i = 0 To resultDict.Count - 1
        If invalidKeys.Exists(CStr(keys(i))) Then
            GoTo NextLocationKey
        End If

        Dim bucket As Variant
        bucket = resultDict(keys(i))

        Dim locationKey As String
        locationKey = CStr(bucket(3))

        Dim locBucket As Variant
        If locationDict.Exists(locationKey) Then
            locBucket = locationDict(locationKey)
            locBucket(1) = CLng(locBucket(1)) + 1
            locBucket(2) = CDbl(locBucket(2)) + CDbl(bucket(4))
            locBucket(3) = CDbl(locBucket(3)) + CDbl(bucket(6))
            locBucket(4) = CLng(locBucket(4)) + CLng(bucket(7))
        Else
            locBucket = Array(locationKey, 1&, bucket(4), bucket(6), bucket(7))
        End If

        locationDict(locationKey) = locBucket
NextLocationKey:
    Next i

    If locationDict.Count = 0 Then Exit Sub

    Dim outArr() As Variant
    ReDim outArr(1 To locationDict.Count, 1 To 5)

    keys = locationDict.Keys
    Dim outRow As Long
    For i = 0 To locationDict.Count - 1
        Dim locationBucket As Variant
        locationBucket = locationDict(keys(i))
        outRow = outRow + 1
        outArr(outRow, 1) = locationBucket(0)
        outArr(outRow, 2) = locationBucket(1)
        outArr(outRow, 3) = locationBucket(2)
        outArr(outRow, 4) = locationBucket(3)
        outArr(outRow, 5) = locationBucket(4)
    Next i

    ws.Range("A2").Resize(locationDict.Count, 5).Value = outArr
End Sub

Private Sub WriteLogRow(ByVal ws As Worksheet, ByVal procName As String, ByVal stepName As String, _
    ByVal statusName As String, ByVal message As String, ByVal rowsIn As Long, _
    ByVal rowsOut As Long, ByVal durationSec As Double)
    EnsureLogHeader ws

    Dim nextRow As Long
    nextRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1

    ws.Cells(nextRow, 1).Value = Now
    ws.Cells(nextRow, 2).Value = procName
    ws.Cells(nextRow, 3).Value = stepName
    ws.Cells(nextRow, 4).Value = statusName
    ws.Cells(nextRow, 5).Value = message
    ws.Cells(nextRow, 6).Value = rowsIn
    ws.Cells(nextRow, 7).Value = rowsOut
    ws.Cells(nextRow, 8).Value = Round(durationSec, 2)
End Sub

Private Sub ApplyStandardFinish(ByVal ws As Worksheet, ByVal numberCols As Variant, ByVal dateCols As Variant, _
    ByVal headerRow As Long)
    Dim lastRow As Long
    Dim lastCol As Long
    lastRow = LastUsedRow(ws)
    lastCol = LastUsedCol(ws)
    If lastRow < headerRow Or lastCol < 1 Then Exit Sub

    Dim headerRange As Range
    Set headerRange = ws.Range(ws.Cells(headerRow, 1), ws.Cells(headerRow, lastCol))
    With headerRange
        .Font.Bold = True
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
        .Interior.Color = RGB(220, 234, 247)
        .Font.Color = RGB(16, 42, 67)
        .Borders.LineStyle = xlContinuous
    End With
    headerRange.EntireRow.RowHeight = 22

    Dim bodyStartRow As Long
    bodyStartRow = headerRow + 1
    If lastRow >= bodyStartRow Then
        ws.Range(ws.Cells(bodyStartRow, 1), ws.Cells(lastRow, lastCol)).EntireRow.AutoFit
        ApplyColumnFormats ws, numberCols, "#,##0.00", bodyStartRow, lastRow
        ApplyColumnFormats ws, dateCols, "yyyy-mm-dd", bodyStartRow, lastRow
    End If

    If ws.AutoFilterMode Then ws.AutoFilterMode = False
    ws.Range(ws.Cells(headerRow, 1), ws.Cells(lastRow, lastCol)).AutoFilter
    ws.Cells.EntireColumn.AutoFit

    If SheetHasColumn(ws, "RunTS", headerRow) Then
        ws.Columns(GetHeaderColumn(ws, "RunTS", headerRow)).ColumnWidth = 19
    End If
    If SheetHasColumn(ws, "Message", headerRow) Then
        ws.Columns(GetHeaderColumn(ws, "Message", headerRow)).ColumnWidth = 36
    End If
End Sub

Private Sub ApplyColumnFormats(ByVal ws As Worksheet, ByVal columnsToFormat As Variant, ByVal fmt As String, _
    ByVal firstRow As Long, ByVal lastRow As Long)
    If IsEmpty(columnsToFormat) Then Exit Sub

    Dim i As Long
    For i = LBound(columnsToFormat) To UBound(columnsToFormat)
        ws.Range(ws.Cells(firstRow, CLng(columnsToFormat(i))), ws.Cells(lastRow, CLng(columnsToFormat(i)))).NumberFormat = fmt
    Next i
End Sub

Private Function LastUsedRow(ByVal ws As Worksheet) As Long
    Dim lastCell As Range
    Set lastCell = ws.Cells.Find(What:="*", After:=ws.Cells(1, 1), SearchOrder:=xlByRows, SearchDirection:=xlPrevious)
    If lastCell Is Nothing Then
        LastUsedRow = 0
    Else
        LastUsedRow = lastCell.Row
    End If
End Function

Private Function LastUsedCol(ByVal ws As Worksheet) As Long
    Dim lastCell As Range
    Set lastCell = ws.Cells.Find(What:="*", After:=ws.Cells(1, 1), SearchOrder:=xlByColumns, SearchDirection:=xlPrevious)
    If lastCell Is Nothing Then
        LastUsedCol = 0
    Else
        LastUsedCol = lastCell.Column
    End If
End Function

Private Function GetHeaderColumn(ByVal ws As Worksheet, ByVal headerName As String, ByVal headerRow As Long) As Long
    Dim lastCol As Long
    Dim col As Long
    lastCol = LastUsedCol(ws)
    For col = 1 To lastCol
        If SameText(CStr(ws.Cells(headerRow, col).Value), headerName) Then
            GetHeaderColumn = col
            Exit Function
        End If
    Next col
End Function

Private Function SheetHasColumn(ByVal ws As Worksheet, ByVal headerName As String, ByVal headerRow As Long) As Boolean
    SheetHasColumn = (GetHeaderColumn(ws, headerName, headerRow) > 0)
End Function

Private Function TimerElapsed(ByVal startedAt As Double) As Double
    Dim elapsed As Double
    elapsed = Timer - startedAt
    If elapsed < 0 Then
        elapsed = elapsed + 86400#
    End If
    TimerElapsed = elapsed
End Function

Private Function SafeCellText(ByVal value As Variant) As String
    If IsError(value) Then
        SafeCellText = "#ERROR"
    Else
        SafeCellText = Trim$(CStr(value))
    End If
End Function

Private Function ValidResultCount(ByVal dict As Object, ByVal invalidKeys As Object) As Long
    Dim keys As Variant
    Dim i As Long

    keys = dict.Keys
    For i = 0 To dict.Count - 1
        If Not invalidKeys.Exists(CStr(keys(i))) Then
            ValidResultCount = ValidResultCount + 1
        End If
    Next i
End Function

Private Function LowStockAlertCount(ByVal itemDict As Object, ByVal invalidItems As Object, _
    ByVal lowStockThreshold As Double) As Long
    Dim keys As Variant
    Dim i As Long
    Dim itemBucket As Variant

    keys = itemDict.Keys
    For i = 0 To itemDict.Count - 1
        If invalidItems.Exists(CStr(keys(i))) Then
            GoTo NextLowStockKey
        End If

        itemBucket = itemDict(keys(i))
        If CDbl(itemBucket(3)) < lowStockThreshold Then
            LowStockAlertCount = LowStockAlertCount + 1
        End If
NextLowStockKey:
    Next i
End Function
