import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { PriorityLevel, PriorityRule } from "@/lib/priority";

export type PriorityRuleRow = PriorityRule & { id: string };

// Semáforo de prioridades del espacio de trabajo activo (personal o equipo).
export function usePriorityRules() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const ownerType = workspace.type === "team" ? "team" : "professional";
  const ownerId = workspace.type === "team" ? workspace.teamId : user?.id ?? null;
  const canEdit = workspace.type === "team" ? workspace.isAdmin : true;

  const [rules, setRules] = useState<PriorityRuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ownerId) { setRules([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("priority_pathologies")
      .select("id, code, label, level")
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId)
      .order("created_at");
    if (error) {
      console.error("Error cargando el semáforo de prioridades:", error);
      toast.error("No se pudo cargar el semáforo de prioridades");
    }
    setRules((data || []) as PriorityRuleRow[]);
    setLoading(false);
  }, [ownerType, ownerId]);

  useEffect(() => { load(); }, [load]);

  const addRule = async (rule: PriorityRule) => {
    if (!ownerId || !canEdit) return;
    const { error } = await supabase
      .from("priority_pathologies")
      .insert({ owner_type: ownerType, owner_id: ownerId, ...rule });
    if (error) {
      toast.error(error.code === "23505" ? "Esa patología ya está en el semáforo" : "No se pudo agregar: " + error.message);
      return;
    }
    load();
  };

  const setLevel = async (id: string, level: PriorityLevel) => {
    if (!canEdit) return;
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, level } : r)));
    const { error } = await supabase.from("priority_pathologies").update({ level }).eq("id", id);
    if (error) { toast.error("No se pudo cambiar el nivel: " + error.message); load(); }
  };

  const removeRule = async (id: string) => {
    if (!canEdit) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from("priority_pathologies").delete().eq("id", id);
    if (error) { toast.error("No se pudo quitar: " + error.message); load(); }
  };

  return { rules, loading, canEdit, addRule, setLevel, removeRule };
}
