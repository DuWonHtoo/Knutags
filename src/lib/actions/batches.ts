'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '../auth';
import { errorMessage, UserError } from '../errors';
import { redirectWith } from '../flash';
import { generateTagId, ID_REGEX } from '../ids';
import { db } from '../supabase';

const MAX_BATCH = 5000;
const CHUNK = 500;

function uniqueIds(count: number): string[] {
  const set = new Set<string>();
  while (set.size < count) set.add(generateTagId());
  return [...set];
}

/** Inserts `quantity` random tags numbered 1..quantity. Retries a chunk on the (rare) ID collision. */
async function insertTags(batchId: string, quantity: number): Promise<void> {
  for (let start = 1; start <= quantity; start += CHUNK) {
    const count = Math.min(CHUNK, quantity - start + 1);
    for (let attempt = 1; ; attempt++) {
      const rows = uniqueIds(count).map((id, i) => ({ id, batch_id: batchId, batch_seq: start + i }));
      // One INSERT statement is atomic: on a duplicate ID nothing is written.
      const { error } = await db().from('tags').insert(rows);
      if (!error) break;
      if (error.code !== '23505' || attempt >= 5) throw new Error(`Could not create tags: ${error.message}`);
    }
  }
}

export async function createBatchAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const label = String(formData.get('label') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const quantity = Number(formData.get('quantity'));

  let batchId: string | null = null;
  let failure: string | null = null;
  try {
    if (!label) throw new UserError('Give the batch a label, e.g. "Order 2026-11 steel 10mm".');
    if (label.length > 100) throw new UserError('Label is too long (max 100 characters).');
    if (notes.length > 1000) throw new UserError('Notes are too long (max 1000 characters).');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_BATCH) {
      throw new UserError(`Quantity must be a whole number from 1 to ${MAX_BATCH}.`);
    }
    const { data, error } = await db()
      .from('batches')
      .insert({ label, quantity, notes: notes || null })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    batchId = (data as { id: string }).id;
    try {
      await insertTags(batchId, quantity);
    } catch (err) {
      // Roll back a half-created batch.
      await db().from('tags').delete().eq('batch_id', batchId);
      await db().from('batches').delete().eq('id', batchId);
      batchId = null;
      throw err;
    }
  } catch (err) {
    failure = errorMessage(err);
  }

  if (failure || !batchId) redirectWith('/admin/batches', 'error', failure ?? 'Batch was not created.');
  revalidatePath('/admin/batches');
  redirectWith(`/admin/batches/${batchId}`, 'ok', `Created ${quantity} tags.`);
}

export async function setEngravedAction(batchId: string, engraved: boolean): Promise<void> {
  await requireAdmin();
  const { error } = await db()
    .from('batches')
    .update({ engraved_at: engraved ? new Date().toISOString() : null })
    .eq('id', batchId);
  if (error) redirectWith(`/admin/batches/${batchId}`, 'error', error.message);
  revalidatePath(`/admin/batches/${batchId}`);
  redirectWith(`/admin/batches/${batchId}`, 'ok', engraved ? 'Batch marked as engraved.' : 'Engraved mark removed.');
}

/**
 * Voids damaged pieces. Accepts tag IDs and/or position numbers (row numbers
 * from the engraving file), separated by spaces, commas or new lines. Only
 * unassigned tags are voided here; assigned ones must be handled individually.
 */
export async function voidInBatchAction(batchId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const path = `/admin/batches/${batchId}`;
  const tokens = String(formData.get('items') ?? '')
    .toUpperCase()
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const ids = new Set<string>();
  const seqs = new Set<number>();
  const invalid: string[] = [];
  for (const token of tokens) {
    if (ID_REGEX.test(token)) ids.add(token);
    else if (/^\d{1,5}$/.test(token)) seqs.add(Number(token));
    else invalid.push(token);
  }
  if (invalid.length) redirectWith(path, 'error', `Not a tag ID or position number: ${invalid.slice(0, 5).join(', ')}`);
  if (!ids.size && !seqs.size) redirectWith(path, 'error', 'Enter at least one tag ID or position number.');

  const filters = [
    ids.size ? `id.in.(${[...ids].join(',')})` : null,
    seqs.size ? `batch_seq.in.(${[...seqs].join(',')})` : null,
  ]
    .filter(Boolean)
    .join(',');

  const { data: matches, error } = await db().from('tags').select('id,status').eq('batch_id', batchId).or(filters);
  if (error) redirectWith(path, 'error', error.message);

  const found = (matches ?? []) as { id: string; status: string }[];
  const toVoid = found.filter((t) => t.status === 'unassigned').map((t) => t.id);
  const skipped = found.filter((t) => t.status !== 'unassigned');
  const requested = ids.size + seqs.size;

  if (toVoid.length) {
    const { error: updateError } = await db()
      .from('tags')
      .update({ status: 'void', status_changed_at: new Date().toISOString() })
      .in('id', toVoid)
      .eq('status', 'unassigned');
    if (updateError) redirectWith(path, 'error', updateError.message);
  }

  revalidatePath(path);
  const parts = [`Voided ${toVoid.length} tag(s).`];
  if (skipped.length) {
    parts.push(`Skipped (not unassigned): ${skipped.map((t) => `${t.id} (${t.status})`).slice(0, 10).join(', ')}.`);
  }
  if (found.length < requested) parts.push(`${requested - found.length} entr(ies) did not match a tag in this batch.`);
  redirectWith(path, skipped.length || found.length < requested ? 'error' : 'ok', parts.join(' '));
}

/** Only for mistakes: a batch can be deleted while it is not engraved and every tag is unassigned. */
export async function deleteBatchAction(batchId: string): Promise<void> {
  await requireAdmin();
  const path = `/admin/batches/${batchId}`;
  const { data: batch } = await db().from('batches').select('engraved_at').eq('id', batchId).maybeSingle();
  if (!batch) redirectWith('/admin/batches', 'error', 'Batch not found.');
  if ((batch as { engraved_at: string | null }).engraved_at) {
    redirectWith(path, 'error', 'This batch is marked as engraved and cannot be deleted. Void damaged tags instead.');
  }
  const { count } = await db()
    .from('tags')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .neq('status', 'unassigned');
  if ((count ?? 0) > 0) redirectWith(path, 'error', 'Only batches where every tag is still unassigned can be deleted.');

  const { error: tagsError } = await db().from('tags').delete().eq('batch_id', batchId).eq('status', 'unassigned');
  if (tagsError) redirectWith(path, 'error', tagsError.message);
  const { error } = await db().from('batches').delete().eq('id', batchId);
  if (error) redirectWith(path, 'error', error.message);

  revalidatePath('/admin/batches');
  redirect('/admin/batches?ok=Batch%20deleted.');
}
