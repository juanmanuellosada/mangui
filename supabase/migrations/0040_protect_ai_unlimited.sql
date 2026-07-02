-- Fix: profiles.ai_unlimited (added in 0031) was never added to the
-- prevent_billing_writes() trigger (0034/0035), so any authenticated user
-- could run `update profiles set ai_unlimited = true where id = auth.uid()`
-- from the browser and get unlimited AI usage for free, burning the
-- owner's Gemini key. Redefine the function to also protect this column,
-- keeping every column already protected and the SECURITY INVOKER +
-- search_path from 0035 untouched.
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
      NEW.subscription_status_changed_at IS DISTINCT FROM OLD.subscription_status_changed_at OR
      NEW.ai_unlimited                  IS DISTINCT FROM OLD.ai_unlimited
    ) THEN
      RAISE EXCEPTION 'permission denied: billing fields are service-role only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
