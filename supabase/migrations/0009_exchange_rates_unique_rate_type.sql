-- =============================================================
-- 0009_exchange_rates_unique_rate_type.sql
-- El cron de cotizaciones (api/cron/refresh-rates) hace UPSERT con
-- onConflict = rate_type. Esto requiere una restricción UNIQUE en
-- rate_type. Cambia la semántica de exchange_rates de "append-only"
-- a "snapshot actual": una sola fila vigente por tipo de cotización.
-- El histórico para reportes de inflación (fase futura) irá en una
-- tabla dedicada.
-- Depende de: 0005 (exchange_rates)
-- =============================================================

ALTER TABLE exchange_rates
  ADD CONSTRAINT uq_exchange_rates_rate_type UNIQUE (rate_type);
