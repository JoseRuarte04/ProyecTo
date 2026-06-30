-- 1) Audit log: prevent forged system-context entries from direct client inserts
DROP POLICY IF EXISTS "audit_log: insertar directo" ON public.audit_log;

CREATE POLICY "audit_log: insertar usuario propio"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  action_context = 'user'::audit_context
  AND performed_by = auth.uid()
);

-- 2) Clinical files storage: require owner folder and safe MIME allowlist for uploads/updates
DROP POLICY IF EXISTS clinical_files_insert ON storage.objects;
DROP POLICY IF EXISTS clinical_files_update ON storage.objects;

CREATE POLICY clinical_files_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clinical-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND coalesce(metadata->>'mimetype', '') IN (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'video/mp4',
    'video/quicktime'
  )
);

CREATE POLICY clinical_files_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'clinical-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'clinical-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND coalesce(metadata->>'mimetype', '') IN (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'video/mp4',
    'video/quicktime'
  )
);

-- 3) Lock down internal SECURITY DEFINER functions that are only used by triggers/server-side logic
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(audit_action, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_patient_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_session_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_plan_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_functional_eval_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_analytical_eval_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Keep RLS helper functions executable by authenticated users because policies depend on them.
-- Remove anonymous access where it is not needed.
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_professional() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_my_patient(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_professional() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_patient(uuid) TO authenticated;

-- 4) Fix mutable search_path on public functions that lacked it
CREATE OR REPLACE FUNCTION public.search_cie10(search_input text, max_results integer DEFAULT 10)
RETURNS TABLE(code text, description text, category text, rank real)
LANGUAGE plpgsql
STABLE
SET search_path TO public
AS $function$
DECLARE
  normalized text;
  words text[];
BEGIN
  normalized := lower(search_input);
  normalized := replace(normalized, 'á', 'a');
  normalized := replace(normalized, 'é', 'e');
  normalized := replace(normalized, 'í', 'i');
  normalized := replace(normalized, 'ó', 'o');
  normalized := replace(normalized, 'ú', 'u');
  normalized := replace(normalized, 'ü', 'u');
  normalized := replace(normalized, 'ñ', 'n');
  normalized := regexp_replace(normalized, '\mfx\M', 'fractura', 'g');
  normalized := regexp_replace(normalized, '\mmr\M', 'manguito rotador', 'g');
  normalized := regexp_replace(normalized, '\mstc\M', 'sindrome tunel carpiano', 'g');
  normalized := regexp_replace(normalized, '\msdrc\M', 'sindrome dolor regional complejo', 'g');
  normalized := regexp_replace(normalized, '\macv\M', 'accidente cerebrovascular', 'g');
  normalized := regexp_replace(normalized, '\mms\M', 'miembro superior', 'g');
  normalized := regexp_replace(normalized, '\mmi\M', 'miembro inferior', 'g');
  normalized := regexp_replace(normalized, '\mlca\M', 'ligamento cruzado anterior', 'g');
  normalized := regexp_replace(normalized, '\mlcp\M', 'ligamento cruzado posterior', 'g');
  normalized := regexp_replace(normalized, '\mela\M', 'esclerosis lateral amiotrofica', 'g');
  normalized := regexp_replace(normalized, '\mdr\M', 'derecho', 'g');
  normalized := regexp_replace(normalized, '\mizq\M', 'izquierdo', 'g');

  words := array(
    SELECT w FROM unnest(string_to_array(trim(normalized), ' ')) w WHERE length(w) > 2
  );

  IF normalized ~ '^[a-z][0-9]' THEN
    RETURN QUERY
      SELECT c.code, c.description, c.category,
             CASE WHEN lower(c.code) = normalized THEN 1.0::real
                  WHEN lower(c.code) LIKE normalized || '%' THEN 0.9::real
                  ELSE 0.7::real END AS rank
      FROM cie10 c
      WHERE lower(c.code) ILIKE '%' || normalized || '%'
      ORDER BY rank DESC, c.code
      LIMIT max_results;
    RETURN;
  END IF;

  IF array_length(words, 1) >= 2 THEN
    RETURN QUERY
      SELECT c.code, c.description, c.category,
             ((SELECT COUNT(*)::real FROM unnest(words) w WHERE c.description_search ILIKE '%' || w || '%') /
             array_length(words, 1)::real) AS rank
      FROM cie10 c
      WHERE (
        SELECT COUNT(*) FROM unnest(words) w WHERE c.description_search ILIKE '%' || w || '%'
      ) = array_length(words, 1)
      ORDER BY rank DESC, c.code
      LIMIT max_results;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT c.code, c.description, c.category,
           CASE WHEN c.description_search ILIKE normalized || '%' THEN 0.9::real
                ELSE 0.7::real END AS rank
    FROM cie10 c
    WHERE c.description_search ILIKE '%' || normalized || '%'
       OR lower(c.code) ILIKE '%' || normalized || '%'
    ORDER BY rank DESC, c.code
    LIMIT max_results;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_cie10_search()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $function$
BEGIN
  NEW.description_search = unaccent(lower(NEW.description));
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_obras_sociales_search()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $function$
BEGIN
  NEW.name_search = unaccent(lower(NEW.name));
  RETURN NEW;
END;
$function$;