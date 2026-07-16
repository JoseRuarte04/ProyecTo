-- Hardening de seguridad (advisors de Supabase, 2026-07-15).
-- Todas las funciones ya validan autorización internamente; esto es defensa
-- en profundidad: reducir la superficie expuesta vía /rest/v1/rpc/.

-- 1) Trigger functions: las ejecuta el trigger como owner de la tabla, nunca
-- deberían ser invocables por RPC por ningún rol.
REVOKE EXECUTE ON FUNCTION public.handle_clinical_record_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_clinical_record_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_occupational_profile_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_occupational_profile_update() FROM PUBLIC, anon, authenticated;

-- 2) Funciones de profesionales/admins: sin acceso para anon.
-- El GRANT explícito a authenticated es necesario porque hasta ahora el
-- EXECUTE les llegaba vía PUBLIC (default de Postgres), que acá se revoca.
-- Quedan ejecutables por anon solo las de flujos públicos con token:
-- get_quickdash_token, complete_quickdash_token, get_exercise_plan_public,
-- get_exercise_plan_token, get_invitation_by_token.
REVOKE EXECUTE ON FUNCTION public.soft_delete_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_session(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_get_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_activity() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_team_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_activity(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_quickdash_token(uuid, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_quickdash_token(uuid, uuid, timestamptz) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_exercise_plan_token(uuid, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_exercise_plan_token(uuid, uuid, timestamptz) TO authenticated;

-- 3) search_path fijo en las dos funciones que no lo tenían (lint 0011:
-- un search_path mutable permite que el caller resuelva objetos en otro schema).
ALTER FUNCTION public.get_exercise_plan_token(uuid) SET search_path = public;
ALTER FUNCTION public.get_exercise_plan_public(uuid) SET search_path = public;

-- 4) Bucket avatars: la política de SELECT amplia permitía LISTAR todos los
-- archivos del bucket. Las URLs públicas no pasan por RLS (no la necesitan);
-- el SELECT solo hace falta para que el dueño pueda listar/borrar su carpeta.
DROP POLICY avatars_select ON storage.objects;
CREATE POLICY avatars_select ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
