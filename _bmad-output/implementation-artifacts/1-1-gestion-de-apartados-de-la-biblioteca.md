# Story 1.1: Gestión de Apartados de la Biblioteca

Status: ready-for-dev

## Story

As a terapeuta,
I want crear, editar y eliminar apartados en la biblioteca de ejercicios (ej: Muñeca, Hombro, Columna),
so that puedo organizar mis ejercicios por región corporal según mi práctica clínica.

## Acceptance Criteria

1. **Given** el terapeuta está en la sección de ejercicios **When** hace click en "Nuevo apartado" **Then** aparece un formulario para ingresar el nombre del apartado **And** al guardar, el nuevo apartado aparece en el panel izquierdo.

2. **Given** un apartado existente en el panel **When** el terapeuta hace click en editar **Then** puede renombrarlo y guardar el cambio.

3. **Given** un apartado existente sin ejercicios asociados **When** el terapeuta lo elimina **Then** el apartado es removido de la lista sin confirmación adicional.

4. **Given** un apartado que tiene ejercicios asociados (`exercise_library.body_region_id` apunta a él) **When** el terapeuta intenta eliminarlo **Then** aparece un diálogo de confirmación advirtiendo que los ejercicios quedarán sin apartado asignado (el apartado se elimina, los `body_region_id` de esos ejercicios quedan NULL — comportamiento ON DELETE SET NULL).

5. **Given** cualquier operación de CRUD sobre apartados **When** falla por error de red o DB **Then** se muestra un `toast.error` con `sonner` y la UI queda en estado operable.

## Tasks / Subtasks

