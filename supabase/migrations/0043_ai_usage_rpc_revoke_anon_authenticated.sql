-- Supabase's default privileges grant EXECUTE on new functions to anon and
-- authenticated explicitly (not via PUBLIC), so the REVOKE ALL FROM PUBLIC in
-- 0042 did not remove them. Revoke explicitly so only service_role (server-side
-- admin client) can call check_and_increment_ai_usage — otherwise an
-- authenticated user could call it directly from the browser with an arbitrary
-- p_limit (bypassing the daily limit) or an arbitrary p_user_id (writing usage
-- rows for other users, since the function is SECURITY DEFINER).
REVOKE EXECUTE ON FUNCTION public.check_and_increment_ai_usage(uuid, integer, text) FROM anon, authenticated;
