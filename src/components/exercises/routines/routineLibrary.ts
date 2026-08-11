import type { Tables } from "@/integrations/supabase/types";

// Rutina: plantilla reutilizable de ejercicios (nivel intermedio entre la
// biblioteca y el plan de un paciente), tipada desde el esquema generado.
export type Routine = Tables<"exercise_routines">;

export type RoutineItem = Tables<"exercise_routine_items"> & {
  exercise: { id: string; name: string; exercise_type: string | null };
};
