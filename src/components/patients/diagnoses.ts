import { supabase } from "@/integrations/supabase/client";

export type DiagnosisItem = { code: string | null; label: string };

// El principal es siempre la posición 0; se sigue escribiendo en las columnas
// legacy (patient_clinical_records.diagnosis / treatment_episodes.diagnosis).
export const primaryLabel = (list: DiagnosisItem[]): string | null =>
  list[0]?.label?.trim() || null;

export async function fetchEpisodeDiagnoses(episodeId: string): Promise<DiagnosisItem[]> {
  const { data } = await supabase
    .from("episode_diagnoses")
    .select("code, label, position")
    .eq("episode_id", episodeId)
    .order("position");
  return (data || []).map((d) => ({ code: d.code, label: d.label }));
}

export async function saveEpisodeDiagnoses(episodeId: string, patientId: string, list: DiagnosisItem[]) {
  // Reemplazo completo: primero la tabla nueva, después el caller sincroniza
  // el principal en las columnas legacy.
  const { error: delErr } = await supabase.from("episode_diagnoses").delete().eq("episode_id", episodeId);
  if (delErr) return { error: delErr };
  if (list.length === 0) return { error: null };
  const { error } = await supabase.from("episode_diagnoses").insert(
    list.map((d, i) => ({ episode_id: episodeId, patient_id: patientId, code: d.code, label: d.label, position: i }))
  );
  return { error };
}
