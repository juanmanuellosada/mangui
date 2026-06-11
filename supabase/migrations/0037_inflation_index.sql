-- =============================================================
-- 0037_inflation_index.sql
-- IPC Nivel General Nacional (INDEC, base dic-2016) por mes.
-- Para valuación de movimientos en términos reales (ajuste por inflación).
-- Se puebla con el cron /api/cron/refresh-inflation (datos.gob.ar).
-- Escritura solo service role; lectura para autenticados (dato público).
-- =============================================================

CREATE TABLE IF NOT EXISTS inflation_index (
  period      date          PRIMARY KEY,                  -- primer día del mes
  ipc         numeric(18,6) NOT NULL CHECK (ipc > 0),     -- índice IPC nivel general
  source      text          NOT NULL DEFAULT 'indec:148.3_INIVELNAL_DICI_M_26',
  fetched_at  timestamptz   NOT NULL DEFAULT now(),
  created_at  timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE inflation_index IS 'IPC Nivel General Nacional (INDEC, base dic-2016) por mes. Upsert por period.';

ALTER TABLE inflation_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY inflation_index_select_authenticated
  ON inflation_index FOR SELECT TO authenticated USING (true);

GRANT SELECT ON inflation_index TO authenticated;
