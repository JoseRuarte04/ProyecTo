-- Reconstrucción de drift: tabla admin_users, is_super_admin() y 9 RPCs
-- admin_* existen y funcionan en producción desde el rollout de equipos del
-- 2026-05-19, pero esa tanda de ~25 migraciones (create_teams, create_admin_users,
-- rls_helper_functions, admin_rpcs_therapists, admin_rpcs_teams,
-- admin_get_activity_rpc, etc. — ver `supabase migrations list` remoto,
-- versiones 20260519191458 a 20260520133210) nunca se guardó como archivo en
-- este repo. Confirmado contra producción (2026-10-11, pg_get_functiondef +
-- information_schema) que faltaban por completo: la tabla `admin_users`, la
-- función `is_super_admin()`, y los RPCs `admin_get_stats`, `admin_create_team`,
-- `admin_deactivate_therapist`, `admin_reactivate_therapist`, `admin_list_patients`,
-- `admin_move_patient_to_team`, `admin_set_team_limit`, `admin_upsert_therapist`
-- y el cuerpo de `admin_get_activity` (solo estaba el GRANT/REVOKE, en
-- 20260715130000_security_hardening.sql).
--
-- Esta migración documenta el estado real para que un `supabase start` local
-- o una restauración desde backup (ver docs/BACKUP_RESTORE.md) puedan
-- reconstruir el panel admin completo. Todo es idempotente (CREATE TABLE IF
-- NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS + CREATE) y, salvo los
-- dos cambios de comportamiento marcados explícitamente abajo, reproduce
-- byte a byte lo que ya corre en producción — aplicarla ahí es un no-op.
--
-- Pendiente, fuera de alcance de esta migración (anotado en docs/TASKS.md):
-- el resto de ese rollout de 2026-05-19/20 (teams, team_members,
-- team_invitations, y la reescritura de RLS de patients/therapy_sessions/
-- treatment_episodes/evaluaciones/treatment_plans/exercise_plans/tokens)
-- tampoco tiene migración en el repo. Es un drift mucho más grande que toca
-- el modelo de RLS de toda la app, no solo admin — merece su propia sesión
-- dedicada en vez de mezclarse acá.

-- ── admin_users ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users: ver" ON public.admin_users;
CREATE POLICY "admin_users: ver"
ON public.admin_users FOR SELECT
USING (user_id = (SELECT auth.uid()));

-- ── is_super_admin() ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;

