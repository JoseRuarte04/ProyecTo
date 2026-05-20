# Arquitectura — Roles, Equipos y Panel de Administración
**RehabOT · Winston / System Architect · 2026-05-19**

---

## 1. Auditoría del RLS actual

### 1.1 Mapa completo de tablas con RLS y sus políticas activas

| Tabla | Mecanismo actual | Helper usada |
|---|---|---|
| `patients` | `professional_id = auth.uid()` | — |
| `therapy_sessions` | `professional_id = auth.uid()` | `is_active_professional()` |
| `treatment_episodes` | `professional_id = auth.uid()` | — |
| `analytical_evaluations` | `professional_id = auth.uid()` | — |
| `functional_evaluations` | `professional_id = auth.uid()` | — |
| `exercise_plans` | `professional_id = auth.uid()` | — |
| `exercise_plan_items` | via `plan_id IN (SELECT … WHERE professional_id = auth.uid())` | — |
| `exercise_plan_tokens` | `professional_id = auth.uid()` | — |
| `quickdash_tokens` | `created_by = auth.uid()` | — |
| `patient_clinical_records` | `is_active_professional() AND is_my_patient(patient_id)` | ambas |
| `patient_occupational_profiles` | `is_active_professional() AND is_my_patient(patient_id)` | ambas |
| `clinical_files` SELECT | `is_active_professional() AND uploaded_by = auth.uid() AND is_my_patient(patient_id)` | ambas |
| `clinical_files` INSERT/UPDATE/DELETE | ídem + `uploaded_by = auth.uid()` | ambas |
| `exercise_body_regions` | `professional_id = auth.uid()` | — |
| `exercise_custom_categories` | `professional_id = auth.uid()` | — |
| `exercise_custom_category_assignments` | via `exercise_library.professional_id` | — |
| `treatment_plans` | `professional_id = auth.uid()` | — |
| `treatment_plan_exercises` | via `treatment_plan_id → treatment_plans.professional_id` | — |
| `appointments` | `professional_id = auth.uid()` | — |
| `audit_log` | INSERT: `action_context='user' AND performed_by = auth.uid()` | — |
| `profiles` | `id = auth.uid() AND is_active = true` | — |

### 1.2 RPCs SECURITY DEFINER que requieren actualización

| RPC | Validación actual | Cambio necesario |
|---|---|---|
| `soft_delete_session(uuid)` | `professional_id = auth.uid()` | Permitir a team-admin eliminar sesiones del equipo |
| `create_quickdash_token(uuid,uuid,timestamptz)` | episodio debe ser de `auth.uid()` | Cualquier miembro del equipo puede crear tokens |
| `create_exercise_plan_token(uuid,uuid,timestamptz)` | plan debe ser de `auth.uid()` | Ídem |

### 1.3 Funciones helper existentes (reutilizadas)

```
get_my_role()            → profile_role   (STABLE, SECURITY INVOKER)
is_active_professional() → boolean        (STABLE, SECURITY INVOKER)
is_my_patient(uuid)      → boolean        (STABLE, SECURITY INVOKER) ← ACTUALIZAR
insert_audit_log(...)    → void           (SECURITY DEFINER)         ← EXTENDER
```

### 1.4 Infraestructura de auditoría existente

- Tabla `audit_log`: `id, action, action_context, performed_by, record_id, table_name, description, created_at`
- **Falta**: columna `changes jsonb` (antes/después)
- Triggers existentes: `handle_patient_insert`, `handle_session_insert`, `handle_plan_insert`, etc. — solo capturan INSERT
- **Falta**: triggers para UPDATE

---

## 2. Nuevas Tablas y Esquema

### 2.1 `teams`

```sql
CREATE TABLE public.teams (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  created_by   uuid        NOT NULL REFERENCES auth.users(id),
  member_limit integer     NOT NULL DEFAULT 5,
  is_active    boolean     NOT NULL DEFAULT true,    -- soft-delete en teams
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

> **member_limit DEFAULT 5**: el super-admin puede cambiarlo por equipo desde /admin. La RPC de agregar miembro valida `COUNT(team_members) < member_limit` antes de insertar.

> **is_active**: soft-delete. Al desactivar un equipo, los pacientes con `team_id` quedan con ese FK; simplemente dejan de ser accesibles vía RLS hasta que se reasignen. Preserva historial.

### 2.2 `team_members`

```sql
CREATE TABLE public.team_members (
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by uuid REFERENCES auth.users(id),    -- quién agregó a quién
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX team_members_user_id_idx    ON public.team_members(user_id);
CREATE INDEX team_members_team_role_idx  ON public.team_members(team_id, role);
```

### 2.3 `team_invitations`

```sql
CREATE TABLE public.team_invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  token       uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by  uuid        NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  status      text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired'))
);

