// Seed script: creates a small demo batch with 5 demo people so you can test
// every state of a tag. Run with:   npm run seed
// Remove the demo data again with:  npm run seed:reset
//
// Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_BASE_URL (and optional
// PHOTO_BUCKET) from .env.local. All people, emails and phone numbers are fictional.

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BATCH_LABEL = 'DEMO (seed data)';
const SEED_NOTE = 'Demo person created by scripts/seed.mjs';
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function need(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Fill in .env.local first (see .env.example).`);
    process.exit(1);
  }
  return value;
}

const db = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const base = need('PUBLIC_BASE_URL').replace(/\/+$/, '');
const bucket = process.env.PHOTO_BUCKET?.trim() || 'photos';
const upper = process.env.QR_URL_UPPERCASE?.trim().toLowerCase() === 'true';
const url = (id) => (upper ? `${base}/P/${id}`.toUpperCase() : `${base}/p/${id}`);

function randomId() {
  const limit = 256 - (256 % ALPHABET.length);
  let id = '';
  while (id.length < 7) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < limit && id.length < 7) id += ALPHABET[b % ALPHABET.length];
    }
  }
  return id;
}

function searchText(fullName, details, notes) {
  return [fullName, ...Object.values(details), notes ?? '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const PEOPLE = [
  {
    full_name: 'Amara Okafor',
    colors: ['#0ea5e9', '#1e3a8a'],
    details: {
      title: 'Site Safety Manager',
      organization: 'Northbridge Construction',
      phone: '+1 555 0101',
      email: 'amara.okafor@example.com',
      website: 'northbridge.example.com',
      location: 'Denver, CO',
      bio: 'Responsible for safety inductions and first aid on site. Ask me about access permits.',
      emergency_contact: 'Chidi Okafor (brother) +1 555 0111',
    },
    public_fields: ['full_name', 'photo', 'title', 'organization', 'phone', 'email', 'website', 'bio'],
  },
  {
    full_name: 'Lukas Brandt',
    colors: ['#f97316', '#7c2d12'],
    details: {
      title: 'Lead Electrician',
      organization: 'Northbridge Construction',
      phone: '+1 555 0102',
      email: 'lukas.brandt@example.com',
      location: 'Boulder, CO',
      bio: 'Licensed master electrician. Photo hidden on purpose to demonstrate the hidden flag.',
    },
    // photo exists but is hidden
    public_fields: ['full_name', 'title', 'organization', 'bio'],
  },
  {
    full_name: 'Mei Tanaka',
    colors: ['#10b981', '#064e3b'],
    details: {
      title: 'Field Engineer',
      organization: 'Tanaka Surveying',
      phone: '+1 555 0103',
      email: 'mei@tanaka-surveying.example.com',
      website: 'https://tanaka-surveying.example.com',
      emergency_contact: 'Hiro Tanaka (spouse) +1 555 0113',
    },
    public_fields: ['full_name', 'photo', 'title', 'organization', 'website'],
  },
  {
    full_name: 'Diego Ramírez',
    colors: ['#a855f7', '#3b0764'],
    details: {
      title: 'Crane Operator',
      organization: 'Ramírez Heavy Lift',
      phone: '+1 555 0104',
      location: 'Pueblo, CO',
      bio: 'Certified for mobile and tower cranes up to 120 t.',
      emergency_contact: 'Lucía Ramírez (mother) +1 555 0114',
    },
    // emergency contact public: e.g. for lone-worker tags
    public_fields: ['full_name', 'photo', 'title', 'organization', 'phone', 'bio', 'emergency_contact'],
  },
  {
    full_name: 'Priya Nair',
    colors: ['#ef4444', '#7f1d1d'],
    details: {
      title: 'Quality Inspector',
      organization: 'Northbridge Construction',
      email: 'priya.nair@example.com',
      bio: 'Lost her first tag; it was deactivated and replaced (see the inactive demo tag).',
    },
    public_fields: ['full_name', 'photo', 'title', 'organization', 'email', 'bio'],
  },
];

async function avatar(name, [c1, c2]) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <circle cx="300" cy="250" r="110" fill="rgba(255,255,255,0.25)"/>
    <ellipse cx="300" cy="560" rx="210" ry="170" fill="rgba(255,255,255,0.25)"/>
    <text x="300" y="275" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="700"
      fill="#ffffff" text-anchor="middle">${initials}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function fail(what, error) {
  console.error(`${what}: ${error?.message ?? error}`);
  process.exit(1);
}

async function reset() {
  const { data: batch } = await db.from('batches').select('id').eq('label', BATCH_LABEL).maybeSingle();
  const { data: people } = await db.from('people').select('id,photo_path').eq('admin_notes', SEED_NOTE);
  const personIds = (people ?? []).map((p) => p.id);
  if (personIds.length) {
    const { error } = await db
      .from('tags')
      .update({ status: 'inactive', person_id: null })
      .in('person_id', personIds);
    if (error) await fail('Unlinking demo tags failed', error);
  }
  if (batch) {
    const { error } = await db.from('tags').delete().eq('batch_id', batch.id);
    if (error) await fail('Deleting demo tags failed', error);
    await db.from('batches').delete().eq('id', batch.id);
  }
  if (personIds.length) {
    const paths = people.map((p) => p.photo_path).filter(Boolean);
    if (paths.length) await db.storage.from(bucket).remove(paths);
    await db.from('people').delete().in('id', personIds);
  }
  console.log(`Removed demo batch${batch ? '' : ' (none found)'} and ${personIds.length} demo people.`);
}

async function seed() {
  const { data: existing, error: existingError } = await db
    .from('batches')
    .select('id')
    .eq('label', BATCH_LABEL)
    .maybeSingle();
  if (existingError) await fail('Could not reach the database (did you run supabase/schema.sql?)', existingError);
  if (existing) {
    console.log('Demo data already exists. Current demo tags:\n');
    const { data: tags } = await db
      .from('tags')
      .select('id,batch_seq,status,person:people(full_name)')
      .eq('batch_id', existing.id)
      .order('batch_seq');
    printTable(tags ?? []);
    console.log('\nRun "npm run seed:reset" first to recreate it.');
    return;
  }

  const { data: batch, error: batchError } = await db
    .from('batches')
    .insert({ label: BATCH_LABEL, quantity: 9, notes: 'Created by scripts/seed.mjs — safe to remove with npm run seed:reset' })
    .select('id')
    .single();
  if (batchError) await fail('Creating batch failed', batchError);

  const ids = new Set();
  while (ids.size < 9) ids.add(randomId());
  const tagIds = [...ids];
  const { error: tagError } = await db
    .from('tags')
    .insert(tagIds.map((id, i) => ({ id, batch_id: batch.id, batch_seq: i + 1 })));
  if (tagError) await fail('Creating tags failed', tagError);

  const personIds = [];
  for (const p of PEOPLE) {
    const photoPath = `${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(photoPath, await avatar(p.full_name, p.colors), { contentType: 'image/jpeg' });
    if (uploadError) await fail(`Photo upload failed (does the "${bucket}" bucket exist?)`, uploadError);

    const { data, error } = await db
      .from('people')
      .insert({
        full_name: p.full_name,
        details: p.details,
        public_fields: p.public_fields,
        photo_path: photoPath,
        admin_notes: SEED_NOTE,
        search_text: searchText(p.full_name, p.details, SEED_NOTE),
      })
      .select('id')
      .single();
    if (error) await fail(`Creating ${p.full_name} failed`, error);
    personIds.push(data.id);
  }

  const now = new Date().toISOString();
  const updates = [
    ...personIds.map((personId, i) => [tagIds[i], { status: 'assigned', person_id: personId, assigned_at: now }]),
    [tagIds[5], { status: 'inactive', person_id: personIds[4], assigned_at: now }], // Priya's lost tag
    [tagIds[6], { status: 'void' }], // damaged during engraving
  ];
  for (const [id, patch] of updates) {
    const { error } = await db.from('tags').update({ ...patch, status_changed_at: now }).eq('id', id);
    if (error) await fail(`Updating tag ${id} failed`, error);
  }
  await db.from('batches').update({ engraved_at: now }).eq('id', batch.id);

  const { data: tags } = await db
    .from('tags')
    .select('id,batch_seq,status,person:people(full_name)')
    .eq('batch_id', batch.id)
    .order('batch_seq');
  console.log('Demo data created:\n');
  printTable(tags ?? []);
}

function printTable(tags) {
  for (const t of tags) {
    const who = t.person?.full_name ? ` — ${t.person.full_name}` : '';
    console.log(`  #${t.batch_seq}  ${t.status.padEnd(10)} ${url(t.id)}${who}`);
  }
  let unknown;
  const known = new Set(tags.map((t) => t.id));
  do unknown = randomId();
  while (known.has(unknown));
  console.log(`\n  Unknown ID test:     ${url(unknown)}`);
  console.log(`  Malformed ID test:   ${base}/p/HELLO10`);
  console.log(`\n  Admin: ${base}/admin  (scan an "unassigned" URL while logged in to see the assignment screen)`);
}

const run = process.argv.includes('--reset') ? reset : seed;
run().catch((err) => fail('Seed failed', err));
