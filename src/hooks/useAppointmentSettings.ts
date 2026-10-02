import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

// Config de turnos del espacio de trabajo activo: personal (owner_type='professional')
// o de equipo (owner_type='team', solo el admin edita). Sin fila o max_absences null
// = sin límite, es decir, nunca se advierte.
export function useAppointmentSettings() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const ownerType = workspace.type === "team" ? "team" : "professional";
  const ownerId = workspace.type === "team" ? workspace.teamId : user?.id ?? null;
  const canEdit = workspace.type === "team" ? workspace.isAdmin : true;

  const [maxAbsences, setMaxAbsencesState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ownerId) { setMaxAbsencesState(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("appointment_settings")
      .select("max_absences")
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) {
      console.error("Error cargando configuración de turnos:", error);
      toast.error("No se pudo cargar la configuración de turnos");
    }
    setMaxAbsencesState(data?.max_absences ?? null);
    setLoading(false);
  }, [ownerType, ownerId]);

  useEffect(() => { load(); }, [load]);

  const setMaxAbsences = async (value: number | null): Promise<boolean> => {
    if (!ownerId || !canEdit) return false;
    const { error } = await supabase
      .from("appointment_settings")
      .upsert(
        { owner_type: ownerType, owner_id: ownerId, max_absences: value },
        { onConflict: "owner_type,owner_id" }
      );
    if (error) {
      toast.error("No se pudo guardar el cambio: " + error.message);
      return false;
    }
    setMaxAbsencesState(value);
    return true;
  };

  const ownerLabel = workspace.type === "team" ? workspace.teamName : "Personal";

  return { maxAbsences, loading, canEdit, setMaxAbsences, ownerLabel };
}
