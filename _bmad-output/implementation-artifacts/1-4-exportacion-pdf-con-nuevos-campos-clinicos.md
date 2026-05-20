# Story 1.4: Exportación PDF con Nuevos Campos Clínicos

Status: ready-for-dev

## Story

As a terapeuta,
I want exportar ejercicios a PDF incluyendo toda la información clínica nueva,
so that puedo entregar instrucciones completas e impresas a los pacientes.

## Acceptance Criteria

1. El PDF incluye por ejercicio: nombre, tipo, instrucciones, posición inicial, precauciones, equipamiento, series y reps sugeridas.
2. Si el ejercicio tiene video_url, aparece como texto en el PDF.
3. El PDF se descarga sin errores al hacer click en Exportar.

## Dev Notes

- Solo modificar `src/components/exercises/ExercisePdfExport.tsx`
- Eliminar referencia a `exercise_categories` (legacy)
- Agregar: exercise_type como label junto al nombre, suggested_sets/reps en params, starting_position antes de instrucciones, precautions después

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### File List

- MODIFIED: `src/components/exercises/ExercisePdfExport.tsx` — campos nuevos agregados (exercise_type, suggested_sets/reps, starting_position, precautions, equipment), categorías legacy eliminadas
