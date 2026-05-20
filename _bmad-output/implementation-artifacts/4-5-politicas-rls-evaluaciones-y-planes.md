# Historia 4.5: Políticas RLS — Evaluaciones, Planes, Tokens y Archivos

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 2 — Funciones helper y RLS actualizado
**Dependencia:** Historia 4.3 aplicada (funciones helper disponibles)
**Tipo:** Solo DB — múltiples migraciones SQL. Sin cambios de UI ni de types.ts.

---

## Historia

Como arquitecto del sistema,
quiero actualizar las políticas RLS de todas las tablas clínicas secundarias para que los miembros de equipo puedan ver y editar los datos completos de los pacientes del equipo,
manteniendo intacto el acceso individual y los controles de ownership en operaciones de escritura.

---

## Estado Actual de las Políticas (verificado en DB)

### Tablas con política FOR ALL que bloquean acceso de equipo

Estas tablas tienen una sola política FOR ALL con `professional_id = auth.uid()` como condición principal. Esto bloquea que miembros del equipo lean registros creados por otros miembros. **Se deben dividir en SELECT / INSERT / UPDATE separados.**

| Tabla | Nombre política actual | Condición bloqueante |
|---|---|---|
| `analytical_evaluations` | "analytical_evals: acceso profesional" | `professional_id = auth.uid() AND is_my_patient(patient_id)` |
| `functional_evaluations` | "functional_evals: acceso profesional" | `professional_id = auth.uid() AND is_my_patient(patient_id)` |
| `appointments` | "appointments: acceso profesional" | `professional_id = auth.uid() AND is_my_patient(patient_id)` |
| `exercise_plans` | "terapeutas acceden a sus planes de ejercicios" | `professional_id = auth.uid()` |
| `exercise_plan_items` | "terapeutas acceden a items de sus planes" | subquery `exercise_plans.professional_id = auth.uid()` |
| `exercise_plan_tokens` | "terapeutas acceden a sus tokens de plan" | `professional_id = auth.uid()` |

### Tablas con ajuste puntual (no ALL)

| Tabla | Nombre política actual | Ajuste necesario |
|---|---|---|
| `quickdash_tokens` | "quickdash_tokens: select propio" (SELECT) | Agregar `OR is_my_patient(patient_id)` |
| `clinical_files` | "clinical_files: ver" (SELECT) | Quitar `uploaded_by = auth.uid()` de USING |
| `clinical_files` | "clinical_files: crear" (INSERT) | Agregar `AND is_my_patient(patient_id)` en WITH CHECK |
| `treatment_plans` | "treatment_plans: ver" / "editar" | Quitar `professional_id = auth.uid()` de USING |
| `treatment_plan_exercises` | "plan_exercises: acceso profesional" | Actualizar subquery para incluir equipo |

### Sin cambios en esta historia

| Tabla | Motivo |
|---|---|
| `patient_clinical_records` | Ya se beneficia de `is_my_patient()` actualizada en 4.3 ✅ |
| `patient_occupational_profiles` | Ídem ✅ |
| `clinical_files: editar/eliminar` | Se mantiene `uploaded_by = auth.uid()` — solo el uploader edita/borra sus archivos |
| `quickdash_tokens: insert/update` | `created_by = auth.uid()` — correcto, el creador es el actual |

---

## Criterios de Aceptación

**AC1 — Miembro de equipo ve evaluaciones analíticas de otros miembros para el paciente del equipo**
- Given: usuario A creó una evaluación analítica para el paciente de equipo P
- When: usuario B (mismo equipo) hace SELECT sobre `analytical_evaluations` para ese paciente
- Then: recibe la evaluación

**AC2 — Solo el creador puede hacer INSERT de evaluaciones con su professional_id**
- Given: usuario B hace INSERT en `analytical_evaluations` con `professional_id = auth.uid()` y `patient_id` de un paciente de su equipo
- Then: el INSERT se acepta

- Given: usuario B intenta INSERT con `professional_id = '<uuid_de_A>'`
- Then: el INSERT es rechazado por RLS

**AC3 — Miembro de equipo ve planes de ejercicio del equipo**
- Given: usuario A creó un plan de ejercicio para paciente de equipo P
- When: usuario B (mismo equipo) consulta `exercise_plans`
- Then: recibe el plan de A

**AC4 — Miembro de equipo ve los ítems del plan de equipo**
- Given: plan de ejercicio del equipo con ítems
- When: usuario B (mismo equipo) consulta `exercise_plan_items` del plan
- Then: recibe los ítems

