-- =============================================================
-- 0033_demo_readonly_preferences.sql
-- Extend demo read-only enforcement to user_preferences.
--
-- Previously excluded from 0032 so the demo user could toggle
-- theme and currency freely. Now that the UI blocks writes in
-- demo mode, the DB layer must also enforce it for completeness.
--
-- Relies on the public.user_is_not_demo() helper created in 0032.
-- =============================================================

-- user_preferences
CREATE POLICY "demo_readonly_no_insert" ON user_preferences AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON user_preferences AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON user_preferences AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());
