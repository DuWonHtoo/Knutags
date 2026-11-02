'use client';

import { useState, type ChangeEvent } from 'react';
import { importPeopleAction } from '@/lib/actions/import';
import { toCsv, parseCsv } from '@/lib/csv';
import { DEFAULT_PUBLIC_FIELDS, PROFILE_FIELDS } from '@/lib/fields';
import { MAX_IMPORT_ROWS, type ImportResult, type ImportRow } from '@/lib/import-types';
import { btnPrimary, btnSecondary, td, th } from './ui';

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Accepted column names → canonical keys.
const ALIASES: Record<string, string> = {
  tag_id: 'tag_id',
  tag: 'tag_id',
  tagid: 'tag_id',
  id: 'tag_id',
  code: 'tag_id',
  url: 'tag_id',
  full_name: 'full_name',
  fullname: 'full_name',
  name: 'full_name',
  public: 'public',
  public_fields: 'public',
  visible: 'public',
  admin_notes: 'admin_notes',
  notes: 'admin_notes',
};
for (const field of PROFILE_FIELDS) {
  ALIASES[field.key] = field.key;
  ALIASES[normalizeHeader(field.label)] = field.key;
}

const TEMPLATE_HEADERS = ['tag_id', 'full_name', ...PROFILE_FIELDS.map((f) => f.key), 'public', 'admin_notes'];

function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadTemplate() {
  const example: Record<string, string> = {
    tag_id: '',
    full_name: 'Jane Example',
    title: 'Site Manager',
    organization: 'Example Ltd',
    phone: '+1 555 0100',
    email: 'jane@example.com',
    website: 'example.com',
    location: 'Springfield',
    bio: 'Leave tag_id empty to create the person without a tag.',
    rank: 'Captain',
    public: DEFAULT_PUBLIC_FIELDS.join('|'),
    admin_notes: 'Only admins see this',
  };
  downloadText(
    'qr-profile-import-template.csv',
    toCsv([TEMPLATE_HEADERS, TEMPLATE_HEADERS.map((h) => example[h] ?? '')]),
    'text/csv;charset=utf-8',
  );
}

const LINE_STYLES = {
  ok: 'text-emerald-700',
  created: 'text-emerald-700',
  warning: 'text-amber-700',
  error: 'text-red-700',
} as const;

export function ImportClient() {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [phase, setPhase] = useState<'idle' | 'checked' | 'done'>('idle');
  const [busy, setBusy] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    setResult(null);
    setPhase('idle');
    setParseError(null);
    setRows([]);
    setIgnored([]);
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const table = parseCsv(await file.text());
      if (table.length < 2) throw new Error('The file needs a header row and at least one data row.');
      const headers = table[0].map((h) => ALIASES[normalizeHeader(h)] ?? null);
      if (!headers.includes('full_name')) throw new Error('No "full_name" (or "name") column found in the header row.');
      setIgnored(table[0].filter((_, i) => headers[i] === null));
      const data = table.slice(1).map((cells) => {
        const row: ImportRow = {};
        headers.forEach((key, i) => {
          if (key && cells[i] !== undefined && !row[key]) row[key] = cells[i];
        });
        return row;
      });
      if (data.length > MAX_IMPORT_ROWS) throw new Error(`Too many rows (${data.length}); the maximum is ${MAX_IMPORT_ROWS}.`);
      setRows(data);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not read the file.');
    }
  }

  async function run(commit: boolean) {
    setBusy(true);
    try {
      const res = await importPeopleAction(rows, commit);
      setResult(res);
      if (!res.error) setPhase(commit ? 'done' : 'checked');
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Request failed.', lines: [], valid: 0, created: 0, assigned: 0 });
    } finally {
      setBusy(false);
    }
  }

  const errorCount = result?.lines.filter((l) => l.status === 'error').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className={`${btnPrimary} cursor-pointer`}>
          Choose CSV file
          <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="sr-only" />
        </label>
        <button type="button" onClick={downloadTemplate} className={btnSecondary}>
          Download template
        </button>
        {fileName ? <span className="text-sm text-slate-600">{fileName}</span> : null}
      </div>

      {parseError ? <p className="text-sm text-red-700">{parseError}</p> : null}

      {rows.length > 0 && phase !== 'done' ? (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          <p>
            <strong>{rows.length}</strong> data row(s) found.
            {ignored.length ? <> Ignored columns: {ignored.join(', ')}.</> : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => run(false)} className={btnSecondary}>
              {busy && phase === 'idle' ? 'Checking…' : '1. Check rows'}
            </button>
            <button
              type="button"
              disabled={busy || phase !== 'checked' || (result?.valid ?? 0) === 0}
              onClick={() => run(true)}
              className={btnPrimary}
            >
              {busy && phase === 'checked' ? 'Importing…' : `2. Import ${result?.valid ?? ''} valid row(s)`}
            </button>
          </div>
          <p className="text-xs text-slate-500">Rows with errors are skipped. Nothing is saved until step 2.</p>
        </div>
      ) : null}

      {result?.error ? <p className="text-sm text-red-700">{result.error}</p> : null}

      {result && !result.error ? (
        <div className="space-y-3">
          <p className="text-sm">
            {phase === 'done' ? (
              <>
                <strong>Done.</strong> Created {result.created} person(s), assigned {result.assigned} tag(s).
                {errorCount ? ` ${errorCount} row(s) skipped.` : ''}
              </>
            ) : (
              <>
                {result.valid} row(s) ready, {errorCount} row(s) with errors.
              </>
            )}
          </p>
          <div className="max-h-[28rem] overflow-auto rounded-xl ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 bg-white">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className={th}>Line</th>
                  <th className={th}>Name</th>
                  <th className={th}>Tag</th>
                  <th className={th}>Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.lines.map((line) => (
                  <tr key={line.line}>
                    <td className={`${td} tabular-nums text-slate-500`}>{line.line}</td>
                    <td className={td}>{line.name || '—'}</td>
                    <td className={`${td} font-mono`}>{line.tagId || '—'}</td>
                    <td className={`${td} whitespace-normal ${LINE_STYLES[line.status]}`}>{line.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
