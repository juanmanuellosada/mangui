-- =============================================================
-- 0023_recurring_custom_frequency.sql
-- Agrega soporte para frecuencia personalizada en recurrentes:
-- 'custom' = repetir cada `interval_days` días (ej. cada 10 días).
-- Depende de: 0011 (recurring_frequency enum, recurring_transactions)
-- =============================================================


-- =================================================================
-- SECCIÓN 1: Nuevo valor al enum recurring_frequency
--
-- REGLAS DE NEGOCIO:
--   - 'custom': la frecuencia no sigue un ciclo fijo (semanal,
--     mensual, etc.) sino un intervalo en días definido por el
--     usuario, almacenado en interval_days.
--   - Cuando frequency = 'custom', interval_days debe ser >= 1.
--   - Cuando frequency <> 'custom', interval_days debe ser NULL.
--     (este CHECK se define en la Sección 2.)
--
-- NOTA: ALTER TYPE ... ADD VALUE no puede usarse en la misma
-- transacción que sentencias que referencian el nuevo valor
-- (limitación de Postgres). Por eso este archivo solo agrega el
-- valor al enum y la columna; la lógica que usa 'custom'
-- pertenece a migraciones o código de aplicación posteriores.
-- =================================================================
ALTER TYPE recurring_frequency ADD VALUE IF NOT EXISTS 'custom';


-- =================================================================
-- SECCIÓN 2: Nueva columna interval_days en recurring_transactions
--
-- REGLAS DE NEGOCIO:
--   - NULL para todas las frecuencias predefinidas
--     (weekly, biweekly, monthly, bimonthly, annual).
--   - Entero >= 1 cuando frequency = 'custom'.
--   - El CHECK garantiza que el valor, si está presente, sea válido;
--     la restricción de negocio (NULL ↔ 'custom') la valida la app
--     (no puede expresarse aquí sin referenciar el nuevo enum value
--     en la misma transacción — ver nota de Sección 1).
-- =================================================================
ALTER TABLE recurring_transactions
  ADD COLUMN IF NOT EXISTS interval_days int NULL
    CHECK (interval_days IS NULL OR interval_days >= 1);