-- ── admin_get_stats ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_therapists  bigint;
  v_total_patients    bigint;
  v_sessions_week     bigint;
  v_total_teams       bigint;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT COUNT(*) INTO v_total_therapists FROM profiles WHERE is_active = true;
  SELECT COUNT(*) INTO v_total_patients FROM patients WHERE is_deleted = false;
  SELECT COUNT(*) INTO v_sessions_week FROM therapy_sessions
  WHERE is_deleted = false
    AND session_date >= date_trunc('week', now())
    AND session_date <  date_trunc('week', now()) + interval '7 days';
  SELECT COUNT(*) INTO v_total_teams FROM teams WHERE is_active = true;

  RETURN jsonb_build_object(
    'total_therapists',   v_total_therapists,
    'total_patients',     v_total_patients,
    'sessions_this_week', v_sessions_week,
    'total_teams',        v_total_teams
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_stats() FROM PUBLIC, anon;

-- ── admin_create_team ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_team(p_name text, p_admin_user_id uuid, p_member_limit int DEFAULT 5)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_team_id uuid;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_user_id AND is_active = true) THEN
    RAISE EXCEPTION 'El usuario designado como admin no tiene un perfil activo';
  END IF;

  IF p_member_limit < 1 THEN
    RAISE EXCEPTION 'El límite de miembros debe ser al menos 1';
  END IF;

  INSERT INTO teams (name, created_by, member_limit, is_active)
  VALUES (p_name, auth.uid(), p_member_limit, true)
  RETURNING id INTO v_team_id;

  INSERT INTO team_members (team_id, user_id, role, invited_by)
  VALUES (v_team_id, p_admin_user_id, 'admin', auth.uid());

  PERFORM insert_audit_log(
    'insert'::audit_action, 'teams', v_team_id,
    format('Equipo "%s" creado por admin con admin inicial %s', p_name, p_admin_user_id)
  );

  RETURN v_team_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_create_team(text, uuid, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_team(text, uuid, int) FROM PUBLIC, anon;

-- ── admin_deactivate_therapist / admin_reactivate_therapist ─────────────────
CREATE OR REPLACE FUNCTION public.admin_deactivate_therapist(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  UPDATE profiles
  SET is_active = false, deactivated_at = now(), updated_at = now()
  WHERE id = p_user_id AND is_active = true;

  PERFORM insert_audit_log('update'::audit_action, 'profiles', p_user_id, 'Terapista desactivado por admin');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_therapist(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_deactivate_therapist(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.admin_reactivate_therapist(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  UPDATE profiles
  SET is_active = true, deactivated_at = NULL, updated_at = now()
  WHERE id = p_user_id AND is_active = false;

  PERFORM insert_audit_log('update'::audit_action, 'profiles', p_user_id, 'Terapista reactivado por admin');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_therapist(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reactivate_therapist(uuid) FROM PUBLIC, anon;

-- ── admin_set_team_limit ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_team_limit(p_team_id uuid, p_limit int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_current_count int;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id) THEN
    RAISE EXCEPTION 'Equipo no encontrado';
  END IF;

  SELECT COUNT(*) INTO v_current_count FROM team_members WHERE team_id = p_team_id;

  IF p_limit < v_current_count THEN
    RAISE EXCEPTION 'El nuevo límite (%) es menor al número actual de miembros (%)', p_limit, v_current_count;
  END IF;

  UPDATE teams SET member_limit = p_limit WHERE id = p_team_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_team_limit(uuid, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_team_limit(uuid, int) FROM PUBLIC, anon;

-- ── admin_get_activity ───────────────────────────────────────────────────────
-- CAMBIO DE COMPORTAMIENTO vs. producción: se agregan p_limit/p_offset para
-- poder paginar desde AdminActivity.tsx ("Cargar más"); antes era un LIMIT 100
-- fijo sin forma de ver eventos más viejos. Default 100/0 reproduce el
-- comportamiento actual para cualquier caller que no pase los parámetros.
CREATE OR REPLACE FUNCTION public.admin_get_activity(p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS TABLE(
  id uuid, action text, table_name text, description text,
  created_at timestamptz, performed_by uuid, full_name text, email text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.action::text,
    al.table_name,
    al.description,
    al.created_at,
    al.performed_by,
    COALESCE(NULLIF(p.full_name, ''), p.email) AS full_name,
    p.email
  FROM audit_log al
  LEFT JOIN profiles p ON p.id = al.performed_by
  ORDER BY al.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_activity(int, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_activity(int, int) FROM PUBLIC, anon;

-- admin_get_activity() sin argumentos ya no existe como overload propio desde
-- que se le agregaron los parámetros con default — limpiar la firma vieja si
-- quedó registrada (no-op si nunca existió con esa firma exacta).
DROP FUNCTION IF EXISTS public.admin_get_activity();

-- ── admin_list_patients ──────────────────────────────────────────────────────
-- CAMBIO DE COMPORTAMIENTO vs. producción: se agrega p_include_deleted y se
-- devuelve la columna `is_deleted`. AdminPatients.tsx ya tenía un filtro
-- "Eliminados" construido contra esos dos campos, pero la función real nunca
-- los exponía (siempre excluía is_deleted=true y no devolvía la columna) —
-- el filtro quedaba mudo, mostrando una lista vacía siempre. Con
-- p_include_deleted=false (default) el comportamiento es idéntico al actual.
CREATE OR REPLACE FUNCTION public.admin_list_patients(
  p_team_id uuid DEFAULT NULL,
  p_professional_id uuid DEFAULT NULL,
  p_include_deleted boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, full_name text, professional_id uuid, professional_name text,
  team_id uuid, team_name text, status text, created_at timestamptz, is_deleted boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    pat.id,
    (pat.last_name || ', ' || pat.first_name) AS full_name,
    pat.professional_id,
    prof.full_name   AS professional_name,
    pat.team_id,
    t.name           AS team_name,
    pat.status::text AS status,
    pat.created_at,
    pat.is_deleted
  FROM patients pat
  JOIN profiles prof ON prof.id = pat.professional_id
  LEFT JOIN teams t   ON t.id  = pat.team_id
  WHERE (p_include_deleted OR pat.is_deleted = false)
    AND (p_team_id IS NULL         OR pat.team_id         = p_team_id)
    AND (p_professional_id IS NULL OR pat.professional_id = p_professional_id)
  ORDER BY pat.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_patients(uuid, uuid, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_patients(uuid, uuid, boolean) FROM PUBLIC, anon;
DROP FUNCTION IF EXISTS public.admin_list_patients(uuid, uuid);

-- ── admin_move_patient_to_team ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_move_patient_to_team(p_patient_id uuid, p_team_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_old_team_id uuid;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT team_id INTO v_old_team_id FROM patients WHERE id = p_patient_id AND is_deleted = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente no encontrado'; END IF;

  IF p_team_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id AND is_active = true) THEN
      RAISE EXCEPTION 'El equipo destino no existe o está inactivo';
    END IF;
  END IF;

  UPDATE patients SET team_id = p_team_id WHERE id = p_patient_id;

  PERFORM insert_audit_log(
    'update'::audit_action, 'patients', p_patient_id,
    format('Paciente movido de equipo %s a equipo %s por admin', v_old_team_id, p_team_id),
    jsonb_build_object('before', jsonb_build_object('team_id', v_old_team_id), 'after', jsonb_build_object('team_id', p_team_id))
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_move_patient_to_team(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_move_patient_to_team(uuid, uuid) FROM PUBLIC, anon;

-- ── admin_upsert_therapist ───────────────────────────────────────────────────
-- FIX DE BUG real, no solo reconstrucción: la versión que corría en
-- producción actualizaba `profiles.email` pero nunca `auth.users.email` (ni
-- `auth.identities`) — "Editar terapista" mostraba el email nuevo en el panel
-- admin, pero el terapista seguía logueándose con el viejo (el panel y el
-- login quedaban desincronizados, sin ningún aviso). Se agrega la
-- actualización de `auth.users`/`auth.identities`, mismo patrón ya usado en
-- este proyecto para rotar passwords directo contra `auth.users` (ver
-- docs/TASKS.md, rotación de rls-test-a/b@example.com, 2026-10-06).
CREATE OR REPLACE FUNCTION public.admin_upsert_therapist(
  p_user_id uuid, p_full_name text, p_email text,
  p_specialty text DEFAULT NULL, p_license text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_old_email text;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil no encontrado para el usuario %', p_user_id;
  END IF;

  SELECT email INTO v_old_email FROM profiles WHERE id = p_user_id;

  UPDATE profiles
  SET full_name = p_full_name, email = p_email, specialty = p_specialty,
      license_number = p_license, updated_at = now()
  WHERE id = p_user_id;

  IF v_old_email IS DISTINCT FROM p_email THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email AND id <> p_user_id) THEN
      RAISE EXCEPTION 'Ya existe otro usuario con ese email';
    END IF;

    UPDATE auth.users
    SET email = p_email, email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now()
    WHERE id = p_user_id;

    UPDATE auth.identities
    SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(p_email)), updated_at = now()
    WHERE user_id = p_user_id AND provider = 'email';

    PERFORM insert_audit_log(
      'update'::audit_action, 'profiles', p_user_id,
      format('Email de login cambiado de %s a %s por admin', v_old_email, p_email)
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_therapist(uuid, text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_therapist(uuid, text, text, text, text) FROM PUBLIC, anon;
