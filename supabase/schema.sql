-- ════════════════════════════════════════════════════════════════════════════
-- QR Profile — database schema
--
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to run again (it only creates what is missing and refreshes
-- functions, views and permissions).
--
-- Security model: the app talks to the database only from the server, using the
-- secret/service_role key. Row Level Security is ON for every table with NO
-- policies, so the public "anon" key (which this app never uses) can read or
-- write nothing. Unassigned tags therefore can never be claimed by the public.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Types ───────────────────────────────────────────────────────────────────
do $$
begin
  create type public.tag_status as enum ('unassigned', 'assigned', 'inactive', 'void');
exception
  when duplicate_object then null;
end
$$;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.batches (
  id          uuid primary key default gen_random_uuid(),
  label       text not null check (char_length(label) between 1 and 100),
  quantity    integer not null check (quantity between 1 and 5000),
  notes       text check (notes is null or char_length(notes) <= 1000),
  engraved_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.people (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null check (char_length(full_name) between 1 and 120),
  -- All other profile fields (title, phone, ...) live here; the list of fields is
  -- defined in src/lib/fields.ts so it can change without a migration.
  details       jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  -- Keys of the fields shown on the public profile ("full_name", "photo", "title", ...).
  public_fields text[] not null default '{}',
  photo_path    text,
  admin_notes   text check (admin_notes is null or char_length(admin_notes) <= 2000),
  -- Lower-cased copy of all text fields, maintained by the app, used for admin search.
  search_text   text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.tags (
  -- 7 characters from 23456789ABCDEFGHJKMNPQRSTUVWXYZ (no 0, O, 1, I, L).
  id                text primary key check (id ~ '^[2-9A-HJKMNP-Z]{7}$'),
  batch_id          uuid not null references public.batches (id) on delete restrict,
  -- Position of the tag inside its batch (row number in the engraving file).
  batch_seq         integer not null check (batch_seq > 0),
  status            public.tag_status not null default 'unassigned',
  person_id         uuid references public.people (id) on delete restrict,
  scan_count        integer not null default 0,
  last_scanned_at   timestamptz,
  assigned_at       timestamptz,
  status_changed_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint tags_batch_seq_unique unique (batch_id, batch_seq),
  -- assigned ⇒ has a person; unassigned/void ⇒ no person; inactive ⇒ either
  -- (keeps the link so the tag can be reactivated).
  constraint tags_person_matches_status check (
    (status = 'assigned' and person_id is not null)
    or (status in ('unassigned', 'void') and person_id is null)
    or status = 'inactive'
  )
);

create index if not exists tags_person_idx       on public.tags (person_id);
create index if not exists tags_status_idx       on public.tags (status);
create index if not exists tags_last_scanned_idx on public.tags (last_scanned_at desc nulls last);
create index if not exists tags_created_idx      on public.tags (created_at desc);

-- Fixed-window counters used for rate limiting (keys contain hashed IPs only).
create table if not exists public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 1,
  primary key (key, window_start)
);

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

-- ── Row Level Security: on, with no policies (= no public access) ───────────
alter table public.batches     enable row level security;
alter table public.people      enable row level security;
alter table public.tags        enable row level security;
alter table public.rate_limits enable row level security;

-- ── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists people_touch_updated_at on public.people;
create trigger people_touch_updated_at
  before update on public.people
  for each row execute function public.touch_updated_at();

-- ── Views used by the admin area ────────────────────────────────────────────
create or replace view public.tag_status_counts
with (security_invoker = true) as
  select status, count(*)::int as n
  from public.tags
  group by status;

create or replace view public.batch_overview
with (security_invoker = true) as
  select
    b.id, b.label, b.quantity, b.notes, b.engraved_at, b.created_at,
    count(t.id)::int                                          as total,
    (count(t.id) filter (where t.status = 'unassigned'))::int as unassigned_count,
    (count(t.id) filter (where t.status = 'assigned'))::int   as assigned_count,
    (count(t.id) filter (where t.status = 'inactive'))::int   as inactive_count,
    (count(t.id) filter (where t.status = 'void'))::int       as void_count,
    coalesce(sum(t.scan_count), 0)::int                       as scan_total
  from public.batches b
  left join public.tags t on t.batch_id = b.id
  group by b.id;

create or replace view public.people_overview
with (security_invoker = true) as
  select
    p.id, p.full_name, p.details, p.public_fields, p.photo_path, p.admin_notes,
    p.search_text, p.created_at, p.updated_at,
    coalesce(
      jsonb_agg(jsonb_build_object('id', t.id, 'status', t.status) order by t.status, t.id)
        filter (where t.id is not null),
      '[]'::jsonb
    )                                                       as tags,
    coalesce(string_agg(t.id, ' '), '')                     as tag_ids,
    (count(t.id) filter (where t.status = 'assigned'))::int as assigned_count,
    (count(t.id) filter (where t.status = 'inactive'))::int as inactive_count
  from public.people p
  left join public.tags t on t.person_id = p.id
  group by p.id;

-- ── Functions ───────────────────────────────────────────────────────────────

-- Counts one hit for p_key in the current fixed window. Returns true while the
-- number of hits is within p_limit.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Occasional housekeeping instead of a cron job.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end
$$;

-- True when p_key has already reached p_limit hits in the current window
-- (does not count a hit).
create or replace function public.rate_limit_exceeded(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select r.hits >= p_limit
       from public.rate_limits r
      where r.key = p_key
        and r.window_start = to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)),
    false
  );
