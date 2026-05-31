-- =============================================================
-- 0013_budgets_goals.sql
-- Fase 5 — Presupuestos y Metas
-- Tablas: budgets, goals, goal_snapshots
-- Depende de: 0001 (currency enum), 0003 (categories, accounts)
-- =============================================================

-- -----------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------

-- Período de presupuesto (ventana de evaluación)
DO $$ BEGIN
  CREATE TYPE budget_period AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Estado del presupuesto
DO $$ BEGIN
  CREATE TYPE budget_status AS ENUM ('active', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de meta: ahorro (acumular) o reducción (gastar menos)
DO $$ BEGIN
  CREATE TYPE goal_type AS ENUM ('saving', 'reduction');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Estado de la meta
DO $$ BEGIN
  CREATE TYPE goal_status AS ENUM ('active', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =================================================================
-- TABLA: budgets
-- Límite de gasto sobre una ventana de tiempo.
--
-- ALCANCE (scope):
--   category_ids uuid[] — categorías que entran en el presupuesto.
--                          Vacío = todas las categorías del usuario.
--   account_ids  uuid[] — cuentas que entran en el presupuesto.
--                          Vacío = todas las cuentas del usuario.
--
-- NOTA DE DISEÑO: Se usan arrays de uuid en lugar de tablas de
-- relación (budget_categories / budget_accounts) para mantener
-- la migración simple. No hay FK sobre arrays en PostgreSQL —
-- la integridad de ownership se valida en la capa de aplicación.
-- Si se borra una categoría o cuenta referenciada, simplemente
-- deja de coincidir con nuevos movimientos; los presupuestos
-- históricos quedan intactos con el uuid huérfano en el array.
--
-- GASTO ACUMULADO: derivado en runtime desde movements que caen
-- dentro de la ventana actual (start_date + period) y cuyo
-- account_id / category_id coinciden con el alcance configurado.
-- No se almacena ningún acumulador aquí.
-- =================================================================
CREATE TABLE IF NOT EXISTS budgets (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name            text           NOT NULL,
  limit_amount    numeric(18,2)  NOT NULL CHECK (limit_amount > 0),
  currency        currency       NOT NULL,
  period          budget_period  NOT NULL,

  -- Si true, la ventana se renueva automáticamente al vencer el período.
  -- Si false, el presupuesto es puntual (una sola ventana a partir de start_date).
  is_recurring    boolean        NOT NULL DEFAULT true,

  status          budget_status  NOT NULL DEFAULT 'active',

  -- Ancla del inicio de la primera ventana de evaluación.
  -- Para períodos recurrentes la app calcula la ventana activa
  -- sumando múltiplos del período a partir de esta fecha.
  start_date      date           NOT NULL DEFAULT CURRENT_DATE,

  -- Scope: vacío = todas las categorías del usuario
  category_ids    uuid[]         NOT NULL DEFAULT '{}',
  -- Scope: vacío = todas las cuentas del usuario
  account_ids     uuid[]         NOT NULL DEFAULT '{}',

  created_at      timestamptz    NOT NULL DEFAULT now(),
  updated_at      timestamptz    NOT NULL DEFAULT now()
);

-- Índice principal: listar presupuestos activos del usuario
CREATE INDEX IF NOT EXISTS idx_budgets_user_status
  ON budgets(user_id, status);

-- RLS
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_select_own"
  ON budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "budgets_insert_own"
  ON budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "budgets_update_own"
  ON budgets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "budgets_delete_own"
  ON budgets FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_budgets_updated_at ON budgets;
CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- TABLA: goals
-- Meta financiera: de ahorro (acumular un monto) o de reducción
-- (gastar menos en una categoría/cuenta respecto de una base).
--
-- Columnas de target (al menos una requerida según tipo):
--   target_amount   — Ahorro: monto a alcanzar.
--                     Reducción: monto máximo de gasto objetivo (opcional).
--   target_percent  — Solo Reducción: % de reducción sobre baseline_amount.
--   baseline_amount — Solo Reducción: gasto histórico de referencia.
--                     NULL = la app lo calcula automáticamente.
--
-- Constraint chk_goal_target garantiza que cada tipo tenga al menos
-- una métrica de objetivo definida.
-- =================================================================
CREATE TABLE IF NOT EXISTS goals (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name             text           NOT NULL,
  type             goal_type      NOT NULL,

  -- Ahorro: monto objetivo a acumular (requerido para type='saving').
  -- Reducción: monto máximo de gasto deseado (opcional).
  target_amount    numeric(18,2)  NULL CHECK (target_amount > 0),

  -- Solo Reducción: porcentaje de reducción deseado sobre el baseline.
  target_percent   numeric(5,2)   NULL CHECK (target_percent > 0 AND target_percent <= 100),

  -- Solo Reducción: gasto histórico de referencia.
  -- NULL indica que la app lo calcula automáticamente al evaluar.
  baseline_amount  numeric(18,2)  NULL CHECK (baseline_amount >= 0),

  currency         currency       NOT NULL,

  -- Scope: categoría o cuenta a la que aplica la meta (opcionales).
  -- NULL = aplica a la totalidad de movimientos del usuario.
  category_id      uuid           NULL REFERENCES categories(id) ON DELETE SET NULL,
  account_id       uuid           NULL REFERENCES accounts(id)   ON DELETE SET NULL,

  deadline         date           NULL,
  status           goal_status    NOT NULL DEFAULT 'active',

  created_at       timestamptz    NOT NULL DEFAULT now(),
  updated_at       timestamptz    NOT NULL DEFAULT now(),

  -- Integridad de objetivo por tipo:
  --   Ahorro     → target_amount obligatorio.
  --   Reducción  → target_percent o target_amount (al menos uno).
  CONSTRAINT chk_goal_target CHECK (
    (type = 'saving'    AND target_amount IS NOT NULL)
    OR
    (type = 'reduction' AND (target_percent IS NOT NULL OR target_amount IS NOT NULL))
  )
);

-- Índice principal: metas activas del usuario
CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON goals(user_id, status);

-- RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_own"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "goals_insert_own"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_update_own"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_delete_own"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_goals_updated_at ON goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- TABLA: goal_snapshots
-- Captura mensual del progreso de una meta.
-- Poblada opcionalmente por la app o por un cron job.
--
-- Para metas de Ahorro:   amount = monto acumulado en ese mes.
-- Para metas de Reducción: amount = gasto medido en ese mes.
--
-- La unicidad (goal_id, month) garantiza exactamente una snapshot
-- por meta y mes (month debe ser siempre el primer día del mes).
--
-- No se usa trigger updated_at: las filas son snapshots inmutables
-- una vez creadas (si se recalculan se hacen upserts on conflict).
-- =================================================================
CREATE TABLE IF NOT EXISTS goal_snapshots (
  id        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid          NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  goal_id   uuid          NOT NULL REFERENCES goals(id)       ON DELETE CASCADE,

  -- Primer día del mes al que corresponde esta snapshot.
  -- Ej: '2025-05-01' para mayo de 2025.
  month     date          NOT NULL,

  -- Valor acumulado o medido para ese mes (según tipo de meta).
  amount    numeric(18,2) NOT NULL DEFAULT 0,

  created_at timestamptz  NOT NULL DEFAULT now(),

  -- Una sola snapshot por meta y mes
  UNIQUE (goal_id, month)
);

-- Índice principal: snapshots de las metas de un usuario
CREATE INDEX IF NOT EXISTS idx_goal_snapshots_user_goal
  ON goal_snapshots(user_id, goal_id);

-- RLS
ALTER TABLE goal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_snapshots_select_own"
  ON goal_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "goal_snapshots_insert_own"
  ON goal_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goal_snapshots_update_own"
  ON goal_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goal_snapshots_delete_own"
  ON goal_snapshots FOR DELETE
  USING (auth.uid() = user_id);