CREATE INDEX team_invitations_email_idx  ON public.team_invitations(email);
CREATE INDEX team_invitations_token_idx  ON public.team_invitations(token);
CREATE INDEX team_invitations_team_idx   ON public.team_invitations(team_id, status);
```

### 2.4 `admin_users`

```sql
CREATE TABLE public.admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

> Tabla separada (no extender el enum `profile_role`). Los 3 super-admins se insertan con un seed en la migración; los UUIDs se completan en producción. La tabla es la fuente de verdad para `is_super_admin()`.

### 2.5 Columna nueva en `patients`

```sql
ALTER TABLE public.patients
  ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX patients_team_id_idx ON public.patients(team_id);
CREATE INDEX patients_team_professional_idx
  ON public.patients(team_id, professional_id)
  WHERE is_deleted = false;
```

> `ON DELETE SET NULL`: si un equipo se elimina, los pacientes quedan como individuales — sin pérdida de datos.

### 2.6 Extensión de `audit_log`

```sql
ALTER TABLE public.audit_log
  ADD COLUMN changes jsonb;
-- Estructura: {"before": {...}, "after": {...}}
-- INSERT  → solo "after"
-- UPDATE  → "before" y "after"
-- DELETE  → solo "before"
```

---

## 3. Nuevo Modelo RLS

### 3.1 Principio rector

**Actualizar `is_my_patient()` propaga el acceso de equipos a todas las políticas que la usan sin tocar cada una individualmente.** Las políticas para las tablas nuevas (`teams`, `team_members`, `team_invitations`) se crean desde cero.

### 3.2 Nueva función `is_my_patient(uuid)`

```sql
CREATE OR REPLACE FUNCTION public.is_my_patient(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM patients p
    JOIN profiles pr ON pr.id = p.professional_id
    WHERE p.id         = p_patient_id
      AND p.is_deleted = false
      AND pr.is_active = true
      AND (
        -- Caso 1: paciente individual propio
        p.professional_id = auth.uid()
        OR
        -- Caso 2: paciente de un equipo activo al que pertenezco
        (
          p.team_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM team_members tm
            JOIN teams t ON t.id = tm.team_id
            WHERE tm.team_id = p.team_id
              AND tm.user_id = auth.uid()
              AND t.is_active = true
          )
        )
      )
  );
$$;
```

**Efecto cascada automático** sobre las políticas que usan `is_my_patient`:
- `patient_clinical_records`
- `patient_occupational_profiles`
- `clinical_files` (ver / crear / editar / eliminar)

### 3.3 Funciones helper nuevas

```sql
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO public AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid)    TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid)   FROM PUBLIC, anon;
```

### 3.4 Políticas RLS — tablas clínicas existentes

#### `patients`

```sql
-- SELECT: propio + equipo activo + super-admin
CREATE POLICY "patients: ver"
ON public.patients FOR SELECT TO authenticated
USING (
  is_deleted = false AND (
    professional_id = auth.uid()
    OR (team_id IS NOT NULL AND is_team_member(team_id))
    OR is_super_admin()
  )
);

-- INSERT: terapista activo; si especifica team_id debe ser miembro
CREATE POLICY "patients: crear"
ON public.patients FOR INSERT TO authenticated
WITH CHECK (
  is_active_professional()
  AND professional_id = auth.uid()
  AND (team_id IS NULL OR is_team_member(team_id))
);

-- UPDATE: propio OR miembro del equipo OR super-admin
CREATE POLICY "patients: editar"
ON public.patients FOR UPDATE TO authenticated
USING (
  is_deleted = false AND (
    professional_id = auth.uid()
    OR (team_id IS NOT NULL AND is_team_member(team_id))
    OR is_super_admin()
  )
)
WITH CHECK (
  professional_id = auth.uid()    -- no se puede reasignar el dueño vía RLS directa
  OR (team_id IS NOT NULL AND is_team_member(team_id))
  OR is_super_admin()
);
```

