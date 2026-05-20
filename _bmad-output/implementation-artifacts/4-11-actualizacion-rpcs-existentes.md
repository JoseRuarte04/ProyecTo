# Historia 4.11: Actualización de RPCs existentes + seed de admin_users

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 4 — RPCs de admin y actualizaciones de RPCs existentes (última historia de la fase)
**Dependencia:** Historias 4.1–4.3 aplicadas (tables, funciones helper); Historia 4.4 aplicada (RLS patients actualizada)
**Tipo:** DB + seed — 2 migraciones SQL. Sin cambios de UI ni de types.ts.

---

## Historia

Como equipo de desarrollo,
quiero actualizar las 3 RPCs existentes que validan `professional_id = auth.uid()` para que también permitan el acceso de miembros del equipo,
y agregar el seed de bootstrap de los 3 super-admins en `admin_users`,
para cerrar todos los gaps de autorización antes de iniciar el desarrollo del frontend.

---

## Estado Actual de las RPCs que cambian

### `soft_delete_session(p_session_id uuid)`

**Validación actual** (migración `20260505035000`):
```sql
SELECT * INTO v_session
FROM therapy_sessions
WHERE id = p_session_id
  AND professional_id = auth.uid()   -- solo el dueño puede eliminar
  AND is_deleted = false;
```

**Problema**: un team-admin no puede eliminar sesiones creadas por otro miembro del equipo para un paciente del equipo.

### `create_quickdash_token(p_session_id, p_patient_id, p_expires_at)`

**Validación actual** (migración `20260511123816`):
```sql
IF NOT EXISTS (
  SELECT 1 FROM therapy_sessions
  WHERE id = p_session_id AND professional_id = auth.uid()
) THEN RAISE EXCEPTION '...'; END IF;
```

**Problema**: un miembro del equipo no puede crear un QuickDASH token para una sesión creada por otro miembro del equipo.

### `create_exercise_plan_token(p_plan_id, p_patient_id, p_expires_at)`

**Validación actual** (migración `20260519100000`):
```sql
IF NOT EXISTS (
  SELECT 1 FROM exercise_plans
  WHERE id = p_plan_id AND professional_id = auth.uid()
) THEN RAISE EXCEPTION 'unauthorized'; END IF;
```

**Problema**: idéntico — solo el dueño del plan puede crear tokens.

---

## Criterios de Aceptación

**AC1 — `soft_delete_session()` permite eliminar sesión si eres team-admin del equipo del paciente**
- Given: sesión S fue creada por usuario A para paciente P del equipo X; usuario B es admin del equipo X
- When: usuario B llama `soft_delete_session(S.id)`
- Then: la sesión queda con `is_deleted = true`, sin error de permisos

**AC2 — `soft_delete_session()` sigue bloqueando a miembros sin permisos**
- Given: usuario C no es admin del equipo ni dueño de la sesión
- When: llama `soft_delete_session(S.id)`
- Then: recibe EXCEPTION 'Sesión no encontrada o sin permisos de acceso'

**AC3 — `create_quickdash_token()` permite crear token si eres miembro del equipo del paciente**
- Given: sesión S del paciente del equipo X; usuario B es miembro del equipo X
- When: usuario B llama `create_quickdash_token(S.id, patient_id, expires_at)`
- Then: el token se crea sin error

**AC4 — `create_exercise_plan_token()` permite crear token si eres miembro del equipo**
- Given: plan P del paciente del equipo X; usuario B es miembro del equipo X
- When: usuario B llama `create_exercise_plan_token(P.id, patient_id, expires_at)`
- Then: el token se crea sin error

**AC5 — `create_exercise_plan_token()` fija `professional_id` desde el plan, no del caller**
- Given: usuario B (miembro del equipo) llama la RPC para un plan creado por usuario A
- Then: `exercise_plan_tokens.professional_id` queda con el `professional_id` del plan (no `auth.uid()`)

**AC6 — Seed: los 3 UUIDs de super-admin están en `admin_users`**
- Given: se aplica la migración de seed
- When: se consulta `SELECT * FROM admin_users`
- Then: se ven exactamente 3 filas con los UUIDs correctos
- And: `is_super_admin()` devuelve `true` cuando se ejecuta como uno de esos usuarios

---

## Tareas

### Task 1 — Migración: actualizar las 3 RPCs existentes

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_update_existing_rpcs.sql`

```sql
-- ── soft_delete_session() ─────────────────────────────────────────────────────
-- Cambio: la validación ahora permite al dueño OR al team-admin del paciente OR super-admin.
-- La lógica de sesión de admisión y reversal de discharge se preserva íntegra.

CREATE OR REPLACE FUNCTION public.soft_delete_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session    RECORD;
  v_patient    RECORD;
  v_authorized boolean := false;
