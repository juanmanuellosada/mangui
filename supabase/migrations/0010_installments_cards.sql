-- =============================================================
-- 0010_installments_cards.sql
-- Tablas: installment_purchases, card_statements
-- FK:     movements.installment_purchase_id → installment_purchases(id)
-- Depende de: 0001 (enums currency), 0003 (accounts, categories),
--             0004 (movements, transfers)
-- Fase: 2 — Tarjetas y Cuotas
-- =============================================================


-- =================================================================
-- TABLA: installment_purchases
-- Agrupa el conjunto de N movimientos mensuales que conforman una
-- compra financiada en cuotas (ej: 12 cuotas en Visa Santander).
--
-- REGLAS DE NEGOCIO:
--   - Cada cuota individual es un movimiento (expense) en la tabla
--     `movements`, con installment_purchase_id = este id,
--     installment_number = 1..N, installment_total = N.
--   - total_amount > 0 siempre; installments_count >= 1 (una cuota =
--     pago completo, válido y útil para el historial).
--   - account_id apunta a la tarjeta de crédito (type='tarjeta_credito')
--     donde caen las cuotas, pero no se fuerza a nivel DB para evitar
--     acoplamiento con la lógica de UI (validación en la capa app).
--   - dollar_type: misma semántica que en movements (soft CHECK).
--   - Si se elimina un installment_purchase, todos sus movimientos-cuota
--     se eliminan en cascada (FK en movements, ver más abajo).
-- =================================================================
CREATE TABLE IF NOT EXISTS installment_purchases (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Descripción del bien/servicio financiado
  description         text          NOT NULL,

  -- Monto total de la compra (suma de todas las cuotas antes de intereses)
  total_amount        numeric(18,2) NOT NULL CHECK (total_amount > 0),

  -- Cantidad de cuotas pactadas (>= 1)
  installments_count  int           NOT NULL CHECK (installments_count >= 1),

  -- Fecha de la primera cuota (las siguientes se calculan en la app)
  start_date          date          NOT NULL,

  -- Moneda de los movimientos-cuota (debe coincidir con la de la tarjeta)
  currency            currency      NOT NULL,

  -- Tarjeta de crédito donde caen las cuotas
  account_id          uuid          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

  -- Categoría del gasto (nullable → "Sin categoría" en la UI)
  category_id         uuid          NULL REFERENCES categories(id) ON DELETE SET NULL,

  -- Qué tipo de cambio se usó al registrar (mismo dominio que movements)
  dollar_type         text          NULL,
  CONSTRAINT chk_installment_purchase_dollar_type CHECK (
    dollar_type IS NULL OR
    dollar_type IN ('oficial', 'blue', 'mep', 'ccl', 'tarjeta')
  ),

  note                text,

  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

-- Índice principal: listar compras en cuotas del usuario
CREATE INDEX IF NOT EXISTS idx_installment_purchases_user_id
  ON installment_purchases(user_id);

-- Índice para filtrar por tarjeta (útil en la pantalla de resumen)
CREATE INDEX IF NOT EXISTS idx_installment_purchases_account_id
  ON installment_purchases(user_id, account_id);

-- RLS
ALTER TABLE installment_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installment_purchases_select_own"
  ON installment_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "installment_purchases_insert_own"
  ON installment_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "installment_purchases_update_own"
  ON installment_purchases FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "installment_purchases_delete_own"
  ON installment_purchases FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_installment_purchases_updated_at ON installment_purchases;
CREATE TRIGGER trg_installment_purchases_updated_at
  BEFORE UPDATE ON installment_purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- FK: movements.installment_purchase_id → installment_purchases(id)
--
-- La columna ya existe (nullable, sin FK) desde 0004. Aquí agregamos
-- la restricción de integridad referencial con ON DELETE CASCADE:
-- si se borra un installment_purchase, todas sus cuotas (movements)
-- se eliminan automáticamente.
--
-- Idempotencia: eliminar primero si existe, luego crear.
-- Nombre de la constraint: movements_installment_purchase_id_fkey
-- =================================================================
DO $$
BEGIN
  -- Eliminar la constraint si ya existiera de una migración anterior
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'movements_installment_purchase_id_fkey'
      AND conrelid = 'movements'::regclass
  ) THEN
    ALTER TABLE movements
      DROP CONSTRAINT movements_installment_purchase_id_fkey;
  END IF;

  -- Agregar la FK con cascada de borrado
  ALTER TABLE movements
    ADD CONSTRAINT movements_installment_purchase_id_fkey
    FOREIGN KEY (installment_purchase_id)
    REFERENCES installment_purchases(id)
    ON DELETE CASCADE;
