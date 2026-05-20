# Historia 4.3: Funciones Helper RLS — is_super_admin, is_team_member, is_team_admin + actualización de is_my_patient

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 2 — Funciones helper y RLS actualizado (primera historia de la fase)
**Dependencia:** Historias 4.1 y 4.2 aplicadas en DB (necesita tablas `admin_users`, `team_members`, `teams`, `patients.team_id`)
**Tipo:** Solo DB — 1 migración SQL. Sin cambios de UI ni de types.ts.

---

## Historia

Como arquitecto del sistema,
quiero crear las funciones helper de autorización y actualizar `is_my_patient()` con lógica de equipos,
para que las políticas RLS de las historias 4.4–4.6 puedan usarlas como base y el acceso a pacientes de equipo funcione correctamente.

---

## Por qué esta historia es la más crítica de la Fase 2

`is_my_patient(uuid)` es usada por **8 políticas RLS activas** en producción:

| Tabla | Política |
|---|---|
| `patient_clinical_records` | "clinical_records: acceso profesional" (ALL) |
| `patient_occupational_profiles` | "occupational_profiles: acceso profesional" (ALL) |
| `clinical_files` | "clinical_files: ver" (SELECT) |
| `clinical_files` | "clinical_files: editar" (UPDATE) |
| `clinical_files` | "clinical_files: eliminar" (DELETE) |
| `therapy_sessions` | "therapy_sessions: ver" (SELECT) |
| `therapy_sessions` | "therapy_sessions: editar" (UPDATE) |
| `treatment_plans` | "treatment_plans: ver" (SELECT) |
| `treatment_plans` | "treatment_plans: editar" (UPDATE) |

Al actualizar `is_my_patient()`, las políticas de `patient_clinical_records` y `patient_occupational_profiles` ya heredan acceso de equipo automáticamente (porque solo usan `is_my_patient()`). Las demás tablas tienen `professional_id = auth.uid()` adicional que se resuelve en las historias 4.4 y 4.5.

**Efecto en producción inmediato tras aplicar esta migración:**
- Terapistas individuales: cero cambio (is_my_patient devuelve lo mismo para `team_id = NULL`)
- Miembros de equipo: ganan acceso a `patient_clinical_records` y `patient_occupational_profiles` de pacientes del equipo ✅

---

## Criterios de Aceptación

**AC1 — Tres nuevas funciones creadas**
- Given: se aplica la migración
- When: se consulta `pg_proc` por nombre
- Then: existen `public.is_super_admin()`, `public.is_team_member(uuid)`, `public.is_team_admin(uuid)` con `SECURITY INVOKER` y `STABLE`
- And: `GRANT EXECUTE TO authenticated` / `REVOKE FROM PUBLIC, anon` para las 3

**AC2 — is_my_patient actualizada con lógica de equipos**
- Given: existe un paciente con `team_id NOT NULL` y el usuario actual es miembro de ese equipo
- When: se ejecuta `SELECT is_my_patient('<patient_id>')` como ese usuario
- Then: devuelve `true`

- Given: el mismo usuario y un paciente de `team_id` de otro equipo al que NO pertenece
- When: se ejecuta `SELECT is_my_patient('<otro_patient_id>')`
- Then: devuelve `false`

- Given: un terapista individual (sin equipos) y su propio paciente con `team_id = NULL`
- When: se ejecuta `SELECT is_my_patient('<su_patient_id>')`
- Then: devuelve `true` (comportamiento anterior preservado)

**AC3 — Terapistas individuales sin impacto**
- Given: un terapista que no pertenece a ningún equipo
- When: usa la app normalmente (listar pacientes, ver sesiones, editar registros clínicos)
- Then: todo funciona exactamente igual que antes de la migración

**AC4 — is_super_admin funciona con admin_users**
- Given: un user_id está en `admin_users`
- When: se ejecuta `SELECT is_super_admin()` como ese usuario
- Then: devuelve `true`

- Given: un user_id NO está en `admin_users`
- When: se ejecuta `SELECT is_super_admin()`
- Then: devuelve `false`

---

## Tareas

### Task 1 — Migración única con las 4 funciones

Archivo: `supabase/migrations/YYYYMMDDHHMMSS_rls_helper_functions.sql`

> **IMPORTANTE**: Ejecutar en una sola migración para que sea atómica. Si falla cualquier parte, no queda la función a medio actualizar.

