import type { Tables } from "@/integrations/supabase/types";

// Fila de la biblioteca de ejercicios, tipada desde el esquema generado de Supabase.
export type Exercise = Tables<"exercise_library">;

// Fuente única de verdad para los tipos de ejercicio. Agregar un tipo acá lo
// propaga a pestañas, badges, selects y exports de PDF.
export const EXERCISE_TYPES = [
  {
    value: "activo",
    label: "Activo",
    tabLabel: "Activos",
    badgeClass: "bg-info/10 text-info border-info/20",
  },
  {
    value: "activo_asistido",
    label: "Activo asistido",
    tabLabel: "Activos asistidos",
    badgeClass: "bg-success/10 text-success border-success/20",
  },
  {
    value: "fortalecimiento",
    label: "Fortalecimiento",
    tabLabel: "Fortalecimiento",
    badgeClass: "bg-warning/10 text-warning border-warning/20",
  },
] as const;

export type ExerciseTypeValue = (typeof EXERCISE_TYPES)[number]["value"];

export function getExerciseType(value: string | null | undefined) {
  return EXERCISE_TYPES.find((t) => t.value === value) ?? null;
}

export function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