> La eliminación de pacientes (soft-delete `is_deleted=true`) se maneja via RPC que valida rol (admin del equipo o dueño) antes del UPDATE.

#### `therapy_sessions`, `treatment_episodes`, `analytical_evaluations`, `functional_evaluations`, `treatment_plans`

Patrón común para todas:

```sql
-- SELECT y UPDATE: propio o miembro del equipo del paciente
-- INSERT: professional_id = auth.uid() + is_my_patient(patient_id)

-- Ejemplo para therapy_sessions:
CREATE POLICY "therapy_sessions: ver"
ON public.therapy_sessions FOR SELECT TO authenticated
USING (is_deleted = false AND (professional_id = auth.uid() OR is_my_patient(patient_id)));

CREATE POLICY "therapy_sessions: editar"
ON public.therapy_sessions FOR UPDATE TO authenticated
USING (is_deleted = false AND (professional_id = auth.uid() OR is_my_patient(patient_id)))
WITH CHECK (professional_id = auth.uid() OR is_my_patient(patient_id));

-- (aplicar mismo patrón a las otras 4 tablas)
```

#### `exercise_plans` y `exercise_plan_items`

```sql
CREATE POLICY "exercise_plans: acceso"
ON public.exercise_plans FOR ALL TO authenticated
USING (professional_id = auth.uid() OR is_my_patient(patient_id))
WITH CHECK (professional_id = auth.uid() OR is_my_patient(patient_id));
```

#### `exercise_plan_tokens` y `quickdash_tokens`

```sql
CREATE POLICY "exercise_plan_tokens: acceso"
ON public.exercise_plan_tokens FOR ALL TO authenticated
USING (professional_id = auth.uid() OR is_my_patient(patient_id))
WITH CHECK (professional_id = auth.uid() OR is_my_patient(patient_id));

CREATE POLICY "quickdash_tokens: ver"
ON public.quickdash_tokens FOR SELECT TO authenticated
USING (created_by = auth.uid() OR is_my_patient(patient_id));
```

#### `clinical_files` — caso especial

La política SELECT actual filtra por `uploaded_by = auth.uid()`, lo que impide a miembros del equipo ver archivos subidos por otros. Se separa:

```sql
-- SELECT: ver archivos de mis pacientes (propios) O pacientes del equipo
CREATE POLICY "clinical_files: ver"
ON public.clinical_files FOR SELECT TO authenticated
USING (
  is_active_professional()
  AND is_deleted = false
  AND (uploaded_by = auth.uid() OR is_my_patient(patient_id))
);
-- INSERT/UPDATE/DELETE: solo el uploader (sin cambios)
```

### 3.5 Políticas RLS — tablas nuevas

#### `teams`

```sql
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams: ver"
ON public.teams FOR SELECT TO authenticated
USING (is_super_admin() OR is_team_member(id));

CREATE POLICY "teams: crear"
ON public.teams FOR INSERT TO authenticated
WITH CHECK (is_super_admin() AND created_by = auth.uid());

CREATE POLICY "teams: editar"
ON public.teams FOR UPDATE TO authenticated
USING (is_super_admin());

CREATE POLICY "teams: eliminar"
ON public.teams FOR DELETE TO authenticated
USING (is_super_admin());
```

#### `team_members`

```sql
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members: ver"
ON public.team_members FOR SELECT TO authenticated
USING (is_super_admin() OR user_id = auth.uid() OR is_team_admin(team_id));

-- INSERT/UPDATE/DELETE: solo super-admin y admin del equipo (via RPC)
CREATE POLICY "team_members: gestionar"
ON public.team_members FOR ALL TO authenticated
USING (is_super_admin() OR is_team_admin(team_id))
WITH CHECK (is_super_admin() OR is_team_admin(team_id));
```

#### `team_invitations`

```sql
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_invitations: ver"
ON public.team_invitations FOR SELECT TO authenticated
USING (is_super_admin() OR is_team_admin(team_id) OR invited_by = auth.uid());

CREATE POLICY "team_invitations: crear"
ON public.team_invitations FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR is_team_admin(team_id));

CREATE POLICY "team_invitations: actualizar"
ON public.team_invitations FOR UPDATE TO authenticated
USING (is_super_admin() OR is_team_admin(team_id));
```

#### `admin_users`

