// Tag ID rules. Shared by server and browser code (no Node-only imports).

/** 31 characters: digits 2–9 and A–Z without the confusable 0, O, 1, I and L. */
export const ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ID_LENGTH = 7;
export const ID_REGEX = /^[2-9A-HJKMNP-Z]{7}$/;

/** Cryptographically random ID (rejection sampling keeps every character equally likely). */
export function generateTagId(): string {
  const n = ID_ALPHABET.length;
  const limit = 256 - (256 % n); // 248: largest multiple of 31 below 256
  let id = '';
  while (id.length < ID_LENGTH) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limit && id.length < ID_LENGTH) id += ID_ALPHABET[b % n];
    }
  }
  return id;
}

/** Returns the canonical (uppercase) ID, or null when the input is not a valid ID. */
export function normalizeTagId(raw: string): string | null {
  const id = raw.trim().toUpperCase();
  return ID_REGEX.test(id) ? id : null;
}

/**
 * Accepts a bare ID or a pasted/scanned URL such as https://domain/p/ABC2345
 * and returns the canonical ID, or null.
 */
export function extractTagId(input: string): string | null {
  const trimmed = input.trim();
  const direct = normalizeTagId(trimmed);
  if (direct) return direct;
  const match = trimmed.match(/\/p\/([0-9a-z]{7})\/?(?:[?#].*)?$/i);
  return match ? normalizeTagId(match[1]) : null;
}

/** The URL engraved into a tag. Uppercase mode lets QR codes use alphanumeric encoding. */
export function tagUrl(baseUrl: string, id: string, uppercase: boolean): string {
  return uppercase ? `${baseUrl}/P/${id}`.toUpperCase() : `${baseUrl}/p/${id}`;
}
