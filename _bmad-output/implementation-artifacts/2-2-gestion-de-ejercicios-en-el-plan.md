# Story 2.2: Gestión de Ejercicios en el Plan

Status: review

## Story

As a terapeuta,
I want agregar, editar y eliminar ejercicios del plan de un paciente con su dosificación individual,
so that puedo personalizar el programa de ejercicios según las necesidades del tratamiento.

## Acceptance Criteria

1. "Agregar ejercicio" abre un dialog con búsqueda por nombre sobre `exercise_library`.
2. Al seleccionar ejercicio, se pueden definir: series, repeticiones, frecuencia (valor + veces/día o veces/semana), notas.
3. Al guardar, el ejercicio se añade al final del plan (order_index = items.length).
4. Cada ítem del plan tiene botones de editar (pencil) y eliminar (trash) visibles al hacer hover.
5. Editar abre el mismo dialog con los valores pre-cargados (sin búsqueda de ejercicio).
6. Eliminar muestra AlertDialog de confirmación; al confirmar, remueve el ítem y recalcula order_index de los restantes.
7. Toast de error con `sonner` si cualquier operación falla.

## Dev Notes

- Todo implementado en `EjerciciosTab.tsx` (sin componentes adicionales).
- Búsqueda debounced 300ms con `ilike` sobre `exercise_library` filtrado por `professional_id` y `is_active = true`.
- Recalculación de order_index post-delete: `Promise.all` con updates individuales por ítem.
- Frecuencia almacenada como texto: `"${freqValue} ${freqUnit}"` ej: `"3 veces/semana"`.

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### File List

- MODIFIED: `src/components/patients/EjerciciosTab.tsx` — add/edit/delete ejercicios en plan