```sql
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users: ver"
ON public.admin_users FOR SELECT TO authenticated
USING (is_super_admin());

-- INSERT solo via service role (bootstrapeo en migración)
```

---

## 4. RPCs de Gestión de Equipos e Invitaciones

### 4.1 Flujo de invitación completo

```
Maia (team admin) escribe email → llama RPC invite_to_team()

   ¿email tiene cuenta en RehabOT?
   │
   ├── SÍ → ¿ya está en el equipo?
   │          ├── SÍ  → error "Ya es miembro"
   │          └── NO  → ¿COUNT(members) < member_limit?
   │                    ├── NO  → error "Límite de miembros alcanzado"
   │                    └── SÍ  → INSERT team_members (role='member')
   │                              → notificación interna (toast/email)
   │
   └── NO → ¿COUNT(members) < member_limit?
             ├── NO  → error "Límite de miembros alcanzado"
             └── SÍ  → INSERT team_invitations (status='pending')
                        → enviar email con link /registro?invitation=<token>
                        → (el backend / Supabase Edge Function envía el email)
```

Cuando Juan se registra con el email invitado:
```
handle_new_user() trigger detecta nuevo user →
busca team_invitations WHERE email = NEW.email AND status = 'pending' AND expires_at > now() →
si existe → INSERT team_members + UPDATE team_invitations SET status='accepted'
```

### 4.2 RPC principal: `invite_to_team`

```sql
CREATE OR REPLACE FUNCTION public.invite_to_team(
  p_team_id  uuid,
  p_email    text
)
RETURNS jsonb  -- { "result": "added" | "invited" | "already_member" | "limit_reached" }
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_team       teams%ROWTYPE;
  v_profile    profiles%ROWTYPE;
  v_count      int;
  v_inv_token  uuid;
BEGIN
  -- Validar que el caller es admin del equipo o super-admin
  IF NOT (is_team_admin(p_team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Obtener equipo
  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipo no encontrado'; END IF;

  -- Contar miembros actuales
  SELECT COUNT(*) INTO v_count FROM team_members WHERE team_id = p_team_id;
  IF v_count >= v_team.member_limit THEN
    RETURN jsonb_build_object('result', 'limit_reached', 'limit', v_team.member_limit);
  END IF;

  -- ¿Tiene cuenta?
  SELECT * INTO v_profile FROM profiles WHERE email = p_email AND is_active = true;

  IF FOUND THEN
    -- ¿Ya es miembro?
    IF EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = v_profile.id) THEN
      RETURN jsonb_build_object('result', 'already_member');
    END IF;
    -- Agregar directo
    INSERT INTO team_members (team_id, user_id, role, invited_by)
    VALUES (p_team_id, v_profile.id, 'member', auth.uid());
    -- Audit
    PERFORM insert_audit_log('insert'::audit_action, 'team_members',
      p_team_id, format('Usuario %s agregado al equipo', p_email), NULL);
    RETURN jsonb_build_object('result', 'added');
  ELSE
    -- Invalidar invitaciones previas del mismo email en este equipo
    UPDATE team_invitations
    SET status = 'expired'
    WHERE team_id = p_team_id AND email = p_email AND status = 'pending';
    -- Crear nueva invitación
    INSERT INTO team_invitations (team_id, email, invited_by)
    VALUES (p_team_id, p_email, auth.uid())
    RETURNING token INTO v_inv_token;
    -- El email se envía desde Edge Function o Supabase Auth hook
    RETURN jsonb_build_object('result', 'invited', 'token', v_inv_token);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.invite_to_team(uuid, text) TO authenticated;
```

### 4.3 RPC: `resend_invitation`

```sql
CREATE OR REPLACE FUNCTION public.resend_invitation(p_invitation_id uuid)
RETURNS uuid  -- nuevo token
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv  team_invitations%ROWTYPE;
  v_new  uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_inv FROM team_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;

  IF NOT (is_team_admin(v_inv.team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE team_invitations
  SET token      = v_new,
      expires_at = now() + interval '7 days',
      status     = 'pending'
  WHERE id = p_invitation_id;

  RETURN v_new;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resend_invitation(uuid) TO authenticated;
```

### 4.4 RPC: `remove_team_member`

