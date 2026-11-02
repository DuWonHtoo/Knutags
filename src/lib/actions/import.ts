'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../auth';
import { errorMessage, UserError } from '../errors';
import { ALL_VISIBILITY_KEYS, DEFAULT_PUBLIC_FIELDS, NAME_KEY, PHOTO_KEY, PROFILE_FIELDS } from '../fields';
import { extractTagId } from '../ids';
import { MAX_IMPORT_ROWS, type ImportLine, type ImportResult, type ImportRow } from '../import-types';
import { cleanPersonInput, type PersonRow } from '../person-input';
import { db } from '../supabase';
import type { TagStatus } from '../types';

interface Prepared {
  line: number;
  tagId: string | null;
  person: PersonRow;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** "name|photo|title" → visibility keys. Accepts | ; or , as separators and "name" for full_name. */
function parsePublicList(value: string): string[] {
  const allowed = new Set(ALL_VISIBILITY_KEYS);
  const aliases: Record<string, string> = { name: NAME_KEY, fullname: NAME_KEY, picture: PHOTO_KEY, image: PHOTO_KEY };
  for (const f of PROFILE_FIELDS) aliases[f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')] = f.key;
  return value
    .split(/[|;,]/)
    .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'))
    .map((s) => aliases[s] ?? s)
    .filter((s) => allowed.has(s));
}

/**
 * Bulk import of people from CSV rows (parsed in the browser).
 * commit=false only validates (dry run); commit=true creates people and assigns
 * tags. Only unassigned tags can be assigned by import.
 */
export async function importPeopleAction(rows: ImportRow[], commit: boolean): Promise<ImportResult> {
  await requireAdmin();
  const result: ImportResult = { lines: [], valid: 0, created: 0, assigned: 0 };
  if (!Array.isArray(rows) || rows.length === 0) return { ...result, error: 'The file has no data rows.' };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { ...result, error: `Too many rows (${rows.length}). Split the file into parts of at most ${MAX_IMPORT_ROWS}.` };
  }

  try {
    const lines: ImportLine[] = [];
    const prepared: Prepared[] = [];
    const seenTags = new Map<string, number>();

    rows.forEach((raw, index) => {
      const line = index + 2; // line 1 is the header
      const name = str(raw.full_name);
      const rawTag = str(raw.tag_id);
      try {
        const tagId = rawTag ? extractTagId(rawTag) : null;
        if (rawTag && !tagId) throw new UserError(`"${rawTag}" is not a valid tag ID.`);
        if (tagId) {
          const first = seenTags.get(tagId);
          if (first) throw new UserError(`Tag ${tagId} appears twice in the file (also line ${first}).`);
          seenTags.set(tagId, line);
        }
        const details: Record<string, unknown> = {};
        for (const field of PROFILE_FIELDS) details[field.key] = raw[field.key];
        const person = cleanPersonInput({
          full_name: name,
          details,
          public_fields: str(raw.public) ? parsePublicList(str(raw.public)) : [...DEFAULT_PUBLIC_FIELDS],
          admin_notes: raw.admin_notes,
        });
        prepared.push({ line, tagId, person });
      } catch (err) {
        lines.push({ line, name, tagId: rawTag, status: 'error', message: errorMessage(err) });
      }
    });

    // Check every referenced tag exists and is unassigned.
    const tagIds = prepared.flatMap((p) => (p.tagId ? [p.tagId] : []));
    const statusById = new Map<string, TagStatus>();
    for (const part of chunks(tagIds, 200)) {
      const { data, error } = await db().from('tags').select('id,status').in('id', part);
      if (error) throw new Error(error.message);
      for (const t of data as { id: string; status: TagStatus }[]) statusById.set(t.id, t.status);
    }

    const ready: Prepared[] = [];
    for (const p of prepared) {
      if (p.tagId) {
        const status = statusById.get(p.tagId);
        if (!status) {
          lines.push({ line: p.line, name: p.person.full_name, tagId: p.tagId, status: 'error', message: 'Tag not found.' });
          continue;
        }
        if (status !== 'unassigned') {
          lines.push({
            line: p.line,
            name: p.person.full_name,
            tagId: p.tagId,
            status: 'error',
            message: `Tag is ${status}; only unassigned tags can be assigned by import.`,
          });
          continue;
        }
      }
      ready.push(p);
    }
    result.valid = ready.length;

    if (!commit) {
      for (const p of ready) {
        lines.push({
          line: p.line,
          name: p.person.full_name,
          tagId: p.tagId ?? '',
          status: 'ok',
          message: p.tagId ? 'Ready: create person and assign tag.' : 'Ready: create person (no tag).',
        });
      }
      result.lines = lines.sort((a, b) => a.line - b.line);
      return result;
    }

    // Commit: insert people with IDs chosen here so rows map back to tags reliably.
    const withIds = ready.map((p) => ({ ...p, id: crypto.randomUUID() }));
    const inserted: typeof withIds = [];
    for (const part of chunks(withIds, 500)) {
      const { error } = await db()
        .from('people')
        .insert(part.map((p) => ({ id: p.id, ...p.person })));
      if (error) {
        for (const p of part) {
          lines.push({ line: p.line, name: p.person.full_name, tagId: p.tagId ?? '', status: 'error', message: error.message });
        }
      } else {
        inserted.push(...part);
      }
    }
    result.created = inserted.length;

    const assignedIds = new Set<string>();
    const pairs = inserted.filter((p) => p.tagId).map((p) => ({ tag_id: p.tagId, person_id: p.id }));
    for (const part of chunks(pairs, 500)) {
      const { data, error } = await db().rpc('bulk_assign_tags', { p_pairs: part });
      if (error) throw new Error(error.message);
      for (const r of data as { tag_id: string }[]) assignedIds.add(r.tag_id);
    }
    result.assigned = assignedIds.size;

    for (const p of inserted) {
      if (!p.tagId) {
        lines.push({ line: p.line, name: p.person.full_name, tagId: '', status: 'created', message: 'Person created (no tag).' });
      } else if (assignedIds.has(p.tagId)) {
        lines.push({ line: p.line, name: p.person.full_name, tagId: p.tagId, status: 'created', message: 'Person created and tag assigned.' });
      } else {
        lines.push({
          line: p.line,
          name: p.person.full_name,
          tagId: p.tagId,
          status: 'warning',
          message: 'Person created, but the tag was taken meanwhile. Assign a tag on their page.',
        });
      }
    }
    result.lines = lines.sort((a, b) => a.line - b.line);
    revalidatePath('/admin/people');
    revalidatePath('/admin/tags');
    return result;
  } catch (err) {
    return { ...result, error: errorMessage(err) };
  }
}