```sql
-- ── 1. Función: is_super_admin() ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$;

-- ── 2. Función: is_team_member(uuid) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = auth.uid()
  );
$$;

-- ── 3. Función: is_team_admin(uuid) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ── 4. Actualizar is_my_patient() con lógica de equipos ──────────────────
-- Versión anterior: solo checkeaba professional_id = auth.uid()
-- Versión nueva: también permite acceso si el paciente tiene team_id y el
-- usuario autenticado es miembro activo de ese equipo
CREATE OR REPLACE FUNCTION public.is_my_patient(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM patients p
    JOIN profiles pr ON pr.id = p.professional_id
    WHERE p.id          = p_patient_id
      AND p.is_deleted  = false
      AND pr.is_active  = true
      AND (
        -- Caso 1: paciente individual propio (comportamiento original)
        p.professional_id = auth.uid()
        OR
        -- Caso 2: paciente de un equipo activo al que pertenezco
        (
          p.team_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM team_members tm
            JOIN teams t ON t.id = tm.team_id
            WHERE tm.team_id = p.team_id
              AND tm.user_id = auth.uid()
              AND t.is_active = true
          )
        )
      )
  );
$$;

-- ── 5. GRANTs y REVOKEs ───────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.is_super_admin()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid)    TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_super_admin()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid)   FROM PUBLIC, anon;

-- is_my_patient ya tenía GRANT/REVOKE correcto en migraciones anteriores, no cambiar.
```

### Task 2 — Rollback SQL (documentar en comentario de la migración)

Incluir al inicio del archivo como comentario:

```sql
-- ROLLBACK (ejecutar solo si es necesario revertir):
-- CREATE OR REPLACE FUNCTION public.is_my_patient(p_patient_id uuid)
-- RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO public AS $$
--   SELECT EXISTS (
--     SELECT 1 FROM patients p
--     JOIN profiles pr ON pr.id = p.professional_id
--     WHERE p.id = p_patient_id
--       AND p.professional_id = auth.uid()
--       AND p.is_deleted = false
--       AND pr.is_active = true
--   );
-- $$;
-- DROP FUNCTION IF EXISTS public.is_super_admin();
-- DROP FUNCTION IF EXISTS public.is_team_member(uuid);
-- DROP FUNCTION IF EXISTS public.is_team_admin(uuid);
```

### Task 3 — Verificación post-deploy

Ejecutar estas queries en Supabase SQL Editor para validar antes de continuar con la Historia 4.4:

```sql
-- Verificar que las 4 funciones existen con los atributos correctos
SELECT proname, prosecdef, provolatile
FROM pg_proc
WHERE proname IN ('is_super_admin', 'is_team_member', 'is_team_admin', 'is_my_patient')
  AND pronamespace = 'public'::regnamespace;
-- Esperado: 4 filas, prosecdef = false (SECURITY INVOKER), provolatile = 's' (STABLE)

-- Verificar que un terapista individual no ve más de lo que debería
-- (ejecutar en SQL Editor mientras autenticado como un terapista de prueba sin equipo)
SELECT COUNT(*) FROM patients WHERE is_deleted = false;
-- Debe devolver solo sus propios pacientes
```

---

## Contexto Técnico Clave

### Por qué SECURITY INVOKER (no DEFINER)
Estas funciones deben ejecutarse en el contexto del usuario que llama, para que `auth.uid()` retorne el UUID correcto. Con `SECURITY DEFINER` correrían como `postgres` y `auth.uid()` podría no estar disponible correctamente.

### Por qué STABLE (no VOLATILE)
`STABLE` permite a PostgreSQL cachear el resultado durante la misma transacción, lo cual es esencial para el rendimiento de RLS (cada fila evaluada llama a estas funciones). `VOLATILE` las llamaría para cada fila sin cache.

### El riesgo de `is_my_patient` y cómo mitigarlo
Esta es la función más crítica — cambia el comportamiento de 9 políticas. Antes de aplicar en producción:
1. Aplicar en un Supabase branch si está disponible
2. Verificar con un usuario de prueba sin equipo que solo ve sus propios pacientes
3. Tener el SQL de rollback listo

### Índices que soportan el rendimiento de estas funciones
Los índices creados en las historias 4.1 y 4.2 son críticos para que estas funciones sean eficientes:
- `team_members_user_id_idx` — soporta `is_team_member()` y `is_team_admin()`
- `patients_team_id_idx` — soporta el lookup de `team_id` en `is_my_patient()`

---

## Historia siguiente
**4.4 — Políticas RLS: patients, therapy_sessions, treatment_episodes**: actualiza las políticas de las 3 tablas principales para permitir acceso de equipo completo (lectura y edición por cualquier miembro del equipo).
