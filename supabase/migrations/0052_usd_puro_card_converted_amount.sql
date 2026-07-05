-- "USD puro": un consumo en dólares sobre una tarjeta de crédito en ARS ya no
-- requiere converted_amount. Se guarda sin equivalente en pesos y se trata
-- por moneda en toda la app (ver src/lib/money.ts) — no se mezcla con los
-- totales en ARS (stats, saldo, resumen de tarjeta), aparece aparte por
-- moneda.
--
-- Relaja el trigger de integridad de 0041/0044: agrega el tipo de cuenta al
-- SELECT y exceptúa `tarjeta_credito` de la exigencia de converted_amount.
-- El invariante se mantiene sin cambios para el resto de las cuentas (p. ej.
-- una caja de ahorro en ARS con un movimiento en USD sigue exigiendo
-- converted_amount).
CREATE OR REPLACE FUNCTION public.check_movement_converted_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_currency public.currency;
  v_account_type public.account_type;
BEGIN
  SELECT currency, type INTO v_account_currency, v_account_type
  FROM public.accounts
  WHERE id = NEW.account_id;

  IF v_account_currency IS DISTINCT FROM NEW.original_currency
     AND NEW.converted_amount IS NULL
     AND v_account_type IS DISTINCT FROM 'tarjeta_credito' THEN
    RAISE EXCEPTION
      'converted_amount is required when original_currency (%) differs from the account currency (%)',
      NEW.original_currency, v_account_currency;
  END IF;

  RETURN NEW;
END;
$$;
