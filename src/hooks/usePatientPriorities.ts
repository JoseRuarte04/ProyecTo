import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { priorityForDiagnoses, type DiagnosisLike, type PriorityLevel } from "@/lib/priority";
import { usePriorityRules } from "@/hooks/usePriorityRules";

// Nivel del semáforo por paciente, según los diagnósticos de sus episodios activos.
// Devuelve un mapa patientId -> nivel (solo pacientes con nivel).
export function usePatientPriorities(patientIds: string[]) {
  const { rules } = usePriorityRules();
  const ids = Array.from(new Set(patientIds)).sort();
  const enabled = rules.length > 0 && ids.length > 0;

  const { data } = useQuery({
    queryKey: ["patient-diagnoses", ids],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("episode_diagnoses")
        .select("patient_id, code, label, treatment_episodes!inner(status)")
        .in("patient_id", ids)
        .eq("treatment_episodes.status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });

  const map: Record<string, PriorityLevel> = {};
  if (enabled && data) {
    const byPatient = new Map<string, DiagnosisLike[]>();
    for (const d of data) {
      byPatient.set(d.patient_id, [...(byPatient.get(d.patient_id) ?? []), { code: d.code, label: d.label }]);
    }
    for (const [pid, list] of byPatient) {
      const level = priorityForDiagnoses(list, rules);
      if (level) map[pid] = level;
    }
  }
  return map;
}
