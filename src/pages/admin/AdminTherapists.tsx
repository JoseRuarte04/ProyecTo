import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Loader2, Search, MoreHorizontal, Pencil, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { TherapistEditDialog } from "@/components/admin/TherapistEditDialog";

interface Therapist {
  id: string;
  full_name: string;
  email: string;
  specialty: string | null;
  license_number: string | null;
  is_active: boolean;
  created_at: string;
  patient_count: number;
  team_count: number;
}

export default function AdminTherapists() {
  const [therapists, setTherapists]       = useState<Therapist[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [editTarget, setEditTarget]       = useState<Therapist | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Therapist | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("admin_list_therapists").then(({ data, error }) => {
      if (error) setError("Error al cargar terapistas");
      else setTherapists((data as unknown as Therapist[]) || []);
      setLoading(false);
    });
  }, []);

  const filtered = therapists.filter((t) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return t.full_name.toLowerCase().includes(term) || t.email.toLowerCase().includes(term);
  });

  const handleToggleActive = async (t: Therapist) => {
    setActionLoading(t.id);
    const rpc = t.is_active ? "admin_deactivate_therapist" : "admin_reactivate_therapist";
    const { error } = await supabase.rpc(rpc, { p_user_id: t.id });
    setActionLoading(null);
    if (error) { toast.error("Error: " + error.message); return; }
    setTherapists((prev) =>
      prev.map((x) => x.id === t.id ? { ...x, is_active: !t.is_active } : x)
    );
    toast.success(t.is_active ? "Terapista desactivado" : "Terapista reactivado");
  };

  const handleSaved = (updated: Pick<Therapist, "id" | "full_name" | "email" | "specialty" | "license_number">) => {
    setTherapists((prev) =>
      prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x)
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground">Terapistas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{therapists.length} en total</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          className="pl-9 h-9 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          {search ? "No hay resultados para esa búsqueda." : "No hay terapistas registrados."}
        </p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Especialidad</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Pac.</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Eq.</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{t.full_name}</p>
                    {t.license_number && (
                      <p className="text-[11px] text-muted-foreground">{t.license_number}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.email}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {t.specialty || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground">{t.patient_count}</td>
                  <td className="px-4 py-3 text-center text-foreground">{t.team_count}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={t.is_active ? "default" : "destructive"} className="text-[11px]">
                      {t.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={actionLoading === t.id}>
                          {actionLoading === t.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <MoreHorizontal className="h-3.5 w-3.5" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditTarget(t)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                        {t.is_active ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeactivateTarget(t)}
                          >
                            <UserX className="h-3.5 w-3.5 mr-2" /> Desactivar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleToggleActive(t)}>
                            <UserCheck className="h-3.5 w-3.5 mr-2" /> Reactivar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <TherapistEditDialog
          therapist={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      <AlertDialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar terapista?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.full_name} perderá acceso al sistema. Podrás reactivarlo en cualquier momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deactivateTarget) handleToggleActive(deactivateTarget);
                setDeactivateTarget(null);
              }}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
