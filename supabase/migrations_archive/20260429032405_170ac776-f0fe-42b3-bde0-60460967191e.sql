CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS profile_role
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_active_professional()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_my_patient(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM patients p
    JOIN profiles pr ON pr.id = p.professional_id
    WHERE p.id               = p_patient_id
      AND p.professional_id  = auth.uid()
      AND p.is_deleted       = false
      AND pr.is_active       = true
  );
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_professional() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_patient(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_professional() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_my_patient(uuid) FROM PUBLIC, anon;