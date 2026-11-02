'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '../auth';
import { errorMessage } from '../errors';
import { redirectWith } from '../flash';
import { isUuid } from '../params';
import { parsePersonForm } from '../person-input';
import { deletePhoto, storePhoto } from '../photos';
import { db } from '../supabase';
import type { ActionState } from '../types';

export async function createPersonAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  let personId: string;
  try {
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
    personId = (data as { id: string }).id;
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath('/admin/people');
  redirectWith(`/admin/people/${personId}`, 'ok', 'Person created. Add a tag below.');
}

export async function updatePersonAction(personId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!isUuid(personId)) return { error: 'Invalid person.' };
  try {
    const { row, photo, removePhoto } = parsePersonForm(formData);
    const { data: current, error: loadError } = await db()
      .from('people')
      .select('photo_path')
      .eq('id', personId)
      .single();
    if (loadError) throw new Error(loadError.message);
    const oldPath = (current as { photo_path: string | null }).photo_path;

    let photoPath = oldPath;
    if (photo) photoPath = await storePhoto(photo);
    else if (removePhoto) photoPath = null;

    const { error } = await db()
      .from('people')
      .update({ ...row, photo_path: photoPath })
      .eq('id', personId);
    if (error) {
      if (photoPath && photoPath !== oldPath) await deletePhoto(photoPath);
      throw new Error(error.message);
    }
    if (oldPath && oldPath !== photoPath) await deletePhoto(oldPath);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/admin/people/${personId}`);
  revalidatePath('/admin/people');
  return { ok: true, message: 'Saved. Changes are live on the public profile.' };
}

/** Permanently deletes a person and their photo. Their assigned tags become inactive. */
export async function deletePersonAction(personId: string): Promise<void> {
  await requireAdmin();
  if (!isUuid(personId)) redirect('/admin/people');
  let failure: string | null = null;
  try {
    const { data, error } = await db().rpc('delete_person', { p_person: personId });
    if (error) throw new Error(error.message);
    await deletePhoto(data as string | null);
  } catch (err) {
    failure = errorMessage(err);
  }
  if (failure) redirectWith(`/admin/people/${personId}`, 'error', failure);
  revalidatePath('/admin/people');
  revalidatePath('/admin/tags');
  redirect('/admin/people?ok=Person%20deleted.%20Their%20tags%20are%20now%20inactive.');
}
