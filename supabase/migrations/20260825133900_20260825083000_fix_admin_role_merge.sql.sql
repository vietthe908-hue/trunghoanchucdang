/*
# Fix admin role and approval status for existing first user

1. Data fix
- Set `role = 'admin'` and `approval_status = 'approved'` for all profiles where `is_admin = true`.
- This merges the legacy `is_admin` boolean column with the `role` text column so both
  the RLS policies (which check `is_admin`) and the SECURITY DEFINER functions (which
  check `role`) agree on who is an admin.

2. Trigger fix
- Drop the old `on_first_user_promote` trigger (from a previous migration) that only
  set `is_admin = true` and `approval_status = 'approved'`.
- Replace `assign_first_admin` so it sets BOTH `role = 'admin'` and `is_admin = true`
  and `approval_status = 'approved'` for the first user, ensuring all three admin
  systems agree going forward.

3. No schema changes
- No columns added or removed; no data lost.
*/

UPDATE public.profiles
SET role = 'admin', approval_status = 'approved', is_admin = true
WHERE is_admin = true;

DROP TRIGGER IF EXISTS on_first_user_promote ON public.profiles;
DROP FUNCTION IF EXISTS public.auto_promote_first_user();

CREATE OR REPLACE FUNCTION public.assign_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin' OR is_admin = true) THEN
    NEW.role := 'admin';
    NEW.is_admin := true;
    NEW.approval_status := 'approved';
  END IF;
  RETURN NEW;
END; $$;
