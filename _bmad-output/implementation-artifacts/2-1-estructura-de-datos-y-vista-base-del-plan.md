# Story 2.1: Estructura de Datos y Vista Base del Plan

Status: in-progress

## Story

As a terapeuta,
I want ver y crear el plan de ejercicios domiciliarios de un paciente,
so that puedo registrar y consultar el programa de ejercicios que el paciente debe hacer en casa.

## Acceptance Criteria

1. Existe una tabla `exercise_plans` (id, patient_id, professional_id, notes, created_at, updated_at) con RLS.
2. Existe una tabla `exercise_plan_items` (id, plan_id, exercise_id ON DELETE RESTRICT, order_index, assigned_sets, assigned_reps, frequency, notes, created_at) con RLS por ownership del plan.
3. El perfil del paciente tiene un tab "Ejercicios" entre "Evaluaciones" y "Archivos".
4. Si no hay plan: empty state con botón "Crear plan".
5. Crear plan abre un dialog con campo "Notas" opcional y botón confirmar.
6. Tras crear el plan se muestra la vista del plan (lista de ejercicios vacía de momento).
7. Si ya existe un plan, se muestra directamente.
8. Toast error si falla la operación de guardado.

## Dev Notes

### Tablas nuevas
- `exercise_plans` y `exercise_plan_items` son INDEPENDIENTES de `treatment_plans`/`treatment_plan_exercises` (sistema de planes terapéuticos ya existente).
- **NO tocar** ninguna lógica relacionada con `treatment_plans` en PatientProfile.tsx.
- FK `exercise_plan_items.exercise_id` → `exercise_library(id) ON DELETE RESTRICT`.

### PatientProfile.tsx
- Insertar TabsTrigger "Ejercicios" (value="ejercicios") en línea ~352, entre "evaluaciones" y "archivos".
- Agregar TabsContent correspondiente que renderiza `<EjerciciosTab patientId={id!} />`.
- Importar `EjerciciosTab` desde `@/components/patients/EjerciciosTab`.
- El `id` del paciente viene de `useParams()` como ya hace el archivo.

### EjerciciosTab.tsx
- Props: `{ patientId: string }`
- Fetcha `exercise_plans` WHERE `patient_id = patientId` (el profesional ve solo los suyos vía RLS).
- Si hay plan, fetcha `exercise_plan_items` + join con `exercise_library` para mostrar nombre del ejercicio.
- Diseño: `dashboard-card` container, empty state con icono + texto + botón.
- Dialog crear plan: solo campo `notes` (textarea, opcional) + botón "Crear".

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### File List

- CREATED: `supabase/migrations/20260518130000_exercise_plans.sql`
- MODIFIED: `src/integrations/supabase/types.ts` — tablas exercise_plans y exercise_plan_items
- CREATED: `src/components/patients/EjerciciosTab.tsx`
- MODIFIED: `src/pages/PatientProfile.tsx` — tab "Ejercicios" agregado