BEGIN
  -- Cargar la sesión (sin filtrar por professional_id todavía)
  SELECT ts.*, ts.patient_id AS ts_patient_id
  INTO v_session
  FROM therapy_sessions ts
  WHERE ts.id = p_session_id
    AND ts.is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión no encontrada o ya eliminada';
  END IF;

  -- Cargar el paciente para obtener team_id
  SELECT * INTO v_patient
  FROM patients
  WHERE id = v_session.patient_id;

  -- Validar autorización: dueño OR team-admin del equipo del paciente OR super-admin
  IF v_session.professional_id = auth.uid() THEN
    v_authorized := true;
  ELSIF v_patient.team_id IS NOT NULL AND is_team_admin(v_patient.team_id) THEN
    v_authorized := true;
  ELSIF is_super_admin() THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Sesión no encontrada o sin permisos de acceso';
  END IF;

  -- No permitir eliminar sesiones de admisión
  IF v_session.session_type = 'admission' THEN
    RAISE EXCEPTION 'No se puede eliminar una sesión de admisión';
  END IF;

  -- Soft delete
  UPDATE therapy_sessions
  SET is_deleted = true
  WHERE id = p_session_id;

  -- Si era una sesión de alta, revertir estado del paciente si no quedan más altas
  IF v_session.session_type = 'discharge' THEN
    DECLARE
      remaining_discharge int;
    BEGIN
      SELECT COUNT(*) INTO remaining_discharge
      FROM therapy_sessions
      WHERE patient_id  = v_session.patient_id
        AND session_type = 'discharge'
        AND is_deleted   = false;

      IF remaining_discharge = 0 THEN
        UPDATE patients SET status = 'active' WHERE id = v_session.patient_id;
      END IF;
    END;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_session(uuid) TO authenticated;


-- ── create_quickdash_token() ──────────────────────────────────────────────────
-- Cambio: la validación pasa de professional_id = auth.uid() a is_my_patient(session.patient_id).
-- is_my_patient() cubre tanto pacientes propios como pacientes del equipo.
-- El resto de la lógica (invalidar previos, crear token) se preserva intacta.

