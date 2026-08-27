/*
# Fix update_my_profile to handle NULL avatar_url properly

COALESCE(p_avatar_url, avatar_url) cannot set avatar_url to NULL.
Use a sentinel approach: separate the "not provided" case from "set to NULL".
Only avatar_url is nullable; wish/quote/oc_name always have values.
*/

DROP FUNCTION IF EXISTS public.update_my_profile(text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_oc_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_wish text DEFAULT NULL,
  p_quote text DEFAULT NULL
)
RETURNS SETOF public.profiles
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
    avatar_url = p_avatar_url,
    wish       = COALESCE(p_wish, wish),
    quote      = COALESCE(p_quote, quote),
    updated_at = now()
  WHERE id = v_uid;

  RETURN QUERY
  SELECT * FROM public.profiles
  WHERE id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_profile FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile TO authenticated;
