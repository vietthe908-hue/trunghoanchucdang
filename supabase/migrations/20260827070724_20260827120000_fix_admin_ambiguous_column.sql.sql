/*
# Fix ambiguous column reference in admin functions

1. Problem
- Các hàm admin_list_profiles, admin_list_lanterns, admin_set_approval_status, admin_update_profile, admin_update_lantern, admin_delete_lantern đều có RETURNS TABLE(id uuid, ...) hoặc tham số p_user_id.
- Bên trong hàm, `WHERE id = auth.uid()` bị ambiguous vì PL/pgSQL tạo biến cho mỗi cột trong RETURNS TABLE.
- Lỗi: "column reference 'id' is ambiguous" — có thể tham chiếu đến biến hàm hoặc cột bảng profiles.

2. Fix
- Alias bảng profiles thành `pr` trong tất cả kiểm tra `is_admin` để tránh ambiguity.
- Ví dụ: `WHERE pr.id = auth.uid()` thay vì `WHERE id = auth.uid()`.
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.is_admin = true) THEN
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.is_admin = true) THEN
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.is_admin = true) THEN
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.is_admin = true) THEN
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.is_admin = true) THEN
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.is_admin = true) THEN
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