```sql
CREATE OR REPLACE FUNCTION public.remove_team_member(p_team_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (is_team_admin(p_team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  -- Garantizar al menos 1 admin en el equipo
  IF (SELECT role FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id) = 'admin'
     AND (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id AND role = 'admin') = 1
  THEN
    RAISE EXCEPTION 'No puedes eliminar al único administrador del equipo';
  END IF;
  DELETE FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid, uuid) TO authenticated;
```

### 4.5 RPC: `promote_team_member`

El team-admin puede promover miembros a admin dentro de su equipo sin requerir al super-admin. La única restricción al bajar el rol (de admin a member) es que debe quedar al menos 1 admin.

```sql
CREATE OR REPLACE FUNCTION public.set_team_member_role(
  p_team_id uuid,
  p_user_id uuid,
  p_role    text   -- 'admin' | 'member'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;
  IF NOT (is_team_admin(p_team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  -- Si se está bajando de admin a member, verificar que quede al menos 1 admin
  IF p_role = 'member'
     AND (SELECT role FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id) = 'admin'
     AND (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id AND role = 'admin') = 1
  THEN
    RAISE EXCEPTION 'Debe quedar al menos un administrador en el equipo';
  END IF;
  UPDATE team_members SET role = p_role
  WHERE team_id = p_team_id AND user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_team_member_role(uuid, uuid, text) TO authenticated;
```

### 4.5 Trigger en `handle_new_user` — auto-join por invitación

```sql
-- Extender el trigger existente handle_new_user() para detectar invitaciones pendientes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv team_invitations%ROWTYPE;
BEGIN
  -- … lógica existente de creación de profile …

  -- Buscar invitación pendiente para este email
  SELECT * INTO v_inv
  FROM team_invitations
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO team_members (team_id, user_id, role, invited_by)
    VALUES (v_inv.team_id, NEW.id, 'member', v_inv.invited_by)
    ON CONFLICT DO NOTHING;

    UPDATE team_invitations
    SET status = 'accepted'
    WHERE id = v_inv.id;
  END IF;

  RETURN NEW;
END;
$$;
```

---

## 5. RPCs de Admin

### 5.1 RPCs SECURITY DEFINER para /admin

Todas validan `is_super_admin()` como primera línea. El cliente React llama estas RPCs desde el panel /admin.

```sql
-- Stats globales
admin_get_stats()
  → { total_therapists, total_patients, sessions_this_week, total_teams }

-- Listado de terapistas (todos, incluso inactivos)
admin_list_therapists()
  → TABLE(id, full_name, email, specialty, license_number,
          is_active, created_at, patient_count, team_count)

-- Crear terapista: solo si no existe en auth.users aún
-- (En la práctica: el super-admin usa el dashboard de Supabase o invita vía
--  Auth > Invite user. La RPC actualiza el profile si ya existe.)
admin_upsert_therapist(p_user_id, p_full_name, p_email, p_specialty, p_license)

-- Desactivar terapista
admin_deactivate_therapist(p_user_id uuid)
  → UPDATE profiles SET is_active=false, deactivated_at=now()
  → audit_log INSERT

-- Reactivar terapista
admin_reactivate_therapist(p_user_id uuid)

-- Crear equipo (super-admin asigna el primer admin)
admin_create_team(p_name text, p_admin_user_id uuid, p_member_limit int DEFAULT 5)
  → INSERT teams + INSERT team_members (role='admin')

-- Cambiar límite de miembros de un equipo
admin_set_team_limit(p_team_id uuid, p_limit int)
  → UPDATE teams SET member_limit = p_limit

-- Mover paciente entre equipos (solo super-admin)
admin_move_patient_to_team(p_patient_id uuid, p_team_id uuid)
  → UPDATE patients SET team_id = p_team_id
  → audit_log INSERT

-- Ver todos los pacientes (bypasa RLS)
admin_list_patients(p_team_id uuid DEFAULT NULL, p_professional_id uuid DEFAULT NULL)
  → SELECT con filtros opcionales
```

### 5.2 Actualización de RPCs existentes para contexto de equipo

```sql
-- soft_delete_session: permitir a team-admin
-- Autorización: dueño OR admin del equipo del paciente OR super-admin
CREATE OR REPLACE FUNCTION public.soft_delete_session(p_session_id uuid)
RETURNS void ...
  -- Leer: team_id del paciente de la sesión
  -- Validar: professional_id = auth.uid()
  --          OR (team_id IS NOT NULL AND is_team_admin(team_id))
  --          OR is_super_admin()

-- create_quickdash_token: cualquier miembro del equipo puede crear tokens
-- Validación nueva: episodio.patient_id debe pasar is_my_patient()
-- (en lugar de episodes.professional_id = auth.uid())

-- create_exercise_plan_token: ídem, validar is_my_patient(plan.patient_id)
```

