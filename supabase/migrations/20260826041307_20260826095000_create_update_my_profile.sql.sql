/*
# Create update_my_profile SECURITY DEFINER function

Direct table UPDATE from the client fails due to column-privilege/trigger interactions.
Move the mutation into a SECURITY DEFINER function that runs as the owner, so it
bypasses RLS and column grants entirely. The function authorizes via auth.uid()
and only allows updating user-content columns (oc_name, avatar_url, wish, quote).
*/

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_oc_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_wish text DEFAULT NULL,
  p_quote text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  oc_name text,
  email text,
  avatar_url text,
  wish text,
  quote text,
  role text,
  approval_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.profiles SET
    oc_name    = COALESCE(p_oc_name, oc_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    wish       = COALESCE(p_wish, wish),
    quote      = COALESCE(p_quote, quote),
    updated_at = now()
  WHERE id = v_uid;

  RETURN QUERY
  SELECT p.id, p.oc_name, p.email, p.avatar_url, p.wish, p.quote, p.role, p.approval_status
  FROM public.profiles p
  WHERE p.id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_profile FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile TO authenticated;
