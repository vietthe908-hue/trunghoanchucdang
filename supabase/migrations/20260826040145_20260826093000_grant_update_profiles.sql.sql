/*
# Grant UPDATE privilege to authenticated role on profiles

The authenticated role was missing UPDATE privilege on profiles, so users could not
update their own quote, avatar_url, wish, or oc_name even though RLS policies allowed it.
RLS policies are checked AFTER column-level grants, so missing grants block updates entirely.
*/

GRANT UPDATE (oc_name, avatar_url, wish, quote) ON public.profiles TO authenticated;
