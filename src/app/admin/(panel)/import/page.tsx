import { ImportClient } from '@/components/ImportClient';
import { Card, PageHeader } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { DEFAULT_PUBLIC_FIELDS, PROFILE_FIELDS } from '@/lib/fields';
import { MAX_IMPORT_ROWS } from '@/lib/import-types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Import' };

export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Bulk import" subtitle={`Create many people from a CSV file (max ${MAX_IMPORT_ROWS} rows per file).`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <ImportClient />
        </Card>
        <Card title="File format">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>
              First row = column names. Required: <code>full_name</code>.
            </li>
            <li>
              Optional: <code>tag_id</code> (an <em>unassigned</em> tag ID or its URL),{' '}
              {PROFILE_FIELDS.map((f) => (
                <code key={f.key} className="mr-1">
                  {f.key}
                </code>
              ))}
              , <code>admin_notes</code>.
            </li>
            <li>
              <code>public</code>: fields to show publicly, separated by <code>|</code>. Empty = default (
              {DEFAULT_PUBLIC_FIELDS.join(', ')}).
            </li>
            <li>Comma or semicolon separated; UTF-8 (Excel: “CSV UTF-8”).</li>
            <li>Photos are added afterwards on each person’s page.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
