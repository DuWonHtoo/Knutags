'use client';

import { useActionState, useEffect, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { DEFAULT_PUBLIC_FIELDS, NAME_KEY, PHOTO_KEY, PROFILE_FIELDS } from '@/lib/fields';
import type { ActionState } from '@/lib/types';
import { btnPrimary, inputClass, labelClass } from './ui';

export interface PersonFormInitial {
  full_name: string;
  details: Record<string, string>;
  public_fields: string[];
  admin_notes: string | null;
  photoUrl: string | null;
}

const MAX_SIDE = 1200;

/** Loads an image file into something drawable; EXIF orientation is applied by the browser. */
async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

/**
 * Shrinks the photo in the browser and re-encodes it as JPEG. This keeps uploads
 * small on mobile data, converts iPhone HEIC photos, and already drops EXIF/GPS
 * data. The server re-encodes again, so metadata is removed even if this fails.
 */
async function shrinkImage(file: File): Promise<Blob> {
  const image = await decodeImage(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');
    ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), 'image/jpeg', 0.88),
    );
  } finally {
    image.close();
  }
}

function VisibilityToggle({ field, defaultChecked }: { field: string; defaultChecked: boolean }) {
  return (
    <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
      <input type="checkbox" name="public" value={field} defaultChecked={defaultChecked} className="h-4 w-4 accent-slate-900" />
      Public
    </label>
  );
}

export function PersonForm({
  action,
  submitLabel,
  initial,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  initial?: PersonFormInitial;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(initial?.photoUrl ?? null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  // After a successful save the server sends fresh props: show the stored photo
  // again and forget the uploaded file so it isn't uploaded twice.
  const initialPhotoUrl = initial?.photoUrl ?? null;
  useEffect(() => {
    if (state?.ok) {
      setPhotoBlob(null);
      setRemovePhoto(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }, [state]);
  useEffect(() => {
    if (!photoBlob) setPreview(initialPhotoUrl);
  }, [initialPhotoUrl, photoBlob]);

  const visible = new Set(initial?.public_fields ?? DEFAULT_PUBLIC_FIELDS);

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPhotoError(null);
    if (!file) return;
    setProcessing(true);
    try {
      const blob = await shrinkImage(file);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(blob);
      setPhotoBlob(blob);
      setPreview(objectUrl.current);
      setRemovePhoto(false);
    } catch {
      setPhotoBlob(null);
      setPhotoError('This photo could not be opened. Please choose a JPEG or PNG image.');
      if (fileInput.current) fileInput.current.value = '';
    } finally {
      setProcessing(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    fd.delete('photo_picker'); // never upload the original file
    if (photoBlob) fd.set('photo', photoBlob, 'photo.jpg');
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {state?.error ? (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          {state.error}
        </div>
      ) : null}
      {state?.ok && state.message ? (
        <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {state.message}
        </div>
      ) : null}

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={labelClass}>Photo</span>
          <VisibilityToggle field={PHOTO_KEY} defaultChecked={visible.has(PHOTO_KEY)} />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
            {preview && !removePhoto ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 space-y-2">
            <input
              ref={fileInput}
              type="file"
              name="photo_picker"
              accept="image/*"
              onChange={onPhotoChange}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            {processing ? <p className="text-xs text-slate-500">Preparing photo…</p> : null}
            {photoError ? <p className="text-xs text-red-700">{photoError}</p> : null}
            {initial?.photoUrl && !photoBlob ? (
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="remove_photo"
                  checked={removePhoto}
                  onChange={(e) => setRemovePhoto(e.target.checked)}
                  className="h-4 w-4 accent-red-600"
                />
                Remove current photo
              </label>
            ) : null}
            <p className="text-xs text-slate-400">Location and camera data are removed automatically.</p>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="full_name" className={labelClass}>
            Full name *
          </label>
          <VisibilityToggle field={NAME_KEY} defaultChecked={visible.has(NAME_KEY)} />
        </div>
        <input
          id="full_name"
          name={NAME_KEY}
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={initial?.full_name ?? ''}
          className={inputClass}
        />
      </div>

      {PROFILE_FIELDS.map((field) => {
        const id = `f_${field.key}`;
        const common = {
          id,
          name: id,
          maxLength: field.maxLength,
          placeholder: field.placeholder,
          defaultValue: initial?.details[field.key] ?? '',
          className: inputClass,
          autoComplete: 'off',
        };
        return (
          <div key={field.key}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor={id} className={labelClass}>
                {field.label}
              </label>
              <VisibilityToggle field={field.key} defaultChecked={visible.has(field.key)} />
            </div>
            {field.type === 'textarea' ? (
              <textarea {...common} rows={3} />
            ) : (
              <input
                {...common}
                type={field.type === 'url' ? 'text' : field.type}
                inputMode={field.type === 'url' ? 'url' : undefined}
              />
            )}
          </div>
        );
      })}

      <div>
        <label htmlFor="admin_notes" className={labelClass}>
          Admin notes <span className="font-normal text-slate-400">(never public)</span>
        </label>
        <textarea
          id="admin_notes"
          name="admin_notes"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.admin_notes ?? ''}
          className={inputClass}
        />
      </div>

      <button type="submit" disabled={pending || processing} className={`${btnPrimary} w-full sm:w-auto`}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
