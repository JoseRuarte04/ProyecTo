# Historia 4.8: RPCs de admin — Gestión de terapistas

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 4 — RPCs de admin y actualizaciones de RPCs existentes
**Dependencia:** Historias 4.1–4.3 aplicadas (tablas `admin_users`, `teams`, `team_members`; funciones `is_super_admin()`, `is_active_professional()`)
**Tipo:** Solo DB — 1 migración SQL. Sin cambios de UI ni de types.ts.

---

## Historia

Como super-admin,
quiero un conjunto de RPCs SECURITY DEFINER que me permitan ver estadísticas globales, listar terapistas, actualizar sus datos, y activar/desactivar su acceso al sistema,
para que el panel /admin pueda consumirlas sin exponer datos de otros usuarios vía RLS.

---

## Estado Actual

No existen RPCs de administración. El panel /admin aún no está implementado (lo hace la Fase 5 del frontend). Esta historia crea la capa de datos que el frontend consumirá.

### Esquema `profiles` relevante

```sql
-- Campos de profiles usados por estas RPCs:
id uuid, full_name text, email text, specialty text | null,
license_number text | null, is_active boolean, deactivated_at timestamptz | null,
role profile_role, created_at timestamptz, updated_at timestamptz
```

---

## Criterios de Aceptación

**AC1 — `admin_get_stats()` devuelve métricas globales**
- Given: caller está en `admin_users`
- When: ejecuta `SELECT * FROM admin_get_stats()`
- Then: recibe un objeto con `total_therapists` (activos), `total_patients` (no eliminados), `sessions_this_week`, `total_teams` (activos)
- And: si el caller NO está en `admin_users`, la RPC lanza EXCEPTION 'unauthorized'

**AC2 — `admin_list_therapists()` devuelve todos los terapistas, incluso inactivos**
- Given: caller es super-admin
- When: ejecuta `SELECT * FROM admin_list_therapists()`
- Then: recibe filas con `id, full_name, email, specialty, license_number, is_active, created_at, patient_count, team_count`
- And: incluye terapistas con `is_active = false` (no los excluye)

**AC3 — `admin_upsert_therapist()` actualiza datos del perfil**
- Given: caller es super-admin y el `p_user_id` tiene un `profiles` existente
- When: llama `admin_upsert_therapist(uuid, 'Nuevo Nombre', 'email@x.com', 'Fisioterapia', 'MN12345')`
- Then: el registro en `profiles` se actualiza con los nuevos valores
- And: si el `p_user_id` no tiene perfil en `profiles`, lanza EXCEPTION 'Perfil no encontrado'

**AC4 — `admin_deactivate_therapist()` desactiva un terapista**
- Given: caller es super-admin y el terapista está activo
- When: llama `admin_deactivate_therapist(p_user_id)`
- Then: `profiles.is_active = false`, `profiles.deactivated_at = now()`
- And: se inserta una entrada en `audit_log` con action='update' y la descripción 'Terapista desactivado por admin'
- And: si el terapista ya estaba inactivo, la llamada es idempotente (no lanza error)

**AC5 — `admin_reactivate_therapist()` reactiva un terapista**
- Given: caller es super-admin y el terapista está inactivo
- When: llama `admin_reactivate_therapist(p_user_id)`
- Then: `profiles.is_active = true`, `profiles.deactivated_at = NULL`
- And: se inserta entrada en `audit_log` con descripción 'Terapista reactivado por admin'

**AC6 — Ninguna RPC es callable sin ser super-admin**
- Given: terapista regular (no en admin_users)
- When: llama cualquiera de estas RPCs
- Then: recibe EXCEPTION 'unauthorized'

---

## Tareas

