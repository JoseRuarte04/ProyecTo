# Historia 4.7: Auditoría extendida — `insert_audit_log` con `changes` + triggers UPDATE

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 3 — Auditoría extendida con triggers
**Dependencia:** Historia 4.2 aplicada (columna `audit_log.changes jsonb` debe existir); Historias 4.1 aplicada (tablas `teams`, `team_members`, `team_invitations`)
**Tipo:** Solo DB — 3 migraciones SQL. Sin cambios de UI ni de types.ts.

---

## Historia

Como arquitecto del sistema,
quiero extender `insert_audit_log()` para que capture el diff `{before, after}` y agregar triggers AFTER UPDATE en todas las tablas clínicas y de equipos,
para que cualquier modificación de datos quede registrada de forma automática e inviolable, sin depender de que el código de aplicación lo recuerde.

---

## Estado Actual

### `insert_audit_log` — 4 parámetros, sin `changes`

```sql
-- Firma actual (de la migración 20260429032405):
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action      audit_action,
  p_table_name  text,
  p_record_id   uuid,
  p_description text DEFAULT NULL::text
)
```

- La columna `audit_log.changes` fue agregada en Historia 4.2 pero la función **no la popula todavía**.
- Callers existentes pasan 3-4 argumentos posicionales; deben seguir funcionando sin modificación.

### Triggers de INSERT existentes (solo INSERT, sin UPDATE)

Los siguientes triggers ya existen en producción (REVOKE aplicado en migración `20260429031828`):

| Función trigger | Tabla cubierta |
|---|---|
| `handle_patient_insert()` | `patients` |
| `handle_session_insert()` | `therapy_sessions` |
| `handle_plan_insert()` | `treatment_plans` |
| `handle_functional_eval_insert()` | `functional_evaluations` |
| `handle_analytical_eval_insert()` | `analytical_evaluations` |

**Falta**: triggers para UPDATE en todas estas tablas + coverage de `treatment_episodes`, `team_members`, `team_invitations`, `profiles`.

### Enum `audit_action` — valores a verificar

Antes de aplicar las migraciones, verificar qué valores tiene el enum:

```sql
SELECT enumlabel FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'audit_action'
ORDER BY enumsortorder;
```

Los valores `'insert'` y `'update'` deben existir (confirmados por el código actual). Si `'delete'` no existe, aplicar la **Tarea 0** antes de las demás.

---

## Criterios de Aceptación

**AC1 — insert_audit_log acepta 5 argumentos (con changes) y sigue aceptando 4**
- Given: se aplica la migración de extensión de la función
- When: se llama `insert_audit_log('update', 'patients', uuid, 'desc', jsonb_obj)`
- Then: se inserta en `audit_log` con `changes = jsonb_obj`
- And: cuando se llama con 4 args (sin changes), `audit_log.changes` queda `NULL` (callers existentes sin modificar)

**AC2 — Trigger UPDATE en `patients` captura el diff**
- Given: el trigger `trg_patient_update` está activo
- When: se actualiza un paciente (e.g., cambia `phone`)
- Then: `audit_log` recibe una nueva fila con:
  - `action = 'update'`, `table_name = 'patients'`, `record_id = <patient.id>`
  - `changes = {"before": {...old values...}, "after": {...new values...}}`
- And: si OLD y NEW son idénticos (no-op UPDATE), **no** se inserta fila en audit_log

**AC3 — Misma cobertura para las otras 5 tablas clínicas**
- Given: triggers activos en `therapy_sessions`, `treatment_episodes`, `functional_evaluations`, `analytical_evaluations`, `treatment_plans`
- When: se hace UPDATE en cualquiera de ellas con cambio real
- Then: audit_log recibe la fila correspondiente con `changes` poblado
- And: no-op updates no generan entradas

**AC4 — team_members queda auditado en INSERT, UPDATE y DELETE**
- Given: triggers en `team_members`
- When: se agrega, modifica o elimina un miembro
- Then: cada operación genera una fila en audit_log con la acción correcta (`insert`/`update`/`delete`) y el diff correspondiente

**AC5 — team_invitations queda auditado en cambios de status**
- Given: trigger UPDATE en `team_invitations`
- When: status cambia de `pending` a `accepted` o `expired`
- Then: audit_log registra el cambio con `changes = {"before": {...}, "after": {...}}`

