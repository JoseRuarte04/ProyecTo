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
  {
    value: "pasivo",
    label: "Pasivo",
    tabLabel: "Pasivo",
    badgeClass: "bg-primary/10 text-primary border-primary/20",
  },
  {
    value: "sin_clasificar",
    label: "Sin clasificar",
    tabLabel: "Sin clasificar",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
] as const;

export type ExerciseTypeValue = (typeof EXERCISE_TYPES)[number]["value"];

// Las filas del catálogo global de ejercicios (HEP2go) pueden traer una
// clasificación combinada, ej. "activo; fortalecimiento" — separada del
// mismo modo que se escribió al importar (ver scripts/generate_catalog_seed.py).
const TYPE_SEPARATOR = "; ";

export function getExerciseType(value: string | null | undefined) {
  return EXERCISE_TYPES.find((t) => t.value === value) ?? null;
}

export function getExerciseTypes(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(TYPE_SEPARATOR)
    .map((v) => EXERCISE_TYPES.find((t) => t.value === v.trim()))
    .filter((t): t is (typeof EXERCISE_TYPES)[number] => !!t);
}

// Los ejercicios sin tipo (datos legacy) matchean cualquier filtro, para que
// no queden inaccesibles al filtrar — mismo criterio que ya usaba Exercises.tsx.
export function matchesExerciseType(value: string | null | undefined, filter: ExerciseTypeValue) {
  if (!value) return true;
  return value.split(TYPE_SEPARATOR).map((v) => v.trim()).includes(filter);
}

// Taxonomía fija de regiones del catálogo global (HEP2go), en el orden de
// la planilla de origen. No confundir con los "Apartados" (exercise_body_regions),
// que son carpetas libres y privadas por profesional.
export const CATALOG_REGIONS = [
  "Cervical",
  "Hombro",
  "Codo y mano",
  "Lumbar y torácica",
  "Cadera y rodilla",
  "Tobillo y pie",
  "Motricidad oral",
  "Especiales",
  "Educación",
] as const;

export function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
