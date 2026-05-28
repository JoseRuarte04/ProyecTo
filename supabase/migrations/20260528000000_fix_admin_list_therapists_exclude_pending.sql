-- Exclude invited-but-not-yet-accepted users from the active therapists list.
-- Previously the trigger created a profile on invite, making them appear as active
-- before they set their password. Now we join auth.users and skip rows where
-- invited_at IS NOT NULL AND last_sign_in_at IS NULL.

CREATE OR REPLACE FUNCTION public.admin_list_therapists()
RETURNS TABLE(id uuid, full_name text, email text, specialty text, license_number text, is_active boolean, created_at timestamp with time zone, patient_count bigint, team_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    p.id, p.full_name, p.email, p.specialty, p.license_number, p.is_active, p.created_at,
    (SELECT COUNT(*) FROM patients pt WHERE pt.professional_id = p.id AND pt.is_deleted = false) AS patient_count,
    (SELECT COUNT(*) FROM team_members tm WHERE tm.user_id = p.id) AS team_count
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE NOT (u.invited_at IS NOT NULL AND u.last_sign_in_at IS NULL)
    AND u.deleted_at IS NULL
  ORDER BY p.full_name;
END;
$function$;
