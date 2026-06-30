-- 1) Move unaccent extension out of public schema
ALTER EXTENSION unaccent SET SCHEMA extensions;

-- 2) Update functions that depend on unaccent to use the protected extension schema
CREATE OR REPLACE FUNCTION public.update_cie10_search()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, extensions
AS $function$
BEGIN
  NEW.description_search = extensions.unaccent(lower(NEW.description));
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_obras_sociales_search()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, extensions
AS $function$
BEGIN
  NEW.name_search = extensions.unaccent(lower(NEW.name));
  RETURN NEW;
END;
$function$;

-- 3) Remove anonymous/public direct API access, but keep authenticated access because RLS policies depend on these functions
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_professional() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_my_patient(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_professional() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_patient(uuid) TO authenticated;