import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { TagMessage } from '@/components/TagMessage';
import { NAME_KEY, PHOTO_KEY, PROFILE_FIELDS, fieldHref, prettyUrl, type ProfileField } from '@/lib/fields';
import { normalizeTagId } from '@/lib/ids';
import { lookupTag } from '@/lib/lookup';
import { signedPhotoUrl } from '@/lib/photos';
import type { TagStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

// Shown under the name instead of in the detail list.
const SUBTITLE_KEYS = new Set(['title', 'organization']);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = normalizeTagId((await params).id);
  if (!id) return { title: 'Tag not found' };
  try {
    const { lookup } = await lookupTag(id);
    if (lookup.result === 'ok' && lookup.tag.status === 'assigned' && lookup.person) {
      return { title: lookup.person.public_fields.includes(NAME_KEY) ? lookup.person.full_name : 'Profile' };
    }
  } catch {
    // The page itself renders the error state.
  }
  return { title: 'Tag' };
}

function AdminBar({ id, status }: { id: string; status: TagStatus }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-slate-900 px-4 py-2 text-xs text-white">
      <span>
        Admin view · tag <span className="font-mono">{id}</span> · {status}
      </span>
      <Link href={`/admin/tags/${id}`} className="rounded-md bg-white px-2.5 py-1 font-semibold text-slate-900">
        Manage tag
      </Link>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function FieldValue({ field, value }: { field: ProfileField; value: string }) {
  const href = fieldHref(field.type, value);
  if (!href) return <span className="break-words">{value}</span>;
  const external = field.type === 'url';
  return (
    <a
      href={href}
      className="break-words font-medium text-slate-900 underline decoration-slate-300 underline-offset-2"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
    >
      {field.type === 'url' ? prettyUrl(value) : value}
    </a>
  );
}

export default async function ProfilePage({ params }: Props) {
  const raw = (await params).id;
  const id = normalizeTagId(raw);
  if (!id) notFound();
  if (raw !== id) redirect(`/p/${id}`);

  const { lookup, admin } = await lookupTag(id);

  if (lookup.result === 'rate_limited') return <TagMessage kind="rate_limited" />;
  if (lookup.result === 'not_found') notFound();

  const status = lookup.tag.status;
  if (status === 'unassigned') {
    // An admin scanning a blank tag goes straight to the assignment screen.
    if (admin) redirect(`/admin/tags/${id}`);
    return <TagMessage kind="unassigned" />;
  }

  if (status !== 'assigned' || !lookup.person) {
    return (
      <>
        {admin ? <AdminBar id={id} status={status} /> : null}
        <TagMessage kind="inactive" />
      </>
    );
  }

  const person = lookup.person;
  const visible = new Set(person.public_fields);
  const showName = visible.has(NAME_KEY);
  const photoUrl = visible.has(PHOTO_KEY) && person.photo_path ? await signedPhotoUrl(person.photo_path) : null;

  const value = (key: string) => (visible.has(key) ? person.details[key]?.trim() || '' : '');
  const subtitle = PROFILE_FIELDS.filter((f) => SUBTITLE_KEYS.has(f.key))
    .map((f) => value(f.key))
    .filter(Boolean)
    .join(' · ');
  const rows = PROFILE_FIELDS.filter((f) => !SUBTITLE_KEYS.has(f.key) && f.type !== 'textarea' && value(f.key));
  const paragraphs = PROFILE_FIELDS.filter((f) => f.type === 'textarea' && value(f.key));

  return (
    <>
      {admin ? <AdminBar id={id} status={status} /> : null}
      <main className="flex min-h-dvh flex-col items-center px-4 py-8 sm:py-14">
        <article className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto h-36 w-36 overflow-hidden rounded-full bg-slate-100 ring-4 ring-white shadow">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={showName ? person.full_name : 'Profile photo'}
                width={144}
                height={144}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <div aria-hidden className="flex h-full w-full items-center justify-center text-4xl font-semibold text-slate-400">
                {showName ? initials(person.full_name) : '•'}
              </div>
            )}
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight">{showName ? person.full_name : 'Profile'}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}

          {rows.length ? (
            <dl className="mt-6 divide-y divide-slate-100 rounded-2xl bg-slate-50 text-left text-sm">
              {rows.map((field) => (
                <div key={field.key} className="px-4 py-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{field.label}</dt>
                  <dd className="mt-0.5 text-slate-800">
                    <FieldValue field={field} value={value(field.key)} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {paragraphs.map((field) => (
            <section key={field.key} className="mt-6 text-left">
              <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">{field.label}</h2>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{value(field.key)}</p>
            </section>
          ))}
        </article>
        <footer className="mt-6 text-xs text-slate-400">QR Profile</footer>
      </main>
    </>
  );
}
