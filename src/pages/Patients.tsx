import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePatients } from "@/hooks/usePatients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status";
import { PageHeader } from "@/components/PageHeader";
import { ListSkeleton } from "@/components/skeletons";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { documentTypeShortLabel } from "@/components/patients/documentTypes";

type FilterStatus = "all" | "active" | "paused" | "discharged" | "abandoned";

const statusTabs: { label: string; value: FilterStatus }[] = [
  { label: "Todos",    value: "all" },
  { label: "Activos",  value: "active" },
  { label: "Pausados", value: "paused" },
  { label: "Alta",     value: "discharged" },
  { label: "Abandono", value: "abandoned" },
];

export default function Patients() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");

  const { data: patients = [], isLoading: loading } = usePatients(workspace, user?.id, filter);

  // Resetear filtros al cambiar de workspace
  useEffect(() => {
    setSearch("");
    setFilter("all");
  }, [workspace]);

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

  const pageTitle =
    workspace.type === "personal" ? "Mis Pacientes" : `Pacientes — ${workspace.teamName}`;

  return (
    <div className="space-y-0">
      {/* Header */}
      <PageHeader
        className="pb-6"
        title={pageTitle}
        actions={
          <Button onClick={() => navigate("/patients/new")} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo Paciente
          </Button>
        }
      />

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

        {/* Tabs de estado — scroll horizontal contenido, no empuja la página */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex border-b border-border w-max min-w-full">
            {statusTabs.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
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
      </div>

      {/* Lista */}
      {loading ? (
        <ListSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No se encontraron pacientes.</p>
      ) : (
        <div className="dashboard-card overflow-hidden">
          {/* Encabezado de columnas — solo desde sm, en mobile la fila ya se entiende sin header */}
          <div className="hidden sm:grid grid-cols-[1fr_80px_100px_80px] gap-4 px-4 py-2 border-b border-border bg-muted">
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
                    "relative px-4 min-h-[56px] py-3 group hover:bg-muted/40 transition-colors cursor-pointer",
                    idx !== filtered.length - 1 && "border-b border-border/60"
                  )}
                >
                  {/* Mobile: nombre a la izquierda, resto apilado a la derecha */}
                  <div className="flex sm:hidden items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {p.last_name}, {p.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{documentTypeShortLabel(p.document_type)} {p.dni}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <StatusBadge status={p.status} />
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">{p.insurance || "—"}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {lastSessionDate
                          ? format(new Date(lastSessionDate + "T12:00:00"), "dd/MM/yy")
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Desktop: alineado con el encabezado de columnas */}
                  <div className="hidden sm:grid grid-cols-[1fr_80px_100px_80px] gap-4 items-center">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {p.last_name}, {p.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{documentTypeShortLabel(p.document_type)} {p.dni}</p>
                    </div>
                    <div className="flex justify-center">
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.insurance || "—"}</p>
                    <p className="text-xs text-muted-foreground tabular-nums text-right">
                      {lastSessionDate
                        ? format(new Date(lastSessionDate + "T12:00:00"), "dd/MM/yy")
                        : "—"}
                    </p>
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
