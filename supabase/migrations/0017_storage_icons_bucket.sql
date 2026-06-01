-- =============================================================
-- 0017_storage_icons_bucket.sql
-- Bucket público para íconos personalizados / avatares subidos
-- por el usuario. Versión prod: 20260531183143.
-- =============================================================

-- Bucket público para íconos personalizados / avatares subidos por el usuario.
INSERT INTO storage.buckets (id, name, public)
VALUES ('icons', 'icons', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública (los íconos se muestran en la app).
DO $$ BEGIN
  CREATE POLICY "icons_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'icons');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cada usuario sube/edita/borra sólo en su carpeta (prefijo = su uid).
DO $$ BEGIN
  CREATE POLICY "icons_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'icons' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "icons_update_own" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'icons' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "icons_delete_own" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'icons' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
