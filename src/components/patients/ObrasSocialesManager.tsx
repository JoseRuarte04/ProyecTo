import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Loader2, Check, X, Search } from "lucide-react";

type ObraSocial = { id: number; name: string; full_name: string | null; type: string | null };

const typeLabel = (type: string | null) => {
  if (!type) return "Otras";
  if (type === "sindical") return "Sindical";
  if (type === "prepaga") return "Prepaga";
  return type;
};

export default function ObrasSocialesManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<ObraSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editType, setEditType] = useState<string>("sindical");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ObraSocial | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("obras_sociales")
      .select("id, name, full_name, type")
      .order("name");
    if (error) {
      console.error("Error cargando obras sociales:", error);
      toast.error("No se pudieron cargar las obras sociales", { description: "Probá recargar la página." });
    }
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetch();
  }, [open]);

  const startEdit = (item: ObraSocial) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditFullName(item.full_name || "");
    setEditType(item.type || "otras");
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) { toast.error("El nombre no puede estar vacío"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("obras_sociales")
      .update({
        name: trimmedName,
        full_name: editFullName.trim() || null,
        type: editType === "otras" ? null : editType,
      })
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      console.error("Error al editar obra social:", error);
      if (error.code === "23505") {
        toast.error("Ya existe otra obra social con ese nombre");
      } else {
        toast.error("No se pudo guardar el cambio", { description: error.message });
      }
      return;
    }
    toast.success("Obra social actualizada");
    setEditingId(null);
    fetch();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("obras_sociales").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) {
      console.error("Error al eliminar obra social:", error);
      toast.error("No se pudo eliminar la obra social", { description: error.message });
      return;
    }
    toast.success(`"${deleteTarget.name}" eliminada del catálogo`);
    fetch();
  };

  const handleDeleteClick = async (item: ObraSocial) => {
    const { data, error } = await supabase.rpc("obra_social_usage_count", { p_name: item.name });
    if (error) {
      console.error("Error al chequear uso de la obra social:", error);
      toast.error("No se pudo verificar si está en uso", { description: "Probá de nuevo." });
      return;
    }
    const count = data ?? 0;
    if (count > 0) {
      toast.error(`"${item.name}" está en uso`, {
        description: `${count} paciente${count === 1 ? "" : "s"} ${count === 1 ? "tiene" : "tienen"} esta obra social cargada — no se puede eliminar.`,
      });
      return;
    }
    setDeleteTarget(item);
  };

  const filtered = items.filter((i) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return i.name.toLowerCase().includes(term) || (i.full_name || "").toLowerCase().includes(term);
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditingId(null); onClose(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Obras sociales</DialogTitle>
            <DialogDescription>Catálogo compartido entre todos los profesionales. Editá o eliminá las que hagan falta.</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-8" />
          </div>

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No se encontraron obras sociales.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <div key={item.id} className="rounded-md border border-border/50 px-3 py-2">
                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nombre (sigla)" />
                      <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} placeholder="Nombre completo (opcional)" />
                      <div className="flex items-center gap-2">
                        <Select value={editType} onValueChange={setEditType}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sindical">Sindical</SelectItem>
                            <SelectItem value="prepaga">Prepaga</SelectItem>
                            <SelectItem value="otras">Otras</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex-1" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={cancelEdit} disabled={saving}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" className="h-8 w-8 p-0" onClick={saveEdit} disabled={saving}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.name}</span>
                          <Badge variant="secondary" className="text-[10px]">{typeLabel(item.type)}</Badge>
                        </div>
                        {item.full_name && <p className="text-xs text-muted-foreground truncate">{item.full_name}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive/80" onClick={() => handleDeleteClick(item)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará del catálogo compartido de forma permanente. Ningún paciente la tiene cargada actualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
