function escapeCsvCell(value: string | number): string {
  const str = String(value ?? "");
  const safe = /^(?:[\s]*[=+\-@]|[\t\r\n])/.test(str) ? `'${str}` : str;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function toSafeCsv(
  headers: string[],
  rows: Array<Array<string | number>>,
): string {
  return [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\n");
}
