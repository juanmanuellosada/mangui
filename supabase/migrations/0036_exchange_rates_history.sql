-- =============================================================
-- 0036_exchange_rates_history.sql
-- Revierte el snapshot (UNIQUE rate_type de 0009) a histórico:
-- una fila por (rate_type, día). Base para valuación histórica de
-- movimientos y reportes de inflación. No destructivo.
-- Depende de: 0005, 0009
-- =============================================================

-- 1. Fecha del día de la cotización (horario Argentina)
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS rate_date date;

-- 2. Backfill de las filas existentes desde fetched_at (TZ AR)
UPDATE exchange_rates
SET rate_date = (fetched_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
WHERE rate_date IS NULL;

-- 3. Default (hoy AR) + NOT NULL para filas nuevas
ALTER TABLE exchange_rates
  ALTER COLUMN rate_date SET DEFAULT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
ALTER TABLE exchange_rates
  ALTER COLUMN rate_date SET NOT NULL;

-- 4. Quitar el UNIQUE(rate_type) que forzaba el snapshot
ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS uq_exchange_rates_rate_type;

-- 5. Una fila por tipo por día (idempotente para el cron diario)
ALTER TABLE exchange_rates
  ADD CONSTRAINT uq_exchange_rates_type_date UNIQUE (rate_type, rate_date);

-- 6. Vista: última cotización por tipo (para lecturas "actuales")
CREATE OR REPLACE VIEW exchange_rates_latest
WITH (security_invoker = true) AS
SELECT DISTINCT ON (rate_type)
  id, rate_type, buy, sell, fetched_at, rate_date, created_at
FROM exchange_rates
ORDER BY rate_type, rate_date DESC, fetched_at DESC;

GRANT SELECT ON exchange_rates_latest TO authenticated;
