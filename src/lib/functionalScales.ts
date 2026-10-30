// Lógica pura de puntuación de escalas funcionales (QuickDASH, FIM),
// extraída de src/components/evaluations/FunctionalScales.tsx para poder
// testearla sin renderizar nada (ver src/lib/functionalScales.test.ts).
// Extracción mecánica, sin cambios de comportamiento — ver docs/TASKS.md
// (plan de tests/cobertura) y docs/DECISIONS.md para las diferencias
// encontradas contra las fórmulas oficiales de cada escala (documentadas
// como tests .skip, no corregidas acá a propósito).

// ── QuickDASH ──

export function calcQuickDashScore(items: (number | null)[]): number | null {
  const answered = items.filter((v): v is number => v !== null && v !== undefined);
  if (answered.length < items.length) return null;
  const sum = answered.reduce((a, b) => a + b, 0);
  const score = ((sum / 11) - 1) * 25;
  return Math.round(score * 10) / 10;
}

export function calcQuickDashPartial(items: (number | null)[]): number | null {
  const answered = items.filter((v): v is number => v !== null && v !== undefined);
  if (answered.length === 0) return null;
  const sum = answered.reduce((a, b) => a + b, 0);
  const score = ((sum / answered.length) - 1) * 25;
  return Math.round(score * 10) / 10;
}

export function emptyQuickDash(): (number | null)[] {
  return Array(11).fill(null);
}

// ── FIM ──

export const FIM_GROUPS = [
  {
    name: "AUTOCUIDADO",
    max: 42,
    items: [
      { key: "alimentacion", label: "Alimentación" },
      { key: "aseo_personal", label: "Aseo personal" },
      { key: "bano", label: "Baño" },
      { key: "vestido_tren_superior", label: "Vestido tren superior" },
      { key: "vestido_tren_inferior", label: "Vestido tren inferior" },
      { key: "uso_del_bano", label: "Uso del baño" },
    ],
  },
  {
    name: "CONTROL DE ESFÍNTERES",
    max: 14,
    items: [
      { key: "control_de_intestino", label: "Control de intestino" },
      { key: "control_de_vejiga", label: "Control de vejiga" },
    ],
  },
  {
    name: "TRANSFERENCIAS",
    max: 21,
    items: [
      { key: "transferencia_cama_silla", label: "Transferencia cama-silla" },
      { key: "transferencia_al_bano", label: "Transferencia al baño" },
      { key: "transferencia_ducha_banera", label: "Transferencia ducha-bañera" },
    ],
  },
  {
    name: "LOCOMOCIÓN",
    max: 14,
    items: [
      { key: "marcha_o_silla_de_ruedas", label: "Marcha o silla de ruedas" },
      { key: "escaleras", label: "Escaleras" },
    ],
  },
];

export const FIM_COGNITIVE_GROUPS = [
  {
    name: "COMUNICACIÓN",
    max: 14,
    items: [
      { key: "comprension", label: "Comprensión" },
      { key: "expresion", label: "Expresión" },
    ],
  },
  {
    name: "CONEXIÓN",
    max: 21,
    items: [
      { key: "interaccion_social", label: "Interacción social" },
      { key: "resolucion_de_problemas", label: "Resolución de problemas" },
      { key: "memoria", label: "Memoria" },
    ],
  },
];

export const FIM_MOTOR: Array<{ key: string; label: string }> = FIM_GROUPS.flatMap(g => g.items);
export const FIM_COGNITIVE: Array<{ key: string; label: string }> = FIM_COGNITIVE_GROUPS.flatMap(g => g.items);
export const FIM_ALL = [...FIM_MOTOR, ...FIM_COGNITIVE];

export function emptyFim(): Record<string, number | null> {
  return Object.fromEntries(FIM_ALL.map((i) => [i.key, null]));
}

export function calcFimTotal(items: Record<string, number | null>): number | null {
  const vals = FIM_ALL.map((i) => items[i.key]).filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}

export function calcGroupSubtotal(items: Record<string, number | null>, group: { items: Array<{ key: string }> }): number | null {
  const vals = group.items.map(i => items[i.key]).filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}
