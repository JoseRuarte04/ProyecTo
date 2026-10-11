-- Fix "structure of query does not match function result type" error.
-- Root cause: COALESCE with em-dash literal caused type inference failure in RETURNS TABLE context.
-- Fix: explicit ::text / ::int / ::uuid / ::timestamptz casts on every returned column,
-- and DATE_PART instead of EXTRACT for the interval calculation.

CREATE OR REPLACE FUNCTION public.admin_list_pending_invitations()
RETURNS TABLE(
  user_id      uuid,
  email        text,
  full_name    text,
  invited_at   timestamptz,
  days_pending int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    u.id::uuid                                          AS user_id,
    u.email::text                                       AS email,
    COALESCE(p.full_name, '')::text                     AS full_name,
    u.invited_at::timestamptz                           AS invited_at,
    DATE_PART('day', now() - u.invited_at)::int         AS days_pending
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.invited_at IS NOT NULL
    AND u.last_sign_in_at IS NULL
    AND u.deleted_at IS NULL
  ORDER BY u.invited_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_pending_invitations() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_pending_invitations() FROM PUBLIC, anon;
