-- =============================================================
-- 0057_card_payment_transfers.sql
-- Fix: registrar el pago de un resumen de tarjeta no descontaba el
-- saldo de la cuenta de origen porque nunca se creaba la transferencia
-- origen → tarjeta (card_statements.transfer_id quedaba sin usar).
--
-- CAMBIOS:
--   1. Backfill pierna ARS: crea la transferencia origen→tarjeta para
--      los resúmenes ya 'pagado' que nunca la generaron, y enlaza
--      transfer_id. Guard de moneda: solo si la cuenta de origen es de
--      la misma moneda que la tarjeta (si no, se saltea la fila en vez
--      de descontar el monto en la moneda equivocada).
--   2. Agrega card_statements.paid_movement_id_usd — la pierna en
--      dólares del pago NO es una transferencia a la tarjeta (la
--      tarjeta es siempre una cuenta en ARS; una transferencia ahí
--      inflaría su saldo en pesos con un monto en dólares). Se
--      registra como un gasto (movement) en la cuenta de origen en
--      USD, sin tocar la tarjeta. Esta columna linkea ese movimiento
--      para poder editarlo/reemplazarlo de forma idempotente.
--   3. Backfill pierna USD: crea ese movimiento de gasto para los
--      resúmenes ya 'pagado' con paid_amount_usd que nunca lo
--      generaron, y enlaza paid_movement_id_usd. Guard de moneda:
--      solo si la cuenta de origen es realmente USD — si no, se
--      dispararía el trigger check_movement_converted_amount
--      (0041/0044) con un RAISE EXCEPTION que abortaría toda la
--      migración; se saltea la fila en su lugar.
--   4. RPC pay_card_statement: mueve TODA la escritura del pago
--      (upsert del statement + transferencia ARS + gasto USD + link
--      de ids) a una única transacción atómica en el servidor, con
--      validación de moneda de las cuentas de origen. Reemplaza las
--      3 operaciones client-side no atómicas que hacía cards-list.tsx.
-- =============================================================

ALTER TABLE card_statements
  ADD COLUMN IF NOT EXISTS paid_movement_id_usd uuid NULL REFERENCES movements(id) ON DELETE SET NULL;

COMMENT ON COLUMN card_statements.paid_movement_id_usd IS
  'Referencia al movimiento de gasto (en la cuenta de origen en USD) que registró la pierna en dólares del pago de este resumen, cuando el ciclo se pagó en ambas monedas. La tarjeta es siempre una cuenta en ARS, por lo que este pago no es una transferencia a la tarjeta (ver transfer_id para la pierna en pesos) sino un gasto directo en la cuenta de origen.';

-- ── Backfill: pierna en pesos (ARS) ──────────────────────────────
-- Guard de moneda: origin_acc.currency = card_acc.currency (evita
-- transferencias con from_amount/to_amount en la moneda equivocada,
-- ver account_balances en 0007_views.sql que no convierte montos).
DO $$
DECLARE
  stmt RECORD;
  new_transfer_id uuid;
BEGIN
  FOR stmt IN
    SELECT cs.id, cs.user_id, cs.account_id, cs.paid_from_account_id, cs.paid_amount,
           cs.paid_date, cs.due_date, cs.close_date
    FROM card_statements cs
    JOIN accounts card_acc ON card_acc.id = cs.account_id
    JOIN accounts origin_acc ON origin_acc.id = cs.paid_from_account_id
    WHERE cs.status = 'pagado'
      AND cs.transfer_id IS NULL
      AND cs.paid_from_account_id IS NOT NULL
      AND cs.paid_amount IS NOT NULL
      AND cs.paid_amount > 0
      AND cs.paid_from_account_id != cs.account_id
      AND origin_acc.currency = card_acc.currency
  LOOP
    INSERT INTO transfers (user_id, from_account_id, to_account_id, from_amount, to_amount, date, note)
    VALUES (
      stmt.user_id,
      stmt.paid_from_account_id,
      stmt.account_id,
      stmt.paid_amount,
      stmt.paid_amount,
      COALESCE(stmt.paid_date, stmt.due_date, stmt.close_date),
      'Pago de resumen de tarjeta (backfill)'
    )
    RETURNING id INTO new_transfer_id;

    UPDATE card_statements SET transfer_id = new_transfer_id WHERE id = stmt.id;
  END LOOP;
