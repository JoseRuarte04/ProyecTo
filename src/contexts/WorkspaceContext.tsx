import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "rehab_workspace_v1";

export interface TeamOption {
  id: string;
  name: string;
  isAdmin: boolean;
}

export type Workspace =
  | { type: "personal" }
  | { type: "team"; teamId: string; teamName: string; isAdmin: boolean };

type StoredWorkspace =
  | { type: "personal" }
  | { type: "team"; teamId: string };

interface WorkspaceContextType {
  workspace: Workspace;
  teams: TeamOption[];
  setWorkspace: (ws: StoredWorkspace) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspace: { type: "personal" },
  teams: [],
  setWorkspace: () => {},
  loading: true,
});

export const useWorkspace = () => useContext(WorkspaceContext);

function readStored(): StoredWorkspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { type: "personal" };
    const parsed = JSON.parse(raw);
    if (parsed?.type === "team" && typeof parsed.teamId === "string") return parsed;
    return { type: "personal" };
  } catch {
    return { type: "personal" };
  }
}

function resolveWorkspace(stored: StoredWorkspace, teams: TeamOption[]): Workspace {
  if (stored.type === "personal") return { type: "personal" };
  const team = teams.find((t) => t.id === stored.teamId);
  // Si el usuario fue removido del equipo, cae a personal y limpia el storage
  if (!team) {
    localStorage.removeItem(STORAGE_KEY);
    return { type: "personal" };
  }
  return { type: "team", teamId: team.id, teamName: team.name, isAdmin: team.isAdmin };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [workspace, setWorkspaceState] = useState<Workspace>({ type: "personal" });
  const [loading, setLoading] = useState(true);

  const loadTeams = async (userId: string) => {
    const { data } = await supabase
      .from("team_members")
      .select("role, teams(id, name)")
      .eq("user_id", userId);
    const loaded: TeamOption[] = (data || []).map((r: any) => ({
      id: r.teams.id,
      name: r.teams.name,
      isAdmin: r.role === "admin",
    }));
    setTeams(loaded);
    const stored = readStored();
    setWorkspaceState(resolveWorkspace(stored, loaded));
    setLoading(false);
  };

  useEffect(() => {
    if (!user) {
      setTeams([]);
      setWorkspaceState({ type: "personal" });
      setLoading(false);
      // Limpiar la elección de sesión para que el próximo login muestre el picker
      sessionStorage.removeItem("workspace_chosen");
      return;
    }

    setLoading(true);
    loadTeams(user.id);

    const channel = supabase
      .channel(`workspace_member_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => loadTeams(user.id)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const setWorkspace = (ws: StoredWorkspace) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
    setWorkspaceState(resolveWorkspace(ws, teams));
  };

  return (
    <WorkspaceContext.Provider value={{ workspace, teams, setWorkspace, loading }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