$$;

-- Public profile lookup in ONE round trip: rate limit, find tag, count the scan,
-- return the person (without admin-only columns) when the tag is assigned.
--   p_client: anonymised client key (hashed IP), or null to skip rate limiting
--   p_count:  whether to increase the scan counter (false for admins)
--   p_limit:  max lookups per minute per client
-- Clients that hit 20 unknown IDs within 10 minutes are blocked for the rest of
-- that window (stops ID guessing).
create or replace function public.lookup_tag(
  p_id     text,
  p_client text    default null,
  p_count  boolean default true,
  p_limit  integer default 60
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_tag    public.tags%rowtype;
  v_person jsonb;
begin
  if p_client is not null then
    if public.rate_limit_exceeded('miss:' || p_client, 20, 600) then
      return jsonb_build_object('result', 'rate_limited');
    end if;
    if not public.rate_limit_hit('lookup:' || p_client, p_limit, 60) then
      return jsonb_build_object('result', 'rate_limited');
    end if;
  end if;

  select * into v_tag from public.tags where id = p_id;

  if not found then
    if p_client is not null then
      perform public.rate_limit_hit('miss:' || p_client, 20, 600);
    end if;
    return jsonb_build_object('result', 'not_found');
  end if;

  if p_count then
    update public.tags
       set scan_count = scan_count + 1, last_scanned_at = now()
     where id = p_id;
  end if;

  if v_tag.status = 'assigned' then
    select to_jsonb(p) - 'search_text' - 'admin_notes'
      into v_person
      from public.people p
     where p.id = v_tag.person_id;
  end if;

  return jsonb_build_object(
    'result', 'ok',
    'tag', jsonb_build_object('id', v_tag.id, 'status', v_tag.status),
    'person', v_person
  );
end
$$;

-- Bulk import helper: assigns many tags at once, but only tags that are still
-- unassigned. Input: [{"tag_id": "...", "person_id": "..."}, ...].
-- Returns the tag IDs that were actually assigned.
create or replace function public.bulk_assign_tags(p_pairs jsonb)
returns table (tag_id text)
language sql
set search_path = ''
as $$
  update public.tags t
     set status = 'assigned',
         person_id = (x ->> 'person_id')::uuid,
         assigned_at = now(),
         status_changed_at = now()
    from jsonb_array_elements(p_pairs) as x
   where t.id = x ->> 'tag_id'
     and t.status = 'unassigned'
  returning t.id;
$$;

-- Deletes a person atomically. Their assigned tags become inactive (so scanning
-- them shows "no longer active"). Returns the photo path so the app can remove
-- the file from Storage.
create or replace function public.delete_person(p_person uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_photo text;
begin
  update public.tags
     set status = 'inactive', person_id = null, status_changed_at = now()
   where person_id = p_person and status = 'assigned';

  update public.tags set person_id = null where person_id = p_person;

  delete from public.people where id = p_person returning photo_path into v_photo;
  return v_photo;
end
$$;

-- ── Permissions: only the server-side secret key (service_role) gets access ──
revoke all on table public.batches, public.people, public.tags, public.rate_limits
  from anon, authenticated;
revoke all on table public.tag_status_counts, public.batch_overview, public.people_overview
  from anon, authenticated;
grant all on table public.batches, public.people, public.tags, public.rate_limits
  to service_role;
grant select on table public.tag_status_counts, public.batch_overview, public.people_overview
  to service_role;

revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.rate_limit_exceeded(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.lookup_tag(text, text, boolean, integer) from public, anon, authenticated;
revoke execute on function public.bulk_assign_tags(jsonb) from public, anon, authenticated;
revoke execute on function public.delete_person(uuid) from public, anon, authenticated;

grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.rate_limit_exceeded(text, integer, integer) to service_role;
grant execute on function public.lookup_tag(text, text, boolean, integer) to service_role;
grant execute on function public.bulk_assign_tags(jsonb) to service_role;
grant execute on function public.delete_person(uuid) to service_role;

-- ── Storage: private bucket for profile photos ──────────────────────────────
-- Private = files are only reachable through short-lived signed URLs that the
-- server creates for ASSIGNED tags whose photo is marked public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