END;
$$;

-- ── Backfill: pierna en dólares (USD) — gasto en la cuenta de origen ──
-- NO es una transferencia a la tarjeta: la tarjeta es siempre ARS, y una
-- transferencia ahí sumaría un monto en USD directo a un saldo en pesos.
-- Guard de moneda: origin_acc.currency = 'USD' (si no, el trigger
-- check_movement_converted_amount de 0041/0044 aborta con RAISE
-- EXCEPTION toda la migración — se saltea la fila en su lugar).
DO $$
DECLARE
  stmt RECORD;
  new_movement_id uuid;
BEGIN
  FOR stmt IN
    SELECT cs.id, cs.user_id, cs.account_id, cs.paid_from_account_id_usd, cs.paid_amount_usd,
           cs.paid_date, cs.due_date, cs.close_date
    FROM card_statements cs
    JOIN accounts origin_acc ON origin_acc.id = cs.paid_from_account_id_usd
    WHERE cs.status = 'pagado'
      AND cs.paid_movement_id_usd IS NULL
      AND cs.paid_from_account_id_usd IS NOT NULL
      AND cs.paid_amount_usd IS NOT NULL
      AND cs.paid_amount_usd > 0
      AND cs.paid_from_account_id_usd != cs.account_id
      AND origin_acc.currency = 'USD'
  LOOP
    INSERT INTO movements (user_id, type, amount, original_currency, account_id, date, note)
    VALUES (
      stmt.user_id,
      'expense',
      stmt.paid_amount_usd,
      'USD',
      stmt.paid_from_account_id_usd,
      COALESCE(stmt.paid_date, stmt.due_date, stmt.close_date),
      'Pago de resumen de tarjeta (backfill USD)'
    )
    RETURNING id INTO new_movement_id;

    UPDATE card_statements SET paid_movement_id_usd = new_movement_id WHERE id = stmt.id;
  END LOOP;
END;
$$;

