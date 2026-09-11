import type { Tables } from "@/integrations/supabase/types";

export type ExerciseProgram = Tables<"exercise_programs">;
export type ExerciseProgramRoutine = Tables<"exercise_program_routines"> & {
  routine: { id: string; name: string; description: string | null };
};
