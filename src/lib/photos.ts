import sharp from 'sharp';
import { env } from './env';
import { UserError } from './errors';
import { db } from './supabase';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const OUTPUT_SIZE = 800;

/**
 * Re-encodes an uploaded photo and stores it in the private bucket.
 * Re-encoding with sharp removes ALL metadata (EXIF, GPS location, camera data,
 * XMP) because .keepMetadata()/.withMetadata() is never called. .rotate() first
 * applies the EXIF orientation so the stripped image is still upright.
 * Returns the storage path.
 */
export async function storePhoto(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UserError('The photo is too large (max 4 MB).');

  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    output = await sharp(input, { failOn: 'error', limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: OUTPUT_SIZE, height: OUTPUT_SIZE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new UserError('That image could not be read. Please use a JPEG, PNG or WebP photo.');
  }

  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await db().storage.from(env.photoBucket).upload(path, output, {
    contentType: 'image/jpeg',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
}

export async function deletePhoto(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await db().storage.from(env.photoBucket).remove([path]);
  if (error) console.error('Photo delete failed', path, error.message);
}

/** Short-lived URL for one private photo. */
export async function signedPhotoUrl(path: string | null | undefined, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await db().storage.from(env.photoBucket).createSignedUrl(path, seconds);
  if (error) {
    console.error('Signed URL failed', error.message);
    return null;
  }
  return data.signedUrl;
}

/** Signed URLs for many photos in one request. Returns a map path → URL. */
export async function signedPhotoUrls(paths: string[], seconds = 3600): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data, error } = await db().storage.from(env.photoBucket).createSignedUrls(paths, seconds);
  if (error) {
    console.error('Signed URLs failed', error.message);
    return map;
  }
  for (const item of data) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}
