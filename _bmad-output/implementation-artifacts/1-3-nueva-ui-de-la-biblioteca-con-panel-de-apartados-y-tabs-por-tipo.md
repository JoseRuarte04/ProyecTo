# Story 1.3: Nueva UI de la Biblioteca con Panel de Apartados y Tabs por Tipo

Status: ready-for-dev

## Story

As a terapeuta,
I want navegar la biblioteca a través de un panel izquierdo con apartados y tabs por tipo de ejercicio,
so that puedo encontrar rápidamente el ejercicio que busco sin recorrer una lista sin estructura.

## Acceptance Criteria

1. Al cargar, el panel izquierdo muestra los apartados con el primero seleccionado por defecto.
2. Al seleccionar un apartado, el panel principal muestra tres tabs: "Activos", "Activos asistidos", "Fortalecimiento".
3. Cada tab muestra cards con: nombre, instrucciones (line-clamp 2), dosificación sugerida, botones editar/eliminar.
4. Los filtros de categorías viejos y el botón "Gestionar categorías" ya no son visibles.
5. Ejercicios sin `body_region_id` aparecen bajo "Sin apartado" al final del panel izquierdo.
6. En tablet (< lg) el panel izquierdo se reemplaza por un Select dropdown.

## Dev Notes

- `ApartadosPanel` se actualiza para recibir `apartados` y `onRefetch` como props (el parent fetcha y gestiona el estado).
- Categorías eliminadas de la UI y del formulario; `canSave` solo requiere nombre.
- `fetchExercises` simplificado: sin joins de categorías.
- Patrón de tabs: `px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors`.

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### File List

- MODIFIED: `src/components/exercises/ApartadosPanel.tsx` — refactorizado para recibir `apartados` y `onRefetch` como props
- MODIFIED: `src/pages/Exercises.tsx` — reescritura completa: two-panel layout, tabs por tipo, filtrado por apartado, ExerciseCard extraído, categorías eliminadas del formulario y la UI principal
