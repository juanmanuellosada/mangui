-- =============================================================
-- 0022_saved_views_stats_compare_scope.sql
-- Amplía el CHECK constraint de saved_views.scope para incluir
-- 'stats_compare' (pestaña Comparar de Analytics).
-- Depende de: 0021 (saved_views_scope)
-- =============================================================


-- =================================================================
-- MODIFICACIÓN: saved_views → CHECK constraint de scope
--
-- REGLAS DE NEGOCIO:
--   - Se agrega 'stats_compare' como valor válido de scope.
--     'stats'         → pestaña Resúmenes de Analytics
--     'movements'     → pestaña Movimientos
--     'stats_compare' → pestaña Comparar de Analytics
--   - Se reemplaza el constraint existente (drop + add, idempotente).
-- =================================================================

-- 1. Eliminar constraint anterior (si existe)
ALTER TABLE saved_views DROP CONSTRAINT IF EXISTS chk_saved_views_scope;

-- 2. Re-agregar constraint con el conjunto ampliado
ALTER TABLE saved_views
  ADD CONSTRAINT chk_saved_views_scope CHECK (scope IN ('stats', 'movements', 'stats_compare'));
