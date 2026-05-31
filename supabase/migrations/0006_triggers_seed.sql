-- =============================================================
-- 0006_triggers_seed.sql
-- Trigger de signup: crea perfil + preferencias + categorías default
-- Función seed de categorías por usuario.
-- Depende de: 0002 (profiles, user_preferences), 0003 (categories)
-- =============================================================


-- =================================================================
-- FUNCIÓN: seed_default_categories(p_user_id uuid)
-- Inserta el set de categorías por defecto para un usuario nuevo.
-- ON CONFLICT DO NOTHING → idempotente (se puede llamar más de una vez).
-- =================================================================
CREATE OR REPLACE FUNCTION seed_default_categories(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO categories (user_id, name, type, icon, is_default)
  VALUES
    -- ── INGRESOS ─────────────────────────────────────────────
    (p_user_id, 'Sueldo',           'income',  '💼', true),
    (p_user_id, 'Freelance',        'income',  '💻', true),
    (p_user_id, 'Inversiones',      'income',  '📈', true),
    (p_user_id, 'Otros ingresos',   'income',  '💰', true),

    -- ── GASTOS ───────────────────────────────────────────────
    (p_user_id, 'Supermercado',     'expense', '🛒', true),
    (p_user_id, 'Comida afuera',    'expense', '🍽️', true),
    (p_user_id, 'Transporte',       'expense', '🚇', true),
    (p_user_id, 'Servicios',        'expense', '💡', true),
    (p_user_id, 'Alquiler',         'expense', '🏠', true),
    (p_user_id, 'Salud',            'expense', '🏥', true),
    (p_user_id, 'Entretenimiento',  'expense', '🎬', true),
    (p_user_id, 'Ropa',             'expense', '👕', true),
    (p_user_id, 'Educación',        'expense', '📚', true),
    (p_user_id, 'Suscripciones',    'expense', '📱', true),
    (p_user_id, 'Impuestos',        'expense', '🧾', true),
    (p_user_id, 'Otros gastos',     'expense', '📦', true)
  ON CONFLICT (user_id, name, type) DO NOTHING;
END;
$$;


-- =================================================================
-- FUNCIÓN: handle_new_user()
-- Se dispara en INSERT sobre auth.users (trigger de Supabase Auth).
-- Crea automáticamente:
--   1. profiles (espejo del usuario)
--   2. user_preferences (valores por defecto)
--   3. categorías por defecto vía seed_default_categories()
--
-- SECURITY DEFINER: necesario para poder escribir en tablas con RLS
-- desde un contexto sin auth.uid() definido (el trigger corre como
-- postgres/service_role, no como el usuario nuevo).
-- =================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Crear perfil
  INSERT INTO profiles (id, email, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    -- Usar display_name del metadata si existe, si no el email
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Crear preferencias por defecto
  INSERT INTO user_preferences (user_id, default_currency, rate_type, theme)
  VALUES (NEW.id, 'ARS', 'blue', 'system')
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Seed de categorías por defecto
  PERFORM seed_default_categories(NEW.id);

  RETURN NEW;
END;
$$;


-- =================================================================
-- TRIGGER: on_auth_user_created
-- Se adjunta a auth.users (tabla de Supabase Auth).
-- Solo se crea si no existe todavía (DROP + CREATE para idempotencia).
-- =================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
