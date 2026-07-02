-- =============================================================
-- 0046_onboarding_flag.sql
-- Columna: profiles.onboarding_completed_at
-- Depende de: 0001 (profiles)
--
-- Marca cuándo un usuario terminó (o saltó) el wizard de onboarding
-- guiado de 3 pasos que se muestra tras el registro. NULL = todavía
-- no lo vio. No está en la lista de columnas de billing protegidas
-- por el trigger profiles_protect_billing_fields (0034), así que el
-- propio usuario puede escribirla vía profiles_update_own.
-- =============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS
  'Timestamp de cuándo el usuario completó o saltó el onboarding guiado. NULL = pendiente.';

-- Backfill: los usuarios existentes (incluida la cuenta demo) no deben
-- ver el wizard retroactivamente — solo los que se registren de ahora
-- en más (para quienes esta columna queda NULL por default).
UPDATE public.profiles
  SET onboarding_completed_at = now()
  WHERE onboarding_completed_at IS NULL;
