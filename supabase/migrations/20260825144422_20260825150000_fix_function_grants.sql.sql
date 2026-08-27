/*
# Fix function grants and ensure profile recovery works

1. Security fix
- Revoke EXECUTE on all admin functions and ensure_my_profile from anon and PUBLIC.
- Only authenticated users should be able to call these functions.
- The functions internally check auth.uid() so anon calls would fail, but
  we remove the grant anyway to follow least-privilege.

2. Profile recovery
- The on_auth_user_created_profile trigger already exists from a prior migration.
- ensure_my_profile already exists and is called on login.
- No schema changes needed; this migration only fixes grants.
*/

REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_approval_status(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_lanterns() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_lantern(uuid, text, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_lantern(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_approval_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_lanterns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_lantern(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_lantern(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
