-- =============================================================
-- 0008_harden_functions.sql
-- Remediación de security advisors de Supabase.
-- Depende de: 0002 (set_updated_at), 0006 (handle_new_user, seed_default_categories)
-- =============================================================

-- 1) search_path inmutable en la función updated_at (lint 0011).
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- 2) Las funciones SECURITY DEFINER no deben ser invocables vía API REST
--    (lints 0028 / 0029). handle_new_user corre solo como trigger de
--    auth.users; seed_default_categories solo se invoca desde handle_new_user.
--    Exponerlas permitiría a anon/authenticated llamarlas vía /rest/v1/rpc/...
--    y, en el caso de seed_default_categories(uuid), escribir categorías para
--    OTRO usuario (la función bypassa RLS por ser SECURITY DEFINER).
REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_categories(uuid) FROM public, anon, authenticated;
