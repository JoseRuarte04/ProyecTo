import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "./Dashboard";
import { Plus, Search, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | "active" | "paused" | "discharged";
type TeamFilter = "all" | "personal" | string;

const statusTabs: { label: string; value: FilterStatus }[] = [
  { label: "Todos", value: "all" },
  { label: "Activos", value: "active" },
  { label: "Pausados", value: "paused" },
  { label: "Alta", value: "discharged" },
];

export default function Patients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [userTeams, setUserTeams] = useState<{ id: string; name: string }[]>([]);

  const fetchPatients = async () => {
    setLoading(true);
    let query = supabase
      .from("patients")
      .select("id, first_name, last_name, dni, status, insurance, admission_date, team_id, teams(name), therapy_sessions(session_date, is_deleted)")
      .eq("is_deleted", false)
      .order("last_name", { ascending: true });

    if (filter !== "all") query = query.eq("status", filter);

    const { data } = await query;
    setPatients(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPatients(); }, [filter]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("team_members")
      .select("team_id, teams(id, name)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setUserTeams(
          (data || []).map((r: any) => ({ id: r.teams.id, name: r.teams.name }))
        );
      });
  }, [user]);

  const filtered = patients.filter((p) => {
    if (teamFilter === "personal" && p.team_id !== null) return false;
    if (teamFilter !== "all" && teamFilter !== "personal" && p.team_id !== teamFilter) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    const teamName = (p.teams as { name: string } | null)?.name?.toLowerCase() ?? "";
    return (
      p.first_name?.toLowerCase().includes(term) ||
      p.last_name?.toLowerCase().includes(term) ||
      p.dni?.toLowerCase().includes(term) ||
      teamName.includes(term)
    );
  });

  const getLastSession = (p: any): string | null => {
    const sessions = (p.therapy_sessions || []).filter((s: any) => !s.is_deleted);
    if (sessions.length === 0) return null;
    const sorted = [...sessions].sort((a: any, b: any) => b.session_date.localeCompare(a.session_date));
    return sorted[0].session_date;
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground tracking-tight">Mis Pacientes</h1>
        <Button onClick={() => navigate("/patients/new")} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Paciente
        </Button>
      </div>

      {/* Buscador + tabs — sticky */}
      <div className="sticky top-0 z-10 bg-background pb-0 pt-0">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 max-w-sm"
          />
        </div>

        {/* Tabs de estado */}
        <div className="flex border-b border-border">
          {statusTabs.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                filter === f.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tabs de equipo — solo si el usuario pertenece a algún equipo */}
        {userTeams.length > 0 && (
          <div className="flex gap-1.5 pt-2 pb-1 flex-wrap">
            {([
              { id: "all",      label: "Todos" },
              { id: "personal", label: "Personales" },
              ...userTeams.map((t) => ({ id: t.id, label: t.name })),
            ] as { id: TeamFilter; label: string }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTeamFilter(t.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-[12px] font-medium border transition-colors",
                  teamFilter === t.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No se encontraron pacientes.</p>
      ) : (
        <div className="dashboard-card overflow-hidden">
          {/* Encabezado de columnas */}
          <div className="grid grid-cols-[1fr_80px_100px_80px] gap-4 px-4 py-2 border-b border-border bg-muted">
            <p className="field-label">Paciente</p>
            <p className="field-label text-center">Estado</p>
            <p className="field-label">Obra social</p>
            <p className="field-label text-right">Últ. sesión</p>
          </div>

          {/* Filas */}
          <div>
            {filtered.map((p, idx) => {
              const lastSessionDate = getLastSession(p);
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className={cn(
                    "relative grid grid-cols-[1fr_80px_100px_80px] gap-4 px-4 items-center",
                    "min-h-[56px] py-3 group hover:bg-muted/40 transition-colors cursor-pointer",
                    idx !== filtered.length - 1 && "border-b border-border/60"
                  )}
                >
                  {/* Nombre + DNI */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {p.last_name}, {p.first_name}
                      </p>
                      {p.teams && (
                        <span className="inline-flex items-center text-[10px] font-medium text-primary/80 bg-primary/8 border border-primary/20 rounded-full px-2 py-0.5">
                          {(p.teams as { name: string }).name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">DNI {p.dni}</p>
                  </div>

                  {/* Estado */}
                  <div className="flex justify-center">
                    <StatusBadge status={p.status} />
                  </div>

                  {/* Obra social */}
                  <p className="text-xs text-muted-foreground truncate">{p.insurance || "—"}</p>

                  {/* Última sesión */}
                  <p className="text-xs text-muted-foreground tabular-nums text-right">
                    {lastSessionDate
                      ? format(new Date(lastSessionDate + "T12:00:00"), "dd/MM/yy")
                      : "—"
                    }
                  </p>

                </div>
              );
            })}
          </div>

          {/* Footer con total */}
          <div className="px-4 py-2.5 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">
              {filtered.length} paciente{filtered.length !== 1 ? "s" : ""}
              {search && ` · búsqueda "${search}"`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
