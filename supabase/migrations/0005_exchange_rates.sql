-- =============================================================
-- 0005_exchange_rates.sql
-- Tabla: exchange_rates
-- Cache global de cotizaciones del dólar (DolarAPI u otra fuente).
-- NO es per-usuario: una sola tabla compartida para todos.
-- Depende de: 0001 (enum rate_type)
-- =============================================================


-- =================================================================
-- TABLA: exchange_rates
-- Almacena el snapshot más reciente (y opcionalmente histórico) de
-- cada cotización. La app puede guardar múltiples filas por rate_type
-- y usar fetched_at para elegir la más reciente.
--
-- ESCRITURA: solo el service role (backend/cron) puede insertar/actualizar.
-- LECTURA:   cualquier usuario autenticado puede leer (datos públicos).
-- =================================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo de cotización: oficial, blue, mep, ccl
  rate_type    rate_type   NOT NULL,

  -- Precio de compra y venta en ARS por 1 USD
  buy          numeric(18,4) NOT NULL CHECK (buy > 0),
  sell         numeric(18,4) NOT NULL CHECK (sell > 0),

  -- Cuándo se obtuvo este dato de la API externa
  fetched_at   timestamptz   NOT NULL DEFAULT now(),

  created_at   timestamptz   NOT NULL DEFAULT now()
  -- Sin updated_at: los registros son inmutables (append-only).
  -- Para "actualizar", se inserta una nueva fila con fetched_at más reciente.
);

-- Índice para obtener la cotización más reciente de cada tipo rápidamente
CREATE INDEX IF NOT EXISTS idx_exchange_rates_type_fetched
  ON exchange_rates(rate_type, fetched_at DESC);

-- =================================================================
-- RLS para exchange_rates
-- Lectura: cualquier usuario autenticado.
-- Escritura (INSERT/UPDATE/DELETE): solo service_role (bypassa RLS).
-- No se definen políticas de escritura — RLS habilitado + sin política
-- = ningún rol de usuario puede escribir directamente.
-- =================================================================
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Lectura pública para usuarios autenticados
CREATE POLICY "exchange_rates_select_authenticated"
  ON exchange_rates FOR SELECT
  TO authenticated
  USING (true);

-- Sin políticas INSERT/UPDATE/DELETE → solo service_role puede modificar
-- (el service_role bypassa RLS por defecto en Supabase)
