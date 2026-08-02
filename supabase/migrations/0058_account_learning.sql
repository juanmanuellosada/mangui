-- =============================================================
-- 0058_account_learning.sql
-- Tabla: account_learning
-- Depende de: 0001 (accounts), auth.users
--
-- Registra, por usuario y contexto del movimiento, qué cuenta eligió
-- repetidamente. Dos tipos de contexto en la misma tabla:
--   - 'category_currency': context_key = "<category_id>:<currency>"
--     (ej.: "Rendimientos" en USD siempre a la misma cuenta de inversión)
--   - 'merchant': context_key = merchantKey(nota) (ver
--     src/lib/category-learning.ts), mismo criterio que category_learning
--     (ej.: "Netflix" siempre sale de la misma tarjeta)
-- Aprendizaje implícito, igual que category_learning (migración 0045):
-- cada vez que el usuario confirma un movimiento se suma un hit. El
-- historial se usa como un término más del puntaje del resolver de
-- cuentas, nunca como una regla que decide por sí sola (ver
-- openspec/changes/mejorar-deteccion-cuenta-ia).
-- =============================================================
CREATE TABLE IF NOT EXISTS account_learning (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  context_kind   text         NOT NULL CHECK (context_kind IN ('category_currency', 'merchant')),
  context_key    text         NOT NULL,
  account_id     uuid         NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,

  hit_count      int          NOT NULL DEFAULT 1,
  last_used_at   timestamptz  NOT NULL DEFAULT now(),

  created_at     timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT account_learning_user_context_account_key
    UNIQUE (user_id, context_kind, context_key, account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_learning_user_context
  ON account_learning(user_id, context_kind, context_key);

-- RLS
ALTER TABLE account_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_learning_select_own"
  ON account_learning FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "account_learning_insert_own"
  ON account_learning FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "account_learning_update_own"
  ON account_learning FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "account_learning_delete_own"
  ON account_learning FOR DELETE
  USING (auth.uid() = user_id);

-- ── RPC: bump_account_learning ──────────────────────────────────────────────
-- Suma un hit (o crea la fila) para hasta dos contextos de
-- (auth.uid(), account_id) en un solo round trip: 'category_currency' si
-- vienen p_category_id y p_currency, y 'merchant' si viene p_merchant_key.
-- Cualquiera de los dos puede venir null (el llamador puede no tener nota,
-- o el movimiento puede no tener categoría). SECURITY DEFINER por el mismo
-- motivo que bump_category_learning: toma el user_id de auth.uid() —nunca
-- de un parámetro— y solo escribe datos propios del usuario autenticado,
-- por eso se otorga a `authenticated` y se invoca directo desde el browser.
CREATE OR REPLACE FUNCTION public.bump_account_learning(
  p_category_id uuid,
  p_currency text,
  p_merchant_key text,
  p_account_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_account_id IS NULL THEN
    RETURN;
  END IF;

  IF p_category_id IS NOT NULL AND p_currency IS NOT NULL THEN
    INSERT INTO public.account_learning (user_id, context_kind, context_key, account_id)
    VALUES (v_uid, 'category_currency', p_category_id::text || ':' || p_currency, p_account_id)
    ON CONFLICT (user_id, context_kind, context_key, account_id)
    DO UPDATE SET
      hit_count = public.account_learning.hit_count + 1,
      last_used_at = now();
  END IF;

  IF p_merchant_key IS NOT NULL THEN
    INSERT INTO public.account_learning (user_id, context_kind, context_key, account_id)
    VALUES (v_uid, 'merchant', p_merchant_key, p_account_id)
    ON CONFLICT (user_id, context_kind, context_key, account_id)
    DO UPDATE SET
      hit_count = public.account_learning.hit_count + 1,
      last_used_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_account_learning(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_account_learning(uuid, text, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_account_learning(uuid, text, text, uuid) FROM anon;
