# Historia 4.2: Extensiones de Schema Existente — patients.team_id, audit_log.changes, índices

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 1 — Infraestructura de datos (sin tocar RLS existente)
**Dependencia:** Historia 4.1 debe estar aplicada en DB (necesita `teams` para la FK)
**Tipo:** Solo DB — 2 migraciones SQL + actualización de types.ts. Sin cambios de UI.

---

## Historia

Como arquitecto del sistema,
quiero extender las tablas existentes `patients` y `audit_log` con las columnas necesarias para soportar equipos y auditoría detallada,
para que la Fase 2 pueda actualizar el RLS y la Fase 3 pueda registrar cambios antes/después sin modificar estructuras posteriormente.

---

## Contexto y Restricciones Críticas

### Por qué estas columnas son nullable
- `patients.team_id` es nullable: `NULL` = paciente individual (comportamiento actual, sin cambios). `NOT NULL` rompería todos los pacientes existentes.
- `audit_log.changes` es nullable: los registros de audit anteriores no tienen `changes`. Agregar como `NOT NULL` requeriría backfill.

### Impacto en funcionalidad existente
- `patients`: agregar `team_id` no modifica ninguna política RLS existente. Las políticas actuales usan `professional_id = auth.uid()` — siguen funcionando exactamente igual. Los pacientes existentes tienen `team_id = NULL` y son 100% invisibles para la lógica de equipos hasta que la Fase 2 active las nuevas políticas.
- `audit_log`: agregar `changes jsonb` no rompe la función `insert_audit_log()` existente porque esa función usa INSERT con columnas explícitas — la nueva columna tiene DEFAULT NULL y no requiere cambios en la función actual. La función se actualizará en la Historia 4.7.
- `exercise_plan_tokens`: la FK a `patients` no incluye `team_id`, no hay impacto.

### Rollback
```sql
-- Revertir (solo si es necesario, el team_id nullable no tiene impacto operacional)
ALTER TABLE public.patients DROP COLUMN IF EXISTS team_id;
ALTER TABLE public.audit_log DROP COLUMN IF EXISTS changes;
DROP INDEX IF EXISTS patients_team_id_idx;
DROP INDEX IF EXISTS patients_team_professional_idx;
```

---

## Criterios de Aceptación

**AC1 — Columna `team_id` en `patients`**
- Given: se aplica la migración
- When: se hace INSERT de un nuevo paciente sin especificar `team_id`
- Then: el paciente se crea con `team_id = NULL` (comportamiento default preservado)

- Given: existe la tabla `teams` (creada en Historia 4.1)
- When: se inspecciona la FK de `patients.team_id`
- Then: la FK apunta a `public.teams(id)` con `ON DELETE SET NULL`

- Given: se elimina un equipo de la tabla `teams`
- When: se listan los pacientes que tenían ese `team_id`
- Then: su `team_id` es NULL (no se eliminaron, no hubo error)

**AC2 — Índices de rendimiento en `patients`**
- Given: la columna `team_id` existe
- When: se inspecciona `pg_indexes`
- Then: existen los índices:
  - `patients_team_id_idx ON patients(team_id)`
  - `patients_team_professional_idx ON patients(team_id, professional_id) WHERE is_deleted = false`

**AC3 — Columna `changes` en `audit_log`**
- Given: se aplica la migración
- When: se lee el schema de `audit_log`
- Then: existe columna `changes jsonb` nullable
- And: los registros existentes en `audit_log` tienen `changes = NULL` (no hubo backfill — es correcto)

**AC4 — Funcionalidad existente intacta**
- Given: se aplican ambas migraciones
- When: se prueba el flujo completo de crear/editar paciente y crear sesión
- Then: todo funciona igual que antes (las columnas nullable no rompen nada)
- And: `npm run lint` sin errores

**AC5 — types.ts actualizado**
- Given: las columnas nuevas existen en DB
- When: se revisa `src/integrations/supabase/types.ts`
- Then: `patients` tiene `team_id: string | null` en Row/Insert/Update y FK en Relationships
- And: `audit_log` tiene `changes: Json | null` en Row/Insert/Update

---

## Tareas

### Task 1 — Migración: `patients.team_id` + índices
Archivo: `supabase/migrations/YYYYMMDDHHMMSS_patients_team_id.sql`
(timestamp posterior a las 4 migraciones de Historia 4.1)

