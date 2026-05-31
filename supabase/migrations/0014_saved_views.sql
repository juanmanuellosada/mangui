-- =============================================================
-- 0014_saved_views.sql
-- Fase 6 — Estadísticas / Reportes: Vistas guardadas
--
-- Tabla: saved_views
-- Propósito: persistir conjuntos de filtros de analytics
--   (rango de fechas, categorías, cuentas, moneda, tipo)
--   que el usuario guarda para reutilizar en la pantalla
--   de Estadísticas sin tener que reconfigurar cada vez.
--
-- DISEÑO:
--   - Los filtros se almacenan como jsonb sin FK declaradas.
--     Los arrays de uuid (categoryIds, accountIds) son validados
--     en la capa de aplicación, igual que en budgets.account_ids.
--   - El nombre es libre; no se exige unicidad para permitir
--     al usuario clonar y renombrar vistas.
--   - La tabla NO almacena resultados calculados (totales,
--     gráficos). Solo persiste el conjunto de parámetros de
--     filtro. Todos los datos analíticos se derivan en runtime
--     desde movements, transfers, budgets y goals.
--
-- Depende de: auth.users (Supabase Auth), set_updated_at() (0002)
-- Idempotente: CREATE TABLE IF NOT EXISTS + DO $$ ... EXCEPTION
-- =============================================================

-- =================================================================
-- TABLA: saved_views
-- =================================================================
-- Estructura del campo filters (jsonb):
--   {
--     "dateFrom":    "2025-01-01",            -- ISO date string, nullable
--     "dateTo":      "2025-05-31",            -- ISO date string, nullable
--     "categoryIds": ["uuid1", "uuid2"],      -- [] = todas las categorías
--     "accountIds":  ["uuid3"],               -- [] = todas las cuentas
--     "currency":    "ARS",                  -- "ARS" | "USD" | null (ambas)
--     "type":        "expense"               -- "income" | "expense" | null (todos)
--   }
-- Todos los campos son opcionales dentro del objeto.
-- Un filtro vacío {} equivale a "sin restricciones" (vista global).
-- =================================================================
CREATE TABLE IF NOT EXISTS saved_views (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Propietario. Borrar el usuario elimina todas sus vistas en cascada.
  user_id     uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Nombre descriptivo elegido por el usuario (ej: "Mayo gastos ARS").
  name        text  NOT NULL,

  -- Conjunto de filtros serializado. DEFAULT {} = sin filtros (vista global).
  -- La aplicación valida que los uuid en categoryIds y accountIds
  -- pertenezcan al usuario al momento de crear/actualizar la vista.
  filters     jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------
-- TRIGGER updated_at
-- Reutiliza set_updated_at() definida en 0002_profiles_preferences.sql.
-- El bloque DO es idempotente: ignora el error si el trigger ya existe.
-- -----------------------------------------------------------------
DO $$ BEGIN
  CREATE TRIGGER saved_views_updated_at
    BEFORE UPDATE ON saved_views
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------
-- ÍNDICE: user_id
-- Cubre la consulta más frecuente: listar todas las vistas del usuario.
-- Idempotente con IF NOT EXISTS.
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_saved_views_user_id
  ON saved_views (user_id);

-- =================================================================
-- ROW LEVEL SECURITY
-- Política estándar: aislamiento total por usuario.
-- Cada usuario solo puede ver, insertar, modificar y borrar
-- sus propias filas (auth.uid() = user_id).
-- =================================================================
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

-- SELECT: solo las vistas propias
DO $$ BEGIN
  CREATE POLICY "saved_views: select own"
    ON saved_views FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INSERT: solo puede insertar filas donde user_id coincide con el usuario
DO $$ BEGIN
  CREATE POLICY "saved_views: insert own"
    ON saved_views FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE: solo puede modificar sus propias filas
DO $$ BEGIN
  CREATE POLICY "saved_views: update own"
    ON saved_views FOR UPDATE
    USING     (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DELETE: solo puede borrar sus propias filas
DO $$ BEGIN
  CREATE POLICY "saved_views: delete own"
    ON saved_views FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
