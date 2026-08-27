/*
# Make touch_updated_at SECURITY DEFINER

The touch_updated_at trigger fires BEFORE UPDATE on profiles.
It runs as the calling user, so it needs UPDATE privilege on updated_at.
Making it SECURITY DEFINER lets it set updated_at regardless of caller privileges,
removing the column-grant dependency that was breaking profile updates.
*/

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.touch_updated_at FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_updated_at TO authenticated;
