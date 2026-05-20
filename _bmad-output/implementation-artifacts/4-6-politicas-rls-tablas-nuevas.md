# Historia 4.6: Políticas RLS — teams, team_members, team_invitations, admin_users + audit_log

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 2 — Funciones helper y RLS actualizado (última historia de la fase)
**Dependencia:** Historia 4.3 aplicada (necesita `is_super_admin()`, `is_team_member()`, `is_team_admin()`)
**Tipo:** Solo DB — 1 migración SQL. Sin cambios de UI ni de types.ts.

---

## Historia

Como arquitecto del sistema,
quiero crear las políticas RLS para las 4 tablas nuevas del sistema de equipos y actualizar la política de lectura de `audit_log` para super-admins,
para que los datos de equipos e invitaciones estén protegidos con el mismo nivel de seguridad que las tablas clínicas.

---

## Estado Actual

Las tablas `teams`, `team_members`, `team_invitations` y `admin_users` fueron creadas en la Historia 4.1 con `ENABLE ROW LEVEL SECURITY` pero **sin ninguna política** — acceso bloqueado por defecto (deny-all). Esta historia agrega las políticas correctas.

`audit_log` tiene una política de lectura actual:
- "audit_log: ver propios" — SELECT — `performed_by = auth.uid()` (solo ves tus propias entradas)

Esta se reemplaza por una política que permite a super-admins ver todas las entradas.

---

## Criterios de Aceptación

**AC1 — Super-admin puede crear equipos**
- Given: user_id en `admin_users`
- When: hace INSERT en `teams` con `created_by = auth.uid()`
- Then: el INSERT se acepta

**AC2 — Terapista no puede crear equipos**
- Given: terapista activo no en `admin_users`
- When: intenta INSERT en `teams`
- Then: es rechazado por RLS

**AC3 — Miembro puede ver su propio equipo**
- Given: usuario A es miembro del equipo X
- When: hace SELECT en `teams WHERE id = X`
- Then: recibe el equipo

**AC4 — Admin del equipo puede ver todos sus miembros**
- Given: usuario A es admin del equipo X
- When: hace SELECT en `team_members WHERE team_id = X`
- Then: recibe todos los miembros (no solo a sí mismo)

**AC5 — Miembro solo puede verse a sí mismo**
- Given: usuario B es miembro (rol = 'member') del equipo X
- When: hace SELECT en `team_members WHERE team_id = X`
- Then: recibe solo su propia fila

**AC6 — Admin del equipo puede gestionar invitaciones (via RPC)**
- Given: usuario A es admin del equipo X
- When: INSERT en `team_invitations` con `team_id = X`
- Then: el INSERT se acepta

**AC7 — Miembro no puede crear invitaciones**
- Given: usuario B es miembro (no admin) del equipo X
- When: intenta INSERT en `team_invitations`
- Then: es rechazado por RLS

**AC8 — Super-admin ve todas las entradas de audit_log**
- Given: user_id en `admin_users`
- When: hace SELECT en `audit_log`
- Then: recibe todas las filas (de todos los usuarios)

**AC9 — Terapista solo ve sus propias entradas de audit_log**
- Given: terapista no en `admin_users`
- When: hace SELECT en `audit_log`
- Then: solo recibe filas donde `performed_by = auth.uid()`

---

## Tareas

### Task 1 — Migración única con todas las políticas

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_rls_tablas_nuevas.sql`

```sql
-- ── TEAMS ──────────────────────────────────────────────────────────────────

-- SELECT: super-admin ve todos; miembros ven solo sus equipos
CREATE POLICY "teams: ver"
ON public.teams FOR SELECT TO authenticated
USING (is_super_admin() OR is_team_member(id));

-- INSERT: solo super-admin puede crear equipos
CREATE POLICY "teams: crear"
ON public.teams FOR INSERT TO authenticated
WITH CHECK (is_super_admin() AND created_by = auth.uid());

-- UPDATE: solo super-admin puede editar equipos (cambiar nombre, member_limit, is_active)
CREATE POLICY "teams: editar"
ON public.teams FOR UPDATE TO authenticated
USING (is_super_admin());

-- DELETE: solo super-admin (preferir soft-delete via is_active = false)
CREATE POLICY "teams: eliminar"
ON public.teams FOR DELETE TO authenticated
USING (is_super_admin());


-- ── TEAM_MEMBERS ───────────────────────────────────────────────────────────
-- Nota sobre interacción de políticas FOR ALL + FOR SELECT:
-- PostgreSQL ORea las políticas PERMISSIVE para el mismo comando.
-- "team_members: gestionar" cubre ALL (incluyendo SELECT).
-- "team_members: ver" amplía SELECT para que miembros se vean a sí mismos.
-- El resultado efectivo en SELECT es la unión de ambas condiciones.

-- SELECT ampliado: super-admin ve todo; admin ve su equipo; miembro se ve a sí mismo
CREATE POLICY "team_members: ver"
ON public.team_members FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR user_id = auth.uid()
  OR is_team_admin(team_id)
);

-- ALL (INSERT / UPDATE / DELETE): solo super-admin y admin del equipo
-- Las RPCs invite_to_team, remove_team_member, set_team_member_role usan
-- SECURITY DEFINER — no pasan por esta política. Esta política protege
-- el acceso directo vía cliente.
CREATE POLICY "team_members: gestionar"
ON public.team_members FOR ALL TO authenticated
USING (is_super_admin() OR is_team_admin(team_id))
WITH CHECK (is_super_admin() OR is_team_admin(team_id));


-- ── TEAM_INVITATIONS ───────────────────────────────────────────────────────