**AC5 — Miembro de equipo ve tokens de ejercicio del equipo**
- Given: token de plan creado por usuario A para paciente de equipo P
- When: usuario B (mismo equipo) consulta `exercise_plan_tokens`
- Then: recibe el token

**AC6 — Miembro de equipo ve tokens de quickdash del equipo**
- Given: token de quickdash creado por usuario A para paciente de equipo P
- When: usuario B (mismo equipo) consulta `quickdash_tokens`
- Then: recibe el token

**AC7 — Miembro de equipo ve archivos clínicos de otros miembros del equipo**
- Given: usuario A subió un archivo para paciente de equipo P
- When: usuario B (mismo equipo) consulta `clinical_files` para ese paciente
- Then: recibe el archivo de A

**AC8 — Solo el uploader puede editar o eliminar sus archivos**
- Given: usuario A subió un archivo
- When: usuario B (mismo equipo) intenta UPDATE o DELETE de ese archivo
- Then: es rechazado por RLS

**AC9 — Comportamiento individual intacto en todas las tablas**
- Given: terapista individual (sin equipos) con sus propios datos
- When: usa la app normalmente
- Then: ve y edita solo sus propios datos — sin cambios respecto al comportamiento anterior

---

## Tareas

### Task 1 — Migración: analytical_evaluations y functional_evaluations

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_rls_evaluaciones.sql`

```sql
-- ── ANALYTICAL_EVALUATIONS ─────────────────────────────────────────────────
-- Dividir la política ALL en SELECT/INSERT/UPDATE separados

DROP POLICY IF EXISTS "analytical_evals: acceso profesional" ON public.analytical_evaluations;

-- SELECT: cualquier miembro del equipo puede ver evaluaciones del paciente del equipo
CREATE POLICY "analytical_evals: ver"
ON public.analytical_evaluations FOR SELECT TO authenticated
USING (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);

-- INSERT: el creador es auth.uid(); el paciente debe ser accesible
CREATE POLICY "analytical_evals: crear"
ON public.analytical_evaluations FOR INSERT TO authenticated
WITH CHECK (
  is_active_professional()
  AND professional_id = auth.uid()
  AND is_my_patient(patient_id)
);

-- UPDATE: cualquier miembro del equipo puede editar evaluaciones del equipo
CREATE POLICY "analytical_evals: editar"
ON public.analytical_evaluations FOR UPDATE TO authenticated
USING (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
)
WITH CHECK (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);

-- ── FUNCTIONAL_EVALUATIONS ─────────────────────────────────────────────────
-- Mismo patrón que analytical_evaluations

DROP POLICY IF EXISTS "functional_evals: acceso profesional" ON public.functional_evaluations;

CREATE POLICY "functional_evals: ver"
ON public.functional_evaluations FOR SELECT TO authenticated
USING (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);

CREATE POLICY "functional_evals: crear"
ON public.functional_evaluations FOR INSERT TO authenticated
WITH CHECK (
  is_active_professional()
  AND professional_id = auth.uid()
  AND is_my_patient(patient_id)
);

CREATE POLICY "functional_evals: editar"
ON public.functional_evaluations FOR UPDATE TO authenticated
USING (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
)
WITH CHECK (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);
```

### Task 2 — Migración: treatment_plans y treatment_plan_exercises

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_rls_treatment_plans.sql`

```sql
-- ── TREATMENT_PLANS ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "treatment_plans: ver"    ON public.treatment_plans;
DROP POLICY IF EXISTS "treatment_plans: editar" ON public.treatment_plans;
DROP POLICY IF EXISTS "treatment_plans: crear"  ON public.treatment_plans;

-- SELECT: propio + equipo (incluir is_deleted = false en USING)
CREATE POLICY "treatment_plans: ver"
ON public.treatment_plans FOR SELECT TO authenticated
USING (
  is_active_professional()
  AND is_deleted = false
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);

-- UPDATE: cualquier miembro del equipo puede editar
CREATE POLICY "treatment_plans: editar"
ON public.treatment_plans FOR UPDATE TO authenticated
USING (
  is_active_professional()
  AND is_deleted = false
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
)
WITH CHECK (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);

-- INSERT: creador es auth.uid()
CREATE POLICY "treatment_plans: crear"
ON public.treatment_plans FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_active_professional()
  AND professional_id = auth.uid()
  AND is_my_patient(patient_id)
);

-- ── TREATMENT_PLAN_EXERCISES ───────────────────────────────────────────────
-- La subquery debe incluir pacientes de equipo para acceder a los ejercicios del plan

DROP POLICY IF EXISTS "plan_exercises: acceso profesional" ON public.treatment_plan_exercises;

CREATE POLICY "plan_exercises: acceso profesional"
ON public.treatment_plan_exercises FOR ALL TO authenticated
USING (
  is_active_professional()
  AND EXISTS (
    SELECT 1 FROM treatment_plans tp
    WHERE tp.id = treatment_plan_exercises.treatment_plan_id
      AND tp.is_deleted = false
      AND (tp.professional_id = auth.uid() OR is_my_patient(tp.patient_id))
  )
)
WITH CHECK (
  is_active_professional()
  AND EXISTS (
    SELECT 1 FROM treatment_plans tp
    WHERE tp.id = treatment_plan_exercises.treatment_plan_id
      AND tp.is_deleted = false
      AND (tp.professional_id = auth.uid() OR is_my_patient(tp.patient_id))
  )
);
```

