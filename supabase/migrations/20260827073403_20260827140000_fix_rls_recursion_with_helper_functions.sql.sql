/*
# Break infinite recursion in RLS policies

1. Problem
- lanterns INSERT RLS policy checks `profiles.approval_status = 'approved'` by querying `profiles`.
- profiles SELECT RLS policy `profiles_select_admin` checks `is_admin` by querying `profiles` again.
- This creates infinite recursion → ERROR: "infinite recursion detected in policy for relation profiles".
- Approved users cannot insert lanterns at all.

2. Fix
- Create `is_current_user_admin()` SECURITY DEFINER function that reads profiles with owner privileges (bypasses RLS).
- Create `is_current_user_approved()` SECURITY DEFINER function for approval check.
- Rewrite all RLS policies on `lanterns` and `profiles` to use these helpers instead of subquerying `profiles`.
*/

-- Helper: is the current user an admin? (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- Helper: is the current user approved? (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_current_user_approved()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT approval_status = 'approved' FROM public.profiles WHERE id = auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_approved() TO authenticated;

-- Drop all existing policies on lanterns and profiles, recreate using helpers
DROP POLICY IF EXISTS lanterns_delete_admin ON public.lanterns;
DROP POLICY IF EXISTS lanterns_delete_own ON public.lanterns;
DROP POLICY IF EXISTS lanterns_insert_admin ON public.lanterns;
DROP POLICY IF EXISTS lanterns_insert_approved ON public.lanterns;
DROP POLICY IF EXISTS lanterns_select_public ON public.lanterns;
DROP POLICY IF EXISTS lanterns_update_admin ON public.lanterns;
DROP POLICY IF EXISTS lanterns_update_own ON public.lanterns;

DROP POLICY IF EXISTS profiles_delete_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

-- Recreate lanterns policies
CREATE POLICY lanterns_select_public ON public.lanterns
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY lanterns_insert_approved ON public.lanterns
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_current_user_approved());

CREATE POLICY lanterns_insert_admin ON public.lanterns
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY lanterns_update_own ON public.lanterns
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY lanterns_update_admin ON public.lanterns
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

CREATE POLICY lanterns_delete_own ON public.lanterns
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY lanterns_delete_admin ON public.lanterns
  FOR DELETE TO authenticated
  USING (public.is_current_user_admin());

-- Recreate profiles policies
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

CREATE POLICY profiles_delete_own ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id);
