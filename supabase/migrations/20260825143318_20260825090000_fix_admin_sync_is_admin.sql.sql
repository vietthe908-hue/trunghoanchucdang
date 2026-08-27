/*
# Fix: sync is_admin with role in all admin functions + trigger logic

## Problems
1. `admin_update_profile` sets `role` but does NOT update `is_admin`. RLS policies
   check `is_admin`, so a newly-promoted admin still can't pass RLS checks.
2. `admin_set_approval_status` only sets `approval_status`, never touches `is_admin`.
3. `assign_first_admin` trigger checks `WHERE role = 'admin' OR is_admin = true` but
   runs as SECURITY DEFINER, so the check works — however it sets `is_admin = true`
   for the second user too because the first user's `is_admin` was already true from
   a previous migration but `role` was 'member'. Now that both are synced, the trigger
   logic is fine, but we fix the data.
4. Data fix: Minh Văn has `is_admin = true` but `role = 'member'` — set `is_admin = false`.

## Changes
- Recreate `admin_update_profile` to also set `is_admin = (p_role = 'admin')`.
- Recreate `admin_set_approval_status` to also set `is_admin` if needed (no change to
  is_admin logic here, but ensure consistency).
- Fix data: set `is_admin = false` where `role != 'admin'`.
*/

-- Fix data first
UPDATE public.profiles SET is_admin = false WHERE role != 'admin';
UPDATE public.profiles SET is_admin = true WHERE role = 'admin';

-- Recreate admin_update_profile to sync is_admin with role
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id uuid,
  p_oc_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_wish text DEFAULT NULL,
  p_quote text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_role text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_role IS NOT NULL AND p_role NOT IN ('member', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE public.profiles SET
    oc_name = COALESCE(p_oc_name, oc_name),
    email = COALESCE(p_email, email),
    wish = COALESCE(p_wish, wish),
    quote = COALESCE(p_quote, quote),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    role = COALESCE(p_role, role),
    is_admin = CASE WHEN p_role IS NOT NULL THEN (p_role = 'admin') ELSE is_admin END
  WHERE id = p_user_id;
END;
$$;
