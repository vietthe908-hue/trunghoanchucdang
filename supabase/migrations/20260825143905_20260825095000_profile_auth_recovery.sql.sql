/*
# Make profile creation and recovery resilient

1. Purpose
- Ensure every new authentication account receives a matching public profile even when email confirmation prevents a browser session.
- Repair a missing profile safely when the owner signs in.

2. Database changes
- Add `create_profile_for_auth_user()` to create a profile from `auth.users` and signup metadata.
- Add `ensure_my_profile()` to create or return only the currently signed-in user's profile.
- Add an `auth.users` trigger that calls the profile creation function after signup.

3. Security
- Both functions use SECURITY DEFINER with a fixed `public` search path.
- `ensure_my_profile()` refuses calls without `auth.uid()` and never accepts a user ID from the browser.
- Profile RLS remains owner-scoped; no public profile access is added.

4. Compatibility
- Existing profiles are preserved.
- Existing users can be repaired on their next successful sign-in.
*/

CREATE OR REPLACE FUNCTION public.create_profile_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  display_name text;
BEGIN
  display_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'oc_name', '')), '');
  IF display_name IS NULL THEN
    display_name := split_part(COALESCE(NEW.email, 'quý nhân'), '@', 1);
  END IF;

  INSERT INTO public.profiles (id, oc_name, email)
  VALUES (NEW.id, left(display_name, 80), COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_for_auth_user();

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
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
SET search_path TO public
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
  SELECT p.id, p.oc_name, p.email, p.avatar_url, p.wish, p.quote, p.role, p.approval_status
  FROM public.profiles p
  WHERE p.id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
