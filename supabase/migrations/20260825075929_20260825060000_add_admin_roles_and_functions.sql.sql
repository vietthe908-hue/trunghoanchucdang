/*
# Admin panel, profile quotes, and server-enforced access control

1. Schema additions
- `profiles.role`: 'member' | 'admin' (default member)
- `profiles.quote`: trích dẫn của nhân vật (OC quote)

2. First-admin bootstrap
- Trigger auto-promotes the first profile to admin + approved.

3. Column-level privileges
- Users may only UPDATE their own oc_name, avatar_url, wish, quote.
- role, approval_status, email are revoked from direct client writes.

4. Privileged SECURITY DEFINER functions (admin-only)
- admin_list_profiles, admin_set_approval_status, admin_update_profile
- admin_list_lanterns, admin_update_lantern, admin_delete_lantern

5. updated_at auto-maintenance trigger
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  ADD COLUMN IF NOT EXISTS quote text NOT NULL DEFAULT 'Trăm năm trôi theo một giấc mộng, tỉnh hay say đều là nhân gian.';

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- First-admin bootstrap
CREATE OR REPLACE FUNCTION public.assign_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    NEW.role := 'admin';
    NEW.approval_status := 'approved';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_first_admin ON public.profiles;
CREATE TRIGGER profiles_first_admin
  BEFORE INSERT ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.assign_first_admin();

-- Column-level privileges: users can only touch their own content columns
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (oc_name, avatar_url, wish, quote) ON public.profiles TO authenticated;

-- Admin: list all profiles
CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS TABLE (
  id uuid, oc_name text, email text, avatar_url text,
  wish text, quote text, role text, approval_status text, created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT p.id, p.oc_name, p.email, p.avatar_url, p.wish, p.quote, p.role, p.approval_status, p.created_at
  FROM public.profiles p ORDER BY p.created_at DESC;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;

-- Admin: set approval status
CREATE OR REPLACE FUNCTION public.admin_set_approval_status(p_user_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.profiles SET approval_status = p_status WHERE id = p_user_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_approval_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_approval_status(uuid, text) TO authenticated;

-- Admin: update a profile (all columns)
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id uuid, p_oc_name text DEFAULT NULL, p_email text DEFAULT NULL,
  p_wish text DEFAULT NULL, p_quote text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL, p_role text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    role = COALESCE(p_role, role)
  WHERE id = p_user_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, text, text) TO authenticated;

-- Admin: list all lanterns with owner names
CREATE OR REPLACE FUNCTION public.admin_list_lanterns()
RETURNS TABLE (
  id uuid, user_id uuid, style_index integer, sender_name text,
  wish text, recipient_name text, recipient_hint text, released_at timestamptz, owner_name text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT l.id, l.user_id, l.style_index, l.sender_name, l.wish, l.recipient_name, l.recipient_hint, l.released_at, p.oc_name
  FROM public.lanterns l LEFT JOIN public.profiles p ON p.id = l.user_id
  ORDER BY l.released_at DESC;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_lanterns() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_lanterns() TO authenticated;

-- Admin: update a lantern
CREATE OR REPLACE FUNCTION public.admin_update_lantern(
  p_lantern_id uuid, p_sender_name text DEFAULT NULL, p_wish text DEFAULT NULL,
  p_recipient_name text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.lanterns SET
    sender_name = COALESCE(p_sender_name, sender_name),
    wish = COALESCE(p_wish, wish),
    recipient_name = COALESCE(p_recipient_name, recipient_name)
  WHERE id = p_lantern_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_update_lantern(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_lantern(uuid, text, text, text) TO authenticated;

-- Admin: delete a lantern
CREATE OR REPLACE FUNCTION public.admin_delete_lantern(p_lantern_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.lanterns WHERE id = p_lantern_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_lantern(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_lantern(uuid) TO authenticated;

-- Allow users to SELECT their own quote (already covered by profiles_select_own, no change needed)
-- Allow users to UPDATE their own quote (covered by GRANT UPDATE above)
