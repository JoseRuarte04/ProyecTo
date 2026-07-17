// Opciones predefinidas del perfil ocupacional. El valor de la izquierda es
// lo que se guarda en patient_occupational_profiles (sin CHECK en DB, la
// validación es por estos selects) — agregar opciones acá no requiere migración.

export const EMPLOYMENT_STATUS_OPTIONS = [
  ["relacion_dependencia", "Empleado/a en relación de dependencia"],
  ["independiente", "Independiente / monotributista"],
  ["informal", "Trabajo informal"],
  ["desempleado", "Desempleado/a"],
  ["jubilado", "Jubilado/a o pensionado/a"],
  ["estudiante", "Estudiante"],
  ["ama_de_casa", "Ama/o de casa"],
  ["licencia", "De licencia (ART / licencia médica)"],
  ["otro", "Otro"],
] as const;

export const MARITAL_STATUS_OPTIONS = [
  ["soltero", "Soltero/a"],
  ["casado", "Casado/a"],
  ["union_convivencial", "Unión convivencial / concubinato"],
  ["separado", "Separado/a"],
  ["divorciado", "Divorciado/a"],
  ["viudo", "Viudo/a"],
] as const;

export const EDUCATION_LEVEL_OPTIONS = [
  ["sin_estudios", "Sin estudios formales"],
  ["primario_incompleto", "Primario incompleto"],
  ["primario_completo", "Primario completo"],
  ["secundario_incompleto", "Secundario incompleto"],
  ["secundario_completo", "Secundario completo"],
  ["terciario_incompleto", "Terciario incompleto"],
  ["terciario_completo", "Terciario completo"],
  ["universitario_incompleto", "Universitario incompleto"],
  ["universitario_completo", "Universitario completo"],
  ["posgrado", "Posgrado"],
] as const;

type Options = readonly (readonly [string, string])[];

const toLabel = (options: Options) => (value: string | null | undefined) =>
  options.find(([v]) => v === value)?.[1] ?? value ?? null;

export const employmentStatusLabel = toLabel(EMPLOYMENT_STATUS_OPTIONS);
export const maritalStatusLabel = toLabel(MARITAL_STATUS_OPTIONS);
export const educationLevelLabel = toLabel(EDUCATION_LEVEL_OPTIONS);
