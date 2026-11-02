# QR Profile

Laser-engraved QR tags that open a person's profile page.

- **Blank tags first.** Generate random tag IDs in batches and export them for BslCAD. Engrave them, then assign each tag to a person later by scanning it with your phone.
- **One URL per tag:** `https://YOUR-DOMAIN/p/{ID}`. What a scan shows depends on the tag:

  | Tag status | What a scan shows |
  | --- | --- |
  | `assigned` | the person's profile (only the fields marked **Public**) |
  | `unassigned` | a neutral "not set up yet" page (admins are sent to the assignment screen instead) |
  | `inactive` or `void` | "no longer active" |
  | unknown or malformed ID | "tag not found" |

**Tech:** Next.js 16 (TypeScript, App Router), Supabase (Postgres + Storage) and Tailwind CSS 4, deployed on Vercel. Besides Next and React there are only three runtime libraries (`@supabase/supabase-js`, `qrcode` and `sharp`); Tailwind is build-time only.

## Documents

| File | What it is |
| --- | --- |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step setup: Supabase, Vercel, domain, first login |
| [docs/BSLCAD.md](docs/BSLCAD.md) | Loading the export into BslCAD variable text, fallback plans, and steel engraving tips |
| [docs/TESTING.md](docs/TESTING.md) | Checklist: iPhone, Android, mobile data, inactive and unknown IDs |
| [supabase/schema.sql](supabase/schema.sql) | The complete database schema (run it once) |
| [.env.example](.env.example) | Every setting, explained |

## Assumptions made

1. **Domain:** set in `PUBLIC_BASE_URL`. Buy a **short** domain before engraving. A shorter URL means fewer QR modules, so small codes are easier to scan. Every engraved tag depends on that domain forever, so keep auto-renew on.
2. **Profile fields:** title, organization, phone, email, website, location, about and emergency contact. You can edit the list in `src/lib/fields.ts`; it's stored as JSON, so no database change is needed. Every field, including the name and photo, has its own **Public** checkbox. Phone, email, location and emergency contact start out hidden.
3. **Scale:** about 3,000 tags and people. Batches can hold up to 5,000 tags and imports up to 3,000 rows per file.
4. **Tag IDs:** 7 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (31 characters, with no 0, O, 1, I or L). That gives about 27.5 billion possible IDs, generated with the browser/Node crypto API (`crypto.getRandomValues`).
5. **Admin:** one admin password. A login stays valid for 30 days per device.
6. **Inactive vs. void:** an inactive tag keeps its link to the person, so you can reactivate it. A void tag is damaged or lost. Both show "no longer active" when scanned.
7. **Uppercase URLs (optional):** `QR_URL_UPPERCASE=true` exports `HTTPS://DOMAIN/P/ID`. That lets the QR use the denser alphanumeric mode, which helps 5 mm codes. It's off by default. Test it on the QR page before using it, and never change it after engraving.

## Folder structure

```
qr-profile/
├─ .env.example                 all settings, documented
├─ next.config.ts               security/noindex headers, /P/ → /p/ rewrite
├─ package.json
├─ postcss.config.mjs           Tailwind 4
├─ tsconfig.json
├─ docs/
│  ├─ BSLCAD.md                 engraving workflow + fallbacks
│  ├─ DEPLOYMENT.md             step-by-step deployment guide
│  └─ TESTING.md                testing checklist
├─ scripts/
│  └─ seed.mjs                  5 demo people + tags in every status
├─ supabase/
│  └─ schema.sql                tables, views, functions, permissions, storage bucket
└─ src/
   ├─ app/
   │  ├─ layout.tsx, globals.css, page.tsx, not-found.tsx, robots.ts, icon.svg
   │  ├─ p/[id]/                public profile page (+ not-found, error)
   │  ├─ admin/
   │  │  ├─ login/page.tsx      password login
   │  │  └─ (panel)/            everything behind the login
   │  │     ├─ layout.tsx       auth check + navigation
   │  │     ├─ page.tsx         dashboard, "open tag", recent scans
   │  │     ├─ tags/            tag list + tag screen (assign/edit/deactivate/reassign/void)
   │  │     ├─ people/          search/filter, new, edit, delete
   │  │     ├─ batches/         generate, export, mark engraved, void pieces
   │  │     ├─ import/          bulk CSV import (check, then import)
   │  │     └─ qr/              QR preview & test sheet (5/7/10 mm × L/M/Q/H)
   │  └─ api/admin/
   │     ├─ batches/[id]/export CSV / TXT / DXF sheet downloads
   │     └─ tags/[id]/qr        single-tag SVG / DXF
   ├─ components/               UI pieces (forms, tables, QR tester, import)
   └─ lib/
      ├─ actions/               server actions (auth, batches, tags, people, import)
      ├─ auth.ts                signed-cookie admin session, IP hashing
      ├─ csv.ts                 CSV parse/write
      ├─ env.ts                 configuration
      ├─ fields.ts              ← profile fields: edit here
      ├─ ids.ts                 tag ID alphabet, generation, URLs
      ├─ lookup.ts              public lookup (one DB round trip)
      ├─ photos.ts              EXIF stripping (sharp) + private storage
      ├─ qr-vector.ts           QR → SVG / DXF, module size rating
      └─ …                      small helpers
```

## Quick start (local)

You need Node.js 20.9 or newer, plus a Supabase project with `supabase/schema.sql` already run. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for setting that up.

```bash
npm install
```

```bash
copy .env.example .env.local
```

Edit `.env.local`, then:

```bash
npm run seed
```

```bash
npm run dev
```

Open http://localhost:3000/admin and log in with `ADMIN_PASSWORD`. The seed prints test URLs for each tag status. `npm run seed:reset` removes the demo data.

## Daily workflow

1. **Batches → Generate.** Enter a label and quantity.
2. **Export.** Download the TXT or CSV and load it into BslCAD (see [docs/BSLCAD.md](docs/BSLCAD.md)). Engrave a test piece first.
3. **Mark as engraved.** Void damaged pieces by entering their position number or ID.
4. **Assign.** Log in to `/admin` once on your phone. Then scan a blank tag with the camera; it opens the assignment screen. Fill in the person's details, take or choose a photo, and save. The profile is live immediately.
5. **Later.** Edit, deactivate, reassign, release or void tags from the tag screen or the person's page.

## Security summary

- **Random IDs only.** IDs are never sequential, and unknown-ID lookups are rate limited: 20 misses per 10 minutes per IP, plus 60 lookups per minute (configurable).
- **Public visitors can only read.** All writes happen in admin-only server actions. Each one checks the signed session cookie itself, so nothing relies on middleware. Supabase Row Level Security is on with no policies, and the anon key is never used. Unassigned tags can't be claimed by the public.
- **Secrets stay on the server.** They live only in environment variables, none of them start with `NEXT_PUBLIC_`, and the service key never reaches the browser.
- **Photos are private.** They're re-encoded on the server (EXIF/GPS removed), stored in a private bucket, and shown only through 1-hour signed URLs while the tag is assigned and the photo is marked public.
- **Nothing is indexed.** Every response sends `X-Robots-Tag: noindex` plus a robots meta tag, `Referrer-Policy: no-referrer` and `X-Frame-Options: DENY`.
- **Admin logins are rate limited:** 10 attempts per 15 minutes per IP.
