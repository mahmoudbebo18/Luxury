// Excel export (members, redemption log). SheetJS is loaded only when exporting.
export async function exportExcel(fileName: string, sheetName: string, rows: Record<string, unknown>[]) {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.json_to_sheet(rows);
  const keys = Object.keys(rows[0] ?? {});
  sheet['!cols'] = keys.map((k) => ({
    wch: Math.min(48, Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)) + 2),
  }));
  const book = XLSX.utils.book_new();
  book.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, `${fileName}.xlsx`, { compression: true });
}
