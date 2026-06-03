-- Refactor de Metas — schema v2 (parte 2/2: todo menos el ADD VALUE del enum)

DO $$ BEGIN
  CREATE TYPE goal_period AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE goals ADD COLUMN IF NOT EXISTS icon       text        NULL;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_global  boolean     NOT NULL DEFAULT false;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS period     goal_period NOT NULL DEFAULT 'monthly';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS start_date date        NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS end_date   date        NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS recurring  boolean     NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS goal_accounts (
  goal_id    uuid NOT NULL REFERENCES goals(id)    ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_goal_accounts_goal ON goal_accounts(goal_id);

CREATE TABLE IF NOT EXISTS goal_categories (
  goal_id     uuid NOT NULL REFERENCES goals(id)      ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_goal_categories_goal ON goal_categories(goal_id);

ALTER TABLE goal_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "goal_accounts_select_own" ON goal_accounts FOR SELECT
    USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_accounts.goal_id AND g.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "goal_accounts_insert_own" ON goal_accounts FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_accounts.goal_id AND g.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "goal_accounts_update_own" ON goal_accounts FOR UPDATE
    USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_accounts.goal_id AND g.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_accounts.goal_id AND g.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "goal_accounts_delete_own" ON goal_accounts FOR DELETE
    USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_accounts.goal_id AND g.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE goal_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "goal_categories_select_own" ON goal_categories FOR SELECT
    USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_categories.goal_id AND g.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "goal_categories_insert_own" ON goal_categories FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_categories.goal_id AND g.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "goal_categories_update_own" ON goal_categories FOR UPDATE
    USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_categories.goal_id AND g.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_categories.goal_id AND g.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "goal_categories_delete_own" ON goal_categories FOR DELETE
    USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_categories.goal_id AND g.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO goal_categories (goal_id, category_id)
SELECT id, category_id FROM goals WHERE category_id IS NOT NULL
ON CONFLICT (goal_id, category_id) DO NOTHING;

INSERT INTO goal_accounts (goal_id, account_id)
SELECT id, account_id FROM goals WHERE account_id IS NOT NULL
ON CONFLICT (goal_id, account_id) DO NOTHING;

UPDATE goals SET is_global = true
WHERE category_id IS NULL AND account_id IS NULL AND is_global = false;

ALTER TABLE goal_snapshots ADD COLUMN IF NOT EXISTS period_start  date          NULL;
ALTER TABLE goal_snapshots ADD COLUMN IF NOT EXISTS period_end    date          NULL;
ALTER TABLE goal_snapshots ADD COLUMN IF NOT EXISTS target_amount numeric(18,2) NULL CHECK (target_amount >= 0);
ALTER TABLE goal_snapshots ADD COLUMN IF NOT EXISTS percent       numeric(7,2)  NULL;
ALTER TABLE goal_snapshots ADD COLUMN IF NOT EXISTS snap_status   text          NULL
  CHECK (snap_status IN ('on_track', 'near', 'reached', 'exceeded'));

UPDATE goal_snapshots
SET period_start = month, period_end = (month + INTERVAL '1 month' - INTERVAL '1 day')::date
WHERE period_start IS NULL AND month IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE goal_snapshots ADD CONSTRAINT uq_goal_snapshots_goal_period UNIQUE (goal_id, period_start);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE goals DROP CONSTRAINT IF EXISTS chk_goal_target;
ALTER TABLE goals ADD CONSTRAINT chk_goal_target CHECK (
  (type = 'income'    AND target_amount  IS NOT NULL)
  OR (type = 'saving'    AND target_amount  IS NOT NULL)
  OR (type = 'reduction' AND target_percent IS NOT NULL)
);

ALTER TABLE goals DROP COLUMN IF EXISTS category_id;
ALTER TABLE goals DROP COLUMN IF EXISTS account_id;
