-- IA incluida: key del servidor + rate limiting por usuario
-- Depende de: 0001 (profiles), auth.users
--
-- CAMBIOS:
--   1. Agrega profiles.ai_unlimited — flag para usuarios exentos del límite diario.
--   2. Crea tabla ai_usage        — un registro por interpretación exitosa.
--      RLS: SELECT del propio usuario; INSERT solo vía service role (admin client).

ALTER TABLE profiles
  ADD COLUMN ai_unlimited boolean NOT NULL DEFAULT false;

CREATE TABLE ai_usage (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  model      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id_created_at
  ON ai_usage (user_id, created_at);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden leer sus propias filas (para mostrar el contador en /ia).
-- INSERT se realiza únicamente desde el admin client (service role), que bypasea RLS.
CREATE POLICY "ai_usage: select own rows"
  ON ai_usage
  FOR SELECT
  USING (auth.uid() = user_id);
