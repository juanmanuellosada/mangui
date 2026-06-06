-- =============================================================
-- 0032_demo_readonly.sql
-- Demo account read-only enforcement via RESTRICTIVE RLS policies.
-- The demo user (demo.mangui@gmail.com) can read everything but
-- cannot INSERT, UPDATE, or DELETE any user-owned data.
-- Security is enforced at the DB level; UI is a nicety on top.
--
-- Tables covered: profiles, accounts, movements, transfers,
--   categories, card_statements, installment_purchases,
--   recurring_transactions, recurring_occurrences, budgets,
--   goals, goal_accounts, goal_categories, goal_snapshots,
--   movement_attachments, auto_rules, auto_rule_conditions,
--   saved_views, push_subscriptions, notification_log,
--   user_ai_settings.
--
-- EXCLUDED: user_preferences (demo can toggle theme/currency),
--           ai_usage (written by service-role, bypasses RLS anyway),
--           exchange_rates (system data, no user writes).
-- =============================================================

-- 1. Add is_demo column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 2. SECURITY DEFINER helper: returns true when the current user is NOT the demo.
--    Non-demo users → true → RESTRICTIVE policy passes → permissive policies decide.
--    Demo user → false → RESTRICTIVE policy blocks all writes.
CREATE OR REPLACE FUNCTION public.user_is_not_demo()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_demo = true
  );
$$;

-- 3. RESTRICTIVE policies per table
--    Pattern: three per table (no INSERT / no UPDATE / no DELETE for demo users).
--    SELECT is not restricted — the demo can still browse all data.

-- profiles
CREATE POLICY "demo_readonly_no_insert" ON profiles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON profiles AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON profiles AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- accounts
CREATE POLICY "demo_readonly_no_insert" ON accounts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON accounts AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON accounts AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- movements
CREATE POLICY "demo_readonly_no_insert" ON movements AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON movements AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON movements AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- transfers
CREATE POLICY "demo_readonly_no_insert" ON transfers AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON transfers AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON transfers AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- categories
CREATE POLICY "demo_readonly_no_insert" ON categories AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON categories AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON categories AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- card_statements
CREATE POLICY "demo_readonly_no_insert" ON card_statements AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON card_statements AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON card_statements AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- installment_purchases
CREATE POLICY "demo_readonly_no_insert" ON installment_purchases AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON installment_purchases AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON installment_purchases AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- recurring_transactions
CREATE POLICY "demo_readonly_no_insert" ON recurring_transactions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON recurring_transactions AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON recurring_transactions AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- recurring_occurrences
CREATE POLICY "demo_readonly_no_insert" ON recurring_occurrences AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON recurring_occurrences AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON recurring_occurrences AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- budgets
CREATE POLICY "demo_readonly_no_insert" ON budgets AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON budgets AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON budgets AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- goals
CREATE POLICY "demo_readonly_no_insert" ON goals AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON goals AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON goals AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- goal_accounts (join table — no user_id, ownership via goals)
CREATE POLICY "demo_readonly_no_insert" ON goal_accounts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON goal_accounts AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON goal_accounts AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- goal_categories (join table — no user_id, ownership via goals)
CREATE POLICY "demo_readonly_no_insert" ON goal_categories AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON goal_categories AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON goal_categories AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- goal_snapshots
CREATE POLICY "demo_readonly_no_insert" ON goal_snapshots AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON goal_snapshots AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON goal_snapshots AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- movement_attachments (covers both movement and transfer attachments)
CREATE POLICY "demo_readonly_no_insert" ON movement_attachments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON movement_attachments AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON movement_attachments AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- auto_rules
CREATE POLICY "demo_readonly_no_insert" ON auto_rules AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON auto_rules AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON auto_rules AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- auto_rule_conditions (join table — ownership via auto_rules)
CREATE POLICY "demo_readonly_no_insert" ON auto_rule_conditions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON auto_rule_conditions AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON auto_rule_conditions AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- saved_views
CREATE POLICY "demo_readonly_no_insert" ON saved_views AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON saved_views AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON saved_views AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- push_subscriptions
CREATE POLICY "demo_readonly_no_insert" ON push_subscriptions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON push_subscriptions AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON push_subscriptions AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- notification_log
CREATE POLICY "demo_readonly_no_insert" ON notification_log AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON notification_log AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON notification_log AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- user_ai_settings
CREATE POLICY "demo_readonly_no_insert" ON user_ai_settings AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_update" ON user_ai_settings AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_is_not_demo());
CREATE POLICY "demo_readonly_no_delete" ON user_ai_settings AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_is_not_demo());

-- 4. Mark the demo user
UPDATE profiles SET is_demo = true WHERE id = '54353bbe-b6fc-42ad-bbfb-58923c208e1f';