END;
$$;


-- =================================================================
-- TABLA: card_statements
-- Registra el estado de pago de un resumen de tarjeta de crédito
-- (cierre + vencimiento + total + impuesto de sellado + pago).
--
-- DISEÑO:
--   - Los ÍTEMS del resumen (líneas de gasto) NO se almacenan aquí:
--     se derivan de movements cuya date cae dentro del ciclo de la
--     cuenta (entre el cierre anterior y el cierre de este resumen).
--     Esta tabla almacena únicamente el estado de pago, el sellado y
--     las referencias al pago efectuado.
--   - UNIQUE (account_id, close_date): un solo resumen por tarjeta y
--     fecha de cierre (unicidad del ciclo).
--   - stamp_tax (impuesto de sellado): cargo adicional sobre ciertos
--     resúmenes en Argentina (ej. tarjetas de crédito bancarias),
--     no derivable de los movimientos → se almacena explícitamente.
--   - transfer_id: referencia opcional a una transferencia en la
--     tabla `transfers` si el pago se registró como transferencia
--     desde otra cuenta (ej. caja de ahorro → tarjeta).
--   - paid_from_account_id: cuenta desde la que se realizó el pago.
--
-- ESTADOS:
--   'pendiente' → resumen emitido, pago no registrado.
--   'pagado'    → pago registrado (paid_amount, paid_date, etc.).
-- =================================================================
CREATE TABLE IF NOT EXISTS card_statements (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tarjeta de crédito a la que pertenece este resumen
  account_id            uuid          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Fecha de cierre del ciclo (determina qué movimientos entran en el resumen)
  close_date            date          NOT NULL,

  -- Fecha límite de pago
  due_date              date          NOT NULL,

  -- Total del resumen (calculado por la app al generar el resumen;
  -- refleja la suma de movimientos del ciclo + sellado)
  total_amount          numeric(18,2) NOT NULL DEFAULT 0,

  -- Impuesto de sellado: cargo fijo sobre el resumen (Argentina).
  -- No derivable de los movimientos; se ingresa manualmente o por regla.
  stamp_tax             numeric(18,2) NOT NULL DEFAULT 0,

  -- Estado de pago
  status                text          NOT NULL DEFAULT 'pendiente',
  CONSTRAINT chk_card_statement_status CHECK (
    status IN ('pendiente', 'pagado')
  ),

  -- Campos de pago (se rellenan al registrar el pago)
  paid_amount           numeric(18,2) NULL,
  paid_from_account_id  uuid          NULL REFERENCES accounts(id) ON DELETE SET NULL,
  paid_date             date          NULL,

  -- Referencia a la transferencia que registró el pago (si aplica)
  transfer_id           uuid          NULL REFERENCES transfers(id) ON DELETE SET NULL,

  note                  text,

  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),

  -- Un solo resumen por tarjeta y fecha de cierre
  UNIQUE (account_id, close_date)
);

-- Índice principal: listar resúmenes del usuario por tarjeta
CREATE INDEX IF NOT EXISTS idx_card_statements_user_account
  ON card_statements(user_id, account_id);

-- RLS
ALTER TABLE card_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_statements_select_own"
  ON card_statements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "card_statements_insert_own"
  ON card_statements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "card_statements_update_own"
  ON card_statements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "card_statements_delete_own"
  ON card_statements FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_card_statements_updated_at ON card_statements;
CREATE TRIGGER trg_card_statements_updated_at
  BEFORE UPDATE ON card_statements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
