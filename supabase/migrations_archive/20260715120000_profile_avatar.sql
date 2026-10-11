-- Módulo Perfil: foto de avatar para profesionales.
-- 1) Columna avatar_url en profiles (guarda la URL pública completa del bucket avatars).
ALTER TABLE public.profiles ADD COLUMN avatar_url text;

-- El GRANT UPDATE existente (20260430025705) es por columna; sin sumar avatar_url
-- el UPDATE desde el cliente falla con "permission denied" aunque la RLS pase.
GRANT UPDATE (avatar_url) ON public.profiles TO authenticated;

-- 2) Bucket público de avatares (los avatares no son data clínica sensible;
-- URL pública evita signed URLs con expiración en el sidebar). Límite 2MB, solo imágenes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 3) Políticas: lectura pública, escritura solo sobre la carpeta propia
-- ({user_id}/archivo — mismo patrón que clinical-files en 20260429031828).
CREATE POLICY avatars_select ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY avatars_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND coalesce(metadata->>'mimetype','') IN ('image/jpeg','image/png','image/webp')
);

CREATE POLICY avatars_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND coalesce(metadata->>'mimetype','') IN ('image/jpeg','image/png','image/webp')
);

CREATE POLICY avatars_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
