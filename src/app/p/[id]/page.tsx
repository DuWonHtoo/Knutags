import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
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

// Outline icons (24×24, stroke = currentColor). Always shown next to a visible text label.
const ICON_PATHS: Record<string, ReactNode> = {
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
};

function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof ICON_PATHS; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const focusRing =
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-knu-blue';

function DetailRow({ field, value }: { field: ProfileField; value: string }) {
  const href = fieldHref(field.type, value);
  const content = (
    <>
      <span className="min-w-0">
        <span className="block text-[13px] leading-tight text-slate-500">{field.label}</span>
        <span className="block font-semibold [overflow-wrap:anywhere] text-slate-900">
          {field.type === 'url' ? prettyUrl(value) : value}
        </span>
      </span>
    </>
  );
  const rowClass = 'flex min-h-14 items-center gap-3.5 rounded-xl p-2';
  if (!href) return <div className={rowClass}>{content}</div>;
  return (
    <a
      href={href}
      className={`${rowClass} transition-colors hover:bg-knu-tint ${focusRing}`}
      {...(field.type === 'url' ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
    >
      {content}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="ml-auto h-[18px] w-[18px] flex-none text-slate-400">
        <path d="m9 6 6 6-6 6" />
      </svg>
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
  const rank = value('rank');
  const title = value('title');
  const organization = value('organization');
  const phoneHref = fieldHref('tel', value('phone'));
  const emailHref = fieldHref('email', value('email'));
  const rows = PROFILE_FIELDS.filter((f) => !HEADER_KEYS.has(f.key) && f.type !== 'textarea' && value(f.key));
  const paragraphs = PROFILE_FIELDS.filter((f) => f.type === 'textarea' && value(f.key));
  const name = showName ? person.full_name : 'Profile';

  const actions = [
    phoneHref ? { href: phoneHref, label: 'Call', icon: 'phone' as const, primary: true } : null,
    emailHref ? { href: emailHref, label: 'Email', icon: 'email' as const, primary: !phoneHref } : null,
  ].filter((a) => a !== null);

  return (
    <>
      {admin ? <AdminBar id={id} status={status} /> : null}
      <main className="min-h-dvh bg-knu-bg px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[420px]">
          <article
            aria-labelledby="name"
            className="overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(15,23,42,.06),0_8px_24px_rgba(26,59,133,.08)]"
          >
            {/* Karen flag behind the profile, shown in full */}
            <div aria-hidden="true" className="relative aspect-[9/5] overflow-hidden">
              <KarenFlag decorative className="absolute inset-0 h-full w-full" />
            </div>

            <div className="px-5 pb-5 text-center">
              <div className="relative z-[1] mx-auto -mt-[60px] h-[120px] w-[120px] overflow-hidden rounded-full border-4 border-white bg-knu-tint">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={showName ? `Photo of ${person.full_name}` : 'Profile photo'}
                    width={120}
                    height={120}
                    fetchPriority="high"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div aria-hidden="true" className="flex h-full w-full items-center justify-center font-heading text-4xl font-semibold text-knu-blue/60">
                    {showName ? initials(person.full_name) : '•'}
                  </div>
                )}
              </div>

              {rank ? (
                <p className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-knu-tint py-[5px] pr-3 pl-2.5 font-heading text-xs font-semibold tracking-[.08em] text-knu-blue uppercase">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5 flex-none">
                    <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" />
                  </svg>
                  <span className="sr-only">Rank: </span>
                  {rank}
                </p>
              ) : null}

              <h1
                id="name"
                className={`${rank ? 'mt-2' : 'mt-3.5'} font-heading text-[1.625rem] leading-tight font-semibold tracking-[-0.01em] text-balance text-slate-900`}
              >
                {name}
              </h1>
              {title ? <p className="mt-1 text-slate-600">{title}</p> : null}
              {organization ? <p className="mt-0.5 font-semibold text-knu-blue">{organization}</p> : null}
            </div>

            {actions.length ? (
              <nav aria-label={`Contact ${name}`} className={`grid gap-2 px-5 pb-5 ${actions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {actions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-[14px] text-sm font-semibold transition-[background-color,transform] duration-200 active:scale-[.97] motion-reduce:transition-none ${focusRing} ${
                      action.primary
                        ? 'bg-knu-blue text-white hover:bg-knu-blue-dark'
                        : 'bg-knu-tint text-knu-blue hover:bg-[#e2e9f7]'
                    }`}
                  >
                    <Icon name={action.icon} className="h-[22px] w-[22px]" />
                    {action.label}
                  </a>
                ))}
              </nav>
            ) : null}

            {rows.length ? (
              <div className="border-t border-knu-line px-3 py-2">
                {rows.map((field) => (
                  <DetailRow key={field.key} field={field} value={value(field.key)} />
                ))}
              </div>
            ) : null}

            {paragraphs.map((field) => (
              <section key={field.key} className="border-t border-knu-line px-5 pt-4 pb-5">
                <h2 className="mb-2 font-heading text-[13px] font-semibold tracking-[.06em] text-slate-500 uppercase">
                  {field.label}
                </h2>
                <p className="whitespace-pre-line text-slate-900">{value(field.key)}</p>
              </section>
            ))}
          </article>

          <footer className="mt-[18px] flex items-center justify-center gap-1.5 text-[13px] text-slate-500">
            <KarenFlag className="h-[15px] w-[27px] rounded-[2px] shadow-[0_0_0_1px_#e3e8f2]" />
            <span>
              ID <span className="font-mono tracking-[.04em]">{id}</span>
            </span>
          </footer>
        </div>
      </main>
    </>
  );
}
