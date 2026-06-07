-- Add billing and plan fields to profiles.
-- These fields are write-protected for non-service-role users via trigger.

ALTER TABLE public.profiles
  ADD COLUMN plan                        text    NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'premium')),
  ADD COLUMN payment_exempt              boolean NOT NULL DEFAULT false,
  ADD COLUMN payment_exempt_reason       text,
  ADD COLUMN mp_preapproval_id           text,
  ADD COLUMN mp_subscription_status      text,
  ADD COLUMN subscription_status_changed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Billing field write protection via trigger
--
-- NOTE: Column-level REVOKE is silently bypassed when the role holds a
-- table-level UPDATE grant (Supabase default). The trigger below is the
-- actual enforcement layer.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_billing_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The admin (service_role) client is allowed to change billing fields.
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Any other role (authenticated, anon, …) must not touch billing fields.
  -- IS DISTINCT FROM handles NULL correctly.
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_billing_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_billing_writes();
