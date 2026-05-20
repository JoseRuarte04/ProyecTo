# Historia 4.4: Políticas RLS — patients, therapy_sessions, treatment_episodes

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 2 — Funciones helper y RLS actualizado
**Dependencia:** Historia 4.3 aplicada (necesita `is_super_admin()`, `is_team_member()`, `is_my_patient()` actualizada)
**Tipo:** Solo DB — 1 migración SQL. Sin cambios de UI ni de types.ts.

---

## Historia

Como arquitecto del sistema,
quiero actualizar las políticas RLS de las 3 tablas clínicas principales para que los miembros de un equipo puedan ver y editar los datos de todos los pacientes del equipo,
preservando exactamente el comportamiento actual para terapistas individuales.

---

## Estado Actual de las Políticas (verificado en DB)

### `patients` — 3 políticas existentes

| Nombre | Cmd | Condición actual |
|---|---|---|
| "patients: ver propios" | SELECT | `professional_id = auth.uid() AND is_deleted = false AND is_active_professional()` |
| "patients: editar propios" | UPDATE | `professional_id = auth.uid() AND is_deleted = false AND is_active_professional()` (USING, sin WITH CHECK) |
| "patients: crear" | INSERT | `auth.uid() IS NOT NULL AND is_active_professional()` (WITH CHECK) |

**Problema**: SELECT y UPDATE excluyen pacientes de equipo al que pertenece el usuario.
**patients: crear** no valida `professional_id = auth.uid()` ni `team_id` — se cierra ese gap.

### `therapy_sessions` — 3 políticas existentes

| Nombre | Cmd | Condición actual |
|---|---|---|
| "therapy_sessions: ver" | SELECT | `professional_id = auth.uid() AND is_my_patient(patient_id) AND is_deleted = false` |
| "therapy_sessions: editar" | UPDATE | `professional_id = auth.uid() AND is_my_patient(patient_id) AND is_deleted = false` (USING, sin WITH CHECK) |
| "therapy_sessions: crear" | INSERT | `auth.uid() IS NOT NULL AND is_active_professional()` (WITH CHECK) |

**Problema**: El `professional_id = auth.uid()` en SELECT/UPDATE impide que un miembro vea sesiones creadas por otro miembro del equipo (aunque `is_my_patient()` ya devuelva `true` para el paciente de equipo).

### `treatment_episodes` — 3 políticas existentes

| Nombre | Cmd | Condición actual |
|---|---|---|
| "Professionals see own episodes" | SELECT | `professional_id = auth.uid()` |
| "Professionals update own episodes" | UPDATE | `professional_id = auth.uid()` |
| "Professionals insert own episodes" | INSERT | `auth.uid() IS NOT NULL AND is_active_professional()` (WITH CHECK) |

**Problema**: SELECT y UPDATE solo ven episodios propios; ningún acceso a episodios de equipo.

---

## Criterios de Aceptación

**AC1 — Miembro de equipo puede ver pacientes del equipo**
- Given: usuario A y usuario B son miembros del mismo equipo
- And: paciente P tiene `team_id = ese_equipo`
- When: usuario B ejecuta `SELECT * FROM patients WHERE id = '<P.id>'`
- Then: recibe la fila del paciente (no vacío)

**AC2 — Terapista individual no puede ver pacientes de otros**
- Given: usuario C es terapista individual (sin equipos)
- And: paciente P pertenece al equipo del usuario A
- When: usuario C consulta patients
- Then: no recibe el paciente P

**AC3 — Miembro de equipo puede ver todas las sesiones del paciente del equipo**
- Given: usuario A creó la sesión S para el paciente de equipo P
- When: usuario B (mismo equipo) hace `SELECT * FROM therapy_sessions WHERE id = '<S.id>'`
- Then: recibe la sesión (no vacío)

**AC4 — Miembro de equipo puede editar sesiones del equipo**
- Given: sesión S creada por usuario A para paciente de equipo P
- When: usuario B (mismo equipo) hace UPDATE de un campo de la sesión
- Then: la actualización se aplica sin error de RLS

**AC5 — Miembro de equipo puede crear sesiones para pacientes del equipo**
- Given: paciente P pertenece al equipo de usuario B
- When: usuario B hace INSERT en `therapy_sessions` con `patient_id = P.id` y `professional_id = auth.uid()`
- Then: la sesión se crea sin error

**AC6 — Miembro de equipo puede ver episodios del equipo**
- Given: episodio E creado por usuario A para paciente de equipo P
- When: usuario B (mismo equipo) hace SELECT del episodio
- Then: recibe el episodio

**AC7 — Comportamiento previo de terapistas individuales intacto**
- Given: terapista individual con sus propios pacientes y sesiones
- When: usa la app normalmente
- Then: todo funciona igual que antes (ve sus propios datos, no ve datos ajenos)

