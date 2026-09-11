import type { Tables } from "@/integrations/supabase/types";

// Nombrado "ExercisePlanTemplate" (no "Plan" a secas) para no colisionar con
// el "Plan de tratamiento" de la ficha clínica (treatment_plans), un
// concepto distinto que vive en otra parte de la app.
export type ExercisePlanTemplate = Tables<"exercise_routines">;
export type ExercisePlanTemplateItem = Tables<"exercise_routine_items"> & {
  exercise: { id: string; name: string; exercise_type: string | null };
};
