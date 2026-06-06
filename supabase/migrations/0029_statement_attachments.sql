-- Adjuntos de resúmenes de tarjeta — parte 2/2
-- Depende de: 0028 (enum 'resumen'), 0019 (movement_attachments),
--             0010 (card_statements)
--
-- CAMBIOS:
--   1. Agrega statement_id uuid nullable con FK a card_statements(id).
--   2. Índice en statement_id.
--   3. Reemplaza el CHECK de "exactamente un padre" para incluir statement_id
--      (movement_id XOR transfer_id XOR statement_id — exactamente uno no nulo).
--   4. Agrega políticas RLS que permiten al dueño de la tarjeta gestionar
--      adjuntos de sus resúmenes (via statement_id → card_statements.user_id).


-- 1. Agregar statement_id con FK a card_statements
ALTER TABLE movement_attachments
  ADD COLUMN statement_id uuid NULL REFERENCES card_statements(id) ON DELETE CASCADE;


-- 2. Índice en statement_id
CREATE INDEX IF NOT EXISTS idx_movement_attachments_statement_id
  ON movement_attachments(statement_id);


-- 3. Reemplazar el CHECK de padre único para incluir statement_id
--    El constraint anterior solo cubría movement_id y transfer_id.
ALTER TABLE movement_attachments
  DROP CONSTRAINT IF EXISTS chk_movement_attachments_one_parent;

ALTER TABLE movement_attachments
  ADD CONSTRAINT chk_movement_attachments_one_parent CHECK (
    (
      (movement_id   IS NOT NULL)::int +
      (transfer_id   IS NOT NULL)::int +
      (statement_id  IS NOT NULL)::int
    ) = 1
  );


-- 4. RLS: el dueño de la tarjeta puede gestionar adjuntos de sus resúmenes.
--    Las políticas existentes (por user_id) ya cubren los casos de movement_id
--    y transfer_id. Agregamos políticas específicas para statement_id que
--    verifican la propiedad a través de card_statements.

-- SELECT: el usuario puede ver adjuntos de sus propios resúmenes
CREATE POLICY "movement_attachments_select_statement_own"
  ON movement_attachments FOR SELECT
  USING (
    statement_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM card_statements cs
      WHERE cs.id = statement_id
        AND cs.user_id = auth.uid()
    )
  );

-- INSERT: el usuario puede adjuntar archivos a sus propios resúmenes
CREATE POLICY "movement_attachments_insert_statement_own"
  ON movement_attachments FOR INSERT
  WITH CHECK (
    statement_id IS NOT NULL
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM card_statements cs
      WHERE cs.id = statement_id
        AND cs.user_id = auth.uid()
    )
  );

-- DELETE: el usuario puede borrar adjuntos de sus propios resúmenes
CREATE POLICY "movement_attachments_delete_statement_own"
  ON movement_attachments FOR DELETE
  USING (
    statement_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM card_statements cs
      WHERE cs.id = statement_id
        AND cs.user_id = auth.uid()
    )
  );