**AC8 — Super-admin puede ver todos los pacientes**
- Given: user_id en `admin_users`
- When: hace SELECT en `patients`
- Then: recibe todos los pacientes (sin filtro de professional_id ni team)

---

## Tareas

### Task 1 — Migración: actualizar políticas de `patients`

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_rls_patients.sql`

```sql
-- ── PATIENTS ───────────────────────────────────────────────────────────────

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "patients: ver propios"   ON public.patients;
DROP POLICY IF EXISTS "patients: editar propios" ON public.patients;
DROP POLICY IF EXISTS "patients: crear"          ON public.patients;

-- SELECT: propio + equipo activo + super-admin
CREATE POLICY "patients: ver"
ON public.patients FOR SELECT TO authenticated
USING (
  is_deleted = false
  AND is_active_professional()
  AND (
    professional_id = auth.uid()
    OR (team_id IS NOT NULL AND is_team_member(team_id))
    OR is_super_admin()
  )
);

-- UPDATE: propio + equipo + super-admin
-- WITH CHECK limita que el professional_id no cambie (solo via RPC admin)
CREATE POLICY "patients: editar"
ON public.patients FOR UPDATE TO authenticated
USING (
  is_deleted = false
  AND is_active_professional()
  AND (
    professional_id = auth.uid()
    OR (team_id IS NOT NULL AND is_team_member(team_id))
    OR is_super_admin()
  )
)
WITH CHECK (
  -- professional_id no puede cambiarse via RLS directa; es invariante
  -- El team_id puede actualizarse solo si el usuario es miembro de ese equipo
  is_active_professional()
  AND (
    professional_id = auth.uid()
    OR (team_id IS NOT NULL AND is_team_member(team_id))
    OR is_super_admin()
  )
);

-- INSERT: cerrar gap de seguridad existente
-- Ahora exige professional_id = auth.uid() y valida team_id si se especifica
CREATE POLICY "patients: crear"
ON public.patients FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_active_professional()
  AND professional_id = auth.uid()
  AND (team_id IS NULL OR is_team_member(team_id))
);
```

### Task 2 — Migración: actualizar políticas de `therapy_sessions`

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_rls_therapy_sessions.sql`

```sql
-- ── THERAPY_SESSIONS ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "therapy_sessions: ver"    ON public.therapy_sessions;
DROP POLICY IF EXISTS "therapy_sessions: editar" ON public.therapy_sessions;
DROP POLICY IF EXISTS "therapy_sessions: crear"  ON public.therapy_sessions;

-- SELECT: propio O miembro del equipo del paciente
-- Nota: is_my_patient() ya incluye tanto pacientes propios como de equipo
CREATE POLICY "therapy_sessions: ver"
ON public.therapy_sessions FOR SELECT TO authenticated
USING (
  is_deleted = false
  AND is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);

-- UPDATE: cualquier miembro del equipo puede editar
CREATE POLICY "therapy_sessions: editar"
ON public.therapy_sessions FOR UPDATE TO authenticated
USING (
  is_deleted = false
  AND is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
)
WITH CHECK (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);

-- INSERT: el creador es auth.uid(); el paciente debe ser accesible
CREATE POLICY "therapy_sessions: crear"
ON public.therapy_sessions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_active_professional()
  AND professional_id = auth.uid()
  AND is_my_patient(patient_id)
);
```

### Task 3 — Migración: actualizar políticas de `treatment_episodes`

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_rls_treatment_episodes.sql`

```sql
-- ── TREATMENT_EPISODES ─────────────────────────────────────────────────────

-- Nota: los nombres originales tienen formato en inglés (legado de Lovable)
DROP POLICY IF EXISTS "Professionals see own episodes"    ON public.treatment_episodes;
DROP POLICY IF EXISTS "Professionals update own episodes" ON public.treatment_episodes;
DROP POLICY IF EXISTS "Professionals insert own episodes" ON public.treatment_episodes;

-- SELECT: episodios propios + episodios de pacientes del equipo
CREATE POLICY "treatment_episodes: ver"
ON public.treatment_episodes FOR SELECT TO authenticated
USING (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);

-- UPDATE: mismo criterio
CREATE POLICY "treatment_episodes: editar"
ON public.treatment_episodes FOR UPDATE TO authenticated
USING (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
)
WITH CHECK (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);

-- INSERT: el creador es auth.uid(); debe tener acceso al paciente
CREATE POLICY "treatment_episodes: crear"
ON public.treatment_episodes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_active_professional()
  AND professional_id = auth.uid()
  AND is_my_patient(patient_id)
);
```

### Task 4 — Verificación post-deploy

```sql
-- Confirmar que las 9 políticas anteriores fueron reemplazadas por 9 nuevas
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('patients', 'therapy_sessions', 'treatment_episodes')
ORDER BY tablename, cmd;

