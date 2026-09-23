import { ClipboardList, BarChart2 } from "lucide-react";

// Definición de las evaluaciones/escalas que se pueden activar o desactivar
// por espacio de trabajo (personal o de equipo) — ver evaluation_settings en Supabase.
export const EVALUATION_KEYS = [
  "barthel",
  "fim",
  "occupations",
  "performance_context",
  "analitica_pain",
  "analitica_edema",
  "analitica_mobility",
  "analitica_muscle_strength",
  "analitica_sensitivity",
  "analitica_scar",
  "analitica_specific_tests",
  "analitica_other",
] as const;

export type EvaluationKey = (typeof EVALUATION_KEYS)[number];

export const EVALUATION_LABELS: Record<EvaluationKey, string> = {
  barthel: "Índice de Barthel",
  fim: "FIM",
  occupations: "Ocupaciones (checklist AOTA/MOHO)",
  performance_context: "Contexto de desempeño",
  analitica_pain: "Dolor",
  analitica_edema: "Edema",
  analitica_mobility: "Movilidad (goniometría)",
  analitica_muscle_strength: "Fuerza muscular (dinamometría, Daniels)",
  analitica_sensitivity: "Sensibilidad",
  analitica_scar: "Cicatriz / escala Vancouver",
  analitica_specific_tests: "Pruebas específicas",
  analitica_other: "Otros (estado trófico, postura, emotividad)",
};

export const EVALUATION_GROUPS: { step: string; icon: typeof ClipboardList; keys: EvaluationKey[] }[] = [
  { step: "Evaluación funcional", icon: ClipboardList, keys: ["barthel", "fim", "occupations", "performance_context"] },
  {
    step: "Evaluación analítica",
    icon: BarChart2,
    keys: [
      "analitica_pain", "analitica_edema", "analitica_mobility", "analitica_muscle_strength",
      "analitica_sensitivity", "analitica_scar", "analitica_specific_tests", "analitica_other",
    ],
  },
];

export function allEvaluationsEnabled(): Record<EvaluationKey, boolean> {
  return Object.fromEntries(EVALUATION_KEYS.map((k) => [k, true])) as Record<EvaluationKey, boolean>;
}
