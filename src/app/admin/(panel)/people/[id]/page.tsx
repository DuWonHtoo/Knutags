import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PersonForm } from '@/components/PersonForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Card, EmptyState, Flash, PageHeader, StatusBadge, btnDanger, btnPrimary, btnSmall, inputClass, labelClass } from '@/components/ui';
import { deletePersonAction, updatePersonAction } from '@/lib/actions/people';
import { assignTagToPersonAction } from '@/lib/actions/tags';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { isUuid, param, type SearchParams } from '@/lib/params';
import { signedPhotoUrl } from '@/lib/photos';
import { db } from '@/lib/supabase';
import type { Person, Tag } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: 'Person' };
  const { data } = await db().from('people').select('full_name').eq('id', id).maybeSingle();
  return { title: (data as { full_name: string } | null)?.full_name ?? 'Person' };
}

export default async function PersonPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();

  const [personRes, tagsRes] = await Promise.all([
    db().from('people').select('*').eq('id', id).maybeSingle(),
    db()
      .from('tags')
      .select('id,status,scan_count,last_scanned_at,assigned_at')
      .eq('person_id', id)
      .order('assigned_at', { ascending: false, nullsFirst: false }),
  ]);
  if (personRes.error) throw new Error(personRes.error.message);
  const person = personRes.data as Person | null;
  if (!person) notFound();
  const tags = (tagsRes.data ?? []) as Pick<Tag, 'id' | 'status' | 'scan_count' | 'last_scanned_at' | 'assigned_at'>[];
  const photoUrl = await signedPhotoUrl(person.photo_path);

  return (
    <>
      <PageHeader
        title={person.full_name}
        subtitle={`Created ${formatDateTime(person.created_at)} · updated ${formatDateTime(person.updated_at)}`}
        actions={
          <Link href="/admin/people" className={btnSmall}>
            ← All people
          </Link>
        }
      />
      <Flash ok={param(sp, 'ok')} error={param(sp, 'error')} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card title="Profile" description="Tick “Public” for each field that should appear on the scanned profile page.">
          <PersonForm
            action={updatePersonAction.bind(null, person.id)}
            submitLabel="Save changes"
            initial={{
              full_name: person.full_name,
              details: person.details,
              public_fields: person.public_fields,
              admin_notes: person.admin_notes,
              photoUrl,
            }}
          />
        </Card>

        <div className="space-y-6">
          <Card title="Tags">
            {tags.length === 0 ? (
              <EmptyState>No tag yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {tags.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/admin/tags/${t.id}`} className="font-mono font-semibold underline underline-offset-2">
                      {t.id}
                    </Link>
                    <span className="text-xs tabular-nums text-slate-500">{t.scan_count} scans</span>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
            <form action={assignTagToPersonAction.bind(null, person.id)} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <div>
                <label htmlFor="tag_id" className={labelClass}>
                  Add an unassigned tag
                </label>
                <input
                  id="tag_id"
                  name="tag_id"
                  required
                  placeholder="Tag ID or scanned URL"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className={`${inputClass} font-mono`}
                />
              </div>
              {tags.some((t) => t.status === 'assigned') ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="deactivate_others" className="h-4 w-4 accent-slate-900" />
                  Deactivate their current tag(s) (replacement)
                </label>
              ) : null}
              <SubmitButton className={btnPrimary} pendingText="Assigning…">
                Assign tag
              </SubmitButton>
            </form>
          </Card>

          <Card title="Delete person">
            <p className="mb-3 text-sm text-slate-500">
              Permanently deletes this profile and photo. Their tags become inactive (scanning shows “no longer active”).
            </p>
            <form action={deletePersonAction.bind(null, person.id)}>
              <SubmitButton
                className={btnDanger}
                pendingText="Deleting…"
                confirmText={`Permanently delete ${person.full_name}? This cannot be undone.`}
              >
                Delete person
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
