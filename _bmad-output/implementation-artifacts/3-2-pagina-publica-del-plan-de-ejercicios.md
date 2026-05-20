# Story 3.2: Página Pública del Plan de Ejercicios

Status: done

## Story

As a paciente,
I want abrir un link y ver mi plan de ejercicios completo sin iniciar sesión,
so that puedo seguir mis ejercicios domiciliarios desde cualquier dispositivo.

## Acceptance Criteria

1. Ruta `/plan/:token` registrada en App.tsx fuera de AppLayout (sin autenticación).
2. Token válido: muestra ejercicios en orden con nombre, instrucciones, posición inicial, precauciones, equipamiento, dosificación asignada.
3. Video YouTube: iframe embebido aspect-ratio 16:9.
4. Video no-YouTube: link de texto clicable.
5. Token expirado: "Este link ha expirado".
6. Token revocado: "Este link fue revocado".
7. Token no encontrado: "Link no válido".
8. Layout mobile-first (max-w-xl, columna única).

## Dev Notes

- Llama `get_exercise_plan_token` para validar, luego `get_exercise_plan_public` para datos.
- `get_exercise_plan_public` devuelve `{plan_notes, items[]}` — no expone patient_id ni professional_id.
- Patrón visual: header sticky con branding RehabOT, cards por ejercicio con secciones equipamiento / posición / instrucciones / precauciones (en caja amber) / notas.
- Precauciones destacadas con fondo amber para visibilidad clínica.

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### File List

- CREATED: `src/pages/PlanPublicPage.tsx`
- MODIFIED: `src/App.tsx` — ruta `/plan/:token` agregada
