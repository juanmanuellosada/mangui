-- 0041 added check_movement_converted_amount() as a SECURITY DEFINER trigger
-- function. Supabase's default privileges make it directly callable by anon /
-- authenticated via /rest/v1/rpc/, which the security advisor flags. Trigger
-- functions never need to be called directly (they run in trigger context),
-- so revoke EXECUTE — matching the hardening approach in 0008_harden_functions.
-- The trigger itself keeps firing regardless of these grants.
REVOKE EXECUTE ON FUNCTION public.check_movement_converted_amount() FROM PUBLIC, anon, authenticated;
