# Historia 4.10: RPCs de gestión de equipo + auto-join por invitación

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 4 — RPCs de admin y actualizaciones de RPCs existentes
**Dependencia:** Historias 4.1–4.3 aplicadas (tablas `teams`, `team_members`, `team_invitations`; funciones `is_super_admin()`, `is_team_admin()`, `is_team_member()`); Historia 4.6 aplicada (RLS en team_invitations)
**Tipo:** Solo DB — 1 migración SQL. Sin cambios de UI ni de types.ts.

---

## Historia

Como team-admin,
quiero RPCs que me permitan invitar terapistas a mi equipo (por email), reenviar invitaciones vencidas, quitar miembros y cambiar roles,
para que pueda gestionar mi equipo de forma autónoma sin necesitar al super-admin.

Como nuevo usuario,
quiero que al registrarme con un email que tiene una invitación pendiente, el sistema me agregue automáticamente al equipo,
para no tener que seguir pasos adicionales tras el registro.

---

## Estado Actual

El trigger `handle_new_user()` existe en producción y crea el perfil del usuario. Necesita ser extendido con la lógica de auto-join. Las RPCs de gestión de equipo no existen aún.

### Flujo de invitación (para el dev)

```
Team-admin llama invite_to_team(team_id, email)
├── email tiene cuenta activa en profiles?
│   ├── SÍ → ¿ya es miembro? → error "Ya es miembro"
│   │       → ¿COUNT(members) < member_limit? → error "Límite alcanzado"
│   │       → INSERT team_members (role='member') → return {result: 'added'}
│   └── NO → ¿COUNT(members) < member_limit? → error "Límite alcanzado"
│            → Invalidar invitaciones previas del mismo email en este equipo
│            → INSERT team_invitations → return {result: 'invited', token: uuid}
│            (El email lo envía una Edge Function / webhook de Supabase Auth — fuera de scope de esta historia)

Nuevo usuario se registra con email invitado:
handle_new_user() trigger → busca team_invitations pendiente para ese email
                          → INSERT team_members + UPDATE team_invitations SET status='accepted'
```

---

## Criterios de Aceptación

**AC1 — `invite_to_team()` agrega directamente si el email tiene cuenta**
- Given: email@x.com tiene un perfil activo, no es miembro del equipo, hay capacidad
- When: team-admin llama `invite_to_team(team_uuid, 'email@x.com')`
- Then: devuelve `{"result": "added"}` y el usuario queda en `team_members` con rol 'member'

**AC2 — `invite_to_team()` crea invitación si el email no tiene cuenta**
- Given: email@x.com no tiene perfil en `profiles`
- When: team-admin llama `invite_to_team(team_uuid, 'email@x.com')`
- Then: devuelve `{"result": "invited", "token": "<uuid>"}` y existe fila en `team_invitations`
- And: cualquier invitación previa pendiente del mismo email en el mismo equipo queda con `status='expired'`

**AC3 — `invite_to_team()` rechaza si el miembro ya está en el equipo**
- Given: usuario ya es miembro del equipo
- When: team-admin invita su email
- Then: devuelve `{"result": "already_member"}`

**AC4 — `invite_to_team()` rechaza si se alcanzó el límite**
- Given: el equipo tiene 5 miembros y `member_limit = 5`
- When: team-admin intenta invitar a alguien más
- Then: devuelve `{"result": "limit_reached", "limit": 5}`

**AC5 — `resend_invitation()` genera nuevo token y extiende expiración**
- Given: existe una invitación (cualquier status)
- When: team-admin llama `resend_invitation(invitation_uuid)`
- Then: `team_invitations.token` es un nuevo UUID, `expires_at = now() + 7 days`, `status = 'pending'`
- And: devuelve el nuevo token UUID

**AC6 — `remove_team_member()` elimina al miembro**
- Given: usuario B es miembro del equipo del caller
- When: team-admin llama `remove_team_member(team_uuid, user_uuid_B)`
- Then: la fila en `team_members` se elimina
- And: si B es el único admin del equipo, lanza EXCEPTION (no puede quedar el equipo sin admin)

**AC7 — `set_team_member_role()` cambia el rol del miembro**
- Given: usuario B es miembro (role='member') del equipo del caller
- When: team-admin llama `set_team_member_role(team_uuid, user_uuid_B, 'admin')`
- Then: `team_members.role = 'admin'` para ese usuario
- And: si se intenta bajar al único admin a 'member', lanza EXCEPTION

**AC8 — Auto-join: nuevo usuario se une al equipo al registrarse**
- Given: existe `team_invitations` con `email='nuevo@x.com'`, `status='pending'`, `expires_at > now()`
- When: 'nuevo@x.com' se registra en Supabase Auth y `handle_new_user()` corre
- Then: el usuario queda insertado en `team_members` con `role='member'`
- And: la invitación queda con `status='accepted'`

