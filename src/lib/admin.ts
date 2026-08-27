import { supabase } from '@/lib/supabase';
import type { AdminProfileRow, AdminLanternRow, ApprovalStatus, Role } from '@/lib/types';

export async function fetchAdminProfiles(): Promise<AdminProfileRow[]> {
  const { data, error } = await supabase.rpc('admin_list_profiles');
  if (error) throw error;
  return (data ?? []) as AdminProfileRow[];
}

export async function setApprovalStatus(userId: string, status: ApprovalStatus): Promise<void> {
  const { error } = await supabase.rpc('admin_set_approval_status', { p_user_id: userId, p_status: status });
  if (error) throw error;
}

export async function adminUpdateProfile(params: {
  userId: string;
  ocName?: string;
  email?: string;
  wish?: string;
  quote?: string;
  avatarUrl?: string;
  role?: Role;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_update_profile', {
    p_user_id: params.userId,
    p_oc_name: params.ocName ?? null,
    p_email: params.email ?? null,
    p_wish: params.wish ?? null,
    p_quote: params.quote ?? null,
    p_avatar_url: params.avatarUrl ?? null,
    p_role: params.role ?? null,
  });
  if (error) throw error;
}

export async function fetchAdminLanterns(): Promise<AdminLanternRow[]> {
  const { data, error } = await supabase.rpc('admin_list_lanterns');
  if (error) throw error;
  return (data ?? []) as AdminLanternRow[];
}

export async function adminUpdateLantern(params: {
  lanternId: string;
  senderName?: string;
  wish?: string;
  recipientName?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_update_lantern', {
    p_lantern_id: params.lanternId,
    p_sender_name: params.senderName ?? null,
    p_wish: params.wish ?? null,
    p_recipient_name: params.recipientName ?? null,
  });
  if (error) throw error;
}

export async function adminDeleteLantern(lanternId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_lantern', { p_lantern_id: lanternId });
  if (error) throw error;
}

export async function adminChangePassword(userId: string, newPassword: string): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-change-password', {
    body: { userId, newPassword },
  });
  if (error) throw error;
}
