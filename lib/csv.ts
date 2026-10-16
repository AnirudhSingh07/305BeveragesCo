/**
 * Minimal, dependency-free CSV builder. RFC-4180-ish quoting so values
 * containing commas, quotes, or newlines survive round-tripping.
 */
export type CsvValue = string | number | null | undefined;

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from a header row and data rows. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  return lines.join("\r\n");
}

/** Build CSV from an array of records given an ordered column spec. */
export function recordsToCsv<T>(
  records: T[],
  columns: { header: string; get: (r: T) => CsvValue }[]
): string {
  return toCsv(
    columns.map((c) => c.header),
    records.map((r) => columns.map((c) => c.get(r)))
  );
}