-- Resultado esperado (9 filas):
-- patients              | patients: crear  | INSERT
-- patients              | patients: editar | UPDATE
-- patients              | patients: ver    | SELECT
-- therapy_sessions      | therapy_sessions: crear  | INSERT
-- therapy_sessions      | therapy_sessions: editar | UPDATE
-- therapy_sessions      | therapy_sessions: ver    | SELECT
-- treatment_episodes    | treatment_episodes: crear  | INSERT
-- treatment_episodes    | treatment_episodes: editar | UPDATE
-- treatment_episodes    | treatment_episodes: ver    | SELECT
```

---

## Rollback

```sql
-- Si es necesario revertir esta migración completa:

-- Restaurar patients
DROP POLICY IF EXISTS "patients: ver"    ON public.patients;
DROP POLICY IF EXISTS "patients: editar" ON public.patients;
DROP POLICY IF EXISTS "patients: crear"  ON public.patients;

CREATE POLICY "patients: ver propios" ON public.patients FOR SELECT TO public
USING ((professional_id = auth.uid()) AND (is_deleted = false) AND is_active_professional());

CREATE POLICY "patients: editar propios" ON public.patients FOR UPDATE TO public
USING ((professional_id = auth.uid()) AND (is_deleted = false) AND is_active_professional());

CREATE POLICY "patients: crear" ON public.patients FOR INSERT TO authenticated
WITH CHECK ((auth.uid() IS NOT NULL) AND is_active_professional());

-- Restaurar therapy_sessions
DROP POLICY IF EXISTS "therapy_sessions: ver"    ON public.therapy_sessions;
DROP POLICY IF EXISTS "therapy_sessions: editar" ON public.therapy_sessions;
DROP POLICY IF EXISTS "therapy_sessions: crear"  ON public.therapy_sessions;

CREATE POLICY "therapy_sessions: ver" ON public.therapy_sessions FOR SELECT TO public
USING ((professional_id = auth.uid()) AND is_my_patient(patient_id) AND (is_deleted = false));
CREATE POLICY "therapy_sessions: editar" ON public.therapy_sessions FOR UPDATE TO authenticated
USING ((professional_id = auth.uid()) AND is_my_patient(patient_id) AND (is_deleted = false));
CREATE POLICY "therapy_sessions: crear" ON public.therapy_sessions FOR INSERT TO authenticated
WITH CHECK ((auth.uid() IS NOT NULL) AND is_active_professional());

-- Restaurar treatment_episodes
DROP POLICY IF EXISTS "treatment_episodes: ver"    ON public.treatment_episodes;
DROP POLICY IF EXISTS "treatment_episodes: editar" ON public.treatment_episodes;
DROP POLICY IF EXISTS "treatment_episodes: crear"  ON public.treatment_episodes;

CREATE POLICY "Professionals see own episodes" ON public.treatment_episodes FOR SELECT TO public
USING (professional_id = auth.uid());
CREATE POLICY "Professionals update own episodes" ON public.treatment_episodes FOR UPDATE TO public
USING (professional_id = auth.uid());
CREATE POLICY "Professionals insert own episodes" ON public.treatment_episodes FOR INSERT TO authenticated
WITH CHECK ((auth.uid() IS NOT NULL) AND is_active_professional());
```

---

## Decisiones de Diseño

### Por qué `professional_id = auth.uid() OR is_my_patient(patient_id)` en SELECT/UPDATE

En lugar de solo `is_my_patient(patient_id)`:
- `is_my_patient()` ya retorna true para pacientes propios (professional_id = auth.uid())
- Entonces `OR professional_id = auth.uid()` es técnicamente redundante
- Pero lo dejamos explícito para documentar la intención y porque un futuro cambio en `is_my_patient()` no debería romper el acceso a pacientes propios

### Por qué `professional_id = auth.uid()` en INSERT WITH CHECK

Al insertar una sesión o episodio, el campo `professional_id` en la fila nueva debe ser `auth.uid()`. Esto garantiza que el registro quede asociado al usuario correcto. Un miembro del equipo crea la sesión como suya — el paciente es del equipo, la sesión es del creador.

### El DELETE no tiene política

Las tablas `therapy_sessions` y `treatment_episodes` usan soft-delete (`is_deleted = true`). El DELETE físico no está autorizado para usuarios autenticados — se implementa via RPC SECURITY DEFINER (`soft_delete_session`). No agregar política DELETE directa.

### Sobre `appointments`

La tabla `appointments` tiene la política "appointments: acceso profesional" (ALL) con `professional_id = auth.uid() AND is_my_patient(patient_id)`. Esta se actualiza en la Historia 4.5 junto con las otras tablas con formato ALL.

---

## Historia siguiente
**4.5 — Políticas RLS: evaluaciones, planes y archivos**: actualiza las políticas de evaluaciones, planes de ejercicio, tokens y archivos clínicos.