**AC6 — profiles queda auditado cuando cambia is_active**
- Given: trigger UPDATE en `profiles`
- When: `is_active` cambia (activación o desactivación de un terapista)
- Then: audit_log registra el cambio

**AC7 — Trigger functions no son callable desde el cliente**
- Given: las nuevas funciones trigger tienen REVOKE FROM PUBLIC, anon, authenticated
- Then: un cliente autenticado no puede invocarlas directamente (son internas del motor)

---

## Tareas

---

### Tarea 0 — Prerrequisito: verificar/agregar 'delete' al enum `audit_action`

Ejecutar en Supabase SQL Editor (no como migración Supabase CLI, porque `ALTER TYPE ADD VALUE` no puede ejecutarse dentro de un bloque de transacción en PostgreSQL):

```sql
-- Verificar valores actuales
SELECT enumlabel FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'audit_action'
ORDER BY enumsortorder;

-- Si 'delete' no aparece, ejecutar:
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'delete';
```

> **Nota de Supabase**: si se usa `apply_migration`, el `ALTER TYPE ADD VALUE` debe estar en su propia migración sin ninguna sentencia DDL posterior que use el nuevo valor. Esto es porque en PostgreSQL 12-15, el nuevo valor no es visible dentro de la misma transacción. Supabase MCP `apply_migration` envuelve la sentencia en una transacción individual, por lo que una migración que solo contiene el `ALTER TYPE` es segura. La siguiente migración (que usa `'delete'::audit_action`) se aplica en una transacción separada y el valor ya está disponible.

Archivo si se usa migración: `supabase/migrations/YYYYMMDDHHMMSS_audit_action_add_delete.sql`

```sql
-- Agrega el valor 'delete' al enum audit_action para triggers de eliminación física
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'delete';
```

---

