-- =============================================================
-- 0039_inflation_index_public_read.sql
-- El IPC es dato público (INDEC). Lectura anónima de inflation_index para las
-- calculadoras públicas del marketing (sueldo ajustado por inflación), que se
-- sirven sin login. La tabla solo se escribe con service role (cron mensual).
-- =============================================================
CREATE POLICY inflation_index_select_anon
  ON inflation_index FOR SELECT TO anon USING (true);

GRANT SELECT ON inflation_index TO anon;
