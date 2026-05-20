import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, ChevronRight } from "lucide-react";

interface Team {
  id: string;
  name: string;
  member_limit: number;
  is_active: boolean;
  created_at: string;
  member_count?: number;
}

interface TherapistOption {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

export default function AdminTeams() {
  const navigate  = useNavigate();
  const [teams, setTeams]               = useState<Team[]>([]);
  const [loading, setLoading]           = useState(true);
  const [createOpen, setCreateOpen]     = useState(false);
  const [therapists, setTherapists]     = useState<TherapistOption[]>([]);
  const [saving, setSaving]             = useState(false);

  const [newName, setNewName]   = useState("");
  const [newAdmin, setNewAdmin] = useState("");
  const [newLimit, setNewLimit] = useState("5");

  const loadTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, member_limit, is_active, created_at, team_members(count)")
      .order("created_at", { ascending: false });
    if (error) { toast.error("Error al cargar equipos"); setLoading(false); return; }
    const mapped = (data || []).map((t: any) => ({
      ...t,
      member_count: t.team_members?.[0]?.count ?? 0,
    }));
    setTeams(mapped);
    setLoading(false);
  };

  const loadTherapists = async () => {
    const { data } = await supabase.rpc("admin_list_therapists");
    setTherapists(
      ((data as unknown as TherapistOption[]) || []).filter((t) => t.is_active)
    );
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const openCreate = () => {
    setNewName(""); setNewAdmin(""); setNewLimit("5");
    loadTherapists();
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newAdmin) {
      toast.error("Nombre y admin inicial son obligatorios");
      return;
    }
    const limit = parseInt(newLimit, 10);
    if (isNaN(limit) || limit < 1) { toast.error("Límite inválido"); return; }

    setSaving(true);
    const { error } = await supabase.rpc("admin_create_team", {
      p_name:          newName.trim(),
      p_admin_user_id: newAdmin,
      p_member_limit:  limit,
    });
    setSaving(false);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Equipo creado");
    setCreateOpen(false);
    loadTeams();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground">Equipos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{teams.length} equipos</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo equipo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : teams.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No hay equipos creados aún.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Miembros</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teams.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {t.member_count ?? "—"} / {t.member_limit}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={t.is_active ? "default" : "secondary"} className="text-[11px]">
                      {t.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => navigate(`/admin/teams/${t.id}`)}
                    >
                      Ver detalle <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo equipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre del equipo *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 text-sm" placeholder="Ej: Clínica Norte" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Admin inicial *</Label>
              <Select value={newAdmin} onValueChange={setNewAdmin}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar terapista" />
                </SelectTrigger>
                <SelectContent>
                  {therapists.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name?.trim() || t.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Límite de miembros</Label>
              <Input type="number" min={1} value={newLimit} onChange={(e) => setNewLimit(e.target.value)} className="h-9 text-sm w-28" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Crear equipo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
