/*
# Add is_admin to ensure_my_profile return

1. Problem
- Hàm ensure_my_profile không trả về cột is_admin, nên frontend không biết người dùng có quyền quản trị hay không.
- Tài khoản có is_admin=true nhưng role='member' không thấy nút Quản trị.

2. Changes
- Thêm cột is_admin (boolean) vào RETURN TABLE của ensure_my_profile.
- DROP + CREATE lại vì thay đổi return type.
*/

DROP FUNCTION IF EXISTS public.ensure_my_profile();

CREATE FUNCTION public.ensure_my_profile()
RETURNS TABLE(id uuid, oc_name text, email text, avatar_url text, wish text, quote text, role text, approval_status text, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  auth_email text;
  display_name text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT u.email, NULLIF(trim(COALESCE(u.raw_user_meta_data ->> 'oc_name', '')), '')
  INTO auth_email, display_name
  FROM auth.users u
  WHERE u.id = current_user_id;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = current_user_id) THEN
    IF display_name IS NULL THEN
      display_name := split_part(COALESCE(auth_email, 'quý nhân'), '@', 1);
    END IF;
    INSERT INTO public.profiles (id, oc_name, email)
    VALUES (current_user_id, left(display_name, 80), COALESCE(auth_email, ''))
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT p.id, p.oc_name, p.email, p.avatar_url, p.wish, p.quote, p.role, p.approval_status, p.is_admin
  FROM public.profiles p
  WHERE p.id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