CREATE OR REPLACE FUNCTION public.create_quickdash_token(
  p_session_id uuid,
  p_patient_id uuid,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_patient_id uuid;
  v_new_token          uuid;
BEGIN
  -- Obtener el patient_id de la sesión para validar acceso
  SELECT patient_id INTO v_session_patient_id
  FROM therapy_sessions
  WHERE id = p_session_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión no encontrada';
  END IF;

  -- Validar que el caller tiene acceso al paciente de la sesión
  IF NOT is_my_patient(v_session_patient_id) THEN
    RAISE EXCEPTION 'Sin permisos sobre esta sesión';
  END IF;

  -- Invalidar tokens activos previos de esta sesión
  UPDATE quickdash_tokens
  SET completed_at = now(),
      completed_by = 'therapist'
  WHERE session_id    = p_session_id
    AND completed_at  IS NULL
    AND expires_at    > now();

  -- Crear nuevo token
  INSERT INTO quickdash_tokens (patient_id, session_id, created_by, expires_at)
  VALUES (p_patient_id, p_session_id, auth.uid(), p_expires_at)
  RETURNING token INTO v_new_token;

  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_quickdash_token(uuid, uuid, timestamptz) TO authenticated;


-- ── create_exercise_plan_token() ──────────────────────────────────────────────
-- Cambio: la validación pasa de professional_id = auth.uid() a is_my_patient(plan.patient_id).
-- El professional_id del token sigue siendo el del plan (no del caller) para preservar autoría.
-- SET search_path añadido (faltaba en la versión original).

CREATE OR REPLACE FUNCTION public.create_exercise_plan_token(
  p_plan_id    uuid,
  p_patient_id uuid,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan   exercise_plans%ROWTYPE;
  v_token  uuid;
BEGIN
  -- Cargar plan completo
  SELECT * INTO v_plan
  FROM exercise_plans
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan de ejercicios no encontrado';
  END IF;

  -- Validar que el caller tiene acceso al paciente del plan
  IF NOT is_my_patient(v_plan.patient_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Revocar tokens activos previos del mismo plan
  UPDATE exercise_plan_tokens
  SET revoked_at = now()
  WHERE plan_id   = p_plan_id
    AND revoked_at IS NULL;

  -- Crear nuevo token; professional_id viene del plan (no del caller)
  INSERT INTO exercise_plan_tokens (plan_id, patient_id, professional_id, expires_at)
  VALUES (p_plan_id, p_patient_id, v_plan.professional_id, p_expires_at)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_exercise_plan_token(uuid, uuid, timestamptz) TO authenticated;
```

---

### Task 2 — Migración: seed de admin_users

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_seed_admin_users.sql`

> **Instrucción**: Reemplazar `'UUID_SUPER_ADMIN_1'`, `'UUID_SUPER_ADMIN_2'`, `'UUID_SUPER_ADMIN_3'`
> con los UUIDs reales de los 3 usuarios super-admin antes de aplicar la migración.
> Los UUIDs se obtienen de Supabase Dashboard → Authentication → Users.

```sql
-- Seed de bootstrap de super-admins.
-- Esta migración inserta los 3 UUIDs de super-admin en admin_users.
-- No hay política INSERT en admin_users (diseño intencional — ver Historia 4.6).
-- Esta migración corre con service role (postgres), que bypasea RLS.

INSERT INTO public.admin_users (user_id) VALUES
  ('UUID_SUPER_ADMIN_1'::uuid),
  ('UUID_SUPER_ADMIN_2'::uuid),
  ('UUID_SUPER_ADMIN_3'::uuid)
ON CONFLICT (user_id) DO NOTHING;  -- idempotente: no falla si ya existen
```

---

### Task 3 — Verificación post-deploy

```sql
-- Verificar que las 3 RPCs existen y tienen la nueva firma
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname IN ('soft_delete_session', 'create_quickdash_token', 'create_exercise_plan_token')
  AND pronamespace = 'public'::regnamespace;

-- Verificar seed de admin_users
SELECT * FROM admin_users;
-- Debe devolver 3 filas

-- Verificar is_super_admin() como uno de los super-admins
-- (ejecutar en SQL Editor autenticado como super-admin UUID_1):
SELECT is_super_admin();
-- Debe devolver: true

-- Smoke test de is_super_admin() como terapista regular:
SELECT is_super_admin();
-- Debe devolver: false

-- Smoke test de soft_delete_session con team-admin:
-- 1. Crear sesión como usuario A para paciente del equipo X
-- 2. Ejecutar como usuario B (team-admin del equipo X):
SELECT soft_delete_session('<session_uuid>');
-- Debe ejecutarse sin error

-- Prueba de integración de la Fase 4 completa:
-- 1. Autenticarse como super-admin
-- 2. Crear equipo: SELECT admin_create_team('Equipo Test', '<therapist_uuid>', 3)
-- 3. Invitar al segundo terapista: SELECT invite_to_team('<team_uuid>', 'segundo@email.com')
-- 4. Autenticarse como segundo terapista, crear sesión para paciente del equipo
-- 5. Autenticarse como team-admin, confirmar que puede ver la sesión del segundo terapista
-- 6. Autenticarse como super-admin, listar pacientes: SELECT * FROM admin_list_patients()
-- 7. Mover paciente de equipo: SELECT admin_move_patient_to_team('<patient_uuid>', '<new_team_uuid>')
```

---

## Decisiones de Diseño

### Por qué `soft_delete_session` carga la sesión sin filtrar por `professional_id`

En la versión original, el WHERE incluía `professional_id = auth.uid()` — si no coincidía, `NOT FOUND` era el resultado, ocultando el motivo del error. En la nueva versión, se carga sin filtro y luego se evalúa la autorización explícitamente. Esto permite dar el mensaje de error correcto (no expone información sobre si la sesión existe para un usuario no autorizado — el mensaje sigue siendo genérico: "Sesión no encontrada o sin permisos").

### Por qué `create_quickdash_token` usa `is_my_patient(session.patient_id)` en lugar de `is_my_patient(p_patient_id)`

`p_patient_id` viene del cliente y podría ser manipulado. La fuente de verdad es el `patient_id` que está en `therapy_sessions` para el `p_session_id` dado. Validar contra el patient_id de la sesión cierra el gap de inyección de `patient_id` externo.

### Por qué `create_exercise_plan_token` preserva `professional_id` del plan (no del caller)

El `professional_id` en `exercise_plan_tokens` identifica quién es el responsable clínico del plan, no quién generó el token de acceso público. Un miembro del equipo puede generar el link de acceso, pero el plan sigue perteneciendo a su creador original. Esto preserva la trazabilidad clínica.

### Por qué el seed usa `ON CONFLICT DO NOTHING`

La migración es idempotente: si se aplica dos veces (por error de deploy), no falla. Los UUIDs son PKs únicas — el conflicto se resuelve silenciosamente. Esto facilita el debugging y re-deploy sin tener que hacer rollback manual.

### Por qué no hay política INSERT en admin_users y el seed corre con service role

La ausencia de política INSERT garantiza que ningún usuario autenticado (ni siquiera un super-admin) puede auto-registrar nuevos super-admins vía cliente. La lista de super-admins es una decisión de arquitectura que debe estar en el código fuente (migrations), no en la UI. El servicio Supabase aplica migraciones con el usuario `postgres` (service role), que bypasea RLS.

---

## Hito: Fase 4 completada

Con esta historia aplicada, toda la capa de datos del sistema de roles y equipos está completa:

✅ RPCs admin para terapistas: `admin_get_stats`, `admin_list_therapists`, `admin_upsert_therapist`, `admin_deactivate_therapist`, `admin_reactivate_therapist`  
✅ RPCs admin para equipos: `admin_create_team`, `admin_set_team_limit`, `admin_move_patient_to_team`, `admin_list_patients`  
✅ RPCs de equipo: `invite_to_team`, `resend_invitation`, `remove_team_member`, `set_team_member_role`  
✅ Auto-join: `handle_new_user()` extiende la invitación a team_members al registrarse  
✅ RPCs existentes actualizadas para contexto de equipo  
✅ Super-admins bootstrapeados en `admin_users`  

La Fase 5 puede comenzar — todo el backend está listo para que el frontend lo consuma.

---

## Historia siguiente

**4.12 — Admin guard y layout**: componente `AdminRoute` que valida `is_super_admin()` y layout base del panel `/admin` con navegación lateral (Dashboard, Terapistas, Equipos).
