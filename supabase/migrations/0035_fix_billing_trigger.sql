-- Fix: previous version (0034) used SECURITY DEFINER, making current_user the
-- function owner (never 'service_role') → it blocked ALL billing writes incl. the
-- webhook. Use SECURITY INVOKER (default) and restrict only end-user roles.
CREATE OR REPLACE FUNCTION public.prevent_billing_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF (
      NEW.plan                          IS DISTINCT FROM OLD.plan                          OR
      NEW.payment_exempt                IS DISTINCT FROM OLD.payment_exempt                OR
      NEW.payment_exempt_reason         IS DISTINCT FROM OLD.payment_exempt_reason         OR
      NEW.mp_preapproval_id             IS DISTINCT FROM OLD.mp_preapproval_id             OR
      NEW.mp_subscription_status        IS DISTINCT FROM OLD.mp_subscription_status        OR
      NEW.subscription_status_changed_at IS DISTINCT FROM OLD.subscription_status_changed_at
    ) THEN
      RAISE EXCEPTION 'permission denied: billing fields are service-role only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
