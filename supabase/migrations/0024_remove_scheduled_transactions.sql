-- =============================================================
-- 0024_remove_scheduled_transactions.sql
-- Preserva las transacciones programadas PENDIENTES convirtiéndolas
-- en movimientos/transferencias futuras, y luego elimina la tabla
-- scheduled_transactions y su enum scheduled_status.
--
-- Depende de: 0004 (movements, transfers), 0011 (scheduled_transactions)
--
-- LÓGICA DE PRESERVACIÓN:
--   - status = 'pending': se convierte en movement/transfer con
--     is_future = (date > CURRENT_DATE), para que el cron las
--     active automáticamente cuando llegue su fecha.
--   - status = 'executed': ya generaron su movement/transfer → se omiten.
--   - status = 'rejected': descartadas intencionalmente → se omiten.
--
-- La tabla no tiene FKs que apunten hacia ella desde otras tablas,
-- por lo que el DROP es seguro sin cascades adicionales.
-- =============================================================


-- =================================================================
-- SECCIÓN 1: Pending income/expense → movements
--
-- REGLAS DE NEGOCIO:
--   - Solo filas con status = 'pending' y kind IN ('income','expense').
--   - account_id NOT NULL es requisito del esquema movements; filas
--     con account_id NULL se omiten (datos incompletos, no ejecutables).
--   - El cast kind::text::movement_type es válido porque los literales
--     'income' y 'expense' son idénticos en ambos enums (txn_kind y
--     movement_type). El valor 'transfer' de txn_kind nunca pasa por
--     aquí gracias al filtro WHERE kind IN ('income','expense').
--   - converted_amount y dollar_type quedan NULL (sin conversión conocida).
--   - is_future = (date > CURRENT_DATE): true si la fecha aún no pasó;
--     false si ya venció pero seguía pendiente (queda visible en historial).
-- =================================================================
INSERT INTO movements (user_id, type, amount, original_currency, account_id, category_id, date, note, is_future)
SELECT
  user_id,
  kind::text::movement_type,  -- 'income'/'expense' son literalmente iguales en movement_type
  amount,
  currency,
  account_id,
  category_id,
  date,
  note,
  (date > CURRENT_DATE)
FROM scheduled_transactions
WHERE status = 'pending'
  AND kind IN ('income', 'expense')
  AND account_id IS NOT NULL;


-- =================================================================
-- SECCIÓN 2: Pending transfer scheduled rows → transfers
--
-- REGLAS DE NEGOCIO:
--   - Solo filas con status = 'pending' y kind = 'transfer'.
--   - Tanto account_id (from_account_id) como to_account_id son NOT NULL
--     en transfers; filas que incumplan se omiten.
--   - to_amount: si es NULL (misma moneda origen/destino) se usa amount.
--   - is_future: mismo criterio que movements.
-- =================================================================
INSERT INTO transfers (user_id, from_account_id, to_account_id, from_amount, to_amount, date, note, is_future)
SELECT
  user_id,
  account_id,
  to_account_id,
  amount,
  COALESCE(to_amount, amount),  -- fallback: igual monto en moneda destino
  date,
  note,
  (date > CURRENT_DATE)
FROM scheduled_transactions
WHERE status = 'pending'
  AND kind = 'transfer'
  AND account_id IS NOT NULL
  AND to_account_id IS NOT NULL;


-- =================================================================
-- SECCIÓN 3: Eliminar tabla y enum
--
-- Primero la tabla (que referencia el enum), luego el enum.
-- IF EXISTS en ambos para idempotencia (re-ejecución segura).
-- =================================================================
DROP TABLE IF EXISTS scheduled_transactions;
DROP TYPE IF EXISTS scheduled_status;
