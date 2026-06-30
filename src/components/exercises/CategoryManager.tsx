import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

const systemCategories = [
  "General", "Ocupación", "Deporte", "Protección articular", "Cuidado de piel",
];

type CustomCategory = { id: string; name: string };

export default function CategoryManager({
  open, onClose, userId, onChanged,
}: {
  open: boolean; onClose: () => void; userId: string; onChanged: () => void;
}) {
  const [customs, setCustoms] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("exercise_custom_categories")
      .select("id, name")
      .eq("professional_id", userId)
      .order("name");
    setCustoms(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetch();
  }, [open]);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) { toast.error("El nombre no puede estar vacío"); return; }
    if (customs.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Ya existe una categoría con ese nombre");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("exercise_custom_categories").insert({
      professional_id: userId,
      name: trimmed,
    });
    setSaving(false);
    if (error) { toast.error("Error al crear categoría"); return; }
    toast.success("Categoría creada correctamente");
    setNewName("");
    fetch();
    onChanged();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("exercise_custom_categories").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) { toast.error("Error al eliminar categoría"); return; }
    toast.success("Categoría eliminada");
    fetch();
    onChanged();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Categorías personalizadas</DialogTitle>
            <DialogDescription className="sr-only">Administrá las categorías personalizadas de ejercicios</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* System categories */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Categorías del sistema (fijas)</p>
              <div className="flex flex-wrap gap-2">
                {systemCategories.map((c) => (
                  <Badge key={c} variant="secondary" className="text-xs cursor-default">{c}</Badge>
                ))}
              </div>
            </div>

            {/* Custom categories */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Categorías personalizadas</p>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : customs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tenés categorías personalizadas todavía.</p>
              ) : (
                <div className="space-y-2">
                  {customs.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                      <span className="text-sm">{c.name}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive/80" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nueva categoría..."
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="flex-1"
                />
                <Button onClick={handleAdd} disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Agregar</>}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta categoría?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará de forma permanente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
