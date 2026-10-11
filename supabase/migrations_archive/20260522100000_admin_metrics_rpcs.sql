-- ── Admin Metrics RPCs ──────────────────────────────────────────────────────
-- Todas validan is_super_admin() como primera instrucción.

-- ── 1. admin_get_trends ──────────────────────────────────────────────────────
-- Comparativa esta semana vs semana anterior para terapistas, pacientes y sesiones.
CREATE OR REPLACE FUNCTION public.admin_get_trends()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_now              timestamptz := now();
  v_week_start       timestamptz := date_trunc('week', v_now);
  v_prev_week_start  timestamptz := v_week_start - interval '7 days';

  v_therapists_this  int;
  v_therapists_prev  int;
  v_patients_this    int;
  v_patients_prev    int;
  v_sessions_this    int;
  v_sessions_prev    int;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT COUNT(*) INTO v_therapists_this
  FROM profiles WHERE created_at >= v_week_start AND is_active = true;

  SELECT COUNT(*) INTO v_therapists_prev
  FROM profiles WHERE created_at >= v_prev_week_start AND created_at < v_week_start AND is_active = true;

  SELECT COUNT(*) INTO v_patients_this
  FROM patients WHERE created_at >= v_week_start AND is_deleted = false;

  SELECT COUNT(*) INTO v_patients_prev
  FROM patients WHERE created_at >= v_prev_week_start AND created_at < v_week_start AND is_deleted = false;

  SELECT COUNT(*) INTO v_sessions_this
  FROM therapy_sessions WHERE created_at >= v_week_start AND is_deleted = false;

  SELECT COUNT(*) INTO v_sessions_prev
  FROM therapy_sessions WHERE created_at >= v_prev_week_start AND created_at < v_week_start AND is_deleted = false;

  RETURN jsonb_build_object(
    'therapists_this_week', v_therapists_this,
    'therapists_last_week', v_therapists_prev,
    'patients_this_week',   v_patients_this,
    'patients_last_week',   v_patients_prev,
    'sessions_this_week',   v_sessions_this,
    'sessions_last_week',   v_sessions_prev
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_trends() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_trends() FROM PUBLIC, anon;

-- ── 2. admin_get_monthly_sessions ────────────────────────────────────────────
-- Sesiones agrupadas por mes, últimos 6 meses.
CREATE OR REPLACE FUNCTION public.admin_get_monthly_sessions()
RETURNS TABLE(month text, session_count int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC('month', gs.month_start), 'Mon YY') AS month,
    COALESCE(
      (SELECT COUNT(*)::int
       FROM therapy_sessions ts
       WHERE ts.is_deleted = false
         AND DATE_TRUNC('month', ts.created_at) = gs.month_start),
      0
    ) AS session_count
  FROM (
    SELECT generate_series(
      DATE_TRUNC('month', now()) - interval '5 months',
      DATE_TRUNC('month', now()),
      interval '1 month'
    ) AS month_start
  ) gs
  ORDER BY gs.month_start;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_monthly_sessions() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_monthly_sessions() FROM PUBLIC, anon;

-- ── 3. admin_get_active_teams ────────────────────────────────────────────────
-- Top equipos por actividad (sesiones en los últimos 30 días).
CREATE OR REPLACE FUNCTION public.admin_get_active_teams()
RETURNS TABLE(
  team_id      uuid,
  team_name    text,
  session_count int,
  patient_count int,
  member_count  int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    t.id                                                            AS team_id,
    t.name                                                         AS team_name,
    COALESCE(
      (SELECT COUNT(*)::int
       FROM therapy_sessions ts
       JOIN patients p ON p.id = ts.patient_id
       WHERE p.team_id = t.id
         AND ts.is_deleted = false
         AND ts.created_at >= now() - interval '30 days'),
      0
    )                                                              AS session_count,
    COALESCE(
      (SELECT COUNT(*)::int
       FROM patients p
       WHERE p.team_id = t.id AND p.is_deleted = false),
      0
    )                                                              AS patient_count,
    COALESCE(
      (SELECT COUNT(*)::int
       FROM team_members tm WHERE tm.team_id = t.id),
      0
    )                                                              AS member_count
  FROM teams t
  WHERE t.is_active = true
  ORDER BY session_count DESC, patient_count DESC
  LIMIT 5;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_active_teams() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_active_teams() FROM PUBLIC, anon;

-- ── 4. admin_get_stale_invitations ───────────────────────────────────────────
-- Invitaciones de equipo pendientes sin aceptar hace más de N días.
CREATE OR REPLACE FUNCTION public.admin_get_stale_invitations(p_days int DEFAULT 7)
RETURNS TABLE(
  invitation_id uuid,
  team_id       uuid,
  team_name     text,
  email         text,
  invited_by_name text,
  created_at    timestamptz,
  days_pending  int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    ti.id                                          AS invitation_id,
    t.id                                           AS team_id,
    t.name                                         AS team_name,
    ti.email                                       AS email,
    COALESCE(pr.full_name, pr.email::text, '—')   AS invited_by_name,
    ti.created_at                                  AS created_at,
    EXTRACT(DAY FROM now() - ti.created_at)::int  AS days_pending
  FROM team_invitations ti
  JOIN teams t ON t.id = ti.team_id
  LEFT JOIN profiles pr ON pr.id = ti.invited_by
  WHERE ti.status = 'pending'
    AND ti.created_at < now() - (p_days || ' days')::interval
  ORDER BY ti.created_at ASC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_stale_invitations(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_stale_invitations(int) FROM PUBLIC, anon;

-- ── 5. admin_get_inactive_therapists ─────────────────────────────────────────
-- Terapistas sin sesiones en los últimos N días (default 30).
CREATE OR REPLACE FUNCTION public.admin_get_inactive_therapists(p_days int DEFAULT 30)
RETURNS TABLE(
  id              uuid,
  full_name       text,
  email           text,
  specialty       text,
  patient_count   int,
  last_session_at timestamptz,
  created_at      timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    pr.id                                                AS id,
    pr.full_name                                         AS full_name,
    pr.email                                             AS email,
    pr.specialty                                         AS specialty,
    COALESCE(
      (SELECT COUNT(*)::int FROM patients pt
       WHERE pt.professional_id = pr.id AND pt.is_deleted = false),
      0
    )                                                    AS patient_count,
    (SELECT MAX(ts.created_at)
     FROM therapy_sessions ts
     WHERE ts.professional_id = pr.id AND ts.is_deleted = false) AS last_session_at,
    pr.created_at                                        AS created_at
  FROM profiles pr
  WHERE pr.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM therapy_sessions ts
      WHERE ts.professional_id = pr.id
        AND ts.is_deleted = false
        AND ts.created_at >= now() - (p_days || ' days')::interval
    )
  ORDER BY last_session_at DESC NULLS LAST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_inactive_therapists(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_inactive_therapists(int) FROM PUBLIC, anon;
