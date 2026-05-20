# Historia 4.9: RPCs de admin — Gestión de equipos y pacientes

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 4 — RPCs de admin y actualizaciones de RPCs existentes
**Dependencia:** Historias 4.1–4.3 aplicadas (tablas `teams`, `team_members`, `admin_users`; funciones `is_super_admin()`, `is_team_member()`); Historia 4.8 aplicada (patrón de RPCs admin ya establecido)
**Tipo:** Solo DB — 1 migración SQL. Sin cambios de UI ni de types.ts.

---

## Historia

Como super-admin,
quiero RPCs SECURITY DEFINER para crear equipos, gestionar sus límites, mover pacientes entre equipos y listar todos los pacientes del sistema (con filtros opcionales),
para que el panel /admin pueda administrar la asignación de pacientes y equipos sin restricciones de RLS.

---

## Estado Actual

No existen RPCs de gestión de equipos desde el panel de admin. La Historia 4.10 crea las RPCs de gestión de equipo para team-admins (`invite_to_team`, etc.). Esta historia crea las de super-admin exclusivamente.

---

## Criterios de Aceptación

**AC1 — `admin_create_team()` crea un equipo y asigna el primer admin**
- Given: caller es super-admin, `p_admin_user_id` tiene un perfil activo
- When: llama `admin_create_team('Clínica Norte', uuid_admin, 5)`
- Then: se inserta en `teams` con `name='Clínica Norte'`, `member_limit=5`, `is_active=true`, `created_by=auth.uid()`
- And: se inserta en `team_members` con `team_id=<nuevo>`, `user_id=p_admin_user_id`, `role='admin'`
- And: devuelve el UUID del equipo creado

**AC2 — `admin_set_team_limit()` actualiza el límite de miembros de un equipo**
- Given: caller es super-admin
- When: llama `admin_set_team_limit(team_uuid, 10)`
- Then: `teams.member_limit = 10`
- And: el nuevo límite no puede ser menor al número actual de miembros — si lo es, lanza EXCEPTION

**AC3 — `admin_move_patient_to_team()` reasigna el team_id del paciente**
- Given: caller es super-admin
- When: llama `admin_move_patient_to_team(patient_uuid, team_uuid)`
- Then: `patients.team_id = team_uuid`
- And: se inserta entrada en `audit_log` con los UUIDs del paciente y equipo
- And: si `p_team_id = NULL`, el paciente queda sin equipo (`team_id = NULL`, pasa a ser paciente individual)
- And: si el equipo no existe o está inactivo, lanza EXCEPTION

**AC4 — `admin_list_patients()` lista todos los pacientes con filtros opcionales**
- Given: caller es super-admin
- When: llama `admin_list_patients()` sin parámetros
- Then: devuelve todos los pacientes no eliminados con datos del profesional y nombre de equipo
- And: al pasar `p_team_id`, filtra por ese equipo
- And: al pasar `p_professional_id`, filtra por ese profesional

**AC5 — Ninguna RPC es callable sin ser super-admin**
- Given: terapista regular o team-admin no en `admin_users`
- When: llama cualquiera de estas RPCs
- Then: recibe EXCEPTION 'unauthorized'

---

## Tareas

