import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";

interface WorkspaceOption {
  type: "personal" | "team";
  teamId?: string;
  teamName?: string;
  patientCount: number | null;
}

export default function WorkspacePicker() {
  const navigate = useNavigate();
  const { teams, setWorkspace, loading: wsLoading } = useWorkspace();
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  // Si no tiene equipos, saltar directo al dashboard
  useEffect(() => {
    if (!wsLoading && teams.length === 0) {
      sessionStorage.setItem("workspace_chosen", "1");
      navigate("/dashboard", { replace: true });
    }
  }, [wsLoading, teams, navigate]);

  // Cargar conteos de pacientes de forma async para no bloquear el render
  useEffect(() => {
    if (!user || teams.length === 0) return;
    setCountsLoading(true);

    const loadCounts = async () => {
      const results: Record<string, number> = {};

      // Pacientes personales (sin equipo)
      const { count: personalCount } = await supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("professional_id", user.id)
        .is("team_id", null)
        .eq("is_deleted", false);
      results["personal"] = personalCount ?? 0;

      // Pacientes por equipo
      await Promise.all(
        teams.map(async (t) => {
          const { count } = await supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("team_id", t.id)
            .eq("is_deleted", false);
          results[t.id] = count ?? 0;
        })
      );

      setCounts(results);
      setCountsLoading(false);
    };

    loadCounts();
  }, [user, teams]);

  const handleSelect = (option: { type: "personal" } | { type: "team"; teamId: string }) => {
    const key = option.type === "personal" ? "personal" : option.teamId;
    setSelecting(key);
    if (option.type === "personal") {
      setWorkspace({ type: "personal" });
    } else {
      setWorkspace({ type: "team", teamId: option.teamId });
    }
    sessionStorage.setItem("workspace_chosen", "1");
    navigate("/dashboard", { replace: true });
  };

  if (wsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const options: WorkspaceOption[] = [
    { type: "personal", patientCount: counts["personal"] ?? null },
    ...teams.map((t) => ({
      type: "team" as const,
      teamId: t.id,
      teamName: t.name,
      patientCount: counts[t.id] ?? null,
    })),
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="text-center mb-10">
        <p className="font-serif text-3xl font-semibold text-foreground tracking-tight">RehabOT</p>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mt-1">
          Terapia Ocupacional
        </p>
      </div>

      <div className="w-full max-w-md">
        <h1 className="text-center text-lg font-semibold text-foreground mb-1">
          ¿Con qué perfil trabajás hoy?
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Podés cambiar el perfil en cualquier momento desde la barra lateral.
        </p>

        <div className="space-y-3">
          {options.map((opt) => {
            const key = opt.type === "personal" ? "personal" : opt.teamId!;
            const isSelecting = selecting === key;
            const isTeam = opt.type === "team";

            return (
              <button
                key={key}
                onClick={() =>
                  isTeam
                    ? handleSelect({ type: "team", teamId: opt.teamId! })
                    : handleSelect({ type: "personal" })
                }
                disabled={!!selecting}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all text-left
                  ${isTeam
                    ? "border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60"
                    : "border-border bg-card hover:bg-accent/50 hover:border-border"
                  }
                  ${selecting && !isSelecting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0
                    ${isTeam ? "bg-primary/10" : "bg-muted"}`}
                >
                  {isSelecting ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : isTeam ? (
                    <Building2 className="h-5 w-5 text-primary" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${isTeam ? "text-foreground" : "text-foreground"}`}>
                    {isTeam ? opt.teamName : "Personal"}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {countsLoading || opt.patientCount === null
                      ? "Cargando pacientes..."
                      : opt.patientCount === 1
                      ? "1 paciente"
                      : `${opt.patientCount} pacientes`}
                    {isTeam && " en el equipo"}
                  </p>
                </div>

                {!isSelecting && (
                  <div className={`h-5 w-5 rounded-full border-2 shrink-0 ${isTeam ? "border-primary/40" : "border-border"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
