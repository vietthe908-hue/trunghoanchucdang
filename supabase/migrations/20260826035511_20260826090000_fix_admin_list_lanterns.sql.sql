/*
# Rebuild admin_list_lanterns with explicit RETURNS TABLE and fix return column name
*/
CREATE OR REPLACE FUNCTION public.admin_list_lanterns()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  style_index integer,
  sender_name text,
  wish text,
  recipient_name text,
  recipient_hint text,
  released_at timestamptz,
  owner_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT l.id, l.user_id, l.style_index, l.sender_name, l.wish, l.recipient_name, l.recipient_hint, l.released_at, p.oc_name
  FROM public.lanterns l
  LEFT JOIN public.profiles p ON p.id = l.user_id
  ORDER BY l.released_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_lanterns() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_lanterns() TO authenticated;
