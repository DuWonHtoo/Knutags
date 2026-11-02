// Minimal RFC 4180 CSV reading/writing. Shared by browser and server.

/** Parses CSV text. Detects ; or tab delimiters (Excel in many regions uses ;). */
export function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const firstLineEnd = text.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const counts: Record<string, number> = {
    ',': firstLine.split(',').length,
    ';': firstLine.split(';').length,
    '\t': firstLine.split('\t').length,
  };
  const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function escapeCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds CSV text with Windows line endings (what Excel and BslCAD expect). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
