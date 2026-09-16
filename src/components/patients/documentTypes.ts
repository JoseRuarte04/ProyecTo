// Opciones predefinidas de tipo de documento. El valor de la izquierda es lo
// que se guarda en patients.document_type (con CHECK en DB — agregar
// opciones acá requiere también actualizar la migración).

export const DOCUMENT_TYPE_OPTIONS = [
  ["dni", "DNI"],
  ["lc", "Libreta Cívica"],
  ["le", "Libreta de Enrolamiento"],
  ["passport", "Pasaporte"],
  ["foreign_id", "Cédula de identidad extranjera"],
  ["other", "Otro"],
] as const;

export const DEFAULT_DOCUMENT_TYPE = "dni";

type Options = readonly (readonly [string, string])[];

const toLabel = (options: Options) => (value: string | null | undefined) =>
  options.find(([v]) => v === value)?.[1] ?? value ?? null;

export const documentTypeLabel = toLabel(DOCUMENT_TYPE_OPTIONS);

// Abreviación corta para usar en listados donde no hay lugar para el nombre completo.
const SHORT_LABELS: Record<string, string> = {
  dni: "DNI",
  lc: "LC",
  le: "LE",
  passport: "Pasaporte",
  foreign_id: "Céd. extranjera",
  other: "Doc.",
};

export const documentTypeShortLabel = (value: string | null | undefined) =>
  (value && SHORT_LABELS[value]) || "DNI";
