/*
# Grant UPDATE on updated_at to authenticated

The touch_updated_at trigger fires BEFORE UPDATE and sets NEW.updated_at = now().
The trigger function is NOT SECURITY DEFINER, so it runs as the calling user.
The authenticated role lacked UPDATE privilege on updated_at, so every profile
update (quote, avatar_url, wish, oc_name) failed silently.
*/

GRANT UPDATE (updated_at) ON public.profiles TO authenticated;
