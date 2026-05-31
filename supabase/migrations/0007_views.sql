-- =============================================================
-- 0007_views.sql
-- Vistas derivadas: account_balances
-- Depende de: 0003 (accounts), 0004 (movements, transfers)
-- =============================================================


-- =================================================================
-- VISTA: account_balances
-- Calcula el saldo actual de cada cuenta de forma derivada.
--
-- FÓRMULA:
--   saldo = initial_balance
--           + SUM(income en moneda de la cuenta)
--           - SUM(expense en moneda de la cuenta)
--           + SUM(transfers entrantes en moneda de la cuenta)
--           - SUM(transfers salientes en moneda de la cuenta)
--
-- MANEJO MULTIMONEDA en movements:
--   - Si original_currency == cuenta.currency → se usa `amount` directo.
--   - Si original_currency != cuenta.currency → se usa `converted_amount`
--     (que ya está expresado en la moneda de la cuenta).
--   - Un movimiento con original_currency distinta y converted_amount NULL
--     es un dato inválido; se excluye del cálculo (COALESCE a 0) para no
--     romper el saldo. La app debe validar esto al insertar.
--
-- TRANSFERS:
--   - from_amount y to_amount están expresados en la moneda nativa de
--     cada cuenta respectivamente, así que no requieren conversión.
--
-- MOVIMIENTOS FUTUROS (is_future = true):
--   - EXCLUIDOS del saldo actual. La UI puede mostrar un "saldo proyectado"
--     separado si lo desea (futuras fases).
--
-- SECURITY INVOKER (default en Postgres):
--   La vista se ejecuta con los permisos del usuario que la consulta.
--   Como las tablas subyacentes tienen RLS, un usuario solo verá sus
--   propias cuentas y movimientos → el saldo resultante es siempre correcto
--   y aislado por usuario.
--   No se necesita RLS sobre la vista misma.
-- =================================================================

DROP VIEW IF EXISTS account_balances;

CREATE VIEW account_balances
WITH (security_invoker = true)
AS
-- Cálculo de ingresos netos por cuenta
WITH income_by_account AS (
  SELECT
    account_id,
    SUM(
      CASE
        WHEN original_currency = a.currency THEN amount
        ELSE COALESCE(converted_amount, 0)
      END
    ) AS total_income
  FROM movements m
  JOIN accounts a ON a.id = m.account_id
  WHERE m.type = 'income'
    AND m.is_future = false
  GROUP BY account_id
),

-- Cálculo de gastos netos por cuenta
expense_by_account AS (
  SELECT
    account_id,
    SUM(
      CASE
        WHEN original_currency = a.currency THEN amount
        ELSE COALESCE(converted_amount, 0)
      END
    ) AS total_expense
  FROM movements m
  JOIN accounts a ON a.id = m.account_id
  WHERE m.type = 'expense'
    AND m.is_future = false
  GROUP BY account_id
),

-- Transferencias entrantes (en moneda de la cuenta destino)
transfers_in AS (
  SELECT
    to_account_id AS account_id,
    SUM(to_amount) AS total_in
  FROM transfers
  WHERE is_future = false
  GROUP BY to_account_id
),

-- Transferencias salientes (en moneda de la cuenta origen)
transfers_out AS (
  SELECT
    from_account_id AS account_id,
    SUM(from_amount) AS total_out
  FROM transfers
  WHERE is_future = false
  GROUP BY from_account_id
)

SELECT
  a.user_id,
  a.id                                                    AS account_id,
  a.name                                                  AS account_name,
  a.type                                                  AS account_type,
  a.currency,
  a.is_hidden,
  -- Saldo calculado
  a.initial_balance
    + COALESCE(inc.total_income,  0)
    - COALESCE(exp.total_expense, 0)
    + COALESCE(tin.total_in,      0)
    - COALESCE(tout.total_out,    0)                       AS current_balance
FROM accounts a
LEFT JOIN income_by_account  inc  ON inc.account_id  = a.id
LEFT JOIN expense_by_account exp  ON exp.account_id  = a.id
LEFT JOIN transfers_in       tin  ON tin.account_id  = a.id
LEFT JOIN transfers_out      tout ON tout.account_id = a.id;


-- =================================================================
-- VISTA: account_balances_with_projected
-- Versión alternativa que incluye también el saldo proyectado
-- (incorpora movimientos con is_future = true).
-- Útil para pantallas de "saldo esperado al fin del mes".
-- Por ahora se deja definida pero no expuesta en la API.
-- =================================================================

DROP VIEW IF EXISTS account_balances_projected;

CREATE VIEW account_balances_projected
WITH (security_invoker = true)
AS
WITH income_by_account AS (
  SELECT
    account_id,
    SUM(
      CASE
        WHEN original_currency = a.currency THEN amount
        ELSE COALESCE(converted_amount, 0)
      END
    ) AS total_income
  FROM movements m
  JOIN accounts a ON a.id = m.account_id
  WHERE m.type = 'income'
  GROUP BY account_id
),
expense_by_account AS (
  SELECT
    account_id,
    SUM(
      CASE
        WHEN original_currency = a.currency THEN amount
        ELSE COALESCE(converted_amount, 0)
      END
    ) AS total_expense
  FROM movements m
  JOIN accounts a ON a.id = m.account_id
  WHERE m.type = 'expense'
  GROUP BY account_id
),
transfers_in AS (
  SELECT to_account_id AS account_id, SUM(to_amount) AS total_in
  FROM transfers
  GROUP BY to_account_id
),
transfers_out AS (
  SELECT from_account_id AS account_id, SUM(from_amount) AS total_out
  FROM transfers
  GROUP BY from_account_id
)

SELECT
  a.user_id,
  a.id          AS account_id,
  a.name        AS account_name,
  a.type        AS account_type,
  a.currency,
  a.is_hidden,
  a.initial_balance
    + COALESCE(inc.total_income,  0)
    - COALESCE(exp.total_expense, 0)
    + COALESCE(tin.total_in,      0)
    - COALESCE(tout.total_out,    0) AS projected_balance
FROM accounts a
LEFT JOIN income_by_account  inc  ON inc.account_id  = a.id
LEFT JOIN expense_by_account exp  ON exp.account_id  = a.id
LEFT JOIN transfers_in       tin  ON tin.account_id  = a.id
LEFT JOIN transfers_out      tout ON tout.account_id = a.id;
