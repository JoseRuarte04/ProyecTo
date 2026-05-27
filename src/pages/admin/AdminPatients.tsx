import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Loader2, Search, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Patient {
  id: string;
  full_name: string;
  professional_name: string;
  professional_id: string;
  team_id: string | null;
  team_name: string | null;
  created_at: string;
  is_deleted: boolean;
}

interface FilterOption {
  id: string;
  label: string;
}

export default function AdminPatients() {
  const [patients, setPatients]           = useState<Patient[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [filterTherapist, setFilterTherapist] = useState<string>("all");
  const [filterTeam, setFilterTeam]       = useState<string>("all");
  const [filterStatus, setFilterStatus]   = useState<string>("active");

  useEffect(() => {
    supabase.rpc("admin_list_patients").then(({ data, error }) => {
      if (error) setError("Error al cargar pacientes");
      else setPatients((data as unknown as Patient[]) || []);
      setLoading(false);
    });
  }, []);

  // Opciones únicas para los filtros
  const therapistOptions: FilterOption[] = Array.from(
    new Map(patients.map((p) => [p.professional_id, p.professional_name])).entries()
  ).map(([id, label]) => ({ id, label }));

  const teamOptions: FilterOption[] = Array.from(
    new Map(
      patients
        .filter((p) => p.team_id && p.team_name)
        .map((p) => [p.team_id!, p.team_name!])
    ).entries()
  ).map(([id, label]) => ({ id, label }));

  const filtered = patients.filter((p) => {
    if (filterStatus === "active"   && p.is_deleted)  return false;
    if (filterStatus === "inactive" && !p.is_deleted) return false;
    if (filterTherapist !== "all"   && p.professional_id !== filterTherapist) return false;
    if (filterTeam !== "all") {
      if (filterTeam === "personal" && p.team_id !== null)  return false;
      if (filterTeam !== "personal" && p.team_id !== filterTeam) return false;
    }
    if (search) {
      const term = search.toLowerCase();
      if (!p.full_name.toLowerCase().includes(term) &&
          !p.professional_name.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const clearFilters = () => {
    setSearch(""); setFilterTherapist("all"); setFilterTeam("all"); setFilterStatus("active");
  };

  const hasFilters = search || filterTherapist !== "all" || filterTeam !== "all" || filterStatus !== "active";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-semibold text-foreground">Pacientes</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Vista global de todos los pacientes del sistema
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o terapista..."
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 text-sm w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Eliminados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterTherapist} onValueChange={setFilterTherapist}>
          <SelectTrigger className="h-9 text-sm w-44">
            <SelectValue placeholder="Terapista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los terapistas</SelectItem>
            {therapistOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTeam} onValueChange={setFilterTeam}>
          <SelectTrigger className="h-9 text-sm w-44">
            <SelectValue placeholder="Equipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="personal">Personal (sin equipo)</SelectItem>
            {teamOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Limpiar
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        {loading ? "Cargando..." : `${filtered.length} paciente${filtered.length !== 1 ? "s" : ""}`}
        {hasFilters && !loading && ` de ${patients.length} totales`}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          {hasFilters ? "No hay resultados para los filtros aplicados." : "No hay pacientes registrados."}
        </p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Paciente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Terapista</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Equipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Alta</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className={p.is_deleted ? "opacity-50" : "hover:bg-muted/30 transition-colors"}>
                  <td className="px-4 py-3 font-medium text-foreground">{p.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.professional_name}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {p.team_name
                      ? <span className="text-foreground">{p.team_name}</span>
                      : <span className="text-muted-foreground text-xs">Personal</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {format(parseISO(p.created_at), "d MMM yyyy", { locale: es })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={p.is_deleted ? "destructive" : "default"} className="text-[11px]">
                      {p.is_deleted ? "Eliminado" : "Activo"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
