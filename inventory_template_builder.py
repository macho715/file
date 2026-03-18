from __future__ import annotations

import argparse
from datetime import datetime
import logging
from pathlib import Path

import xlsxwriter


CONFIG_ROWS = [
    ("InputSheet", "InputData"),
    ("ResultSheet", "Result"),
    ("ItemSummarySheet", "ItemSummary"),
    ("LocationSummarySheet", "LocationSummary"),
    ("AlertSheet", "LowStockAlerts"),
    ("ErrorSheet", "Validation_Errors"),
    ("LogSheet", "LOG"),
    ("HeaderRow", 1),
    ("FirstDataRow", 2),
    ("LowStockThreshold", 20),
    ("StrictDuplicateCheck", "Y"),
]

INPUT_HEADERS = [
    "ItemCode",
    "ItemName",
    "Category",
    "Location",
    "QtyOnHand",
    "UnitCost",
    "LastUpdated",
]

SAMPLE_ROWS = [
    ["RM-001", "Bolt M8", "RawMaterial", "WH-A", 120, 0.55, "2026-03-18"],
    ["RM-001", "Bolt M8", "RawMaterial", "WH-A", 40, 0.55, "2026-03-18"],
    ["RM-002", "Nut M8", "RawMaterial", "WH-A", 200, 0.22, "2026-03-18"],
    ["FG-100", "Pump Set", "FinishedGood", "YARD-1", 8, 1450.0, "2026-03-18"],
    ["FG-100", "Pump Set", "FinishedGood", "YARD-2", 2, 1450.0, "2026-03-18"],
    ["SP-900", "Seal Kit", "Spare", "WH-B", "15", 84.5, "2026-03-18"],
    ["SP-901", "Bearing Kit", "Spare", "WH-B", "", 122.0, "2026-03-18"],
    ["", "Missing Code Sample", "Spare", "WH-B", 3, 51.0, "2026-03-18"],
]

RESULT_HEADERS = [
    "ItemCode",
    "ItemName",
    "Category",
    "Location",
    "QtyOnHand",
    "UnitCost",
    "InventoryValue",
    "SourceRows",
]

ITEM_SUMMARY_HEADERS = [
    "ItemCode",
    "ItemName",
    "Category",
    "TotalQtyOnHand",
    "TotalInventoryValue",
    "LocationCount",
    "SourceRows",
]

LOCATION_SUMMARY_HEADERS = [
    "Location",
    "ItemBucketCount",
    "TotalQtyOnHand",
    "TotalInventoryValue",
    "SourceRows",
]

LOW_STOCK_HEADERS = [
    "ItemCode",
    "ItemName",
    "Category",
    "TotalQtyOnHand",
    "LowStockThreshold",
    "ShortfallQty",
    "LocationCount",
    "TotalInventoryValue",
]

ERROR_HEADERS = ["RowNum", "ItemCode", "FieldName", "Issue", "RawValue"]

LOG_HEADERS = [
    "RunTS",
    "Proc",
    "Step",
    "Status",
    "Message",
    "RowsIn",
    "RowsOut",
    "DurationSec",
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create a VBA-linked inventory aggregation workbook template."
    )
    parser.add_argument(
        "--output",
        default="inventory_aggregation_template.xlsx",
        help="Path to the template workbook to create.",
    )
    return parser


def write_headers(worksheet, headers, header_format) -> None:
    for col_idx, header in enumerate(headers):
        worksheet.write(0, col_idx, header, header_format)


def add_table_if_rows(worksheet, headers, row_count: int) -> None:
    if row_count < 1:
        return
    worksheet.add_table(
        0,
        0,
        row_count,
        len(headers) - 1,
        {
            "style": "Table Style Medium 2",
            "columns": [{"header": header} for header in headers],
            "autofilter": True,
        },
    )


def autosize_columns(worksheet, headers, sample_rows) -> None:
    for col_idx, header in enumerate(headers):
        max_len = len(str(header))
        for row in sample_rows:
            if col_idx < len(row):
                max_len = max(max_len, len(str(row[col_idx])))
        worksheet.set_column(col_idx, col_idx, min(max_len + 2, 24))