### Task 1 — Migración única con las 5 RPCs de admin para terapistas

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_admin_rpcs_therapists.sql`

```sql
-- ── admin_get_stats() ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_total_therapists  bigint;
  v_total_patients    bigint;
  v_sessions_week     bigint;
  v_total_teams       bigint;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_total_therapists
  FROM profiles
  WHERE is_active = true;

  SELECT COUNT(*) INTO v_total_patients
  FROM patients
  WHERE is_deleted = false;

  SELECT COUNT(*) INTO v_sessions_week
  FROM therapy_sessions
  WHERE is_deleted = false
    AND session_date >= date_trunc('week', now())
    AND session_date <  date_trunc('week', now()) + interval '7 days';

  SELECT COUNT(*) INTO v_total_teams
  FROM teams
  WHERE is_active = true;

  RETURN jsonb_build_object(
    'total_therapists',  v_total_therapists,
    'total_patients',    v_total_patients,
    'sessions_this_week', v_sessions_week,
    'total_teams',       v_total_teams
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_stats() FROM PUBLIC, anon;


-- ── admin_list_therapists() ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_therapists()
RETURNS TABLE(
  id             uuid,
  full_name      text,
  email          text,
  specialty      text,
  license_number text,
  is_active      boolean,
  created_at     timestamptz,
  patient_count  bigint,
  team_count     bigint
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
    p.id,
    p.full_name,
    p.email,
    p.specialty,
    p.license_number,
    p.is_active,
    p.created_at,
    (SELECT COUNT(*) FROM patients pt
     WHERE pt.professional_id = p.id AND pt.is_deleted = false)  AS patient_count,
    (SELECT COUNT(*) FROM team_members tm
     WHERE tm.user_id = p.id)                                    AS team_count
  FROM profiles p
  ORDER BY p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_therapists() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_therapists() FROM PUBLIC, anon;


-- ── admin_upsert_therapist() ──────────────────────────────────────────────────
-- Solo actualiza el profile existente. La creación del usuario en auth.users se
-- hace via Supabase Studio (Invite user) o Auth API, no desde esta RPC.
-- Una vez que el usuario existe y tiene profile, esta RPC sincroniza sus datos.

CREATE OR REPLACE FUNCTION public.admin_upsert_therapist(
  p_user_id      uuid,
  p_full_name    text,
  p_email        text,
  p_specialty    text DEFAULT NULL,
  p_license      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil no encontrado para el usuario %', p_user_id;
  END IF;

  UPDATE profiles
  SET
    full_name      = p_full_name,
    email          = p_email,
    specialty      = p_specialty,
    license_number = p_license,
    updated_at     = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_therapist(uuid, text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_therapist(uuid, text, text, text, text) FROM PUBLIC, anon;


-- ── admin_deactivate_therapist() ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_deactivate_therapist(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  UPDATE profiles
  SET is_active       = false,
      deactivated_at  = now(),
      updated_at      = now()
  WHERE id = p_user_id
    AND is_active = true;  -- idempotente: no actualiza si ya está inactivo

  PERFORM insert_audit_log(
    'update'::audit_action,
    'profiles',
    p_user_id,
    'Terapista desactivado por admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_deactivate_therapist(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_deactivate_therapist(uuid) FROM PUBLIC, anon;


-- ── admin_reactivate_therapist() ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_reactivate_therapist(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  UPDATE profiles
  SET is_active      = true,
      deactivated_at = NULL,
      updated_at     = now()
  WHERE id = p_user_id
    AND is_active = false;  -- idempotente

  PERFORM insert_audit_log(
    'update'::audit_action,
    'profiles',
    p_user_id,
    'Terapista reactivado por admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reactivate_therapist(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reactivate_therapist(uuid) FROM PUBLIC, anon;
```

---

### Task 2 — Verificación post-deploy

```sql
-- Verificar que las 5 RPCs existen
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname IN (
  'admin_get_stats', 'admin_list_therapists', 'admin_upsert_therapist',
  'admin_deactivate_therapist', 'admin_reactivate_therapist'
) AND pronamespace = 'public'::regnamespace;
-- Esperado: 5 filas

-- Smoke test como super-admin (ejecutar en SQL Editor autenticado como super-admin):
SELECT admin_get_stats();
-- Debe devolver json con las 4 métricas, sin error

SELECT * FROM admin_list_therapists() LIMIT 5;
-- Debe devolver filas de profiles incluyendo inactivos
```

---

## Decisiones de Diseño

### Por qué `admin_upsert_therapist` no crea usuarios en auth.users

La creación de un usuario en Supabase Auth requiere privilegios de service role — no se puede hacer desde una RPC SECURITY DEFINER (que corre como `postgres`, no como service role). El flujo correcto es: el super-admin invita al nuevo terapista desde Supabase Studio (Auth > Invite user) → el usuario acepta y se registra → `handle_new_user()` crea el perfil. Luego, si es necesario actualizar datos del perfil, usa `admin_upsert_therapist()`.

### Por qué los conteos se hacen con subqueries correlacionadas

`admin_list_therapists` usa subqueries por `patient_count` y `team_count` en lugar de JOINs con GROUP BY. Con N terapistas y muchos pacientes, los JOINs + GROUP BY pueden generar intermediarios grandes. Las subqueries correlacionadas son directas y se benefician de los índices `patients.professional_id` y `team_members.user_id` para cada fila de profiles. Con cientos de terapistas (escala realista del sistema), este patrón es eficiente.

### Por qué `admin_deactivate_therapist` tiene `AND is_active = true` en el UPDATE

La condición hace que el UPDATE sea un no-op si el terapista ya estaba inactivo — 0 filas afectadas, pero sin error. El `insert_audit_log` se llama igualmente (auditar que el super-admin intentó desactivar aunque ya lo estaba). Si se quisiera evitar la entrada de audit para no-ops, se puede chequear `IF FOUND` después del UPDATE. Se deja la implementación simple y el audit explícito por trazabilidad.

---

## Historia siguiente

**4.9 — RPCs admin: equipos**: `admin_create_team()`, `admin_set_team_limit()`, `admin_move_patient_to_team()`, `admin_list_patients()`.
