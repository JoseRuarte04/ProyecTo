import { supabase } from "@/integrations/supabase/client";

// Misma normalización que la base (normalize_obra_social_name): sin tildes, sin espacios de más, en minúsculas.
export const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// patients.insurance es texto copiado del catálogo, no una FK: antes de guardarlo hay que confirmar que el
// texto escrito corresponde a una obra social real. Si coincide (sin importar mayúsculas, tildes o espacios)
// devuelve el nombre exacto del catálogo, para que el paciente quede con la grafía canónica.
export type InsuranceResolution = { status: "ok"; name: string } | { status: "missing" } | { status: "error" };

export async function resolveInsuranceName(raw: string): Promise<InsuranceResolution> {
  const term = normalizeName(raw);
  if (!term) return { status: "missing" };
  const escaped = term.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await supabase
    .from("obras_sociales")
    .select("name")
    .ilike("name_search", `${escaped}%`)
    .limit(20);
  if (error) {
    console.error("Error al verificar la obra social:", error);
    return { status: "error" };
  }
  const match = (data || []).find((r) => normalizeName(r.name) === term);
  return match ? { status: "ok", name: match.name } : { status: "missing" };
}
