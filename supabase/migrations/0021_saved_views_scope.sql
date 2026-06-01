-- =============================================================
-- 0021_saved_views_scope.sql
-- Agrega la columna scope a saved_views para separar vistas de
-- Analytics ('stats') de vistas de Movimientos ('movements').
-- Depende de: 0013 (saved_views)
-- =============================================================


-- =================================================================
-- EXTENSIÓN: saved_views → columna scope
--
-- REGLAS DE NEGOCIO:
--   - scope NOT NULL DEFAULT 'stats' → las filas existentes quedan
--     automáticamente en scope='stats' (pertenecen a Analytics).
--   - CHECK constraint limita los valores a 'stats' y 'movements'.
--   - Índice compuesto (user_id, scope) para filtrar vistas por
--     usuario y scope de forma eficiente.
-- =================================================================

-- 1. Agregar columna scope (idempotente con IF NOT EXISTS)
ALTER TABLE saved_views
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'stats';

-- 2. CHECK constraint (guard: solo se agrega si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_saved_views_scope'
      AND conrelid = 'saved_views'::regclass
  ) THEN
    ALTER TABLE saved_views
      ADD CONSTRAINT chk_saved_views_scope CHECK (scope IN ('stats', 'movements'));
  END IF;
END$$;

-- 3. Índice compuesto (user_id, scope)
CREATE INDEX IF NOT EXISTS idx_saved_views_user_scope
  ON saved_views(user_id, scope);
