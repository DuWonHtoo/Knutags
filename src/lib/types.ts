export type TagStatus = 'unassigned' | 'assigned' | 'inactive' | 'void';

export const TAG_STATUSES: readonly TagStatus[] = ['unassigned', 'assigned', 'inactive', 'void'];

export function isTagStatus(value: unknown): value is TagStatus {
  return typeof value === 'string' && (TAG_STATUSES as readonly string[]).includes(value);
}

export interface Batch {
  id: string;
  label: string;
  quantity: number;
  notes: string | null;
  engraved_at: string | null;
  created_at: string;
}

export interface BatchOverview extends Batch {
  total: number;
  unassigned_count: number;
  assigned_count: number;
  inactive_count: number;
  void_count: number;
  scan_total: number;
}

export interface Tag {
  id: string;
  batch_id: string;
  batch_seq: number;
  status: TagStatus;
  person_id: string | null;
  scan_count: number;
  last_scanned_at: string | null;
  assigned_at: string | null;
  status_changed_at: string;
  created_at: string;
}

export interface Person {
  id: string;
  full_name: string;
  details: Record<string, string>;
  public_fields: string[];
  photo_path: string | null;
  admin_notes: string | null;
  search_text: string;
  created_at: string;
  updated_at: string;
}

export interface PersonOverview extends Person {
  tags: { id: string; status: TagStatus }[];
  tag_ids: string;
  assigned_count: number;
  inactive_count: number;
}

/** What the public lookup RPC returns (person never includes admin-only columns). */
export type LookupResult =
  | {
      result: 'ok';
      tag: { id: string; status: TagStatus };
      person: Omit<Person, 'search_text' | 'admin_notes'> | null;
    }
  | { result: 'not_found' }
  | { result: 'rate_limited' };

/** Return value of server actions used with useActionState. */
export type ActionState = { ok?: boolean; error?: string; message?: string } | null;
