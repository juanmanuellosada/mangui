-- =============================================================
-- 0020_transfer_attachments.sql
-- Extiende movement_attachments para soportar también transfers.
-- Depende de: 0004 (transfers), 0019 (movement_attachments)
-- =============================================================


-- =================================================================
-- EXTENSIÓN: movement_attachments → soporta transfers
--
-- REGLAS DE NEGOCIO:
--   - movement_id pasa a ser nullable.
--   - Se agrega transfer_id uuid nullable con FK a transfers(id).
--   - El CHECK constraint exige exactamente uno de los dos: la suma
--     de booleanos (IS NOT NULL) debe ser 1.
--   - RLS existente se mantiene sin cambios: filtra por user_id.
--   - El enum attachment_kind ya incluye 'comprobante', que es el
--     kind por defecto para adjuntos de transferencias.
-- =================================================================

-- 1. Hacer movement_id nullable
ALTER TABLE movement_attachments
  ALTER COLUMN movement_id DROP NOT NULL;

-- 2. Agregar transfer_id con FK
ALTER TABLE movement_attachments
  ADD COLUMN transfer_id uuid NULL REFERENCES transfers(id) ON DELETE CASCADE;

-- 3. CHECK: exactamente uno de (movement_id, transfer_id) no es null
ALTER TABLE movement_attachments
  ADD CONSTRAINT chk_movement_attachments_one_parent CHECK (
    ((movement_id IS NOT NULL)::int + (transfer_id IS NOT NULL)::int) = 1
  );

-- 4. Índice en transfer_id
CREATE INDEX IF NOT EXISTS idx_movement_attachments_transfer_id
  ON movement_attachments(transfer_id);
