-- =============================================================
-- 0004_movements_transfers.sql
-- Tablas: movements, transfers
-- Depende de: 0001 (enums), 0003 (accounts, categories)
-- =============================================================


-- =================================================================
-- TABLA: movements
-- Registra ingresos y egresos sobre una cuenta.
--
-- REGLAS DE NEGOCIO:
--   - amount > 0 siempre (el tipo determina si suma o resta).
--   - original_currency: la moneda en que fue registrado el movimiento.
--   - Si original_currency != cuenta.currency, converted_amount contiene
--     el monto ya convertido a la moneda de la cuenta. La vista
--     account_balances usa converted_amount en ese caso.
--   - is_future = true: movimiento programado (aún no ocurrido). La vista
--     puede opcionalmente excluirlos del saldo real.
--   - date es tipo DATE (no timestamptz) porque en finanzas personales
--     la fecha del comprobante importa más que la hora exacta.
--
-- COLUMNAS FORWARD-COMPAT (fases futuras, nullable desde el inicio):
--   - installment_purchase_id / installment_number / installment_total:
--     para cuotas de tarjeta de crédito.
--   - recurring_id: enlace a un template de movimiento recurrente.
--   - dollar_type: qué cotización se usó ('oficial','blue','mep','ccl','tarjeta').
-- =================================================================
CREATE TABLE IF NOT EXISTS movements (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  type                   movement_type NOT NULL,
  amount                 numeric(18,2) NOT NULL CHECK (amount > 0),

  -- Moneda en que fue cargado el movimiento
  original_currency      currency      NOT NULL,

  -- Monto convertido a la moneda de la cuenta (solo cuando difieren)
  -- NULL cuando original_currency == cuenta.currency
  converted_amount       numeric(18,2) NULL CHECK (converted_amount > 0),

  -- Cuenta afectada
  account_id             uuid          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

  -- Fecha del movimiento (solo fecha, sin hora)
  date                   date          NOT NULL DEFAULT CURRENT_DATE,

  -- Categoría (nullable → "Sin categoría" en la UI)
  category_id            uuid          NULL REFERENCES categories(id) ON DELETE SET NULL,

  note                   text,

  -- Movimiento programado a futuro (aún no ejecutado)
  is_future              boolean       NOT NULL DEFAULT false,

  -- ── Columnas forward-compat para cuotas (fase 2) ─────────────
  -- Referencia al grupo de cuotas (InstallmentPurchase)
  installment_purchase_id uuid          NULL,
  -- Número de esta cuota (1 de N)
  installment_number      int           NULL CHECK (installment_number >= 1),
  -- Total de cuotas del grupo
  installment_total       int           NULL CHECK (installment_total >= 1),

  -- ── Forward-compat: recurrentes (fase 3) ─────────────────────
  recurring_id            uuid          NULL,

  -- ── Forward-compat: cotización usada (moat multimoneda ARG) ──
  -- Cuál tipo de dólar se aplicó al convertir
  dollar_type             text          NULL,
  -- CHECK suave: acepta NULL o valores conocidos (extensible)
  CONSTRAINT chk_dollar_type CHECK (
    dollar_type IS NULL OR
    dollar_type IN ('oficial', 'blue', 'mep', 'ccl', 'tarjeta')
  ),

  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now(),

  -- Si tiene converted_amount, la moneda original debe diferir de la cuenta
  -- (no podemos validar contra accounts.currency aquí directamente sin trigger,
  -- lo dejamos para la capa de aplicación / un trigger opcional en fase 2)

  -- Integridad de cuotas: o se especifican todos los campos o ninguno
  CONSTRAINT chk_installment_fields CHECK (
    (installment_purchase_id IS NULL AND installment_number IS NULL AND installment_total IS NULL)
    OR
    (installment_purchase_id IS NOT NULL AND installment_number IS NOT NULL AND installment_total IS NOT NULL)
  )
);

-- ── Índices (clave para performance del dashboard y la vista account_balances)
-- Consultas principales: movimientos de un usuario por fecha, por cuenta, por categoría
CREATE INDEX IF NOT EXISTS idx_movements_user_date
  ON movements(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_movements_user_account
  ON movements(user_id, account_id);

CREATE INDEX IF NOT EXISTS idx_movements_user_category
  ON movements(user_id, category_id);

-- Índice adicional para account_balances: suma rápida por cuenta
CREATE INDEX IF NOT EXISTS idx_movements_account_type
  ON movements(account_id, type);

-- RLS
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movements_select_own"
  ON movements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "movements_insert_own"
  ON movements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "movements_update_own"
  ON movements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "movements_delete_own"
  ON movements FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_movements_updated_at ON movements;
CREATE TRIGGER trg_movements_updated_at
  BEFORE UPDATE ON movements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- TABLA: transfers
-- Mueve dinero entre cuentas del mismo usuario.
-- NO genera movimientos de income/expense — solo afecta saldos.
--
-- from_amount y to_amount pueden diferir (ej: transferir USD a ARS
-- implica una conversión; cada lado registra su moneda nativa).
--
-- La vista account_balances los trata como:
--   from_account: - from_amount
--   to_account:   + to_amount
-- =================================================================
CREATE TABLE IF NOT EXISTS transfers (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  from_account_id  uuid         NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id    uuid         NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

  from_amount      numeric(18,2) NOT NULL CHECK (from_amount > 0),
  to_amount        numeric(18,2) NOT NULL CHECK (to_amount > 0),

  date             date          NOT NULL DEFAULT CURRENT_DATE,
  note             text,

  -- Forward-compat: recurrentes (fase 3)
  recurring_id     uuid          NULL,

  -- Forward-compat: transferencias programadas (fase 3)
  is_future        boolean       NOT NULL DEFAULT false,

  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),

  -- Las cuentas origen y destino deben ser distintas
  CONSTRAINT chk_transfer_different_accounts CHECK (from_account_id != to_account_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_transfers_user_date
  ON transfers(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transfers_from_account
  ON transfers(from_account_id);

CREATE INDEX IF NOT EXISTS idx_transfers_to_account
  ON transfers(to_account_id);

-- RLS
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_select_own"
  ON transfers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transfers_insert_own"
  ON transfers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transfers_update_own"
  ON transfers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transfers_delete_own"
  ON transfers FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_transfers_updated_at ON transfers;
CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