### Task 3 — Migración: exercise_plans, exercise_plan_items, exercise_plan_tokens

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_rls_exercise_plans.sql`

```sql
-- ── EXERCISE_PLANS ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "terapeutas acceden a sus planes de ejercicios" ON public.exercise_plans;

-- SELECT: propio + equipo (exercise_plans no tiene is_deleted — sin ese filtro)
CREATE POLICY "exercise_plans: ver"
ON public.exercise_plans FOR SELECT TO authenticated
USING (professional_id = auth.uid() OR is_my_patient(patient_id));

-- INSERT: creador es auth.uid()
CREATE POLICY "exercise_plans: crear"
ON public.exercise_plans FOR INSERT TO authenticated
WITH CHECK (
  is_active_professional()
  AND professional_id = auth.uid()
  AND is_my_patient(patient_id)
);

-- UPDATE: cualquier miembro del equipo puede editar el plan
CREATE POLICY "exercise_plans: editar"
ON public.exercise_plans FOR UPDATE TO authenticated
USING (professional_id = auth.uid() OR is_my_patient(patient_id))
WITH CHECK (professional_id = auth.uid() OR is_my_patient(patient_id));

-- ── EXERCISE_PLAN_ITEMS ────────────────────────────────────────────────────
-- La subquery del plan debe incluir pacientes de equipo

DROP POLICY IF EXISTS "terapeutas acceden a items de sus planes" ON public.exercise_plan_items;

CREATE POLICY "exercise_plan_items: acceso"
ON public.exercise_plan_items FOR ALL TO authenticated
USING (
  plan_id IN (
    SELECT id FROM exercise_plans
    WHERE professional_id = auth.uid() OR is_my_patient(patient_id)
  )
)
WITH CHECK (
  plan_id IN (
    SELECT id FROM exercise_plans
    WHERE professional_id = auth.uid() OR is_my_patient(patient_id)
  )
);

-- ── EXERCISE_PLAN_TOKENS ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "terapeutas acceden a sus tokens de plan" ON public.exercise_plan_tokens;

-- SELECT: propio + equipo
CREATE POLICY "exercise_plan_tokens: ver"
ON public.exercise_plan_tokens FOR SELECT TO authenticated
USING (professional_id = auth.uid() OR is_my_patient(patient_id));

-- INSERT: creador es auth.uid()
CREATE POLICY "exercise_plan_tokens: crear"
ON public.exercise_plan_tokens FOR INSERT TO authenticated
WITH CHECK (
  is_active_professional()
  AND professional_id = auth.uid()
  AND is_my_patient(patient_id)
);

-- UPDATE: propio + equipo (para revocar tokens)
CREATE POLICY "exercise_plan_tokens: editar"
ON public.exercise_plan_tokens FOR UPDATE TO authenticated
USING (professional_id = auth.uid() OR is_my_patient(patient_id))
WITH CHECK (professional_id = auth.uid() OR is_my_patient(patient_id));
```

### Task 4 — Migración: quickdash_tokens (SELECT), clinical_files (SELECT + INSERT), appointments

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_rls_tokens_y_archivos.sql`

