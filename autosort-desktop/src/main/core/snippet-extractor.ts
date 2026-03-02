import * as fs from 'fs';
import * as path from 'path';

const MAX_SNIPPET_CHARS = 2500;

export async function extractSnippet(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.txt' || ext === '.md') {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.substring(0, MAX_SNIPPET_CHARS);
    }

    if (ext === '.pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer, { max: 2 });
        return (data.text ?? '').trim().substring(0, MAX_SNIPPET_CHARS);
      } catch {
        return '';
      }
    }

    if (ext === '.docx') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return (result.value ?? '').trim().substring(0, MAX_SNIPPET_CHARS);
      } catch {
        return '';
      }
    }

    if (ext === '.xlsx' || ext === '.xlsm') {
      try {
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(filePath, { sheetRows: 20 });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[] = [];
        const data = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
        }) as unknown[][];
        for (const row of data.slice(0, 20)) {
          const cells = row
            .filter((x) => x != null)
            .map((x) => String(x).substring(0, 200));
          const line = cells.join(' | ').trim();
          if (line) rows.push(line);
        }
        return rows.join('\n').substring(0, MAX_SNIPPET_CHARS);
      } catch {
        return '';
      }
    }
  } catch {
    return '';
  }

  return '';
}