- [ ] Task 1: Crear migración SQL (AC: #1-5)
  - [ ] Crear tabla `exercise_body_regions` (id uuid PK, name text not null, professional_id uuid FK auth.users not null, created_at timestamptz default now())
  - [ ] Agregar columna `body_region_id` uuid nullable FK a `exercise_body_regions(id)` ON DELETE SET NULL en `exercise_library`
  - [ ] Crear políticas RLS en `exercise_body_regions`: SELECT/INSERT/UPDATE/DELETE where `professional_id = auth.uid()`
  - [ ] Guardar migración en `supabase/migrations/` con timestamp como prefijo

- [ ] Task 2: Actualizar types.ts (AC: #1-5)
  - [ ] Agregar entrada `exercise_body_regions` en sección `Tables` con Row/Insert/Update/Relationships
  - [ ] Agregar `body_region_id: string | null` a Row, Insert y Update de `exercise_library`
  - [ ] Agregar FK relationship de `exercise_library` a `exercise_body_regions` en Relationships

- [ ] Task 3: Crear componente ApartadosPanel (AC: #1-4)
  - [ ] Crear `src/components/exercises/ApartadosPanel.tsx` con lista de apartados, formulario inline de creación, botones editar/eliminar
  - [ ] Fetch de `exercise_body_regions` filtrado por `professional_id = user.id`
  - [ ] Crear apartado: INSERT con `professional_id: user.id`
  - [ ] Editar apartado: UPDATE por id (verificar que `professional_id = user.id` en el WHERE o confiar en RLS)
  - [ ] Eliminar apartado: primero contar ejercicios con ese `body_region_id` para decidir si mostrar confirmación; luego DELETE
  - [ ] Mostrar `AlertDialog` de Shadcn para la confirmación de eliminación con ejercicios

- [ ] Task 4: Integrar ApartadosPanel en Exercises.tsx (AC: #1-5)
  - [ ] Renderizar `<ApartadosPanel>` en lugar del `<CategoryManager>` / filtros de categorías existentes (o dentro del mismo layout mientras Story 1.3 no reemplaza el layout completo)
  - [ ] Pasar callback para que el padre reciba el apartado seleccionado (preparar la prop, usarla en Story 1.3)

## Dev Notes

### Contexto del archivo existente — Exercises.tsx

`src/pages/Exercises.tsx` es la página actual de la biblioteca. Antes de tocarla leer completa. Puntos clave:

- **Estado actual de fetch**: `fetchExercises()` hace `supabase.from("exercise_library").select("*, exercise_categories(category), exercise_custom_category_assignments(custom_category_id)")`. Esta query trae las relaciones de categorías viejas.
- **Sistema de categorías viejo**: Usa `exercise_categories` (tabla con enum `exercise_category` con valores: general, occupation, sport, joint_protection, skin_care) y `exercise_custom_categories` / `exercise_custom_category_assignments`. Este sistema NO se toca ni elimina en esta story — se elimina en Story 1.3.
- **`CategoryManager`**: Componente en `src/components/exercises/CategoryManager` importado en la línea 16. Este story NO lo elimina; Story 1.3 se encarga.
- **`handleDelete`** ya implementado: captura el error FK con código `23503` y muestra mensaje al usuario. El nuevo comportamiento de "ejercicios sin apartado" (ON DELETE SET NULL) no genera error FK, así que este código existente no interfiere.
- **`body_region`**: Columna de texto libre en `exercise_library` (ej: "Muñeca", "Hombro"). No se elimina — la nueva columna `body_region_id` es adicional y coexiste.

### Schema actual de exercise_library (de types.ts)

```typescript
Row: {
  body_region: string | null      // ← texto libre, se conserva
  created_at: string
  default_duration: string | null
  default_frequency: string | null
  default_repetitions: number | null
  default_sets: number | null
  description: string | null
  id: string
  instructions: string | null
  is_active: boolean
  name: string
  professional_id: string | null
  updated_at: string
  video_url: string | null
}
```

Esta story agrega únicamente `body_region_id: string | null` — los campos nuevos clínicos (exercise_type, starting_position, etc.) son de Story 1.2.

### Migración SQL — esquema exacto

```sql
-- exercise_body_regions
CREATE TABLE exercise_body_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  professional_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercise_body_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeutas acceden a sus apartados"
  ON exercise_body_regions FOR ALL
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

-- FK en exercise_library
ALTER TABLE exercise_library
  ADD COLUMN body_region_id uuid
    REFERENCES exercise_body_regions(id)
    ON DELETE SET NULL;
```

Guardar como `supabase/migrations/YYYYMMDDHHMMSS_exercise_body_regions.sql`.

### types.ts — bloque a agregar

```typescript
// Agregar ANTES de exercise_categories (orden alfabético):
exercise_body_regions: {
  Row: {
    id: string
    name: string
    professional_id: string
    created_at: string
  }
  Insert: {
    id?: string
    name: string
    professional_id: string
    created_at?: string
  }
  Update: {
    id?: string
    name?: string
    professional_id?: string
    created_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "exercise_body_regions_professional_id_fkey"
      columns: ["professional_id"]
      isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}

// En exercise_library — agregar body_region_id a Row, Insert y Update:
body_region_id: string | null   // Row
body_region_id?: string | null  // Insert
body_region_id?: string | null  // Update

// En exercise_library Relationships — agregar:
{
  foreignKeyName: "exercise_library_body_region_id_fkey"
  columns: ["body_region_id"]
  isOneToOne: false
  referencedRelation: "exercise_body_regions"
  referencedColumns: ["id"]
}
```

### ApartadosPanel — notas de implementación

- Es un componente nuevo en `src/components/exercises/ApartadosPanel.tsx`.
- Props mínimas: `onSelectApartado: (id: string | null) => void` y `selectedApartadoId: string | null`. Estos props preparan la integración con Story 1.3, aunque Story 1.1 solo debe renderizar el panel y permitir CRUD.
- Fetch: `supabase.from("exercise_body_regions").select("id, name").eq("professional_id", user.id).order("name")`.
- La confirmación de eliminación con ejercicios requiere un COUNT previo: `supabase.from("exercise_library").select("id", { count: "exact", head: true }).eq("body_region_id", apartadoId)`. Si count > 0, mostrar `AlertDialog` con aviso de que los ejercicios quedarán sin apartado.
- **ON DELETE SET NULL** significa que al eliminar el apartado la DB pone `body_region_id = null` en los ejercicios afectados automáticamente — no hay FK constraint error, por eso la confirmación es solo informativa.
- Usar `toast.success` / `toast.error` de `sonner` para todas las operaciones.
- Usar `AlertDialog` de `@/components/ui/alert-dialog` para la confirmación.
- NO usar `react-toastify` ni `useToast`.
- Formulario de edición inline: mostrar un `Input` en lugar del nombre cuando el usuario hace click en editar; guardar con Enter o botón de check; cancelar con Escape o botón de X.

### Integración en Exercises.tsx — alcance limitado

Esta story NO refactoriza el layout completo de `Exercises.tsx` (eso es Story 1.3). Solo:
1. Importar `ApartadosPanel` y renderizarlo en algún lugar visible de la página (puede ser un bloque al inicio o en un modal temporal — lo que permita probar el CRUD sin romper el layout actual).
2. Si la integración requiere romper demasiado el layout, crear una sección colapsable temporal.

**No tocar**: el fetch de ejercicios existente, el sistema de categorías, los filtros, los dialogs de ejercicios, el PDF export.

### Patrón multi-tenancy

Siempre filtrar: `.eq("professional_id", user.id)` en las queries del cliente, además de confiar en RLS. Seguir el patrón de todos los otros fetches del proyecto.

### Project Structure Notes

- Nueva tabla: `exercise_body_regions` — sin tabla preexistente con ese nombre en types.ts
- Columna nueva: `body_region_id` en `exercise_library` — coexiste con `body_region` (texto libre)
- Componente nuevo: `src/components/exercises/ApartadosPanel.tsx`
- Archivo a modificar: `src/integrations/supabase/types.ts` (manual)
- Archivo a modificar mínimamente: `src/pages/Exercises.tsx` (importar y renderizar ApartadosPanel)
- Migración nueva: `supabase/migrations/YYYYMMDDHHMMSS_exercise_body_regions.sql`

### References

- Story definición: `_bmad-output/planning-artifacts/epics.md` — Story 1.1
- Patrones del proyecto: `_bmad-output/project-context.md` — Framework Rules, Critical Don't-Miss Rules
- Tabla `exercise_library` actual: `src/integrations/supabase/types.ts` líneas 498-556
- Página existente: `src/pages/Exercises.tsx` — sistema de categorías viejo (a conservar hasta Story 1.3)
- Referencia AlertDialog: `@/components/ui/alert-dialog` (Shadcn/Radix — ya instalado)
- Patrón token similar (RLS + multi-tenancy): `src/pages/QuickDashPublicPage.tsx` + `src/components/evaluations/QuickDashTokenManager.tsx`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- CREATED: `supabase/migrations/20260518120000_exercise_body_regions.sql`
- MODIFIED: `src/integrations/supabase/types.ts` — nueva tabla `exercise_body_regions`, columna `body_region_id` en `exercise_library`
- CREATED: `src/components/exercises/ApartadosPanel.tsx`
- MODIFIED: `src/pages/Exercises.tsx` — import + estado + botón "Apartados" + panel colapsable