**AC9 — Ninguna RPC de gestión es callable por miembros regulares**
- Given: usuario con role='member' en el equipo (no admin)
- When: llama `invite_to_team`, `remove_team_member` o `set_team_member_role`
- Then: recibe EXCEPTION 'unauthorized' (la RPC valida `is_team_admin() OR is_super_admin()`)

---

## Tareas

### Task 1 — Migración con las 4 RPCs de gestión + actualización de handle_new_user

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_team_management_rpcs.sql`

```sql
-- ── invite_to_team() ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invite_to_team(
  p_team_id uuid,
  p_email   text
)
RETURNS jsonb  -- { "result": "added" | "invited" | "already_member" | "limit_reached" }
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_team      teams%ROWTYPE;
  v_profile   profiles%ROWTYPE;
  v_count     int;
  v_inv_token uuid;
BEGIN
  -- Solo team-admin o super-admin pueden invitar
  IF NOT (is_team_admin(p_team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Obtener equipo
  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipo no encontrado o inactivo';
  END IF;

  -- Contar miembros actuales
  SELECT COUNT(*) INTO v_count FROM team_members WHERE team_id = p_team_id;
  IF v_count >= v_team.member_limit THEN
    RETURN jsonb_build_object('result', 'limit_reached', 'limit', v_team.member_limit);
  END IF;

  -- ¿El email tiene cuenta activa?
  SELECT * INTO v_profile FROM profiles WHERE email = p_email AND is_active = true;

  IF FOUND THEN
    -- ¿Ya es miembro?
    IF EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = v_profile.id) THEN
      RETURN jsonb_build_object('result', 'already_member');
    END IF;

    -- Agregar directo al equipo
    INSERT INTO team_members (team_id, user_id, role, invited_by)
    VALUES (p_team_id, v_profile.id, 'member', auth.uid());

    RETURN jsonb_build_object('result', 'added');

  ELSE
    -- Invalidar invitaciones previas del mismo email en este equipo
    UPDATE team_invitations
    SET status = 'expired'
    WHERE team_id = p_team_id
      AND email   = p_email
      AND status  = 'pending';

    -- Crear nueva invitación
    INSERT INTO team_invitations (team_id, email, invited_by)
    VALUES (p_team_id, p_email, auth.uid())
    RETURNING token INTO v_inv_token;

    -- Nota: el email de invitación se envía desde una Edge Function (fuera de scope de esta RPC).
    -- La Edge Function debe suscribirse al evento de INSERT en team_invitations o ser llamada
    -- desde el cliente tras recibir el token.

    RETURN jsonb_build_object('result', 'invited', 'token', v_inv_token);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_to_team(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.invite_to_team(uuid, text) FROM PUBLIC, anon;


-- ── resend_invitation() ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resend_invitation(p_invitation_id uuid)
RETURNS uuid  -- nuevo token
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_inv   team_invitations%ROWTYPE;
  v_token uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_inv FROM team_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación no encontrada';
  END IF;

  IF NOT (is_team_admin(v_inv.team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE team_invitations
  SET token      = v_token,
      expires_at = now() + interval '7 days',
      status     = 'pending'
  WHERE id = p_invitation_id;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resend_invitation(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.resend_invitation(uuid) FROM PUBLIC, anon;


-- ── remove_team_member() ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_team_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_member_role text;
  v_admin_count int;
BEGIN
  IF NOT (is_team_admin(p_team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT role INTO v_member_role
  FROM team_members
  WHERE team_id = p_team_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario no es miembro de este equipo';
  END IF;

  -- Si se va a quitar a un admin, verificar que quede al menos 1
  IF v_member_role = 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM team_members
    WHERE team_id = p_team_id AND role = 'admin';

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'No se puede quitar al único administrador del equipo';
    END IF;
  END IF;

  DELETE FROM team_members
  WHERE team_id = p_team_id AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_team_member(uuid, uuid) FROM PUBLIC, anon;


-- ── set_team_member_role() ────────────────────────────────────────────────────
-- team-admin puede promover a miembro a admin o bajar a admin a miembro,
-- sin necesitar al super-admin. Invariante: siempre debe quedar al menos 1 admin.

CREATE OR REPLACE FUNCTION public.set_team_member_role(
  p_team_id uuid,
  p_user_id uuid,
  p_role    text    -- 'admin' | 'member'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_current_role text;
  v_admin_count  int;
BEGIN
  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Rol inválido: "%". Usar "admin" o "member"', p_role;
  END IF;

  IF NOT (is_team_admin(p_team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT role INTO v_current_role
  FROM team_members
  WHERE team_id = p_team_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario no es miembro de este equipo';
  END IF;

  -- Proteger el último admin
  IF p_role = 'member' AND v_current_role = 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM team_members
    WHERE team_id = p_team_id AND role = 'admin';

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Debe quedar al menos un administrador en el equipo';
    END IF;
  END IF;

  UPDATE team_members
  SET role = p_role
  WHERE team_id = p_team_id AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_team_member_role(uuid, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_team_member_role(uuid, uuid, text) FROM PUBLIC, anon;


-- ── handle_new_user() — extender con auto-join por invitación ─────────────────
-- IMPORTANTE: Esta función ya existe en producción y maneja la creación del profile.
-- Solo se agrega la lógica de auto-join DESPUÉS de la lógica existente.
-- El bloque de lógica existente se preserva intacto.
-- Verificar el cuerpo actual en Supabase Dashboard antes de aplicar.
--
-- El cuerpo completo se reconstruye aquí. Si la lógica de creación de profile
-- cambió desde la última revisión, ajustar el bloque EXISTING LOGIC antes de aplicar.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_inv team_invitations%ROWTYPE;
BEGIN
  -- ── LÓGICA EXISTENTE: crear profile ────────────────────────────────────────
  -- Preservar tal cual estaba. Si el cuerpo actual difiere, ajustar aquí.
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'therapist'
  )
  ON CONFLICT (id) DO NOTHING;
  -- ── FIN LÓGICA EXISTENTE ───────────────────────────────────────────────────

  -- ── NUEVO: auto-join por invitación pendiente ──────────────────────────────
  SELECT * INTO v_inv
  FROM team_invitations
  WHERE email      = NEW.email
    AND status     = 'pending'
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

-- handle_new_user es un trigger function — no se expone a usuarios.
-- El REVOKE ya estaba aplicado en migración anterior; no se necesita repetir.
-- Si no estaba, agregar:
-- REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
```

---

### Task 2 — Verificación post-deploy

```sql
-- Verificar que las 4 RPCs + función trigger existen
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname IN (
  'invite_to_team', 'resend_invitation',
  'remove_team_member', 'set_team_member_role', 'handle_new_user'
) AND pronamespace = 'public'::regnamespace;
-- Esperado: 5 filas

-- Verificar que handle_new_user sigue siendo trigger de auth.users
SELECT trigger_name, event_object_schema, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Debe seguir existiendo

-- Smoke test de invite_to_team como team-admin:
-- (autenticado como admin del equipo de prueba)
SELECT invite_to_team('<team_uuid>', 'email_sin_cuenta@test.com');
-- Debe devolver: {"result": "invited", "token": "<uuid>"}

SELECT invite_to_team('<team_uuid>', 'email_sin_cuenta@test.com');
-- Segunda llamada: debe devolver "invited" de nuevo (primera invitación quedó 'expired')

SELECT invite_to_team('<team_uuid>', 'email_sin_cuenta@test.com');
-- Si el equipo llega al límite, debe devolver "limit_reached"
```

---

## Decisiones de Diseño

### Por qué `handle_new_user` reconstruye el cuerpo completo en lugar de un ALTER

PostgreSQL no tiene `ALTER FUNCTION ... ADD CODE`. Para modificar el cuerpo de una función trigger existente se usa `CREATE OR REPLACE FUNCTION`. Esto requiere conocer el cuerpo actual completo. La historia incluye el cuerpo completo con un aviso explícito al dev de que debe verificar el cuerpo actual en Supabase Dashboard antes de aplicar, para no perder lógica que haya cambiado desde esta documentación.

### Por qué `invite_to_team` usa `ON CONFLICT DO NOTHING` en el INSERT de team_members

En el caso de auto-join (handle_new_user), existe una pequeña ventana de race condition: si el usuario se registra exactamente cuando un admin lo está agregando manualmente. `ON CONFLICT DO NOTHING` garantiza que no falla por clave duplicada.

### Por qué el envío de email de invitación no está en la RPC

Las RPCs son funciones PL/pgSQL que corren en el contexto de la base de datos. No pueden hacer requests HTTP (salvo vía `pg_net`, que requiere extensión adicional y añade complejidad). La arquitectura correcta para enviar emails con Resend es una Supabase Edge Function que se llama desde el cliente tras recibir el `token` devuelto por `invite_to_team`. Esto mantiene la separación de responsabilidades: la DB gestiona el estado, el cliente gestiona la UI, la Edge Function gestiona el email.

### Por qué el `LIMIT 1` en el auto-join de handle_new_user

Un email puede tener múltiples invitaciones activas si fue invitado a varios equipos. `LIMIT 1` procesa solo la primera (ordenada por `created_at DESC` implícitamente). Una mejora futura podría procesar todas las invitaciones pendientes en un loop. Para el MVP, una invitación es suficiente.

---

## Historia siguiente

**4.11 — Actualización de RPCs existentes + seed de admin_users**: `soft_delete_session()`, `create_quickdash_token()`, `create_exercise_plan_token()` actualizados para contexto de equipo. Migración de seed con los 3 UUIDs de super-admins reales.
