-- =============================================================
-- 0002_profiles_preferences.sql
-- Tablas: profiles, user_preferences
-- Depende de: 0001 (enums currency, rate_type, ui_theme)
-- =============================================================

-- -----------------------------------------------------------------
-- HELPER: función updated_at genérica (creada aquí, reutilizada por
-- todas las tablas que la necesiten en migraciones posteriores).
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- =================================================================
-- TABLA: profiles
-- Espejo 1:1 de auth.users. Se crea automáticamente en el signup
-- mediante el trigger handle_new_user (definido en 0006).
-- La PK coincide con auth.users.id para que los JOINs sean directos.
-- =================================================================
CREATE TABLE IF NOT EXISTS profiles (
  -- PK = FK a auth.users
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Datos del perfil
  name          text,
  avatar_url    text,
  email         text,                    -- mirror de auth.users.email (útil para queries sin join)

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas: el usuario solo accede a su propio perfil
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No permitimos DELETE directo: se propaga desde auth.users ON DELETE CASCADE

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- TABLA: user_preferences
-- Una fila por usuario. Creada automáticamente junto con el perfil.
-- Fases futuras: agregar columnas push_enabled, reminder_time, etc.
-- =================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Moneda principal de visualización
  default_currency currency    NOT NULL DEFAULT 'ARS',

  -- Cotización del dólar preferida para conversiones
  rate_type        rate_type   NOT NULL DEFAULT 'blue',

  -- Solo se usa cuando rate_type = 'manual'
  manual_rate      numeric(18,2) NULL CHECK (manual_rate > 0),

  -- Tema de la UI
  theme            ui_theme    NOT NULL DEFAULT 'system',

  -- Placeholder para fases futuras (notificaciones, recordatorios)
  -- push_enabled  boolean NOT NULL DEFAULT false,
  -- reminder_time time,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert_own"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update_own"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
