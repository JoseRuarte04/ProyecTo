# Story 3.1: Generación y Gestión de Links del Plan

Status: done

## Story

As a terapeuta,
I want generar un link único con fecha de expiración para compartir el plan de ejercicios del paciente,
so that el paciente acceda a su plan sin necesidad de una cuenta.

## Acceptance Criteria

1. Tab "Ejercicios" muestra sección "Links compartibles" cuando existe un plan.
2. "Generar link" abre selector inline de vencimiento (24hs / 48hs / 72hs / 7 días / fecha personalizada).
3. Si ya existe un link activo, se avisa que quedará revocado al generar uno nuevo.
4. Link generado muestra URL copiable con botón Copiar (feedback visual 2s).
5. Listado muestra todos los links con estado (Activo / Expirado / Revocado), fecha creación y vencimiento.
6. Links activos tienen botón "Revocar" con AlertDialog de confirmación.
7. `create_exercise_plan_token` RPC revoca activos previos del mismo plan automáticamente.

## Dev Notes

- Tabla `exercise_plan_tokens`: id, token (uuid unique), plan_id, patient_id, professional_id, created_at, expires_at, revoked_at
- RPC `create_exercise_plan_token(p_plan_id, p_patient_id, p_expires_at)` SECURITY DEFINER con check de ownership.
- RPC `get_exercise_plan_token(p_token)` SECURITY DEFINER GRANT TO anon.
- Componente `ExercisePlanLinkManager.tsx` embebido en `EjerciciosTab.tsx` debajo del plan card.

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### File List

- CREATED: `supabase/migrations/20260519100000_exercise_plan_tokens.sql`
- MODIFIED: `src/integrations/supabase/types.ts` — tabla exercise_plan_tokens
- CREATED: `src/components/patients/ExercisePlanLinkManager.tsx`
- MODIFIED: `src/components/patients/EjerciciosTab.tsx` — import y render ExercisePlanLinkManager