```sql
-- ── QUICKDASH_TOKENS: solo ajuste en SELECT ────────────────────────────────
-- INSERT y UPDATE permanecen con created_by = auth.uid() (correcto)

DROP POLICY IF EXISTS "quickdash_tokens: select propio" ON public.quickdash_tokens;

CREATE POLICY "quickdash_tokens: ver"
ON public.quickdash_tokens FOR SELECT TO authenticated
USING (created_by = auth.uid() OR is_my_patient(patient_id));

-- INSERT y UPDATE no cambian — mantienen "quickdash_tokens: insert" y "quickdash_tokens: update propio"

-- ── CLINICAL_FILES ─────────────────────────────────────────────────────────
-- SELECT: miembros del equipo pueden ver archivos de pacientes del equipo
-- (eliminar restricción uploaded_by = auth.uid() del SELECT)
-- INSERT: agregar validación de is_my_patient(patient_id)
-- UPDATE/DELETE: sin cambios (solo el uploader puede modificar/eliminar sus archivos)

DROP POLICY IF EXISTS "clinical_files: ver"   ON public.clinical_files;
DROP POLICY IF EXISTS "clinical_files: crear" ON public.clinical_files;

CREATE POLICY "clinical_files: ver"
ON public.clinical_files FOR SELECT TO authenticated
USING (
  is_active_professional()
  AND is_deleted = false
  AND (uploaded_by = auth.uid() OR is_my_patient(patient_id))
);

CREATE POLICY "clinical_files: crear"
ON public.clinical_files FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_active_professional()
  AND uploaded_by = auth.uid()
  AND is_my_patient(patient_id)
);

-- ── APPOINTMENTS ───────────────────────────────────────────────────────────
-- Dividir la política ALL en SELECT/INSERT/UPDATE

DROP POLICY IF EXISTS "appointments: acceso profesional" ON public.appointments;

CREATE POLICY "appointments: ver"
ON public.appointments FOR SELECT TO authenticated
USING (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);

CREATE POLICY "appointments: crear"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  is_active_professional()
  AND professional_id = auth.uid()
  AND is_my_patient(patient_id)
);

CREATE POLICY "appointments: editar"
ON public.appointments FOR UPDATE TO authenticated
USING (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
)
WITH CHECK (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
);
```

### Task 5 — Verificación post-deploy

```sql
-- Confirmar políticas de todas las tablas modificadas
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'analytical_evaluations', 'functional_evaluations',
    'treatment_plans', 'treatment_plan_exercises',
    'exercise_plans', 'exercise_plan_items', 'exercise_plan_tokens',
    'quickdash_tokens', 'clinical_files', 'appointments'
  )
ORDER BY tablename, cmd;

-- No deben existir políticas con nombres antiguos:
-- "analytical_evals: acceso profesional"
-- "functional_evals: acceso profesional"
-- "terapeutas acceden a sus planes de ejercicios"
-- "terapeutas acceden a items de sus planes"
-- "terapeutas acceden a sus tokens de plan"
-- "quickdash_tokens: select propio"
-- "appointments: acceso profesional"
```

---

## Rollback

Cada migración es independiente. Si es necesario revertir una tabla en particular, recrear la política anterior con su nombre y condición exacta (los nombres originales están documentados en la sección "Estado Actual" al inicio de esta historia).

---

## Decisiones de Diseño

### Por qué exercise_plan_items mantiene FOR ALL

`exercise_plan_items` no tiene `professional_id` ni `patient_id` directamente — solo tiene `plan_id`. La política via subquery `plan_id IN (SELECT id FROM exercise_plans WHERE ...)` ya es selectiva. Mantener FOR ALL aquí es correcto y más simple que dividir en SELECT/INSERT/UPDATE cuando la condición es la misma para todas las operaciones.

### Por qué clinical_files editar/eliminar mantiene `uploaded_by = auth.uid()`

Un miembro del equipo puede ver archivos subidos por un colega, pero no puede editarlos ni borrarlos. Este control de ownership en UPDATE/DELETE es una regla de negocio explícita: cada profesional es responsable de sus propios archivos clínicos.

### Por qué quickdash_tokens INSERT/UPDATE no cambian

Los tokens de quickdash son creados por un terapeuta específico y vinculados a su identidad. `created_by = auth.uid()` en INSERT y UPDATE es correcto: cualquier miembro del equipo que quiera enviar un quickdash a un paciente del equipo lo hace como sí mismo (created_by = su UID). La RPC `create_quickdash_token` se actualiza en la Historia 4.11 para validar acceso al episodio via equipo.

---

## Historia siguiente
**4.6 — Políticas RLS tablas nuevas**: crea las políticas para `teams`, `team_members`, `team_invitations`, `admin_users` y actualiza `audit_log` para lectura de super-admin.