---

## 6. Auditoría con Triggers

### 6.1 Decisión: triggers en DB

**Triggers SECURITY DEFINER** — no bypasseables desde el cliente. El proyecto ya los usa (`handle_patient_insert`, etc.). Se extiende la cobertura a UPDATE.

### 6.2 Extensión de `insert_audit_log`

```sql
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action      audit_action,
  p_table_name  text,
  p_record_id   uuid,
  p_description text,
  p_changes     jsonb DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO audit_log(action, table_name, record_id, description, changes, performed_by)
  VALUES (p_action, p_table_name, p_record_id, p_description, p_changes, auth.uid());
END;
$$;
```

### 6.3 Trigger UPDATE genérico para tablas clínicas

```sql
-- Ejemplo para patients (replicar en therapy_sessions, treatment_episodes,
-- functional_evaluations, analytical_evaluations, treatment_plans)
CREATE OR REPLACE FUNCTION public.handle_patient_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action, 'patients', NEW.id,
    'Paciente actualizado',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patient_update
AFTER UPDATE ON public.patients
FOR EACH ROW WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.handle_patient_update();
```

### 6.4 Tablas a cubrir con triggers UPDATE

| Tabla | Prioridad |
|---|---|
| `patients` | Alta |
| `therapy_sessions` | Alta |
| `treatment_episodes` | Alta |
| `functional_evaluations` | Alta |
| `analytical_evaluations` | Media |
| `treatment_plans` | Media |
| `team_members` | Alta |
| `team_invitations` | Media |
| `profiles` | Alta (desactivación de terapistas) |

### 6.5 Política de lectura en audit_log para super-admin

```sql
CREATE POLICY "audit_log: super-admin lee todo"
ON public.audit_log FOR SELECT TO authenticated
USING (is_super_admin() OR performed_by = auth.uid());
```

---

## 7. Reglas de Negocio en Frontend

### 7.1 Creación de paciente — selector de contexto

La UI del formulario de nuevo paciente (`NewPatientForm.tsx`) debe:

1. Al cargar, consultar `team_members WHERE user_id = auth.uid()` para saber si el terapista pertenece a algún equipo.
2. **Sin equipos** → crear paciente siempre personal (no muestra selector, `team_id = null`).
3. **Con equipos** → mostrar un selector:
   - "Paciente personal" (`team_id = null`)
   - "Paciente de [nombre equipo]" (`team_id = team.id`) — uno por equipo al que pertenece

El selector debe aparecer antes de los campos del formulario (es un dato estructural, no clínico).

### 7.2 Sección "Mi equipo" — dentro de la app principal (no /admin)

Visible solo para terapistas que son **admin** de al menos un equipo.

**Contenido por equipo:**

```
┌─────────────────────────────────────────────────────┐
│ Equipo: Clínica Norte            3 de 5 miembros    │
├─────────────────────────────────────────────────────┤
│ MIEMBROS ACTIVOS                                     │
│  • Maia García      admin    [Quitar]               │
│  • Juan López       miembro  [Quitar]               │
│  • Ana Torres       miembro  [Quitar]               │
├─────────────────────────────────────────────────────┤
│ INVITACIONES PENDIENTES                              │
│  • pedro@mail.com   vence 26/05  [Reenviar]         │
│  • jose@mail.com    vencida      [Reenviar]         │
├─────────────────────────────────────────────────────┤
│ Invitar: [email@ejemplo.com          ] [Invitar]    │
└─────────────────────────────────────────────────────┘
```

- El botón "Invitar" llama a `invite_to_team()`. 
- Si el resultado es `limit_reached`, muestra error con el límite actual.
- Si es `added`, toast "Miembro agregado". Si es `invited`, toast "Invitación enviada a X".
- "Reenviar" llama a `resend_invitation()`.
- "Quitar" llama a `remove_team_member()`.
- El contador "3 de 5" actualiza en tiempo real vía React Query.

### 7.3 Panel /admin — rutas y guard