-- SELECT: super-admin ve todas; admin del equipo ve las de su equipo; invitador ve las suyas
CREATE POLICY "team_invitations: ver"
ON public.team_invitations FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR is_team_admin(team_id)
  OR invited_by = auth.uid()
);

-- INSERT: super-admin o admin del equipo pueden crear invitaciones
-- (en la práctica se hace via RPC invite_to_team, pero el acceso directo queda protegido)
CREATE POLICY "team_invitations: crear"
ON public.team_invitations FOR INSERT TO authenticated
WITH CHECK (
  (is_super_admin() OR is_team_admin(team_id))
  AND invited_by = auth.uid()
);

-- UPDATE: solo super-admin o admin del equipo pueden cambiar status/token (reenvío)
CREATE POLICY "team_invitations: actualizar"
ON public.team_invitations FOR UPDATE TO authenticated
USING (is_super_admin() OR is_team_admin(team_id));


-- ── ADMIN_USERS ────────────────────────────────────────────────────────────
-- Solo super-admins pueden ver la tabla (no pueden auto-insertarse)
-- Los seeds se hacen via migración con service role, no via cliente

CREATE POLICY "admin_users: ver"
ON public.admin_users FOR SELECT TO authenticated
USING (is_super_admin());


-- ── AUDIT_LOG: ampliar lectura para super-admin ────────────────────────────
-- Política actual: "audit_log: ver propios" — performed_by = auth.uid()
-- Nueva: super-admin ve todo; resto solo sus propias entradas

DROP POLICY IF EXISTS "audit_log: ver propios" ON public.audit_log;

CREATE POLICY "audit_log: ver"
ON public.audit_log FOR SELECT TO authenticated
USING (is_super_admin() OR performed_by = auth.uid());
```

### Task 2 — Verificación post-deploy

```sql
-- Verificar que las 4 tablas nuevas tienen sus políticas
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('teams', 'team_members', 'team_invitations', 'admin_users')
ORDER BY tablename, cmd;

-- Resultado esperado:
-- admin_users       | admin_users: ver          | SELECT
-- team_invitations  | team_invitations: crear    | INSERT
-- team_invitations  | team_invitations: actualizar | UPDATE
-- team_invitations  | team_invitations: ver      | SELECT
-- team_members      | team_members: gestionar   | ALL
-- team_members      | team_members: ver         | SELECT
-- teams             | teams: crear              | INSERT
-- teams             | teams: editar             | UPDATE
-- teams             | teams: eliminar           | DELETE
-- teams             | teams: ver                | SELECT

-- Verificar audit_log
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_log';
-- Debe existir "audit_log: ver" y NO debe existir "audit_log: ver propios"
```

---

## Decisiones de Diseño

### Por qué no hay política INSERT en `admin_users`

Los 3 super-admins se insertan vía migración SQL (Historia 4.11 — seed de bootstrap) que corre con privilegios de servicio, no como usuario autenticado. Agregar una política INSERT permitiría que un super-admin se auto-registre más admins vía cliente — eso debe hacerse via migración controlada o via Supabase Studio para mantener la lista auditada.

### Por qué team_members tiene dos políticas para SELECT

PostgreSQL permite múltiples políticas PERMISSIVE — todas se evalúan con OR. Tener `team_members: gestionar` (ALL) y `team_members: ver` (SELECT) separados permite:
- El admin puede hacer SELECT gracias a `is_team_admin(team_id)` en ambas políticas
- El miembro puede hacer SELECT solo de su propia fila (`user_id = auth.uid()`) gracias a "team_members: ver"
- El miembro NO puede INSERT/UPDATE/DELETE (la política "gestionar" lo bloquea, y no hay otra política que lo permita)

### Por qué las RPCs (SECURITY DEFINER) aún funcionan aunque los usuarios no puedan acceder directo

Las RPCs `invite_to_team`, `remove_team_member`, `set_team_member_role` son `SECURITY DEFINER` — corren como `postgres` y bypasan RLS. Las políticas de `team_members` protegen el acceso **directo desde el cliente** (`.from('team_members').insert()`). Las RPCs tienen su propia lógica de autorización interna.

### Por qué audit_log no tiene política DELETE

El audit log es append-only. Nadie, ni el super-admin, debería poder borrar entradas de auditoría. La ausencia de política DELETE (con RLS habilitado) garantiza deny-all para DELETE.

---

## Hito: Fase 2 completada

Con esta historia aplicada, la Fase 2 está completa. El sistema ahora tiene:

✅ Funciones helper: `is_super_admin()`, `is_team_member()`, `is_team_admin()`
✅ `is_my_patient()` actualizada con lógica de equipos
✅ Todas las tablas clínicas (patients, sessions, episodes, evaluaciones, planes, archivos) con acceso de equipo
✅ Tablas nuevas de equipos con políticas correctas
✅ Super-admin con acceso de lectura a audit_log

**Prueba de integración de la Fase 2 completa** (ejecutar con dos usuarios de prueba en el mismo equipo):
1. Crear un equipo en `teams` (via Supabase Studio, con service role)
2. Agregar dos usuarios a `team_members`
3. Asignar un paciente de prueba a ese equipo (`patients.team_id = equipo`)
4. Con usuario A: crear una sesión para el paciente
5. Con usuario B: verificar que puede ver la sesión de A
6. Con usuario C (sin equipo): verificar que NO puede ver el paciente ni la sesión

---

## Historia siguiente
**4.7 — Auditoría extendida con triggers**: extiende `insert_audit_log()` con `changes jsonb` y agrega triggers UPDATE para capturar cambios antes/después en tablas clínicas principales.
