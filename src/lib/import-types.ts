// Shared between the import page (browser) and the import server action.

export const MAX_IMPORT_ROWS = 3000;

/** One CSV row, keyed by canonical column names (tag_id, full_name, field keys, public, admin_notes). */
export type ImportRow = Record<string, string>;

export interface ImportLine {
  line: number; // line number in the CSV file (header = line 1)
  name: string;
  tagId: string;
  status: 'ok' | 'error' | 'created' | 'warning';
  message: string;
}

export interface ImportResult {
  error?: string;
  lines: ImportLine[];
  valid: number;
  created: number;
  assigned: number;
}
