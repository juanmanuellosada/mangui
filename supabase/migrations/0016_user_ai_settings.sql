-- =============================================================
-- 0016_user_ai_settings.sql
-- Configuración de IA por usuario (BYOK — bring-your-own-key).
-- Fase 8: permite que cada usuario configure su propio proveedor
-- de IA (Google Gemini / OpenAI / Anthropic Claude) y asocie una
-- API key cifrada en el servidor (AES-256-GCM).
--
-- Idempotente: usa IF NOT EXISTS / DO $$ EXCEPTION pattern.
-- RLS: aislamiento total por user_id (mismo patrón que profiles,
--   accounts, movements, etc.).
-- =============================================================

-- -----------------------------------------------------------------
-- TABLA: user_ai_settings
-- Una fila por usuario (UNIQUE user_id). Almacena el proveedor
-- de IA elegido, el modelo preferido y la API key cifrada.
--
-- SEGURIDAD — api_key_encrypted:
--   • Contiene ÚNICAMENTE el ciphertext AES-256-GCM serializado
--     en formato "<iv_b64>:<tag_b64>:<data_b64>" (Base64).
--   • NUNCA se almacena la clave en texto plano.
--   • El cliente NO debe SELECT esta columna directamente;
--     en su lugar selecciona (provider, model,
--     api_key_encrypted IS NOT NULL AS has_key).
--   • El descifrado ocurre exclusivamente en el servidor
--     usando la variable de entorno APP_ENCRYPTION_KEY
--     (nunca expuesta al cliente).
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_ai_settings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,

  -- Proveedor de IA. Valores válidos: 'google' | 'openai' | 'anthropic'.
  -- Default: 'google' (Google Gemini tiene capa gratuita sin tarjeta).
  provider    text        NOT NULL DEFAULT 'google',

  -- Modelo específico del proveedor. NULL = usar el default del proveedor.
  -- Ejemplos: 'gemini-2.0-flash', 'gpt-4o-mini', 'claude-3-5-haiku-latest'.
  model       text        NULL,

  -- Ciphertext AES-256-GCM de la API key del proveedor.
  -- Formato: "<iv_base64>:<authTag_base64>:<data_base64>".
  -- NULL significa que el usuario aún no configuró su key.
  -- NUNCA almacenar la clave en texto plano en esta columna.
  api_key_encrypted text NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Garantiza que solo se acepten proveedores conocidos.
  CONSTRAINT chk_ai_provider CHECK (provider IN ('google', 'openai', 'anthropic'))
);

-- -----------------------------------------------------------------
-- TRIGGER: updated_at automático (mismo patrón que el resto del schema).
-- set_updated_at() ya existe desde 0002_profiles_preferences.sql.
-- -----------------------------------------------------------------
DO $$ BEGIN
  CREATE TRIGGER set_updated_at_user_ai_settings
    BEFORE UPDATE ON user_ai_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------
-- ÍNDICE: búsqueda directa por user_id (cubre la consulta estándar
-- del servidor: "dame la config de IA de este usuario").
-- La UNIQUE constraint ya genera un índice, pero lo dejamos
-- explícito para documentar la intención.
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS user_ai_settings_user_id_idx
  ON user_ai_settings (user_id);

-- -----------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Aislamiento completo: un usuario solo puede ver y manipular
-- su propia fila. Patrón idéntico al de movements, accounts, etc.
-- -----------------------------------------------------------------
ALTER TABLE user_ai_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: solo la propia fila.
-- NOTA: la app cliente NO debe incluir api_key_encrypted en el
-- SELECT. Usar: SELECT provider, model, api_key_encrypted IS NOT NULL AS has_key
-- El servidor (service_role, bypass RLS) sí puede leer api_key_encrypted
-- para descifrarla y llamar al proveedor.
DO $$ BEGIN
  CREATE POLICY "user_ai_settings_select_own"
    ON user_ai_settings
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT: solo puede insertar su propia fila.
DO $$ BEGIN
  CREATE POLICY "user_ai_settings_insert_own"
    ON user_ai_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE: solo puede actualizar su propia fila.
DO $$ BEGIN
  CREATE POLICY "user_ai_settings_update_own"
    ON user_ai_settings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DELETE: el usuario puede borrar su configuración (quitar la key).
DO $$ BEGIN
  CREATE POLICY "user_ai_settings_delete_own"
    ON user_ai_settings
    FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