-- =================================================================
-- RPC: pay_card_statement
-- Registra el pago de un resumen de tarjeta en una única transacción
-- atómica: upsert del statement + transferencia ARS (origen→tarjeta)
-- + gasto USD (en la cuenta de origen) + link de ids. Antes esto eran
-- 3 operaciones separadas hechas desde el cliente (cards-list.tsx):
-- si el link fallaba después de crear la transferencia/movimiento,
-- quedaba plata descontada sin linkear y la re-edición no la
-- limpiaba (doble descuento en un reintento).
--
-- SEGURIDAD: mismo modelo que import_card_statement (0049/0055/0056):
-- SECURITY DEFINER + search_path vacío (fuerza calificar todo con
-- `public.`), auth.uid() para identificar al usuario (no se confía en
-- ningún user_id que mande el cliente), y ownership de la tarjeta
-- verificado contra accounts.user_id antes de tocar nada.
--
-- VALIDACIÓN DE MONEDA (server-side, defensa en profundidad además
-- del filtro que ya hace la UI): la cuenta de origen del tramo ARS
-- debe tener la misma moneda que la tarjeta; la del tramo USD debe
-- ser 'USD'. Si no, RAISE EXCEPTION con mensaje en español — evita
-- que account_balances (que no convierte from_amount/to_amount, ver
-- 0007_views.sql) descuente el monto en la moneda equivocada. Además,
-- ninguna cuenta de origen puede ser otra tarjeta de crédito (paridad
-- con el filtro que ya hace la UI) — no es un agujero de seguridad
-- (el ownership ya está enforced), es integridad de datos.
--
-- IDEMPOTENCIA: si el statement ya existía con transfer_id/
-- paid_movement_id_usd linkeados (pago editado), se borran esos
-- registros ANTES de crear los nuevos, todo dentro de la misma
-- transacción — no puede quedar un estado a mitad de camino.
-- =================================================================
CREATE OR REPLACE FUNCTION public.pay_card_statement(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_account_id uuid;
  v_card_currency public.currency;
  v_close_date date;
  v_due_date date;
  v_total_amount numeric;
  v_total_amount_usd numeric;
  v_stamp_tax numeric;
  v_paid_amount numeric;
  v_paid_from_account_id uuid;
  v_paid_amount_usd numeric;
  v_paid_from_account_id_usd uuid;
  v_paid_date date;
  v_from_currency public.currency;
  v_from_type public.account_type;
  v_statement_id uuid;
  v_prev_transfer_id uuid;
  v_prev_movement_id_usd uuid;
  v_new_transfer_id uuid;
  v_new_movement_id_usd uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_account_id := (p_payload->>'account_id')::uuid;

  SELECT currency INTO v_card_currency
  FROM public.accounts
  WHERE id = v_account_id AND user_id = v_uid AND type = 'tarjeta_credito';

  IF v_card_currency IS NULL THEN
    RAISE EXCEPTION 'La cuenta no existe o no es una tarjeta de crédito del usuario';
  END IF;

  v_close_date := (p_payload->>'close_date')::date;
  v_due_date := COALESCE((p_payload->>'due_date')::date, v_close_date);
  v_total_amount := COALESCE((p_payload->>'total_amount')::numeric, 0);
  v_total_amount_usd := COALESCE((p_payload->>'total_amount_usd')::numeric, 0);
  v_stamp_tax := COALESCE((p_payload->>'stamp_tax')::numeric, 0);
  v_paid_amount := (p_payload->>'paid_amount')::numeric;
  v_paid_from_account_id := (p_payload->>'paid_from_account_id')::uuid;
  v_paid_amount_usd := (p_payload->>'paid_amount_usd')::numeric;
  v_paid_from_account_id_usd := (p_payload->>'paid_from_account_id_usd')::uuid;
  v_paid_date := COALESCE((p_payload->>'paid_date')::date, v_due_date, v_close_date);

  -- ── Validación de moneda + ownership de las cuentas de origen ──
  IF v_paid_from_account_id IS NOT NULL AND v_paid_amount IS NOT NULL AND v_paid_amount > 0 THEN
    IF v_paid_from_account_id = v_account_id THEN
      RAISE EXCEPTION 'La cuenta de origen del pago no puede ser la propia tarjeta';
    END IF;

    SELECT currency, type INTO v_from_currency, v_from_type
    FROM public.accounts
    WHERE id = v_paid_from_account_id AND user_id = v_uid;

    IF v_from_currency IS NULL THEN
      RAISE EXCEPTION 'La cuenta de origen del pago en pesos no existe';
    END IF;
    IF v_from_type = 'tarjeta_credito' THEN
      RAISE EXCEPTION 'La cuenta de origen del pago no puede ser otra tarjeta de crédito';
    END IF;
    IF v_from_currency IS DISTINCT FROM v_card_currency THEN
      RAISE EXCEPTION 'La cuenta de origen del pago en pesos debe ser de la misma moneda que la tarjeta';
    END IF;
  END IF;

  IF v_paid_from_account_id_usd IS NOT NULL AND v_paid_amount_usd IS NOT NULL AND v_paid_amount_usd > 0 THEN
    IF v_paid_from_account_id_usd = v_account_id THEN
      RAISE EXCEPTION 'La cuenta de origen del pago en dólares no puede ser la propia tarjeta';
    END IF;

    SELECT currency, type INTO v_from_currency, v_from_type
    FROM public.accounts
    WHERE id = v_paid_from_account_id_usd AND user_id = v_uid;

    IF v_from_currency IS NULL THEN
      RAISE EXCEPTION 'La cuenta de origen del pago en dólares no existe';
    END IF;
    IF v_from_type = 'tarjeta_credito' THEN
      RAISE EXCEPTION 'La cuenta de origen del pago no puede ser otra tarjeta de crédito';
    END IF;
    IF v_from_currency IS DISTINCT FROM 'USD' THEN
      RAISE EXCEPTION 'La cuenta de origen del pago en dólares debe ser una cuenta en USD';
    END IF;
  END IF;

  -- ── Statement existente: limpiar transfer/movement previamente linkeados ──
  SELECT id, transfer_id, paid_movement_id_usd
  INTO v_statement_id, v_prev_transfer_id, v_prev_movement_id_usd
  FROM public.card_statements
  WHERE account_id = v_account_id AND close_date = v_close_date;

  IF v_prev_transfer_id IS NOT NULL THEN
    DELETE FROM public.transfers WHERE id = v_prev_transfer_id;
  END IF;
  IF v_prev_movement_id_usd IS NOT NULL THEN
    DELETE FROM public.movements WHERE id = v_prev_movement_id_usd;
  END IF;

  -- ── Upsert del statement (mismo comportamiento que hacía el cliente) ──
  INSERT INTO public.card_statements (
    user_id, account_id, close_date, due_date, total_amount, total_amount_usd,
    stamp_tax, status, paid_amount, paid_from_account_id, paid_amount_usd,
    paid_from_account_id_usd, paid_date
  ) VALUES (
    v_uid, v_account_id, v_close_date, v_due_date, v_total_amount, v_total_amount_usd,
    v_stamp_tax, 'pagado', v_paid_amount, v_paid_from_account_id, v_paid_amount_usd,
    v_paid_from_account_id_usd, v_paid_date
  )
  ON CONFLICT (account_id, close_date) DO UPDATE SET
    due_date = EXCLUDED.due_date,
    total_amount = EXCLUDED.total_amount,
    total_amount_usd = EXCLUDED.total_amount_usd,
    stamp_tax = EXCLUDED.stamp_tax,
    status = EXCLUDED.status,
    paid_amount = EXCLUDED.paid_amount,
    paid_from_account_id = EXCLUDED.paid_from_account_id,
    paid_amount_usd = EXCLUDED.paid_amount_usd,
    paid_from_account_id_usd = EXCLUDED.paid_from_account_id_usd,
    paid_date = EXCLUDED.paid_date
  RETURNING id INTO v_statement_id;

  -- ── Tramo ARS: transferencia origen → tarjeta ──
  IF v_paid_from_account_id IS NOT NULL AND v_paid_amount IS NOT NULL AND v_paid_amount > 0 THEN
    INSERT INTO public.transfers (user_id, from_account_id, to_account_id, from_amount, to_amount, date, note)
    VALUES (v_uid, v_paid_from_account_id, v_account_id, v_paid_amount, v_paid_amount, v_paid_date, 'Pago de resumen de tarjeta')
    RETURNING id INTO v_new_transfer_id;
  END IF;

  -- ── Tramo USD: gasto en la cuenta de origen (no toca la tarjeta) ──
  IF v_paid_from_account_id_usd IS NOT NULL AND v_paid_amount_usd IS NOT NULL AND v_paid_amount_usd > 0 THEN
    INSERT INTO public.movements (user_id, type, amount, original_currency, account_id, date, note)
    VALUES (v_uid, 'expense', v_paid_amount_usd, 'USD', v_paid_from_account_id_usd, v_paid_date, 'Pago de resumen de tarjeta (USD)')
    RETURNING id INTO v_new_movement_id_usd;
  END IF;

  UPDATE public.card_statements
  SET transfer_id = v_new_transfer_id, paid_movement_id_usd = v_new_movement_id_usd
  WHERE id = v_statement_id;

  RETURN jsonb_build_object(
    'statement_id', v_statement_id,
    'transfer_id', v_new_transfer_id,
    'paid_movement_id_usd', v_new_movement_id_usd
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_card_statement(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_card_statement(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pay_card_statement(jsonb) FROM anon;
