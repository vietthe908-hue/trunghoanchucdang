export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type Role = 'member' | 'admin';

export interface Profile {
  id: string;
  oc_name: string;
  email: string;
  avatar_url: string | null;
  wish: string;
  quote: string;
  role: Role;
  approval_status: ApprovalStatus;
  created_at: string;
  is_admin: boolean;
}

export interface Lantern {
  id: string;
  style_index: number;
  sender_name: string;
  wish: string;
  recipient_name?: string | null;
  recipient_hint?: string | null;
  released_at?: string;
  owner_name?: string | null;
  user_id?: string;
}

export interface AdminProfileRow {
  id: string;
  oc_name: string;
  email: string;
  avatar_url: string | null;
  wish: string;
  quote: string;
  role: Role;
  approval_status: ApprovalStatus;
  created_at: string;
}

export interface AdminLanternRow {
  id: string;
  user_id: string;
  style_index: number;
  sender_name: string;
  wish: string;
  recipient_name: string | null;
  recipient_hint: string | null;
  released_at: string;
  owner_name: string | null;
}
