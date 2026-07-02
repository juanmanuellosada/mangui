-- =============================================================
-- 0048_budgets_rollover_threshold.sql
-- Columnas: budgets.rollover_enabled, budgets.alert_threshold
-- Depende de: 0013 (budgets), 0025 (budgets.icon/end_date/period)
--
-- Presupuestos: rollover de sobrante entre períodos + umbral de
-- alerta configurable (antes hardcodeado en 80%).
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- =============================================================

-- rollover_enabled: si true (y el presupuesto es recurrente), el sobrante
-- positivo del período anterior se suma al límite del período actual.
-- false por defecto (comportamiento actual sin cambios).
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS rollover_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN budgets.rollover_enabled IS
  'Si es true y el presupuesto es recurrente, el sobrante positivo del período anterior se acumula al límite del período actual.';

-- alert_threshold: porcentaje de uso (1-100) a partir del cual el presupuesto
-- pasa a estado "near" y dispara el aviso push. 80 por defecto.
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS alert_threshold smallint NOT NULL DEFAULT 80
    CHECK (alert_threshold BETWEEN 1 AND 100);

COMMENT ON COLUMN budgets.alert_threshold IS
  'Porcentaje de uso (1-100) a partir del cual el presupuesto se considera "cerca del límite" y dispara el aviso push.';
