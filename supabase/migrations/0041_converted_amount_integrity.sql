-- Fix: account_balances (0007) does COALESCE(converted_amount, 0) for
-- movements whose original_currency differs from the account's currency.
-- A cross-currency movement with converted_amount left NULL silently
-- counts as $0 in the balance instead of raising an error.
--
-- A plain CHECK constraint can't validate this (it would need to join
-- movements against accounts.currency), so we enforce it with a
-- BEFORE INSERT OR UPDATE trigger on movements instead. This only
-- guards future writes — no backfill/validation of existing rows, since
-- the demo account has ~1 year of historical data that could already
-- violate this and we don't want the migration to fail on apply.
--
-- SECURITY DEFINER + search_path = '' (fully-qualified identifiers):
-- the trigger must read accounts.currency for NEW.account_id regardless
-- of the caller's RLS visibility into that row, so the integrity check
-- can't be silently bypassed by RLS edge cases. It only ever reads a
-- single currency value and never returns account data to the caller,
-- so this doesn't leak anything beyond what the FK already exposes.
CREATE OR REPLACE FUNCTION public.check_movement_converted_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_currency public.currency;
BEGIN
  SELECT currency INTO v_account_currency
  FROM public.accounts
  WHERE id = NEW.account_id;

  IF v_account_currency IS DISTINCT FROM NEW.original_currency
     AND NEW.converted_amount IS NULL THEN
    RAISE EXCEPTION
      'converted_amount is required when original_currency (%) differs from the account currency (%)',
      NEW.original_currency, v_account_currency;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movements_converted_amount_integrity ON public.movements;
CREATE TRIGGER trg_movements_converted_amount_integrity
  BEFORE INSERT OR UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.check_movement_converted_amount();