```sql
-- FK a teams: nullable, ON DELETE SET NULL preserva pacientes si el equipo se elimina
ALTER TABLE public.patients
  ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Índice simple para queries por equipo
CREATE INDEX patients_team_id_idx
  ON public.patients(team_id);

-- Índice compuesto para queries filtradas (no-deleted) por equipo y profesional
-- El filtro WHERE is_deleted = false reduce el tamaño del índice considerablemente
CREATE INDEX patients_team_professional_idx
  ON public.patients(team_id, professional_id)
  WHERE is_deleted = false;
```

### Task 2 — Migración: `audit_log.changes`
Archivo: `supabase/migrations/YYYYMMDDHHMMSS_audit_log_changes.sql`

```sql
-- Columna nullable: registros existentes quedan con changes = NULL (correcto)
-- La función insert_audit_log() se extenderá en Historia 4.7 para usar este campo
ALTER TABLE public.audit_log
  ADD COLUMN changes jsonb;
```

### Task 3 — Actualizar `src/integrations/supabase/types.ts`

**En la tabla `patients` — agregar `team_id` en Row, Insert y Update:**

En el bloque `Row` de `patients` (después de `status`):
```typescript
team_id: string | null
```

En el bloque `Insert` de `patients`:
```typescript
team_id?: string | null
```

En el bloque `Update` de `patients`:
```typescript
team_id?: string | null
```

En el array `Relationships` de `patients`, agregar:
```typescript
{
  foreignKeyName: "patients_team_id_fkey"
  columns: ["team_id"]
  isOneToOne: false
  referencedRelation: "teams"
  referencedColumns: ["id"]
},
```

**En la tabla `audit_log` — agregar `changes` en Row, Insert y Update:**

En el bloque `Row` de `audit_log` (después de `action_context`):
```typescript
changes: Json | null
```

En el bloque `Insert` de `audit_log`:
```typescript
changes?: Json | null
```

En el bloque `Update` de `audit_log`:
```typescript
changes?: Json | null
```

> `Json` ya está importado/definido al inicio de `types.ts` — usar ese tipo, no `object` ni `Record<string, any>`.

### Task 4 — Verificación final

- [ ] `npm run lint` — sin errores de TypeScript
- [ ] Crear un paciente de prueba en la app — debe seguir funcionando sin errores
- [ ] Verificar en Supabase Studio que `patients.team_id` existe y es nullable
- [ ] Verificar que los índices existen en `pg_indexes`
- [ ] Verificar en la app que el listado de pacientes, el perfil y las sesiones funcionan igual

---

## Contexto Técnico del Proyecto

### Sobre `NewPatientForm.tsx` — no modificar en esta historia
El formulario de nuevo paciente (`src/components/patients/NewPatientForm.tsx`) **no debe tocarse en esta historia**. El selector de "Paciente personal / Paciente de equipo" se agrega en la Historia 4.17. En este momento, todos los pacientes se crean con `team_id = NULL` automáticamente (valor DEFAULT de la columna).

### Sobre el RLS existente en `patients`
Las políticas actuales de `patients` usan `professional_id = auth.uid()`. No las tocar. La columna `team_id` es completamente invisible para esas políticas — no afecta ni amplía el acceso. La ampliación del RLS ocurre en Historia 4.4.

### Sobre `audit_log` — patrón actual a preservar
La función `insert_audit_log(audit_action, text, uuid, text)` actualmente toma 4 parámetros (sin `changes`). No modificarla en esta historia. Quedará así:
```sql
INSERT INTO audit_log(action, table_name, record_id, description, performed_by)
VALUES (...);
-- changes queda NULL automáticamente
```
La firma extendida con `changes jsonb` se agrega en Historia 4.7.

### Convenciones de migraciones
- Usar timestamp `YYYYMMDDHHMMSS` — que sea posterior a los timestamps de Historia 4.1
- Migraciones atómicas: una responsabilidad por archivo
- Referencia de estilo: `supabase/migrations/20260512000001_quickdash_tokens_episode.sql` (ALTER TABLE existente)

### Archivo types.ts — ubicación de campos
En la tabla `patients`, los campos están en orden alfabético dentro de Row/Insert/Update. Insertar `team_id` entre `status` y `updated_at`.

En `audit_log`, insertar `changes` en orden alfabético: antes de `created_at`.

---

## Resumen de lo que cambia en esta historia

| Elemento | Cambio |
|---|---|
| `patients` | +1 columna `team_id uuid nullable` + 2 índices |
| `audit_log` | +1 columna `changes jsonb nullable` |
| `src/integrations/supabase/types.ts` | +`team_id` en patients, +`changes` en audit_log |
| RLS / funciones / UI | Sin cambios |

## Historia siguiente
**4.3 — Funciones helper RLS**: crea `is_super_admin()`, `is_team_member()`, `is_team_admin()` y actualiza `is_my_patient()` con lógica de equipos.