def parse_excel_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def create_workbook(output_path: Path) -> None:
    workbook = xlsxwriter.Workbook(output_path)
    try:
        header_fmt = workbook.add_format(
            {
                "bold": True,
                "bg_color": "#DCEAF7",
                "font_color": "#102A43",
                "border": 1,
                "align": "center",
                "valign": "vcenter",
            }
        )
        text_fmt = workbook.add_format({"border": 1, "valign": "vcenter"})
        number_fmt = workbook.add_format(
            {"border": 1, "valign": "vcenter", "num_format": "#,##0.00"}
        )
        date_fmt = workbook.add_format(
            {"border": 1, "valign": "vcenter", "num_format": "yyyy-mm-dd"}
        )
        note_fmt = workbook.add_format({"italic": True, "font_color": "#666666"})

        ws_config = workbook.add_worksheet("Config")
        ws_input = workbook.add_worksheet("InputData")
        ws_result = workbook.add_worksheet("Result")
        ws_item_summary = workbook.add_worksheet("ItemSummary")
        ws_location_summary = workbook.add_worksheet("LocationSummary")
        ws_alert = workbook.add_worksheet("LowStockAlerts")
        ws_error = workbook.add_worksheet("Validation_Errors")
        ws_log = workbook.add_worksheet("LOG")

        ws_config.write(0, 0, "Key", header_fmt)
        ws_config.write(0, 1, "Value", header_fmt)
        ws_config.set_row(0, 22)
        for row_idx, (key, value) in enumerate(CONFIG_ROWS, start=1):
            ws_config.write(row_idx, 0, key, text_fmt)
            ws_config.write(row_idx, 1, value, text_fmt)
        ws_config.write(
            len(CONFIG_ROWS) + 2,
            0,
            "Save this workbook as .xlsm before importing the VBA module.",
            note_fmt,
        )
        ws_config.write(
            len(CONFIG_ROWS) + 3,
            0,
            "Set StrictDuplicateCheck to Y to exclude duplicate keys with metadata or cost drift.",
            note_fmt,
        )
        ws_config.write(
            len(CONFIG_ROWS) + 4,
            0,
            "LowStockThreshold is used to build LowStockAlerts from ItemSummary totals.",
            note_fmt,
        )
        ws_config.set_column(0, 0, 20)
        ws_config.set_column(1, 1, 28)

        write_headers(ws_input, INPUT_HEADERS, header_fmt)
        ws_input.set_row(0, 22)
        for row_idx, row in enumerate(SAMPLE_ROWS, start=1):
            for col_idx, value in enumerate(row):
                if col_idx in (4, 5) and isinstance(value, (int, float)):
                    fmt = number_fmt
                    ws_input.write(row_idx, col_idx, value, fmt)
                elif col_idx == 6 and isinstance(value, str) and value:
                    ws_input.write_datetime(row_idx, col_idx, parse_excel_date(value), date_fmt)
                else:
                    ws_input.write(row_idx, col_idx, value, text_fmt)
        ws_input.freeze_panes(1, 0)
        add_table_if_rows(ws_input, INPUT_HEADERS, len(SAMPLE_ROWS))
        autosize_columns(ws_input, INPUT_HEADERS, SAMPLE_ROWS)
        ws_input.set_column(6, 6, 14, date_fmt)

        write_headers(ws_result, RESULT_HEADERS, header_fmt)
        ws_result.set_row(0, 22)
        ws_result.freeze_panes(1, 0)
        autosize_columns(ws_result, RESULT_HEADERS, [])
        ws_result.autofilter(0, 0, 0, len(RESULT_HEADERS) - 1)

        write_headers(ws_item_summary, ITEM_SUMMARY_HEADERS, header_fmt)
        ws_item_summary.set_row(0, 22)
        ws_item_summary.freeze_panes(1, 0)
        autosize_columns(ws_item_summary, ITEM_SUMMARY_HEADERS, [])
        ws_item_summary.autofilter(0, 0, 0, len(ITEM_SUMMARY_HEADERS) - 1)

        write_headers(ws_location_summary, LOCATION_SUMMARY_HEADERS, header_fmt)
        ws_location_summary.set_row(0, 22)
        ws_location_summary.freeze_panes(1, 0)
        autosize_columns(ws_location_summary, LOCATION_SUMMARY_HEADERS, [])
        ws_location_summary.autofilter(0, 0, 0, len(LOCATION_SUMMARY_HEADERS) - 1)

        write_headers(ws_alert, LOW_STOCK_HEADERS, header_fmt)
        ws_alert.set_row(0, 22)
        ws_alert.freeze_panes(1, 0)
        autosize_columns(ws_alert, LOW_STOCK_HEADERS, [])
        ws_alert.autofilter(0, 0, 0, len(LOW_STOCK_HEADERS) - 1)

        write_headers(ws_error, ERROR_HEADERS, header_fmt)
        ws_error.set_row(0, 22)
        ws_error.freeze_panes(1, 0)
        autosize_columns(ws_error, ERROR_HEADERS, [])
        ws_error.autofilter(0, 0, 0, len(ERROR_HEADERS) - 1)

        write_headers(ws_log, LOG_HEADERS, header_fmt)
        ws_log.set_row(0, 22)
        ws_log.freeze_panes(1, 0)
        autosize_columns(ws_log, LOG_HEADERS, [])
        ws_log.autofilter(0, 0, 0, len(LOG_HEADERS) - 1)
        ws_log.set_column(0, 0, 19, date_fmt)
        ws_log.set_column(4, 4, 36)
    finally:
        workbook.close()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = build_parser().parse_args()
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    logging.info("Creating workbook template: %s", output_path)
    create_workbook(output_path)
    logging.info("Workbook template created successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
