'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '../auth';
import { errorMessage, UserError } from '../errors';
import { redirectWith } from '../flash';
import { extractTagId, normalizeTagId } from '../ids';
import { parsePersonForm } from '../person-input';
import { deletePhoto, storePhoto } from '../photos';
import { db } from '../supabase';
import { assignTag, deactivateOtherTags, transitionTag } from '../tags';
import type { ActionState, TagStatus } from '../types';

function tagPath(tagId: string) {
  return `/admin/tags/${tagId}`;
}

function validId(raw: string): string {
  const id = normalizeTagId(raw);
  if (!id) throw new UserError('Invalid tag ID.');
  return id;
}

function refresh(tagId: string, personId?: string | null) {
  revalidatePath(tagPath(tagId));
  revalidatePath('/admin/tags');
  revalidatePath('/admin/people');
  if (personId) revalidatePath(`/admin/people/${personId}`);
}

/** Creates a new person (with optional photo) and assigns the tag to them. */
export async function assignNewPersonAction(
  rawTagId: string,
  expectedStatus: TagStatus,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  let tagId: string;
  try {
    tagId = validId(rawTagId);
    if (expectedStatus === 'void') throw new UserError('Restore this tag before assigning it.');
    const { row, photo } = parsePersonForm(formData);
    const photoPath = photo ? await storePhoto(photo) : null;

    const { data, error } = await db()
      .from('people')
      .insert({ ...row, photo_path: photoPath })
      .select('id')
      .single();
    if (error) {
      await deletePhoto(photoPath);
      throw new Error(error.message);
    }
    const personId = (data as { id: string }).id;

    try {
      await assignTag(tagId, personId, [expectedStatus]);
    } catch (err) {
      // Tag changed meanwhile: undo the person we just created.
      await db().from('people').delete().eq('id', personId);
      await deletePhoto(photoPath);
      throw err;
    }
    refresh(tagId, personId);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  redirectWith(tagPath(tagId), 'ok', 'Tag assigned. Scan it to see the public profile.');
}

/** Assigns the tag to someone already in the system. */
export async function assignExistingPersonAction(
  rawTagId: string,
  expectedStatus: TagStatus,
  personId: string,
  deactivateOthers: boolean,
): Promise<void> {
  await requireAdmin();
  const tagId = normalizeTagId(rawTagId);
  if (!tagId) redirect('/admin/tags');
  let failure: string | null = null;
  let deactivated = 0;
  try {
    if (expectedStatus === 'void') throw new UserError('Restore this tag before assigning it.');
    await assignTag(tagId, personId, [expectedStatus]);
    if (deactivateOthers) deactivated = await deactivateOtherTags(personId, tagId);
    refresh(tagId, personId);
  } catch (err) {
    failure = errorMessage(err);
  }
  if (failure) redirectWith(tagPath(tagId), 'error', failure);
  redirectWith(
    tagPath(tagId),
    'ok',
    deactivated ? `Tag assigned. ${deactivated} older tag(s) of this person deactivated.` : 'Tag assigned.',
  );
}

/** From a person's page: attach an unassigned tag (typed or pasted ID/URL) to them. */
export async function assignTagToPersonAction(personId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const path = `/admin/people/${personId}`;
  const tagId = extractTagId(String(formData.get('tag_id') ?? ''));
  if (!tagId) redirectWith(path, 'error', 'That is not a valid tag ID.');
  const deactivateOthers = formData.get('deactivate_others') === 'on';
  let failure: string | null = null;
  let deactivated = 0;
  try {
    const { data: tag } = await db().from('tags').select('status').eq('id', tagId).maybeSingle();
    if (!tag) throw new UserError(`Tag ${tagId} does not exist.`);
    const status = (tag as { status: TagStatus }).status;
    if (status !== 'unassigned') {
      throw new UserError(`Tag ${tagId} is ${status}. Open the tag's page to reassign it deliberately.`);
    }
    await assignTag(tagId, personId, ['unassigned']);
    if (deactivateOthers) deactivated = await deactivateOtherTags(personId, tagId);
    refresh(tagId, personId);
  } catch (err) {
    failure = errorMessage(err);
  }
  if (failure) redirectWith(path, 'error', failure);
  redirectWith(path, 'ok', `Tag ${tagId} assigned.${deactivated ? ` ${deactivated} older tag(s) deactivated.` : ''}`);
}

async function simpleTransition(
  rawTagId: string,
  from: readonly TagStatus[],
  patch: Parameters<typeof transitionTag>[2],
  success: string,
): Promise<void> {
  await requireAdmin();
  const tagId = normalizeTagId(rawTagId);
  if (!tagId) redirect('/admin/tags');
  let failure: string | null = null;
  try {
    const { data: before } = await db().from('tags').select('person_id').eq('id', tagId).maybeSingle();
    await transitionTag(tagId, from, patch);
    refresh(tagId, (before as { person_id: string | null } | null)?.person_id);
  } catch (err) {
    failure = errorMessage(err);
  }
  if (failure) redirectWith(tagPath(tagId), 'error', failure);
  redirectWith(tagPath(tagId), 'ok', success);
}

/** assigned → inactive. Keeps the person link so it can be reactivated. */
export async function deactivateTagAction(tagId: string): Promise<void> {
  await simpleTransition(tagId, ['assigned'], { status: 'inactive' }, 'Tag deactivated. Scanning it now shows "no longer active".');
}

/** inactive (with person) → assigned. */
export async function reactivateTagAction(tagId: string): Promise<void> {
  await requireAdmin();
  const id = normalizeTagId(tagId);
  if (!id) redirect('/admin/tags');
  const { data } = await db().from('tags').select('person_id').eq('id', id).maybeSingle();
  if (!(data as { person_id: string | null } | null)?.person_id) {
    redirectWith(tagPath(id), 'error', 'This tag has no person linked any more. Assign it to someone instead.');
  }
  await simpleTransition(id, ['inactive'], { status: 'assigned' }, 'Tag reactivated.');
}

/** assigned/inactive → unassigned, removing the person link (tag can be reused). */
export async function releaseTagAction(tagId: string): Promise<void> {
  await simpleTransition(
    tagId,
    ['assigned', 'inactive'],
    { status: 'unassigned', person_id: null, assigned_at: null },
    'Tag released. It is unassigned again and can be given to someone else.',
  );
}

/** Any status → void (damaged, lost, destroyed). */
export async function voidTagAction(tagId: string): Promise<void> {
  await simpleTransition(
    tagId,
    ['unassigned', 'assigned', 'inactive'],
    { status: 'void', person_id: null, assigned_at: null },
    'Tag voided.',
  );
}

/** void → unassigned (undo a mistaken void). */
export async function restoreTagAction(tagId: string): Promise<void> {
  await simpleTransition(tagId, ['void'], { status: 'unassigned' }, 'Tag restored to unassigned.');
}
