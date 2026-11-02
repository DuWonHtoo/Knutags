import Link from 'next/link';
import { Pagination } from '@/components/Pagination';
import { Card, EmptyState, Flash, PageHeader, StatusBadge, TableWrap, btnPrimary, inputClass, td, th } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { ilikePattern, pageParam, param, type SearchParams } from '@/lib/params';
import { signedPhotoUrls } from '@/lib/photos';
import { db } from '@/lib/supabase';
import type { PersonOverview } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'People' };

const PAGE_SIZE = 50;
const TAG_FILTERS = {
  '': 'Any tag status',
  active: 'Has an active tag',
  inactive: 'Only inactive tags',
  none: 'No tag',
} as const;
const PHOTO_FILTERS = { '': 'Photo: any', with: 'With photo', without: 'Without photo' } as const;

type Row = Pick<PersonOverview, 'id' | 'full_name' | 'details' | 'photo_path' | 'tags' | 'updated_at'>;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp, 'q').trim();
  const tagFilter = (param(sp, 'tags') in TAG_FILTERS ? param(sp, 'tags') : '') as keyof typeof TAG_FILTERS;
  const photoFilter = (param(sp, 'photo') in PHOTO_FILTERS ? param(sp, 'photo') : '') as keyof typeof PHOTO_FILTERS;
  const page = pageParam(sp);

  let query = db()
    .from('people_overview')
    .select('id,full_name,details,photo_path,tags,updated_at', { count: 'exact' });
  const pattern = ilikePattern(q);
  if (pattern) query = query.or(`search_text.ilike.${pattern},tag_ids.ilike.${pattern}`);
  if (tagFilter === 'active') query = query.gt('assigned_count', 0);
  if (tagFilter === 'inactive') query = query.eq('assigned_count', 0).gt('inactive_count', 0);
  if (tagFilter === 'none') query = query.eq('assigned_count', 0).eq('inactive_count', 0);
  if (photoFilter === 'with') query = query.not('photo_path', 'is', null);
  if (photoFilter === 'without') query = query.is('photo_path', null);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.order('full_name').range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const photos = await signedPhotoUrls(rows.flatMap((r) => (r.photo_path ? [r.photo_path] : [])));

  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${count ?? 0} matching`}
        actions={
          <Link href="/admin/people/new" className={btnPrimary}>
            New person
          </Link>
        }
      />
      <Flash ok={param(sp, 'ok')} error={param(sp, 'error')} />

      <Card className="mb-6">
        <form method="get" className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input name="q" defaultValue={q} placeholder="Name, title, company, email, phone, tag ID…" className={inputClass} />
          <select name="tags" defaultValue={tagFilter} className={inputClass}>
            {Object.entries(TAG_FILTERS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select name="photo" defaultValue={photoFilter} className={inputClass}>
            {Object.entries(PHOTO_FILTERS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className={btnPrimary}>
            Search
          </button>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState>No people found.</EmptyState>
        ) : (
          <TableWrap>
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className={th}>Name</th>
                  <th className={th}>Title · Organization</th>
                  <th className={th}>Tags</th>
                  <th className={th}>Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => {
                  const photo = p.photo_path ? photos.get(p.photo_path) : undefined;
                  return (
                    <tr key={p.id}>
                      <td className={td}>
                        <Link href={`/admin/people/${p.id}`} className="flex items-center gap-3 font-medium">
                          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                            {photo ? <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                          </span>
                          <span className="underline decoration-slate-300 underline-offset-2">{p.full_name}</span>
                        </Link>
                      </td>
                      <td className={`${td} text-slate-600`}>
                        {[p.details.title, p.details.organization].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className={td}>
                        <div className="flex flex-wrap gap-1.5">
                          {p.tags.length === 0 ? <span className="text-slate-400">none</span> : null}
                          {p.tags.map((t) => (
                            <Link key={t.id} href={`/admin/tags/${t.id}`} className="inline-flex items-center gap-1">
                              <span className="font-mono text-xs">{t.id}</span>
                              <StatusBadge status={t.status} />
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className={`${td} text-slate-500`}>{formatDate(p.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pagination
          basePath="/admin/people"
          params={{ q, tags: tagFilter, photo: photoFilter }}
          page={page}
          pageSize={PAGE_SIZE}
          total={count ?? 0}
        />
      </Card>
    </>
  );
}
