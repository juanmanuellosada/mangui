-- =============================================================
-- 0045_category_learning.sql
-- Tabla: category_learning
-- Depende de: 0003 (categories), auth.users
--
-- Registra, por usuario y "comercio" (palabra clave extraída de la nota
-- del movimiento, ver merchantKey() en src/lib/category-learning.ts), qué
-- categoría eligió repetidamente. A diferencia de auto_rules (reglas
-- explícitas creadas por el usuario), esto es aprendizaje implícito: cada
-- vez que el usuario guarda o corrige un movimiento con nota + categoría,
-- se suma un hit. Cuando un comercio acumula suficientes hits en una misma
-- categoría, el formulario la sugiere automáticamente (ver LEARN_MIN_HITS).
-- =============================================================
CREATE TABLE IF NOT EXISTS category_learning (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  merchant_key   text         NOT NULL,
  category_id    uuid         NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,

  hit_count      int          NOT NULL DEFAULT 1,
  last_used_at   timestamptz  NOT NULL DEFAULT now(),

  created_at     timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT category_learning_user_merchant_category_key
    UNIQUE (user_id, merchant_key, category_id)
);

CREATE INDEX IF NOT EXISTS idx_category_learning_user_merchant
  ON category_learning(user_id, merchant_key);

-- RLS
ALTER TABLE category_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_learning_select_own"
  ON category_learning FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "category_learning_insert_own"
  ON category_learning FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "category_learning_update_own"
  ON category_learning FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "category_learning_delete_own"
  ON category_learning FOR DELETE
  USING (auth.uid() = user_id);

-- ── RPC: bump_category_learning ──────────────────────────────────────────────
-- Suma un hit (o crea la fila) para (auth.uid(), p_merchant_key, p_category_id).
-- SECURITY DEFINER porque hace UPSERT sobre category_learning, pero a
-- diferencia de check_and_increment_ai_usage (0042/0043, service_role-only
-- porque recibe p_limit/p_user_id del server y no puede confiar en un
-- caller arbitrario), esta función toma el user_id de auth.uid() —no de un
-- parámetro— y solo escribe datos propios del usuario autenticado. Por eso
-- SÍ se otorga a `authenticated`: se invoca directamente desde el browser
-- (cliente con JWT de sesión) al guardar/corregir un movimiento.
CREATE OR REPLACE FUNCTION public.bump_category_learning(
  p_merchant_key text,
  p_category_id uuid
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

  INSERT INTO public.category_learning (user_id, merchant_key, category_id)
  VALUES (v_uid, p_merchant_key, p_category_id)
  ON CONFLICT (user_id, merchant_key, category_id)
  DO UPDATE SET
    hit_count = public.category_learning.hit_count + 1,
    last_used_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.bump_category_learning(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_category_learning(text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_category_learning(text, uuid) FROM anon;