```
/admin                    → redirect a /admin/dashboard
/admin/dashboard          → stats globales
/admin/therapists         → lista + crear + editar + desactivar
/admin/teams              → lista de equipos + crear
/admin/teams/:id          → detalle: miembros, pacientes, cambiar límite
```

Guard `AdminRoute`: verifica `is_super_admin()` al cargar. Si false, redirige a `/dashboard`.

---

## 8. Plan de Fases (22 migraciones)

### Fase 1 — Infraestructura de datos (sin tocar RLS existente)
> Rollback: `DROP TABLE` de las 3 tablas nuevas + `ALTER TABLE patients DROP COLUMN team_id`

| # | Migración |
|---|---|
| 01 | `CREATE TABLE teams (con member_limit, is_active)` |
| 02 | `CREATE TABLE team_members (con invited_by)` |
| 03 | `CREATE TABLE team_invitations` |
| 04 | `CREATE TABLE admin_users` |
| 05 | `ALTER TABLE patients ADD COLUMN team_id` + índices |
| 06 | `ALTER TABLE audit_log ADD COLUMN changes jsonb` |

### Fase 2 — Funciones helper y RLS actualizado
> Rollback: restaurar `is_my_patient` original (incluir SQL en comentario de migración)

| # | Migración |
|---|---|
| 07 | `CREATE FUNCTION is_super_admin, is_team_member, is_team_admin` |
| 08 | `CREATE OR REPLACE FUNCTION is_my_patient` (versión con equipos) |
| 09 | RLS nuevas para `patients` |
| 10 | RLS para `therapy_sessions`, `treatment_episodes` |
| 11 | RLS para `analytical_evaluations`, `functional_evaluations` |
| 12 | RLS para `exercise_plans`, `exercise_plan_items`, `exercise_plan_tokens` |
| 13 | RLS para `quickdash_tokens`, `clinical_files` SELECT update |
| 14 | RLS para `teams`, `team_members`, `team_invitations`, `admin_users` |
| 15 | `audit_log: super-admin lee todo` policy |

### Fase 3 — Auditoría extendida
> Rollback: `DROP TRIGGER` de los nuevos triggers

| # | Migración |
|---|---|
| 16 | `CREATE OR REPLACE FUNCTION insert_audit_log` (con `changes`) |
| 17 | Triggers UPDATE: `patients`, `therapy_sessions`, `treatment_episodes` |
| 18 | Triggers UPDATE: `functional_evaluations`, `analytical_evaluations`, `treatment_plans` |
| 19 | Triggers UPDATE: `team_members`, `team_invitations`, `profiles` |

### Fase 4 — RPCs de admin y actualizaciones de RPCs existentes
> Rollback: `DROP FUNCTION admin_*`

| # | Migración |
|---|---|
| 20 | RPCs de admin: `admin_get_stats`, `admin_list_therapists`, `admin_upsert_therapist`, `admin_deactivate_therapist`, `admin_reactivate_therapist` |
| 21 | RPCs de admin: `admin_create_team`, `admin_set_team_limit`, `admin_move_patient_to_team`, `admin_list_patients` |
| 22 | RPCs de equipo: `invite_to_team`, `resend_invitation`, `remove_team_member` |
| 23 | UPDATE `soft_delete_session`, `create_quickdash_token`, `create_exercise_plan_token` para contexto de equipo |
| 24 | UPDATE `handle_new_user()` trigger para auto-join por invitación |
| 25 | **Seed de bootstrap** — INSERT admin_users con los 3 UUIDs reales (completar en el momento) |

### Fase 5 — Frontend
> Sin cambios en DB. Dependencia: fases 1–4 aplicadas en producción.

| Sprint | Entregable |
|---|---|
| A | `AdminGuard` + `AdminLayout` + ruta `/admin` + `TeamContext` hook |
| B | Panel admin: dashboard stats + lista de terapistas |
| C | Panel admin: crear/editar/desactivar terapistas |
| D | Panel admin: crear equipos, asignar primer admin, cambiar límite |
| E | Sección "Mi equipo" en app principal (para team-admins) |
| F | Selector de contexto al crear paciente (personal / equipo) |
| G | Visualización diferenciada de pacientes de equipo en listado |

---

## 9. Riesgos y Mitigaciones

| # | Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | `is_my_patient` actualizado expande acceso no intencionado | Baja | Alto | Query de verificación antes de deploy: terapista sin equipo debe ver SOLO sus propios pacientes. SQL de rollback en la migración. |
| 2 | Rendimiento: subquery a `team_members` en RLS por cada fila | Media | Medio | Índices `team_members(user_id)` y `patients(team_id)`. Monitorear con `pg_stat_statements` post-deploy. |
| 3 | `clinical_files` SELECT expone archivos de otros miembros | Esperado | Bajo (UX) | Mostrar `uploaded_by` en UI. Documentar en changelog para terapistas. |
| 4 | RPCs existentes hardcodean `professional_id = auth.uid()` | Alta si Fase 4 se omite | Medio | Fase 4 ANTES de lanzar UI de equipos. |
| 5 | Bootstrap de super-admins: UUIDs no conocidos aún | Media | Alto | Migración 25 con UUIDs en placeholder; aplicar manualmente o como seed separado. |
| 6 | `handle_new_user` con múltiples invitaciones pendientes para mismo email | Baja | Bajo | `LIMIT 1` en la query + `ON CONFLICT DO NOTHING` en el INSERT de `team_members`. |
| 7 | Un team-admin se elimina a sí mismo siendo el único admin | Media | Medio | `remove_team_member` valida `COUNT(admins) > 1` antes de eliminar. |
| 8 | Email de invitación requiere Supabase Edge Function o servicio externo | Esperado | — | La RPC devuelve el token; el email se delega a Edge Function (`supabase/functions/send-invite`). Puede quedar pendiente para Sprint E. |

---

## 10. Mejoras Sugeridas

### 10.1 Vista `my_accessible_patients` (simplifica queries de la app)

```sql
CREATE VIEW public.my_accessible_patients AS
SELECT p.* FROM patients p
WHERE is_deleted = false
  AND (
    p.professional_id = auth.uid()
    OR (p.team_id IS NOT NULL AND is_team_member(p.team_id))
  );
```

El cliente hace `.from('my_accessible_patients')` sin filtros adicionales.

### 10.2 `deactivated_reason` en `profiles`

```sql
ALTER TABLE public.profiles ADD COLUMN deactivated_reason text;
```

Cuando el super-admin desactiva un terapista, registrar el motivo. Útil para soporte.

### 10.3 Expirar invitaciones automáticamente (cron job o Edge Function)

Las invitaciones con `expires_at < now()` siguen con `status='pending'` hasta que alguien las reenvía. Una Edge Function scheduled diaria puede hacer:

```sql
UPDATE team_invitations SET status='expired'
WHERE status='pending' AND expires_at < now();
```

### 10.4 `audit_log` visible en "Mi equipo" para team-admins

Opcional: mostrar un historial de cambios recientes en los pacientes del equipo. Esto reutiliza el `audit_log` existente con la política de SELECT ya planificada.

---

## 11. Diagrama de Acceso por Rol

```
PACIENTE
├── team_id = NULL (individual)
│   └── Solo lo ve: professional_id (dueño)
│
└── team_id = X (equipo)
    ├── Miembro del equipo X → VER + CREAR + EDITAR
    ├── Admin del equipo X   → VER + CREAR + EDITAR + ELIMINAR + gestionar equipo
    └── Super-admin          → TODO + mover entre equipos

TABLA teams / team_members / team_invitations
├── Team-admin → gestiona su propio equipo
└── Super-admin → gestiona todos los equipos

PANEL /admin (RPCs SECURITY DEFINER)
└── Solo super-admin (validado en cada RPC)
```

---

## 12. Próximos Pasos

1. **Confirmar los 3 UUIDs de super-admins** para incluirlos en la migración 25.
2. **Decidir cómo se envían los emails de invitación**: Supabase Edge Function (recomendado) o servicio externo (SendGrid, Resend). Definir antes de Sprint E.
3. **Crear las historias de implementación** por sprint usando `bmad-create-story`.
4. **Aplicar Fase 1** en producción (sin riesgo, solo agrega tablas y columnas).
5. **Testing de Fase 2** en un Supabase branch antes de aplicar a producción.
6. **Definir UX del panel /admin** con Sally (`bmad-agent-ux-designer`) antes de Sprint B.

---

*Generado por Winston · System Architect · RehabOT · 2026-05-19*
*Actualizado con: member_limit, sistema de invitaciones, "Mi equipo" en app, roles confirmados, regla de creación de pacientes*