### Tarea 1 — Migración: extender `insert_audit_log`

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_audit_log_extend_function.sql`

```sql
-- ROLLBACK:
-- DROP FUNCTION IF EXISTS public.insert_audit_log(audit_action, text, uuid, text, jsonb);
-- CREATE OR REPLACE FUNCTION public.insert_audit_log(
--   p_action audit_action, p_table_name text, p_record_id uuid, p_description text DEFAULT NULL
-- ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
-- DECLARE v_uid UUID; v_context audit_context;
-- BEGIN
--   v_uid := auth.uid();
--   IF v_uid IS NOT NULL THEN v_context := 'user'; ELSE v_context := 'system'; END IF;
--   INSERT INTO audit_log (performed_by, action, action_context, table_name, record_id, description)
--   VALUES (v_uid, p_action, v_context, p_table_name, p_record_id, p_description);
-- END;
-- $$;
-- REVOKE EXECUTE ON FUNCTION public.insert_audit_log(audit_action, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- ── PASO 1: Eliminar la firma de 4 parámetros ─────────────────────────────────
-- La nueva versión de 5 parámetros es backward-compatible: callers con 4 args
-- usan el valor DEFAULT NULL para p_changes. PostgreSQL no permite CREATE OR REPLACE
-- cuando cambia la firma, por lo que se hace DROP + CREATE.
-- Los callers existentes (handle_patient_insert, etc.) resuelven la llamada a
-- insert_audit_log por nombre en tiempo de ejecución — el DROP no los rompe.
DROP FUNCTION IF EXISTS public.insert_audit_log(audit_action, text, uuid, text);

-- ── PASO 2: Crear la nueva versión con 5 parámetros ──────────────────────────
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action      audit_action,
  p_table_name  text,
  p_record_id   uuid,
  p_description text  DEFAULT NULL,
  p_changes     jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid     UUID;
  v_context audit_context;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    v_context := 'user';
  ELSE
    v_context := 'system';
  END IF;

  INSERT INTO audit_log (performed_by, action, action_context, table_name, record_id, description, changes)
  VALUES (v_uid, p_action, v_context, p_table_name, p_record_id, p_description, p_changes);
END;
$$;

-- ── PASO 3: Restablecer REVOKE sobre la nueva firma ───────────────────────────
-- Esta función es SECURITY DEFINER e interna — no debe ser callable desde el cliente.
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(audit_action, text, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
```

---

### Tarea 2 — Migración: triggers UPDATE para tablas clínicas

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_audit_triggers_clinical.sql`

```sql
-- Triggers AFTER UPDATE para: patients, therapy_sessions, treatment_episodes,
-- functional_evaluations, analytical_evaluations, treatment_plans.
-- Todas las funciones son SECURITY DEFINER para bypasear RLS al escribir en audit_log.
-- WHEN (OLD IS DISTINCT FROM NEW) evita entradas vacías en updates sin cambio real.


-- ── PATIENTS ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_patient_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action,
    'patients',
    NEW.id,
    'Paciente actualizado',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patient_update
AFTER UPDATE ON public.patients
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.handle_patient_update();


-- ── THERAPY_SESSIONS ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_session_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action,
    'therapy_sessions',
    NEW.id,
    'Sesión actualizada',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_session_update
AFTER UPDATE ON public.therapy_sessions
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.handle_session_update();


-- ── TREATMENT_EPISODES ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_treatment_episode_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action,
    'treatment_episodes',
    NEW.id,
    'Episodio de tratamiento actualizado',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_treatment_episode_update
AFTER UPDATE ON public.treatment_episodes
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.handle_treatment_episode_update();


-- ── FUNCTIONAL_EVALUATIONS ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_functional_eval_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action,
    'functional_evaluations',
    NEW.id,
    'Evaluación funcional actualizada',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_functional_eval_update
AFTER UPDATE ON public.functional_evaluations
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.handle_functional_eval_update();


-- ── ANALYTICAL_EVALUATIONS ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_analytical_eval_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action,
    'analytical_evaluations',
    NEW.id,
    'Evaluación analítica actualizada',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_analytical_eval_update
AFTER UPDATE ON public.analytical_evaluations
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.handle_analytical_eval_update();


-- ── TREATMENT_PLANS ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_treatment_plan_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action,
    'treatment_plans',
    NEW.id,
    'Plan de tratamiento actualizado',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_treatment_plan_update
AFTER UPDATE ON public.treatment_plans
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.handle_treatment_plan_update();


-- ── REVOKE: funciones trigger internas ───────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_patient_update()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_session_update()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_treatment_episode_update()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_functional_eval_update()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_analytical_eval_update()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_treatment_plan_update()     FROM PUBLIC, anon, authenticated;
```

---

### Tarea 3 — Migración: triggers para tablas de equipos y profiles

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_audit_triggers_teams.sql`

> **Prerequisito**: la Tarea 0 debe haberse aplicado antes de esta migración para que `'delete'::audit_action` sea válido.

```sql
-- Triggers de auditoría para team_members (INSERT + UPDATE + DELETE),
-- team_invitations (UPDATE) y profiles (UPDATE cuando cambia is_active).


-- ── TEAM_MEMBERS ──────────────────────────────────────────────────────────────
-- PK compuesto (team_id, user_id) — se usa user_id como record_id (es UUID).
-- Cubre INSERT, UPDATE y DELETE en una sola función trigger (TG_OP branching).
-- Nota sobre doble-auditoría: las RPCs invite_to_team y remove_team_member
-- llaman insert_audit_log directamente. Esta función trigger proporciona una
-- red de seguridad para inserciones/eliminaciones que no pasen por esas RPCs
-- (ej: migrations de seed, Supabase Studio). La doble entrada es aceptable dado
-- que el audit_log sirve como registro forense completo.

CREATE OR REPLACE FUNCTION public.handle_team_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      'insert'::audit_action,
      'team_members',
      NEW.user_id,
      format('Miembro %s agregado al equipo %s con rol %s', NEW.user_id, NEW.team_id, NEW.role),
      jsonb_build_object(
        'team_id',    NEW.team_id,
        'role',       NEW.role,
        'invited_by', NEW.invited_by
      )
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM insert_audit_log(
      'update'::audit_action,
      'team_members',
      NEW.user_id,
      format('Miembro %s actualizado en equipo %s', NEW.user_id, NEW.team_id),
      jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    PERFORM insert_audit_log(
      'delete'::audit_action,
      'team_members',
      OLD.user_id,
      format('Miembro %s eliminado del equipo %s (rol: %s)', OLD.user_id, OLD.team_id, OLD.role),
      jsonb_build_object(
        'team_id', OLD.team_id,
        'role',    OLD.role
      )
    );
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_team_member_insert
AFTER INSERT ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.handle_team_member_change();

CREATE TRIGGER trg_team_member_update
AFTER UPDATE ON public.team_members
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.handle_team_member_change();

CREATE TRIGGER trg_team_member_delete
AFTER DELETE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.handle_team_member_change();


-- ── TEAM_INVITATIONS ─────────────────────────────────────────────────────────
-- Solo UPDATE (INSERT ya auditado por RPC invite_to_team).
-- Los cambios críticos son de status: pending → accepted | expired.

CREATE OR REPLACE FUNCTION public.handle_team_invitation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action,
    'team_invitations',
    NEW.id,
    format('Invitación %s actualizada: %s → %s', NEW.id, OLD.status, NEW.status),
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_team_invitation_update
AFTER UPDATE ON public.team_invitations
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.handle_team_invitation_update();


-- ── PROFILES ──────────────────────────────────────────────────────────────────
-- Trigger UPDATE restringido: solo dispara cuando cambia is_active.
-- Esto audita activaciones y desactivaciones de terapistas sin llenar el log
-- con cambios menores de perfil (nombre, foto, etc.).

CREATE OR REPLACE FUNCTION public.handle_profile_activation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action,
    'profiles',
    NEW.id,
    CASE
      WHEN NEW.is_active = true  THEN 'Terapista reactivado'
      WHEN NEW.is_active = false THEN 'Terapista desactivado'
    END,
    jsonb_build_object(
      'before', jsonb_build_object('is_active', OLD.is_active),
      'after',  jsonb_build_object('is_active', NEW.is_active)
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profile_activation_update
AFTER UPDATE ON public.profiles
FOR EACH ROW
WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
EXECUTE FUNCTION public.handle_profile_activation_change();


-- ── REVOKE: funciones trigger internas ───────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_team_member_change()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_team_invitation_update()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_profile_activation_change()   FROM PUBLIC, anon, authenticated;
```

---

### Tarea 4 — Verificación post-deploy

```sql
-- ── Verificar que insert_audit_log tiene la nueva firma (5 parámetros) ───────
SELECT proname, pronargs, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'insert_audit_log'
  AND pronamespace = 'public'::regnamespace;
-- Esperado: 1 fila, args = "p_action audit_action, p_table_name text, p_record_id uuid, p_description text DEFAULT NULL::text, p_changes jsonb DEFAULT NULL"

-- ── Verificar triggers en tablas clínicas ────────────────────────────────────
SELECT event_object_table, trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'patients', 'therapy_sessions', 'treatment_episodes',
    'functional_evaluations', 'analytical_evaluations', 'treatment_plans'
  )
  AND trigger_name LIKE 'trg_%update'
ORDER BY event_object_table;
-- Esperado: 6 filas, una por tabla, event_manipulation = 'UPDATE', action_timing = 'AFTER'

-- ── Verificar triggers en tablas de equipos y profiles ───────────────────────
SELECT event_object_table, trigger_name, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('team_members', 'team_invitations', 'profiles')
ORDER BY event_object_table, trigger_name;
-- Esperado:
-- profiles          | trg_profile_activation_update   | UPDATE
-- team_invitations  | trg_team_invitation_update      | UPDATE
-- team_members      | trg_team_member_delete          | DELETE
-- team_members      | trg_team_member_insert          | INSERT
-- team_members      | trg_team_member_update          | UPDATE

-- ── Smoke test: forzar una actualización y verificar audit_log ────────────────
-- (Ejecutar con un paciente de prueba, como service role para bypasear RLS)
UPDATE patients SET phone = phone WHERE id = '<uuid-paciente-prueba>';
-- Resultado esperado: NO debe insertar entrada (OLD IS NOT DISTINCT FROM NEW — no-op)

UPDATE patients SET phone = '+54 11 9999-0000' WHERE id = '<uuid-paciente-prueba>';
SELECT action, table_name, record_id, changes
FROM audit_log
WHERE table_name = 'patients' AND record_id = '<uuid-paciente-prueba>'
ORDER BY created_at DESC LIMIT 1;
-- Esperado: action='update', changes contiene {"before": {...}, "after": {...}} con phone diferente
```

---

## Decisiones de Diseño

### Por qué DROP + CREATE en lugar de CREATE OR REPLACE para `insert_audit_log`

PostgreSQL requiere que `CREATE OR REPLACE FUNCTION` mantenga la firma exacta (mismos tipos de parámetros en el mismo orden). Agregar `p_changes jsonb DEFAULT NULL` como quinto parámetro cambia la firma, por lo que el engine rechaza `CREATE OR REPLACE`. La solución es `DROP + CREATE`. Los callers existentes (funciones PL/pgSQL como `handle_patient_insert`) resuelven la llamada a `insert_audit_log` por nombre en tiempo de ejecución, no por OID, por lo que el `DROP` no los invalida.

### Por qué los callers de 4 argumentos siguen funcionando

La nueva firma tiene `p_changes jsonb DEFAULT NULL` como quinto parámetro. Al llamar `insert_audit_log(action, table, id, desc)` con 4 argumentos posicionales, PostgreSQL usa el valor default `NULL` para `p_changes`. El INSERT en audit_log queda con `changes = NULL`, que es exactamente el comportamiento anterior. Cero cambios necesarios en los callers existentes.

### Por qué WHEN (OLD IS DISTINCT FROM NEW)

Sin esta condición, un `UPDATE ... WHERE id = X` que no cambia ningún valor generaría una entrada en audit_log con `changes = {"before": {...same...}, "after": {...same...}}`. La condición `WHEN (OLD IS DISTINCT FROM NEW)` hace que el trigger solo dispare cuando hay al menos un campo diferente. Esto evita ruido en el log de auditoría.

### Por qué `team_members` usa una sola función trigger para INSERT/UPDATE/DELETE

PostgreSQL permite asociar el mismo trigger function a múltiples eventos (`AFTER INSERT OR UPDATE OR DELETE`), pero la forma más clara en PostgreSQL es crear un trigger por evento (INSERT, UPDATE, DELETE por separado) apuntando a la misma función, y usar `TG_OP` dentro para diferenciar. Esto da flexibilidad para agregar condiciones `WHEN` específicas por evento (como el `WHEN (OLD IS DISTINCT FROM NEW)` solo en UPDATE).

### Por qué `profiles` solo audita cambios en `is_active`

El perfil de un terapista incluye campos como foto de perfil, nombre, teléfono — cambios frecuentes y de bajo riesgo. Auditar todos los cambios llenaría el log de ruido. El evento crítico de seguridad es la desactivación/reactivación (afecta al acceso del terapista al sistema). La condición `WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)` acota el trigger exactamente a ese evento.

### Por qué audit_log no tiene política DELETE

El audit log es append-only. Sin política DELETE (con RLS habilitado), el acceso directo vía `DELETE FROM audit_log` es rechazado para todos, incluyendo super-admins. La limpieza de registros antiguos, si fuera necesaria, se haría via migración con service role — no desde el cliente.

### Sobre la doble auditoría en team_members

Las RPCs `invite_to_team` y `remove_team_member` ya llaman `insert_audit_log` explícitamente. El trigger `trg_team_member_insert` y `trg_team_member_delete` generarán entradas adicionales cuando esas RPCs ejecuten. Esto resulta en dos entradas por operación: una desde la RPC (con el contexto del usuario) y otra desde el trigger (también con el usuario, ya que las RPCs corren como SECURITY DEFINER pero `auth.uid()` sigue siendo el del caller en el contexto de conexión). Las entradas duplicadas son aceptables dado que el trigger actúa como red de seguridad para cambios directos que no pasen por las RPCs. En una futura iteración se puede remover el `insert_audit_log` manual de las RPCs para consolidar en triggers.

---

## Hito: Fase 3 completada

Con esta historia aplicada, el sistema tiene auditoría completa:

✅ `insert_audit_log()` captura diff `{before, after}` en `changes` jsonb  
✅ Todos los UPDATEs en tablas clínicas quedan registrados automáticamente  
✅ Altas, bajas y cambios de rol en `team_members` quedan registrados  
✅ Cambios de status en `team_invitations` quedan registrados  
✅ Activaciones/desactivaciones de terapistas quedan registradas  
✅ Los triggers son SECURITY DEFINER — no bypasseables desde el cliente  

---

## Historia siguiente

**4.8 — RPCs admin: terapistas**: RPCs SECURITY DEFINER para el panel /admin — `admin_get_stats()`, `admin_list_therapists()`, `admin_upsert_therapist()`, `admin_deactivate_therapist()`, `admin_reactivate_therapist()`.
