-- Fix: el ON CONFLICT del upsert de cuotas en import_card_statement apuntaba a
-- un índice PARCIAL (idx_movements_installment_purchase_number, con
-- WHERE installment_purchase_id IS NOT NULL) sin repetir ese predicado, así que
-- Postgres no lo matcheaba y la RPC fallaba con:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Se agrega el WHERE al ON CONFLICT para que infiera el índice parcial. Único
-- cambio respecto de 0051; el resto de la función queda igual.
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
  v_purchase jsonb;
  v_installment jsonb;
  v_purchase_id uuid;
  v_line_count integer := 0;
  v_installment_count integer := 0;
  v_recurring_count integer := 0;
  v_skip_paid boolean;
  v_recurring_day_of_month integer;
  v_recurring_start date;
  v_recurring_next_run date;
  v_recurring_next_month date;
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
  RETURNING id INTO v_statement_id;

  DELETE FROM public.movements
  WHERE import_statement_id = v_statement_id
    AND installment_purchase_id IS NULL;

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
    v_line_count := v_line_count + 1;

    IF v_line->'create_recurring' IS NOT NULL AND v_line->'create_recurring' <> 'null'::jsonb THEN
      v_recurring_day_of_month := COALESCE(
        (v_line->'create_recurring'->>'day_of_month')::int,
        EXTRACT(DAY FROM (v_line->>'date')::date)::int
      );

      v_recurring_start := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;

      v_recurring_next_run := make_date(
        EXTRACT(YEAR FROM v_recurring_start)::int,
        EXTRACT(MONTH FROM v_recurring_start)::int,
        LEAST(
          v_recurring_day_of_month,
          EXTRACT(DAY FROM (date_trunc('month', v_recurring_start) + interval '1 month - 1 day'))::int
        )
      );
      IF v_recurring_next_run < v_recurring_start THEN
        v_recurring_next_month := (v_recurring_start + interval '1 month')::date;
        v_recurring_next_run := make_date(
          EXTRACT(YEAR FROM v_recurring_next_month)::int,
          EXTRACT(MONTH FROM v_recurring_next_month)::int,
          LEAST(
            v_recurring_day_of_month,
            EXTRACT(DAY FROM (date_trunc('month', v_recurring_next_month) + interval '1 month - 1 day'))::int
          )
        );
      END IF;

      INSERT INTO public.recurring_transactions (
        user_id, kind, amount, currency, account_id, category_id, note,
        frequency, day_of_month, weekend_handling, start_date, next_run,
        status, is_card_recurring, source_key
      ) VALUES (
        v_uid,
        'expense',
        (v_line->>'amount')::numeric,
        (v_line->>'original_currency')::public.currency,
        v_account_id,
        (v_line->>'category_id')::uuid,
        v_line->>'note',
        'monthly',
        v_recurring_day_of_month,
        'as_is',
        v_recurring_start,
        v_recurring_next_run,
        'active',
        true,
        v_line->'create_recurring'->>'subscription_key'
      )
      ON CONFLICT (user_id, source_key) WHERE source_key IS NOT NULL DO NOTHING;
      IF FOUND THEN
        v_recurring_count := v_recurring_count + 1;
      END IF;
    END IF;
  END LOOP;

  FOR v_purchase IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'installment_purchases', '[]'::jsonb))
  LOOP
    INSERT INTO public.installment_purchases (
      user_id, description, total_amount, installments_count, start_date,
      currency, account_id, category_id, dollar_type, note, purchase_key
    ) VALUES (
      v_uid,
      v_purchase->>'description',
      (v_purchase->>'total_amount')::numeric,
      (v_purchase->>'installments_count')::int,
      (v_purchase->>'start_date')::date,
      (v_purchase->>'currency')::public.currency,
      v_account_id,
      (v_purchase->>'category_id')::uuid,
      v_purchase->>'dollar_type',
      v_purchase->>'note',
      v_purchase->>'purchase_key'
    )
    ON CONFLICT (user_id, purchase_key) WHERE purchase_key IS NOT NULL DO UPDATE SET
      description = EXCLUDED.description,
      total_amount = EXCLUDED.total_amount,
      installments_count = EXCLUDED.installments_count,
      currency = EXCLUDED.currency,
      account_id = EXCLUDED.account_id,
      category_id = EXCLUDED.category_id,
      dollar_type = EXCLUDED.dollar_type,
      note = EXCLUDED.note
    RETURNING id INTO v_purchase_id;

    FOR v_installment IN SELECT * FROM jsonb_array_elements(COALESCE(v_purchase->'installments', '[]'::jsonb))
    LOOP
      v_skip_paid := EXISTS (
        SELECT 1 FROM public.card_statements cs
        WHERE cs.account_id = v_account_id
          AND cs.status = 'pagado'
          AND cs.close_date = (
            SELECT MIN(cs2.close_date) FROM public.card_statements cs2
            WHERE cs2.account_id = v_account_id
              AND cs2.close_date >= (v_installment->>'date')::date
          )
      );

      IF NOT v_skip_paid THEN
        INSERT INTO public.movements (
          user_id, type, amount, original_currency, converted_amount, account_id,
          date, category_id, note, dollar_type, is_future,
          installment_purchase_id, installment_number, installment_total
        ) VALUES (
          v_uid,
          'expense',
          (v_installment->>'amount')::numeric,
          (v_installment->>'original_currency')::public.currency,
          (v_installment->>'converted_amount')::numeric,
          v_account_id,
          (v_installment->>'date')::date,
          (v_installment->>'category_id')::uuid,
          v_installment->>'note',
          v_installment->>'dollar_type',
          (v_installment->>'date')::date > (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
          v_purchase_id,
          (v_installment->>'installment_number')::int,
          (v_installment->>'installment_total')::int
        )
        ON CONFLICT (installment_purchase_id, installment_number) WHERE installment_purchase_id IS NOT NULL DO UPDATE SET
          amount = EXCLUDED.amount,
          original_currency = EXCLUDED.original_currency,
          converted_amount = EXCLUDED.converted_amount,
          date = EXCLUDED.date,
          category_id = EXCLUDED.category_id,
          note = EXCLUDED.note,
          dollar_type = EXCLUDED.dollar_type,
          is_future = EXCLUDED.is_future,
          installment_total = EXCLUDED.installment_total;
        v_installment_count := v_installment_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'statement_id', v_statement_id,
    'movements_created', v_line_count,
    'installments_upserted', v_installment_count,
    'recurring_created', v_recurring_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_card_statement(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_card_statement(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.import_card_statement(jsonb) FROM anon;
