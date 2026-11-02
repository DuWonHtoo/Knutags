// Profile fields. Edit this list to change what a profile contains — no database
// change is needed (values are stored in people.details as JSON).

export type FieldType = 'text' | 'tel' | 'email' | 'url' | 'textarea' | 'select';

export interface ProfileField {
  key: string;
  label: string;
  type: FieldType;
  /** Whether new profiles show this field publicly by default. */
  defaultPublic: boolean;
  maxLength: number;
  placeholder?: string;
  /** Allowed values for 'select' fields, in display order. */
  options?: readonly string[];
}

/** Ranks offered in the admin dropdown, highest first. Edit freely; no database change needed. */
export const RANKS: readonly string[] = [
  'General',
  'Lieutenant General',
  'Major General',
  'Brigadier General',
  'Colonel',
  'Lieutenant Colonel',
  'Major',
  'Captain',
  'Lieutenant',
  'Second Lieutenant',
  'Warrant Officer',
  'Sergeant',
  'Corporal',
  'Lance Corporal',
  'Private',
];

export const PROFILE_FIELDS: readonly ProfileField[] = [
  { key: 'rank', label: 'Rank', type: 'select', defaultPublic: true, maxLength: 60, options: RANKS },
  { key: 'title', label: 'Title / role', type: 'text', defaultPublic: true, maxLength: 120, placeholder: 'Site Manager' },
  { key: 'organization', label: 'Organization', type: 'text', defaultPublic: true, maxLength: 120, placeholder: 'Company name' },
  { key: 'phone', label: 'Phone', type: 'tel', defaultPublic: false, maxLength: 40, placeholder: '+1 555 0100' },
  { key: 'email', label: 'Email', type: 'email', defaultPublic: false, maxLength: 200, placeholder: 'name@company.com' },
  { key: 'website', label: 'Website', type: 'url', defaultPublic: true, maxLength: 300, placeholder: 'company.com' },
  { key: 'location', label: 'Location', type: 'text', defaultPublic: false, maxLength: 120, placeholder: 'City, Country' },
  { key: 'bio', label: 'About', type: 'textarea', defaultPublic: true, maxLength: 1000 },
];

/** The name and photo can be hidden too; they use these keys in public_fields. */
export const NAME_KEY = 'full_name';
export const PHOTO_KEY = 'photo';

export const ALL_VISIBILITY_KEYS: readonly string[] = [NAME_KEY, PHOTO_KEY, ...PROFILE_FIELDS.map((f) => f.key)];

export const DEFAULT_PUBLIC_FIELDS: readonly string[] = [
  NAME_KEY,
  PHOTO_KEY,
  ...PROFILE_FIELDS.filter((f) => f.defaultPublic).map((f) => f.key),
];

export function fieldLabel(key: string): string {
  if (key === NAME_KEY) return 'Full name';
  if (key === PHOTO_KEY) return 'Photo';
  return PROFILE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

/** Lower-cased text used by the admin search (stored in people.search_text). */
export function buildSearchText(fullName: string, details: Record<string, string>, adminNotes: string | null): string {
  return [fullName, ...Object.values(details), adminNotes ?? '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Safe link target for a field value, or null when it should be shown as plain text. */
export function fieldHref(type: FieldType, value: string): string | null {
  const v = value.trim();
  if (type === 'tel') {
    const digits = v.replace(/[^\d+]/g, '');
    return digits.length >= 3 ? `tel:${digits}` : null;
  }
  if (type === 'email') {
    return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v) ? `mailto:${v}` : null;
  }
  if (type === 'url') {
    try {
      const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Display form of a URL without the protocol. */
export function prettyUrl(value: string): string {
  return value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}
