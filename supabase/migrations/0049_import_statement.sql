-- =============================================================
-- 0049_import_statement.sql
-- Import de resumen de tarjeta de crédito (PDF vía IA) — backend.
-- Depende de: 0004 (movements), 0010 (card_statements)
--
-- Cada línea del resumen entra como un MOVIMIENTO SIMPLE (no se
-- reconstruye installment_purchases): la etiqueta "(cuota N/T)" va sólo
-- en la nota. import_statement_id taggea los movimientos creados por una
-- importación, para poder re-importar el mismo resumen de forma
-- idempotente (se borran y recrean sus movimientos, nunca los manuales).
-- =============================================================

ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS import_statement_id uuid NULL
    REFERENCES card_statements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movements_import_statement_id
  ON movements(import_statement_id);

-- ── RPC: import_card_statement ───────────────────────────────────────────────
-- Recibe el resumen ya revisado por el usuario (payload armado por
-- buildStatementPayload en src/lib/statement-import.ts) y hace el UPSERT de
-- card_statements + el (re)alta de sus movimientos en una sola transacción.
--
-- p_payload shape:
--   {
--     account_id, close_date, due_date, total_amount, total_amount_usd, stamp_tax,
--     lines: [{ date, amount, original_currency, converted_amount, dollar_type,
--               category_id, note }]
--   }
--
-- SECURITY DEFINER porque hace UPSERT/INSERT/DELETE cruzando card_statements y
-- movements para el usuario autenticado; toma el user_id de auth.uid() (no de
-- un parámetro) y valida que la cuenta pertenezca al caller y sea una tarjeta
-- de crédito antes de escribir nada, así que SÍ se otorga a `authenticated`
-- (se invoca desde el browser con la sesión del usuario), igual que
-- bump_category_learning (0045).
--
-- Idempotencia: antes de insertar las líneas nuevas, borra los movimientos
-- que quedaron taggeados con import_statement_id = este resumen de una
-- importación previa. Nunca toca movimientos manuales (import_statement_id
-- NULL).
--
-- No setea installment_number/installment_total en los movimientos (decisión
-- de producto: cada línea es un movimiento simple, chk_installment_fields
-- exige los 3 campos juntos o los 3 null).
CREATE OR REPLACE FUNCTION public.import_card_statement(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_account_id uuid;
  v_statement_id uuid;
  v_line jsonb;
  v_count integer := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_account_id := (p_payload->>'account_id')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = v_account_id AND user_id = v_uid AND type = 'tarjeta_credito'
  ) THEN
    RAISE EXCEPTION 'La cuenta no existe o no es una tarjeta de crédito del usuario';
  END IF;

  INSERT INTO public.card_statements (
    user_id, account_id, close_date, due_date, total_amount, total_amount_usd, stamp_tax, status
  ) VALUES (
    v_uid,
    v_account_id,
    (p_payload->>'close_date')::date,
    (p_payload->>'due_date')::date,
    COALESCE((p_payload->>'total_amount')::numeric, 0),
    COALESCE((p_payload->>'total_amount_usd')::numeric, 0),
    COALESCE((p_payload->>'stamp_tax')::numeric, 0),
    'pendiente'
  )
  ON CONFLICT (account_id, close_date) DO UPDATE SET
    due_date = EXCLUDED.due_date,
    total_amount = EXCLUDED.total_amount,
    total_amount_usd = EXCLUDED.total_amount_usd,
    stamp_tax = EXCLUDED.stamp_tax
    -- status NO se pisa: si el resumen ya estaba 'pagado', se mantiene.
  RETURNING id INTO v_statement_id;

  -- Idempotencia: descarta sólo los movimientos de una importación previa
  -- de ESTE resumen (nunca movimientos manuales, que tienen la columna NULL).
  DELETE FROM public.movements WHERE import_statement_id = v_statement_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'lines', '[]'::jsonb))
  LOOP
    INSERT INTO public.movements (
      user_id, type, amount, original_currency, converted_amount, account_id,
      date, category_id, note, dollar_type, is_future, import_statement_id
    ) VALUES (
      v_uid,
      'expense',
      (v_line->>'amount')::numeric,
      (v_line->>'original_currency')::public.currency,
      (v_line->>'converted_amount')::numeric,
      v_account_id,
      (v_line->>'date')::date,
      (v_line->>'category_id')::uuid,
      v_line->>'note',
      v_line->>'dollar_type',
      (v_line->>'date')::date > (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
      v_statement_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('statement_id', v_statement_id, 'movements_created', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.import_card_statement(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_card_statement(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.import_card_statement(jsonb) FROM anon;
