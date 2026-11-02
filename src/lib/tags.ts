import { UserError } from './errors';
import { db } from './supabase';
import type { Tag, TagStatus } from './types';

/**
 * Changes a tag atomically, but only if it is still in one of the expected
 * statuses (protects against two admins editing the same tag at once).
 */
export async function transitionTag(
  id: string,
  from: readonly TagStatus[],
  patch: Partial<Pick<Tag, 'status' | 'person_id' | 'assigned_at'>>,
): Promise<void> {
  const { data, error } = await db()
    .from('tags')
    .update({ ...patch, status_changed_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', from as TagStatus[])
    .select('id');
  if (error) throw new Error(`Tag update failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new UserError('This tag was changed in the meantime (or does not exist). Reload the page and try again.');
  }
}

export async function assignTag(tagId: string, personId: string, from: readonly TagStatus[]): Promise<void> {
  await transitionTag(tagId, from, {
    status: 'assigned',
    person_id: personId,
    assigned_at: new Date().toISOString(),
  });
}

/** Sets every other assigned tag of this person to inactive (e.g. replaced tag). */
export async function deactivateOtherTags(personId: string, keepTagId: string): Promise<number> {
  const { data, error } = await db()
    .from('tags')
    .update({ status: 'inactive', status_changed_at: new Date().toISOString() })
    .eq('person_id', personId)
    .eq('status', 'assigned')
    .neq('id', keepTagId)
    .select('id');
  if (error) throw new Error(`Could not deactivate other tags: ${error.message}`);
  return data?.length ?? 0;
}

/** All tags of a batch in engraving order (pages through Supabase's 1000-row limit). */
export async function fetchBatchTags(batchId: string): Promise<Pick<Tag, 'id' | 'batch_seq' | 'status'>[]> {
  const out: Pick<Tag, 'id' | 'batch_seq' | 'status'>[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db()
      .from('tags')
      .select('id,batch_seq,status')
      .eq('batch_id', batchId)
      .order('batch_seq', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not load tags: ${error.message}`);
    out.push(...(data as Pick<Tag, 'id' | 'batch_seq' | 'status'>[]));
    if (!data || data.length < pageSize) break;
  }
  return out;
}
