/**
 * exportToCsv — pure client-side CSV export, no dependencies.
 * Opens natively in Excel, Google Sheets, Numbers, etc.
 *
 * @param filename  e.g. "blogs-2026-07-06.csv"
 * @param rows      Array of plain objects. All keys from the first row become headers.
 */
export function exportToCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const escape = (v: unknown): string => {
    if (v == null) return "";
    const str = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
    // Wrap in quotes if value contains comma, quote, or newline
    return str.includes(",") || str.includes('"') ? `"${str}"` : str;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  const bom = "\uFEFF"; // UTF-8 BOM so Excel opens accented chars correctly
  const blob = new Blob([bom + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Returns "blogs-2026-07-06" style stem for filenames. */
export function exportFilename(label: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${label}-${date}.csv`;
}
