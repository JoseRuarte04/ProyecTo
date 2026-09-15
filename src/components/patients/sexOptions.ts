// Opciones predefinidas de sexo. El valor de la izquierda es lo que se
// guarda en patients.gender (sin CHECK en DB, la validación es por este
// select) — agregar opciones acá no requiere migración.

export const SEX_OPTIONS = [
  ["male", "Masculino"],
  ["female", "Femenino"],
  ["non_binary", "No binario"],
] as const;

type Options = readonly (readonly [string, string])[];

const toLabel = (options: Options) => (value: string | null | undefined) =>
  options.find(([v]) => v === value)?.[1] ?? value ?? null;

export const sexLabel = toLabel(SEX_OPTIONS);
