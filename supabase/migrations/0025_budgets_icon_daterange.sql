-- =============================================================
-- 0025_budgets_icon_daterange.sql
-- Rediseño de modelo de presupuestos: icono + rango explícito
--
-- Depende de: 0013 (budgets, budget_period)
--
-- CAMBIOS:
--   1. icon     text NULL  — emoji o clave de ícono para la UI.
--   2. end_date date NULL  — límite superior explícito de la ventana.
--   3. period   pasa a NULLable. NULL = rango personalizado (usa
--               [start_date, end_date] directamente sin ciclo de período).
--
-- BACKFILL de end_date para filas existentes:
--   Se deriva del período original + start_date para que las filas
--   preexistentes conserven una ventana válida sin period.
--   weekly      → start_date + 6 días
--   biweekly    → start_date + 13 días
--   monthly     → último día del mismo mes de start_date
--   quarterly   → último día del trimestre de start_date
--   annual      → último día del año de start_date
-- =============================================================


-- -----------------------------------------------------------------
-- 1. Agregar columnas nuevas (idempotente con IF NOT EXISTS)
-- -----------------------------------------------------------------
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS icon     text NULL;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS end_date date NULL;

-- -----------------------------------------------------------------
-- 2. Hacer period NULLable (NULL = rango personalizado)
-- -----------------------------------------------------------------
ALTER TABLE budgets ALTER COLUMN period DROP NOT NULL;

-- -----------------------------------------------------------------
-- 3. Backfill end_date para filas que todavía no la tengan,
--    derivada del período actual + start_date.
--    Las filas recién creadas (period = NULL) no entran en el WHERE.
-- -----------------------------------------------------------------
UPDATE budgets
SET end_date = CASE period
  WHEN 'weekly'     THEN (start_date + INTERVAL '6 days')::date
  WHEN 'biweekly'   THEN (start_date + INTERVAL '13 days')::date
  WHEN 'monthly'    THEN (date_trunc('month', start_date) + INTERVAL '1 month' - INTERVAL '1 day')::date
  WHEN 'quarterly'  THEN (date_trunc('quarter', start_date) + INTERVAL '3 months' - INTERVAL '1 day')::date
  WHEN 'annual'     THEN (date_trunc('year', start_date) + INTERVAL '1 year' - INTERVAL '1 day')::date
END
WHERE end_date IS NULL
  AND period IS NOT NULL;
