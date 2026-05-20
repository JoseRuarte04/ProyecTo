# Story 2.3: Reordenamiento de Ejercicios en el Plan

Status: review

## Story

As a terapeuta,
I want reordenar los ejercicios del plan de un paciente,
so that el paciente los vea en el orden que tiene más sentido clínico.

## Acceptance Criteria

1. Con 2+ ejercicios, cada fila muestra botones ↑ y ↓ (ChevronUp/ChevronDown).
2. El botón ↑ del primer ítem está deshabilitado; el ↓ del último también.
3. Al hacer click, el ejercicio se mueve de posición inmediatamente (optimista).
4. Cuando hay cambios sin guardar, aparece el botón "Guardar orden" en el header del plan.
5. Al guardar, se hace UPSERT de todos los order_index y se muestra toast de confirmación.
6. Al recargar el plan (fetchPlan), orderDirty se resetea a false.

## Dev Notes

- Implementado en `EjerciciosTab.tsx` sin dependencias externas de drag-and-drop.
- `moveItem(idx, dir)`: swap de elementos en el array local + `setOrderDirty(true)`.
- `saveOrder()`: `Promise.all` de updates individuales por ítem con su nuevo `order_index`.
- Los botones ↑/↓ solo se muestran cuando `items.length > 1`.

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### File List

- MODIFIED: `src/components/patients/EjerciciosTab.tsx` — botones ↑/↓ + saveOrder + orderDirty
