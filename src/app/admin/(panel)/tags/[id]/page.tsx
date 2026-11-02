import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PersonForm } from '@/components/PersonForm';
import { SubmitButton } from '@/components/SubmitButton';
import {
  Card,
  EmptyState,
  Flash,
  PageHeader,
  StatusBadge,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSmall,
  inputClass,
  linkClass,
} from '@/components/ui';
import {
  assignExistingPersonAction,
  assignNewPersonAction,
  deactivateTagAction,
  reactivateTagAction,
  releaseTagAction,
  restoreTagAction,
  voidTagAction,
} from '@/lib/actions/tags';
import { requireAdmin } from '@/lib/auth';
import { env } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { normalizeTagId, tagUrl } from '@/lib/ids';
import { ilikePattern, param, type SearchParams } from '@/lib/params';
import { signedPhotoUrl } from '@/lib/photos';
import { makeMatrix, qrSvg } from '@/lib/qr-vector';
import { db } from '@/lib/supabase';
import type { Person, PersonOverview, Tag, TagStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Tag ${normalizeTagId((await params).id) ?? ''}` };
}

type Candidate = Pick<PersonOverview, 'id' | 'full_name' | 'details' | 'tags' | 'assigned_count'>;

function ExistingPersonPicker({
  tagId,
  status,
  q,
  candidates,
  currentPersonId,
}: {
  tagId: string;
  status: TagStatus;
  q: string;
  candidates: Candidate[];
  currentPersonId: string | null;
}) {
  return (
    <div id="existing" className="scroll-mt-24">
      <form method="get" action={`/admin/tags/${tagId}#existing`} className="flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} placeholder="Search name, company, email or tag ID" className={inputClass} />
        <button type="submit" className={btnSecondary}>
          Search
        </button>
      </form>
      {q ? (
        candidates.length === 0 ? (
          <div className="mt-3">
            <EmptyState>No one found for “{q}”.</EmptyState>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {candidates.map((p) => {
              const isCurrent = p.id === currentPersonId;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-slate-500">
                      {[p.details.title, p.details.organization].filter(Boolean).join(' · ') || '—'}
                      {p.tags.length ? <> · tags: {p.tags.map((t) => `${t.id} (${t.status})`).join(', ')}</> : null}
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="text-xs text-slate-500">Already linked</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <form action={assignExistingPersonAction.bind(null, tagId, status, p.id, false)}>
                        <SubmitButton className={btnSmall} pendingText="Assigning…">
                          Assign
                        </SubmitButton>
                      </form>
                      {p.assigned_count > 0 ? (
                        <form action={assignExistingPersonAction.bind(null, tagId, status, p.id, true)}>
                          <SubmitButton className={btnSmall} pendingText="Assigning…">
                            Assign &amp; deactivate their old tag
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}

export default async function TagPage({ params, searchParams }: Props) {
  await requireAdmin();
  const raw = (await params).id;
  const sp = await searchParams;
  const id = normalizeTagId(raw);
  if (!id) notFound();
  if (raw !== id) redirect(`/admin/tags/${id}`);

  const { data: tagData, error } = await db()
    .from('tags')
    .select('*, batch:batches(id,label,engraved_at)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!tagData) {
    return (
      <>
        <PageHeader title={<span className="font-mono">{id}</span>} />
        <Card>
          <EmptyState>
            This tag ID does not exist in the database. It was never generated here, or it was typed incorrectly.
          </EmptyState>
        </Card>
      </>
    );
  }

  const tag = tagData as Tag & { batch: { id: string; label: string; engraved_at: string | null } | null };
  const person = tag.person_id
    ? ((await db().from('people').select('*').eq('id', tag.person_id).maybeSingle()).data as Person | null)
    : null;
  const photoUrl = await signedPhotoUrl(person?.photo_path);

  const url = tagUrl(env.publicBaseUrl, id, env.qrUppercase);
  const qr = qrSvg(makeMatrix(url, 'M'), { width: '128' });

  const q = param(sp, 'q').trim();
  let candidates: Candidate[] = [];
  const pattern = q ? ilikePattern(q) : null;
  if (pattern) {
    const { data } = await db()
      .from('people_overview')
      .select('id,full_name,details,tags,assigned_count')
      .or(`search_text.ilike.${pattern},tag_ids.ilike.${pattern}`)
      .order('full_name')
      .limit(10);
    candidates = (data ?? []) as Candidate[];
  }

  const canAssign = tag.status !== 'void';
  const reassigning = tag.status === 'assigned' || tag.status === 'inactive';

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{id}</span>
            <StatusBadge status={tag.status} />
          </span>
        }
        subtitle={
          <>
            {tag.batch ? (
              <Link href={`/admin/batches/${tag.batch.id}`} className={linkClass}>
                {tag.batch.label}
              </Link>
            ) : null}{' '}
            · position #{tag.batch_seq} · {tag.scan_count} scan(s) · last scan {formatDateTime(tag.last_scanned_at)}
          </>
        }
      />
      <Flash ok={param(sp, 'ok')} error={param(sp, 'error')} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {tag.status === 'unassigned' ? (
            <>
              <Card title="Assign to a new person" description="Fill in the details and add a photo. The profile goes live immediately.">
                <PersonForm action={assignNewPersonAction.bind(null, id, tag.status)} submitLabel="Create & assign tag" />
              </Card>
              <Card title="…or assign to someone already in the system" description="For example a replacement for a lost tag.">
                <ExistingPersonPicker tagId={id} status={tag.status} q={q} candidates={candidates} currentPersonId={null} />
              </Card>
            </>
          ) : null}

          {reassigning ? (
            <Card title={tag.status === 'assigned' ? 'Assigned to' : 'Inactive'}>
              {person ? (
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                    {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold">{person.full_name}</div>
                    <div className="text-sm text-slate-500">
                      {[person.details.title, person.details.organization].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link href={`/admin/people/${person.id}`} className={btnSmall}>
                        Edit person
                      </Link>
                      <Link href={`/p/${id}`} className={btnSmall}>
                        View public page
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No person is linked to this tag any more.</p>
              )}

              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {tag.status === 'assigned' ? (
                  <form action={deactivateTagAction.bind(null, id)}>
                    <SubmitButton className={btnSecondary} pendingText="Deactivating…">
                      Deactivate
                    </SubmitButton>
                  </form>
                ) : null}
                {tag.status === 'inactive' && person ? (
                  <form action={reactivateTagAction.bind(null, id)}>
                    <SubmitButton className={btnPrimary} pendingText="Reactivating…">
                      Reactivate
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Deactivated tags show “no longer active” when scanned and keep the link to the person so you can reactivate.
              </p>
            </Card>
          ) : null}

          {reassigning && canAssign ? (
            <Card title="Reassign this tag" description="Give this physical tag to a different person.">
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold">Choose an existing person</summary>
                <div className="mt-3">
                  <ExistingPersonPicker
                    tagId={id}
                    status={tag.status}
                    q={q}
                    candidates={candidates}
                    currentPersonId={tag.person_id}
                  />
                </div>
              </details>
              <details className="mt-4 border-t border-slate-100 pt-4">
                <summary className="cursor-pointer text-sm font-semibold">Create a new person for this tag</summary>
                <div className="mt-4">
                  <PersonForm action={assignNewPersonAction.bind(null, id, tag.status)} submitLabel="Create & reassign tag" />
                </div>
              </details>
            </Card>
          ) : null}

          {tag.status === 'void' ? (
            <Card title="Void" description="This tag was marked as damaged or destroyed. Scanning it shows “no longer active”.">
              <form action={restoreTagAction.bind(null, id)}>
                <SubmitButton className={btnSecondary} pendingText="Restoring…" confirmText="Restore this tag to unassigned?">
                  Restore to unassigned
                </SubmitButton>
              </form>
            </Card>
          ) : null}

          {tag.status !== 'void' ? (
            <Card title="Danger zone">
              <div className="flex flex-wrap gap-2">
                {reassigning ? (
                  <form action={releaseTagAction.bind(null, id)}>
                    <SubmitButton
                      className={btnSecondary}
                      pendingText="Releasing…"
                      confirmText="Remove the person from this tag and make it unassigned? The person is not deleted."
                    >
                      Release (make unassigned)
                    </SubmitButton>
                  </form>
                ) : null}
                <form action={voidTagAction.bind(null, id)}>
                  <SubmitButton
                    className={btnDanger}
                    pendingText="Voiding…"
                    confirmText="Mark this tag as void (damaged/lost)? Scanning it will show “no longer active”."
                  >
                    Void tag
                  </SubmitButton>
                </form>
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card title="QR code">
            <div className="mx-auto w-32" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-3 break-all text-center font-mono text-xs text-slate-600">{url}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <a className={btnSmall} href={`/api/admin/tags/${id}/qr?format=svg&size=10&ec=M`}>
                SVG 10 mm
              </a>
              <a className={btnSmall} href={`/api/admin/tags/${id}/qr?format=dxf&size=10&ec=M`}>
                DXF 10 mm
              </a>
              <Link className={btnSmall} href={`/p/${id}`}>
                Open page
              </Link>
            </div>
          </Card>
          <Card title="History">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Created</dt>
                <dd>{formatDateTime(tag.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Engraved</dt>
                <dd>{tag.batch?.engraved_at ? formatDateTime(tag.batch.engraved_at) : 'not marked'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Assigned</dt>
                <dd>{formatDateTime(tag.assigned_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Status changed</dt>
                <dd>{formatDateTime(tag.status_changed_at)}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}
