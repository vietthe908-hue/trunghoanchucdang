/*
# Fix admin functions to use is_admin instead of role

1. Problem
- Các hàm admin kiểm tra `role = 'admin'` nhưng cột `role` có thể là 'member' ngay cả khi `is_admin = true`.
- RLS policies dùng `is_admin = true`, nên các hàm cũng cần dùng `is_admin` để nhất quán.
- Tài khoản quản trị có `is_admin = true` nhưng `role = 'member'` bị từ chối truy cập.

2. Changes
- Đổi tất cả kiểm tra `role = 'admin'` sang `is_admin = true` trong 6 hàm admin.
- DROP + CREATE lại admin_update_profile vì thay đổi parameter signatures (giữ DEFAULT NULL).
*/

DROP FUNCTION IF EXISTS public.admin_list_profiles();
DROP FUNCTION IF EXISTS public.admin_list_lanterns();
DROP FUNCTION IF EXISTS public.admin_set_approval_status(uuid, text);
DROP FUNCTION IF EXISTS public.admin_update_profile(uuid, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_update_lantern(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.admin_delete_lantern(uuid);

CREATE FUNCTION public.admin_list_profiles()
RETURNS TABLE(id uuid, oc_name text, email text, avatar_url text, wish text, quote text, role text, approval_status text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT p.id, p.oc_name, p.email, p.avatar_url, p.wish, p.quote, p.role, p.approval_status, p.created_at
  FROM public.profiles p ORDER BY p.created_at DESC;
END;
$$;

CREATE FUNCTION public.admin_list_lanterns()
RETURNS TABLE(id uuid, user_id uuid, style_index integer, sender_name text, wish text, recipient_name text, recipient_hint text, released_at timestamptz, owner_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT l.id, l.user_id, l.style_index, l.sender_name, l.wish, l.recipient_name, l.recipient_hint, l.released_at, p.oc_name
  FROM public.lanterns l
  LEFT JOIN public.profiles p ON p.id = l.user_id
  ORDER BY l.released_at DESC;
END;
$$;

CREATE FUNCTION public.admin_set_approval_status(p_user_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.profiles SET approval_status = p_status WHERE id = p_user_id;
END;
$$;

CREATE FUNCTION public.admin_update_profile(
  p_user_id uuid, p_oc_name text DEFAULT NULL, p_email text DEFAULT NULL,
  p_wish text DEFAULT NULL, p_quote text DEFAULT NULL, p_avatar_url text DEFAULT NULL, p_role text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
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

CREATE FUNCTION public.admin_update_lantern(
  p_lantern_id uuid, p_sender_name text DEFAULT NULL, p_wish text DEFAULT NULL, p_recipient_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.lanterns SET
    sender_name = COALESCE(p_sender_name, sender_name),
    wish = COALESCE(p_wish, wish),
    recipient_name = COALESCE(p_recipient_name, recipient_name)
  WHERE id = p_lantern_id;
END;
$$;

CREATE FUNCTION public.admin_delete_lantern(p_lantern_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.lanterns WHERE id = p_lantern_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_lanterns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_approval_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_lantern(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_lantern(uuid) TO authenticated;
