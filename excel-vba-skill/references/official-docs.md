# Official Documentation Baseline

Use official documentation before providing VBA code and before recommending Python Excel libraries as current best-fit choices.

## Microsoft Excel VBA references
- Excel VBA reference: <https://learn.microsoft.com/en-us/office/vba/api/overview/excel>
- Excel object model overview: <https://learn.microsoft.com/en-us/office/vba/api/overview/excel/object-model>
- VBA language reference overview: <https://learn.microsoft.com/en-us/office/vba/api/overview/language-reference>
- Visual Basic language reference: <https://learn.microsoft.com/en-us/office/vba/language/reference/user-interface-help/visual-basic-language-reference>
- Office LTSC 2021 overview: <https://learn.microsoft.com/en-us/office/ltsc/2021/overview>
- Office LTSC 2021 update model: <https://learn.microsoft.com/en-us/office/ltsc/2021/update>
- Macros from the internet are blocked by default: <https://learn.microsoft.com/en-us/deployoffice/security/internet-macros-blocked>
- Trusted Locations for Office files: <https://learn.microsoft.com/en-us/microsoft-365-apps/security/trusted-locations>

## Python Excel documentation anchors
- pandas `DataFrame.to_excel`: <https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_excel.html>
- pandas `read_excel`: <https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html>
- openpyxl docs: <https://openpyxl.readthedocs.io/en/stable/>
- XlsxWriter docs: <https://xlsxwriter.readthedocs.io/working_with_pandas.html>
- xlwings docs: <https://docs.xlwings.org/en/stable/>
- polars `DataFrame.write_excel`: <https://docs.pola.rs/api/python/stable/reference/api/polars.DataFrame.write_excel.html>

## Usage rule
- Before presenting VBA code, verify the relevant Excel object, property, method, or event against Microsoft Learn.
- Before presenting Python workbook-generation guidance, verify the current official library docs when making a recommendation that depends on the latest state of the ecosystem.
- Keep the LTSC 2021-safe path as the default baseline. Treat Microsoft 365-only behavior as an optional branch.
