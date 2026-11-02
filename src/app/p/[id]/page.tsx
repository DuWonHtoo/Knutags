import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { KarenFlag } from '@/components/KarenFlag';
import { TagMessage } from '@/components/TagMessage';
import { NAME_KEY, PHOTO_KEY, PROFILE_FIELDS, fieldHref, prettyUrl, type ProfileField } from '@/lib/fields';
import { normalizeTagId } from '@/lib/ids';
import { lookupTag } from '@/lib/lookup';
import { signedPhotoUrl } from '@/lib/photos';
import type { TagStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

// Fields shown in the header instead of the detail list.
const HEADER_KEYS = new Set(['rank', 'title', 'organization']);

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
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-knu-blue-dark px-4 py-2 text-xs text-white">
      <span>
        Admin view · tag <span className="font-mono">{id}</span> · {status}
      </span>
      <Link href={`/admin/tags/${id}`} className="rounded-md bg-white px-2.5 py-1 font-semibold text-knu-blue">
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

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-knu-blue';

/** One detail line: label above value. Tappable values are blue instead of carrying an arrow. */
function DetailRow({ field, value }: { field: ProfileField; value: string }) {
  const href = fieldHref(field.type, value);
  const text = field.type === 'url' ? prettyUrl(value) : value;
  return (
    <div className="border-b border-knu-line px-5 py-3">
      <dt className="text-sm text-slate-500">{field.label}</dt>
      <dd className="mt-0.5 [overflow-wrap:anywhere]">
        {href ? (
          <a
            href={href}
            className={`font-semibold text-knu-blue underline decoration-knu-blue/25 underline-offset-4 hover:decoration-knu-blue ${focusRing}`}
            {...(field.type === 'url' ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
          >
            {text}
          </a>
        ) : (
          <span className="font-semibold text-slate-900">{text}</span>
        )}
      </dd>
    </div>
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
  const rank = value('rank');
  const title = value('title');
  const organization = value('organization');
  const phoneHref = fieldHref('tel', value('phone'));
  const emailHref = fieldHref('email', value('email'));
  const rows = PROFILE_FIELDS.filter((f) => !HEADER_KEYS.has(f.key) && f.type !== 'textarea' && value(f.key));
  const paragraphs = PROFILE_FIELDS.filter((f) => f.type === 'textarea' && value(f.key));
  const name = showName ? person.full_name : 'Profile';

  const actions = [
    phoneHref ? { href: phoneHref, label: 'Call', primary: true } : null,
    emailHref ? { href: emailHref, label: 'Email', primary: !phoneHref } : null,
  ].filter((a) => a !== null);

  return (
    <>
      {admin ? <AdminBar id={id} status={status} /> : null}
      <main className="min-h-dvh bg-white pb-[max(32px,env(safe-area-inset-bottom))]">
        <article aria-labelledby="name" className="mx-auto max-w-[480px]">
          {/* Karen flag across the full width, shown in full */}
          <div aria-hidden="true" className="relative aspect-[9/5] overflow-hidden">
            <KarenFlag decorative className="absolute inset-0 h-full w-full" />
          </div>

          <header className="px-5">
            <div className="relative z-[1] -mt-14 h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-knu-tint">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={showName ? `Photo of ${person.full_name}` : 'Profile photo'}
                  width={112}
                  height={112}
                  fetchPriority="high"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div aria-hidden="true" className="flex h-full w-full items-center justify-center font-heading text-3xl font-semibold text-knu-blue/60">
                  {showName ? initials(person.full_name) : '•'}
                </div>
              )}
            </div>

            {rank ? (
              <p className="mt-4 font-heading text-[15px] font-semibold text-knu-blue">
                <span className="sr-only">Rank: </span>
                {rank}
              </p>
            ) : null}
            <h1
              id="name"
              className={`${rank ? 'mt-0.5' : 'mt-4'} font-heading text-[1.75rem] leading-tight font-semibold tracking-[-0.01em] text-balance text-slate-900`}
            >
              {name}
            </h1>
            {title ? <p className="mt-1 text-slate-600">{title}</p> : null}
            {organization ? <p className="text-slate-600">{organization}</p> : null}

            <p className="mt-3 text-sm text-slate-500">
              ID <span className="ml-1 font-mono text-[15px] font-semibold tracking-[.06em] text-slate-900">{id}</span>
            </p>

            {actions.length ? (
              <nav aria-label={`Contact ${name}`} className={`mt-5 grid gap-2 ${actions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {actions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className={`flex h-12 items-center justify-center rounded-lg text-[15px] font-semibold transition-colors ${focusRing} ${
                      action.primary
                        ? 'bg-knu-blue text-white hover:bg-knu-blue-dark'
                        : 'border border-knu-blue text-knu-blue hover:bg-knu-tint'
                    }`}
                  >
                    {action.label}
                  </a>
                ))}
              </nav>
            ) : null}
          </header>

          {rows.length ? (
            <dl className="mt-6 border-t border-knu-line">
              {rows.map((field) => (
                <DetailRow key={field.key} field={field} value={value(field.key)} />
              ))}
            </dl>
          ) : null}

          {paragraphs.map((field) => (
            <section key={field.key} className="px-5 pt-5">
              <h2 className="text-sm text-slate-500">{field.label}</h2>
              <p className="mt-1 whitespace-pre-line text-slate-900">{value(field.key)}</p>
            </section>
          ))}
        </article>
      </main>
    </>
  );
}
