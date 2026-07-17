import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type FilterStatus = "all" | "active" | "paused" | "discharged" | "abandoned";
type Workspace = { type: "personal" | "team"; teamId?: string; teamName?: string };

export function usePatients(workspace: Workspace, userId: string | undefined, filter: FilterStatus) {
  return useQuery({
    queryKey: ["patients", "list", workspace.type, workspace.teamId, userId, filter],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select("id, first_name, last_name, dni, status, insurance, admission_date, therapy_sessions(session_date, is_deleted)")
        .eq("is_deleted", false)
        .order("last_name", { ascending: true });

      if (workspace.type === "personal") {
        query = query.eq("professional_id", userId!);
      } else {
        query = query.eq("team_id", workspace.teamId!);
      }

      if (filter !== "all") query = query.eq("status", filter);

      const { data } = await query;
      return data ?? [];
    },
  });
}
