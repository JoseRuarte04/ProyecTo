import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "./Dashboard";
import { Plus, Search, Loader2, ExternalLink } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | "active" | "paused" | "discharged";

const filterTabs: { label: string; value: FilterStatus }[] = [
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

  const fetchPatients = async () => {
    setLoading(true);
    let query = supabase
      .from("patients")
      .select("id, first_name, last_name, dni, status, insurance, admission_date, therapy_sessions(session_date, is_deleted)")
      .eq("is_deleted", false)
      .order("last_name", { ascending: true });

    if (filter !== "all") query = query.eq("status", filter);

    const { data } = await query;
    setPatients(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPatients();
  }, [filter]);

  const filtered = patients.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      p.first_name?.toLowerCase().includes(term) ||
      p.last_name?.toLowerCase().includes(term) ||
      p.dni?.toLowerCase().includes(term)
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

        {/* Filtros como tabs con borde inferior */}
        <div className="flex border-b border-border">
          {filterTabs.map((f) => (
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
                  className={cn(
                    "relative grid grid-cols-[1fr_80px_100px_80px] gap-4 px-4 items-center",
                    "min-h-[56px] py-3 group hover:bg-muted/40 transition-colors",
                    idx !== filtered.length - 1 && "border-b border-border/60"
                  )}
                >
                  {/* Nombre + DNI */}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {p.last_name}, {p.first_name}
                    </p>
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

                  {/* Acciones en hover */}
                  <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-muted/80 via-muted/80 to-transparent pl-10">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 font-medium"
                      onClick={() => navigate(`/patients/${p.id}/sessions/new`)}
                    >
                      <Plus className="h-3 w-3" /> Sesión
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 font-medium"
                      asChild
                    >
                      <Link to={`/patients/${p.id}`}>
                        <ExternalLink className="h-3 w-3" /> Perfil
                      </Link>
                    </Button>
                  </div>
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
