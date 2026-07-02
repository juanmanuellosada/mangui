-- =============================================================
-- 0050_movements_tags.sql
-- Tags libres en movimientos — el usuario arma sus propias etiquetas
-- (sin tabla ni catálogo: un simple text[] en la fila del movimiento).
-- Depende de: 0004 (movements)
--
-- GIN index para que futuras búsquedas/filtros por tag (tags.cs.{...})
-- no requieran un seq scan.
-- =============================================================

ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_movements_tags
  ON movements USING GIN (tags);
