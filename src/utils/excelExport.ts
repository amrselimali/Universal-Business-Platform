import * as XLSX from 'xlsx';

/**
 * Exports tabular data to a real Excel (.xlsx) file.
 * Works fully client-side and preserves Arabic text.
 */
export function exportRowsToExcel(options: {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number)[][];
}): void {
  const { filename, sheetName = 'Sheet1', headers, rows } = options;

  const aoa: (string | number)[][] = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Reasonable default column widths so Arabic content is readable.
  worksheet['!cols'] = headers.map((header, index) => {
    const longest = Math.max(
      String(header).length,
      ...rows.slice(0, 200).map((row) => String(row[index] ?? '').length)
    );
    return { wch: Math.min(48, Math.max(12, longest + 2)) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filename}_${stamp}.xlsx`);
}
