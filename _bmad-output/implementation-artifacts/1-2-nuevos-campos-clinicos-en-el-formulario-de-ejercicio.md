# Story 1.2: Nuevos Campos Clínicos en el Formulario de Ejercicio

Status: ready-for-dev

## Story

As a terapeuta,
I want crear y editar ejercicios con información clínica completa (tipo de ejercicio, posición inicial, precauciones, equipamiento, dosificación sugerida y video),
so that la biblioteca contenga toda la información necesaria para prescribirlos correctamente.

## Acceptance Criteria

1. **Given** el terapeuta abre el formulario de nuevo o editar ejercicio **When** completa los campos **Then** puede ingresar: `exercise_type` (dropdown: Activo / Activo asistido / Fortalecimiento), `starting_position` (textarea), `precautions` (textarea), `equipment` (text), `suggested_sets` (number), `suggested_reps` (number), `video_url` (text).

2. **Given** el terapeuta ingresa una URL de YouTube en `video_url` **When** el campo pierde foco (o tras debounce ~500ms) **Then** se muestra un thumbnail de preview usando `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`.

3. **Given** el terapeuta ingresa una URL que no es de YouTube **When** el campo pierde foco **Then** no se muestra thumbnail pero la URL se acepta sin error.

4. **Given** el terapeuta guarda con los campos completados **When** envía el formulario **Then** el ejercicio se guarda con todos los nuevos campos y aparece en la biblioteca.

5. **Given** un ejercicio no está en ningún plan de paciente **When** el terapeuta hace click en eliminar y confirma **Then** el ejercicio es removido permanentemente.

6. **Given** un ejercicio está incluido en el plan de al menos un paciente **When** el terapeuta intenta eliminarlo y confirma **Then** se muestra toast de error: "Este ejercicio está en uso en el plan de uno o más pacientes" y el ejercicio no se elimina.

## Tasks / Subtasks

- [ ] Task 1: Migración SQL — nuevos campos en exercise_library (AC: #1-6)
  - [ ] ADD COLUMN exercise_type, starting_position, precautions, equipment, suggested_sets, suggested_reps

- [ ] Task 2: Actualizar types.ts (AC: #1-6)
  - [ ] Agregar los 6 campos nuevos a Row, Insert y Update de exercise_library

- [ ] Task 3: Actualizar ExerciseFormDialog en Exercises.tsx (AC: #1-4)
  - [ ] Agregar campos al estado `form`
  - [ ] Agregar Select para exercise_type
  - [ ] Agregar Textarea para starting_position y precautions
  - [ ] Agregar Input para equipment, suggested_sets, suggested_reps
  - [ ] YouTube thumbnail: extraer videoId con regex, mostrar img condicionalmente
  - [ ] Incluir nuevos campos en el payload de INSERT/UPDATE

- [ ] Task 4: Actualizar ExerciseDetailDialog (AC: #4)
  - [ ] Mostrar exercise_type, starting_position, precautions, equipment, suggested_sets, suggested_reps

- [ ] Task 5: Actualizar handleDelete — check proactivo de uso (AC: #5-6)
  - [ ] COUNT en treatment_plan_exercises antes de eliminar
  - [ ] Si count > 0: toast.error con mensaje explicativo, no eliminar

## Dev Notes

### Campos exactos a agregar a exercise_library

```sql
ALTER TABLE exercise_library
  ADD COLUMN exercise_type text CHECK (exercise_type IN ('activo', 'activo_asistido', 'fortalecimiento')),
  ADD COLUMN starting_position text,
  ADD COLUMN precautions text,
  ADD COLUMN equipment text,
  ADD COLUMN suggested_sets integer,
  ADD COLUMN suggested_reps integer;
```

`video_url` ya existe. No crear ni eliminar.

### ExerciseFormDialog — estado actual

El formulario usa un objeto `form` con campos planos. Agrega los 6 nuevos campos al estado inicial y al payload de INSERT/UPDATE. La validación `canSave` actualmente requiere nombre + al menos una categoría — **no cambiar este requisito**.

El campo `exercise_type` debe usar `Select` de `@/components/ui/select` (Shadcn). Opciones:
- value: `"activo"` → label: `"Activo"`
- value: `"activo_asistido"` → label: `"Activo asistido"`
- value: `"fortalecimiento"` → label: `"Fortalecimiento"`

### YouTube thumbnail

```ts
function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
```

En el formulario: `const ytId = extractYoutubeId(form.video_url)` — mostrar `<img>` con `https://img.youtube.com/vi/{ytId}/hqdefault.jpg` solo cuando `ytId !== null`.

### handleDelete — check de uso

La tabla `treatment_plan_exercises` ya existe con FK a `exercise_library`. Hacer SELECT COUNT antes de la operación de borrado para dar feedback claro. Cuando Story 2.1 cree `exercise_plan_items`, se añadirá un segundo COUNT.

```ts
const { count } = await supabase
  .from("treatment_plan_exercises")
  .select("id", { count: "exact", head: true })
  .eq("exercise_id", deleteEx.id);
if ((count ?? 0) > 0) {
  toast.error("Este ejercicio está en uso en el plan de uno o más pacientes");
  setDeleteEx(null);
  return;
}
```

### Project Structure Notes

- Solo se modifica `src/pages/Exercises.tsx` (ExerciseFormDialog, ExerciseDetailDialog, handleDelete inline)
- Migración nueva: `supabase/migrations/YYYYMMDDHHMMSS_exercise_library_clinical_fields.sql`
- `types.ts` actualización manual de exercise_library

### References

- Story epics.md: Story 1.2 en `_bmad-output/planning-artifacts/epics.md`
- Formulario actual: `src/pages/Exercises.tsx` líneas 383-532
- Select Shadcn: `@/components/ui/select`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- CREATED: `supabase/migrations/20260518120001_exercise_library_clinical_fields.sql`
- MODIFIED: `src/integrations/supabase/types.ts` — 6 campos nuevos en exercise_library (Row/Insert/Update)
- MODIFIED: `src/pages/Exercises.tsx` — ExerciseFormDialog (nuevos campos + YouTube thumbnail), ExerciseDetailDialog (nuevos campos), handleDelete (check proactivo treatment_plan_exercises)
