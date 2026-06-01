-- =============================================================
-- 0017_movement_attachments.sql
-- Tabla: movement_attachments
-- Depende de: 0004 (movements)
-- =============================================================


-- =================================================================
-- ENUM: attachment_kind
-- Tipo de comprobante adjunto a un movimiento.
-- =================================================================
DO $$ BEGIN
  CREATE TYPE attachment_kind AS ENUM ('factura', 'recibo', 'comprobante');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =================================================================
-- TABLA: movement_attachments
-- Almacena referencias a archivos adjuntos de un movimiento
-- (facturas, recibos, comprobantes). Los archivos viven en el
-- bucket de Storage "attachments" (privado).
--
-- REGLAS DE NEGOCIO:
--   - kind indica qué tipo de comprobante es el adjunto.
--   - file_url guarda el path relativo en Storage (NO una URL pública);
--     el acceso se realiza vía signed URL.
--   - La cardinalidad por movimiento (gasto ≤2, ingreso ≤1) se aplica
--     en la capa de aplicación; la tabla no la fuerza.
--   - ON DELETE CASCADE en movement_id: al borrar el movimiento se
--     borran las filas; el borrado del objeto en Storage queda a cargo
--     de la aplicación o de un trigger/webhook en fase futura.
-- =================================================================
CREATE TABLE IF NOT EXISTS movement_attachments (
  id            uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movement_id   uuid             NOT NULL REFERENCES movements(id) ON DELETE CASCADE,

  kind          attachment_kind  NOT NULL,

  -- Path relativo en el bucket "attachments" (ej: {userId}/{uuid}.pdf)
  file_url      text             NOT NULL,
  file_name     text,
  file_size     int,
  mime_type     text,

  created_at    timestamptz      NOT NULL DEFAULT now(),
  updated_at    timestamptz      NOT NULL DEFAULT now()
);

-- ── Índices
CREATE INDEX IF NOT EXISTS idx_movement_attachments_movement_id
  ON movement_attachments(movement_id);

-- RLS
ALTER TABLE movement_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movement_attachments_select_own"
  ON movement_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "movement_attachments_insert_own"
  ON movement_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "movement_attachments_update_own"
  ON movement_attachments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "movement_attachments_delete_own"
  ON movement_attachments FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_movement_attachments_updated_at ON movement_attachments;
CREATE TRIGGER trg_movement_attachments_updated_at
  BEFORE UPDATE ON movement_attachments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- STORAGE: bucket "attachments" (privado) + políticas por usuario
--
-- El bucket es privado (public = false); los archivos se sirven
-- exclusivamente mediante signed URLs (createSignedUrl).
-- Cada usuario tiene acceso solo a su carpeta: {auth.uid()}/...
-- =================================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('attachments', 'attachments', false)
  ON CONFLICT DO NOTHING;

-- SELECT: el usuario puede listar/leer sus propios objetos
CREATE POLICY "attachments_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- INSERT: el usuario puede subir a su propia carpeta
CREATE POLICY "attachments_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: el usuario puede modificar sus propios objetos
CREATE POLICY "attachments_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: el usuario puede borrar sus propios objetos
CREATE POLICY "attachments_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
