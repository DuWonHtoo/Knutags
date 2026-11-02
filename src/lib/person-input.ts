import { UserError } from './errors';
import { ALL_VISIBILITY_KEYS, NAME_KEY, PROFILE_FIELDS, buildSearchText, fieldHref } from './fields';

export interface PersonInput {
  full_name: string;
  details: Record<string, string>;
  public_fields: string[];
  admin_notes: string | null;
}

export interface PersonRow extends PersonInput {
  search_text: string;
}

const PHONE_REGEX = /^[0-9+()\-.\s/]{3,40}$/;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').trim() : '';
}

/** Validates and normalises person data from a form or an import row. Throws UserError. */
export function cleanPersonInput(input: {
  full_name: unknown;
  details: Record<string, unknown>;
  public_fields: unknown[];
  admin_notes: unknown;
}): PersonRow {
  const fullName = clean(input.full_name).replace(/\s+/g, ' ');
  if (!fullName) throw new UserError('Full name is required.');
  if (fullName.length > 120) throw new UserError('Full name is too long (max 120 characters).');

  const details: Record<string, string> = {};
  for (const field of PROFILE_FIELDS) {
    let value = clean(input.details[field.key]);
    if (!value) continue;
    if (field.type === 'select' && field.options) {
      // Accept any capitalisation (e.g. from a CSV import) and store the canonical spelling.
      value = field.options.find((option) => option.toLowerCase() === value.toLowerCase()) ?? value;
    }
    if (value.length > field.maxLength) {
      throw new UserError(`${field.label} is too long (max ${field.maxLength} characters).`);
    }
    if (field.type === 'email' && !fieldHref('email', value)) {
      throw new UserError(`${field.label} doesn't look like an email address.`);
    }
    if (field.type === 'url' && !fieldHref('url', value)) {
      throw new UserError(`${field.label} doesn't look like a web address.`);
    }
    if (field.type === 'select' && field.options && !field.options.includes(value)) {
      throw new UserError(`${field.label} must be one of: ${field.options.join(', ')}.`);
    }
    if (field.type === 'tel' && !PHONE_REGEX.test(value)) {
      throw new UserError(`${field.label} may only contain digits, spaces and + ( ) - . /`);
    }
    details[field.key] = value;
  }

  const allowed = new Set(ALL_VISIBILITY_KEYS);
  const publicFields = [...new Set(input.public_fields.map(clean))].filter((key) => allowed.has(key));

  const notes = clean(input.admin_notes);
  if (notes.length > 2000) throw new UserError('Admin notes are too long (max 2000 characters).');
  const adminNotes = notes || null;

  return {
    full_name: fullName,
    details,
    public_fields: publicFields,
    admin_notes: adminNotes,
    search_text: buildSearchText(fullName, details, adminNotes),
  };
}

/** Reads the person form (see components/PersonForm.tsx). */
export function parsePersonForm(fd: FormData): { row: PersonRow; photo: File | null; removePhoto: boolean } {
  const details: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) details[field.key] = fd.get(`f_${field.key}`);

  const row = cleanPersonInput({
    full_name: fd.get(NAME_KEY),
    details,
    public_fields: fd.getAll('public'),
    admin_notes: fd.get('admin_notes'),
  });

  const photoValue = fd.get('photo');
  const photo = photoValue instanceof File && photoValue.size > 0 ? photoValue : null;
  return { row, photo, removePhoto: fd.get('remove_photo') === 'on' };
}
