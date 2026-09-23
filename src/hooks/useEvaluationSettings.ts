import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { EvaluationKey, allEvaluationsEnabled } from "@/lib/evaluationSettings";

// Resuelve la config de evaluaciones habilitadas para el espacio de trabajo
// activo: personal (owner_type='professional', owner_id=auth.uid()) o de
// equipo (owner_type='team', owner_id=team_id, solo el admin puede editar).
// Ausencia de fila en `evaluation_settings` = habilitado.
export function useEvaluationSettings() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const ownerType = workspace.type === "team" ? "team" : "professional";
  const ownerId = workspace.type === "team" ? workspace.teamId : user?.id ?? null;
  const canEdit = workspace.type === "team" ? workspace.isAdmin : true;

  const [settings, setSettings] = useState<Record<EvaluationKey, boolean>>(allEvaluationsEnabled());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ownerId) { setSettings(allEvaluationsEnabled()); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("evaluation_settings")
      .select("evaluation_key, enabled")
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId);
    if (error) {
      console.error("Error cargando configuración de evaluaciones:", error);
      toast.error("No se pudo cargar la configuración de evaluaciones");
      setSettings(allEvaluationsEnabled());
      setLoading(false);
      return;
    }
    const map = allEvaluationsEnabled();
    for (const row of data || []) {
      map[row.evaluation_key as EvaluationKey] = row.enabled;
    }
    setSettings(map);
    setLoading(false);
  }, [ownerType, ownerId]);

  useEffect(() => { load(); }, [load]);

  const setEnabled = async (key: EvaluationKey, enabled: boolean) => {
    if (!ownerId || !canEdit) return;
    setSettings((prev) => ({ ...prev, [key]: enabled }));
    const { error } = await supabase
      .from("evaluation_settings")
      .upsert(
        { owner_type: ownerType, owner_id: ownerId, evaluation_key: key, enabled },
        { onConflict: "owner_type,owner_id,evaluation_key" }
      );
    if (error) {
      toast.error("No se pudo guardar el cambio: " + error.message);
      load();
    }
  };

  const ownerLabel = workspace.type === "team" ? workspace.teamName : "Personal";

  return { settings, loading, canEdit, setEnabled, ownerLabel, ready: !!ownerId };
}
