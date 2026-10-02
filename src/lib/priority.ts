export type PriorityLevel = "red" | "yellow" | "green";

export const PRIORITY_LEVELS: PriorityLevel[] = ["red", "yellow", "green"];

// Mayor número = más urgente. Si un paciente tiene varias patologías con nivel,
// gana la más urgente.
const RANK: Record<PriorityLevel, number> = { red: 3, yellow: 2, green: 1 };

export const PRIORITY_META: Record<PriorityLevel, { label: string; hint: string; dot: string; chip: string }> = {
  red: { label: "Prioridad alta", hint: "Dar turno primero", dot: "bg-red-500", chip: "bg-red-50 text-red-800 border-red-200" },
  yellow: { label: "Prioridad media", hint: "Dar turno pronto", dot: "bg-amber-400", chip: "bg-amber-50 text-amber-900 border-amber-200" },
  green: { label: "Prioridad baja", hint: "Sin urgencia", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
};

export type PriorityRule = { code: string | null; label: string; level: PriorityLevel };
export type DiagnosisLike = { code: string | null; label: string };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// Un diagnóstico coincide con una regla por código CIE-10 o, si no, por nombre.
export function priorityForDiagnoses(diagnoses: DiagnosisLike[], rules: PriorityRule[]): PriorityLevel | null {
  let best: PriorityLevel | null = null;
  for (const d of diagnoses) {
    for (const r of rules) {
      const match = (r.code && d.code && norm(r.code) === norm(d.code)) || norm(r.label) === norm(d.label);
      if (match && (!best || RANK[r.level] > RANK[best])) best = r.level;
    }
  }
  return best;
}