### Task 1 — Migración con las 4 RPCs de admin para equipos

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_admin_rpcs_teams.sql`

```sql
-- ── admin_create_team() ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_team(
  p_name         text,
  p_admin_user_id uuid,
  p_member_limit  int DEFAULT 5
)
RETURNS uuid  -- UUID del equipo creado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

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
    'insert'::audit_action,
    'teams',
    v_team_id,
    format('Equipo "%s" creado por admin con admin inicial %s', p_name, p_admin_user_id)
  );

  RETURN v_team_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_team(text, uuid, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_team(text, uuid, int) FROM PUBLIC, anon;


-- ── admin_set_team_limit() ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_set_team_limit(
  p_team_id uuid,
  p_limit   int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_current_count int;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id) THEN
    RAISE EXCEPTION 'Equipo no encontrado';
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM team_members
  WHERE team_id = p_team_id;

  IF p_limit < v_current_count THEN
    RAISE EXCEPTION 'El nuevo límite (%) es menor al número actual de miembros (%)',
      p_limit, v_current_count;
  END IF;

  UPDATE teams
  SET member_limit = p_limit
  WHERE id = p_team_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_team_limit(uuid, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_team_limit(uuid, int) FROM PUBLIC, anon;


-- ── admin_move_patient_to_team() ──────────────────────────────────────────────
-- p_team_id = NULL → desasignar equipo (paciente queda individual)

CREATE OR REPLACE FUNCTION public.admin_move_patient_to_team(
  p_patient_id uuid,
  p_team_id    uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_old_team_id uuid;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT team_id INTO v_old_team_id
  FROM patients
  WHERE id = p_patient_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paciente no encontrado';
  END IF;

  -- Validar que el equipo destino existe y está activo (si se especifica)
  IF p_team_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id AND is_active = true) THEN
      RAISE EXCEPTION 'El equipo destino no existe o está inactivo';
    END IF;
  END IF;

  UPDATE patients
  SET team_id = p_team_id
  WHERE id = p_patient_id;

  PERFORM insert_audit_log(
    'update'::audit_action,
    'patients',
    p_patient_id,
    format('Paciente movido de equipo %s a equipo %s por admin', v_old_team_id, p_team_id),
    jsonb_build_object(
      'before', jsonb_build_object('team_id', v_old_team_id),
      'after',  jsonb_build_object('team_id', p_team_id)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_move_patient_to_team(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_move_patient_to_team(uuid, uuid) FROM PUBLIC, anon;


-- ── admin_list_patients() ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_patients(
  p_team_id         uuid DEFAULT NULL,
  p_professional_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id              uuid,
  full_name       text,
  professional_id uuid,
  professional_name text,
  team_id         uuid,
  team_name       text,
  status          text,
  created_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    pat.id,
    pat.full_name,
    pat.professional_id,
    prof.full_name   AS professional_name,
    pat.team_id,
    t.name           AS team_name,
    pat.status,
    pat.created_at
  FROM patients pat
  JOIN profiles prof ON prof.id = pat.professional_id
  LEFT JOIN teams t   ON t.id  = pat.team_id
  WHERE pat.is_deleted = false
    AND (p_team_id IS NULL         OR pat.team_id         = p_team_id)
    AND (p_professional_id IS NULL OR pat.professional_id = p_professional_id)
  ORDER BY pat.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_patients(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_patients(uuid, uuid) FROM PUBLIC, anon;
```

---

### Task 2 — Verificación post-deploy

```sql
-- Verificar que las 4 RPCs existen
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname IN (
  'admin_create_team', 'admin_set_team_limit',
  'admin_move_patient_to_team', 'admin_list_patients'
) AND pronamespace = 'public'::regnamespace;
-- Esperado: 4 filas

-- Smoke test: listar todos los pacientes como super-admin
SELECT * FROM admin_list_patients() LIMIT 5;
-- Debe devolver todas las filas (sin filtro RLS)

-- Smoke test: intentar como no-admin → debe fallar
-- (ejecutar en SQL Editor autenticado como terapista regular)
SELECT admin_create_team('Test', auth.uid(), 3);
-- Debe lanzar: ERROR: unauthorized
```

---

## Decisiones de Diseño

### Por qué `admin_move_patient_to_team` acepta `p_team_id = NULL`

Permitir `NULL` como destino hace que la RPC sirva tanto para asignar como para desasignar un paciente de un equipo (pasarlo a "individual"). Sin esto, sería necesaria una RPC separada `admin_remove_patient_from_team`. Un único endpoint con semántica clara es más simple para el frontend.

### Por qué `admin_create_team` require `p_admin_user_id` desde la creación

Un equipo sin admin está en estado inválido — nunca debería existir. Al exigir el admin inicial en la misma llamada, se garantiza el invariante en el mismo bloque de transacción. Si el INSERT en `team_members` falla (por ejemplo, el user no existe), el INSERT en `teams` también se revierte.

### Por qué `admin_list_patients` usa JOIN con `profiles` y LEFT JOIN con `teams`

Un paciente siempre tiene `professional_id` (la FK es NOT NULL en el esquema), por lo que el JOIN con `profiles` es interno. Un paciente puede no tener `team_id` (individual), por lo que el JOIN con `teams` es LEFT para no excluirlos.

---

## Historia siguiente

**4.10 — RPCs gestión de equipo**: `invite_to_team()`, `resend_invitation()`, `remove_team_member()`, `set_team_member_role()`, actualización de `handle_new_user()` para auto-join por invitación.
