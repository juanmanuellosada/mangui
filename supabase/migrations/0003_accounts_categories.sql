-- =============================================================
-- 0003_accounts_categories.sql
-- Tablas: accounts, categories
-- Depende de: 0001 (enums), 0002 (auth.users existe)
-- =============================================================


-- =================================================================
-- TABLA: accounts
-- Representa cuentas bancarias, efectivo, tarjetas, billeteras, etc.
--
-- BALANCE: NO se almacena el saldo actual como columna (sería
-- inconsistente ante ediciones de movimientos históricos). El saldo
-- se deriva en la vista account_balances (0007_views.sql):
--   saldo = initial_balance
--           + SUM(movements de tipo income en esta cuenta)
--           - SUM(movements de tipo expense en esta cuenta)
--           + SUM(transfers.to_amount donde to_account_id = accounts.id)
--           - SUM(transfers.from_amount donde from_account_id = accounts.id)
-- Cuando un movimiento está en distinta moneda que la cuenta se usa
-- converted_amount (en la moneda de la cuenta).
--
-- Campos de tarjeta de crédito: closing_day, due_day.
-- Solo tienen sentido para type = 'tarjeta_credito'.
-- =================================================================
CREATE TABLE IF NOT EXISTS accounts (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name             text         NOT NULL,
  type             account_type NOT NULL DEFAULT 'caja_ahorro',
  currency         currency     NOT NULL DEFAULT 'ARS',

  -- Saldo inicial al crear la cuenta (punto de partida del cálculo)
  initial_balance  numeric(18,2) NOT NULL DEFAULT 0,

  -- Apariencia
  icon             text,
  color            text,         -- ej. '#22c55e' — reservado para futuras fases de UI

  -- Ocultar de vistas principales (sin borrar)
  is_hidden        boolean      NOT NULL DEFAULT false,

  -- Campos exclusivos de tarjeta de crédito (null en otras cuentas)
  closing_day      int          NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day          int          NULL CHECK (due_day BETWEEN 1 AND 31),

  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

-- Índice frecuente: listar cuentas del usuario
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select_own"
  ON accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "accounts_insert_own"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_update_own"
  ON accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_delete_own"
  ON accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- TABLA: categories
-- Categorías de ingreso/egreso por usuario.
-- Las categorías por defecto se insertan en el signup (0006).
-- Un movimiento sin categoría equivale a "Sin categoría" a nivel UI
-- (category_id nullable en movements).
-- =================================================================
CREATE TABLE IF NOT EXISTS categories (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name         text          NOT NULL,
  type         category_type NOT NULL,
  icon         text,         -- emoji o nombre de icono de Lucide

  -- true = fue creada automáticamente en el signup; el usuario puede
  -- editarla pero la UI puede marcarla visualmente diferente.
  is_default   boolean       NOT NULL DEFAULT false,

  -- Soft-delete para fases futuras (no borrar categorías con movimientos)
  -- is_archived boolean NOT NULL DEFAULT false,

  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),

  -- Un usuario no puede tener dos categorías con el mismo nombre y tipo
  UNIQUE (user_id, name, type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_categories_user_id      ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_type    ON categories(user_id, type);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_own"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "categories_insert_own"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_update_own"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_delete_own"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
