import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type Apartado = { id: string; name: string };

interface ApartadosPanelProps {
  apartados: Apartado[];
  onRefetch: () => Promise<void>;
  selectedApartadoId: string | null;
  onSelectApartado: (id: string | null) => void;
}

export default function ApartadosPanel({ apartados, onRefetch, selectedApartadoId, onSelectApartado }: ApartadosPanelProps) {
  const { user } = useAuth();

  // ── Nuevo apartado ──
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Edición inline ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // ── Confirmación de eliminación ──
  const [deleteTarget, setDeleteTarget] = useState<Apartado | null>(null);
  const [deleteHasExercises, setDeleteHasExercises] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ── Crear ──
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("exercise_body_regions")
      .insert({ name, professional_id: user.id });
    setSaving(false);
    if (error) { toast.error("Error al crear apartado"); return; }
    toast.success("Apartado creado");
    setNewName("");
    setShowNew(false);
    await onRefetch();
  };

  // ── Editar ──
  const startEdit = (ap: Apartado) => { setEditingId(ap.id); setEditName(ap.name); };

  const handleSaveEdit = async () => {
    const name = editName.trim();
    if (!name || !editingId) return;
    const { error } = await supabase
      .from("exercise_body_regions")
      .update({ name })
      .eq("id", editingId);
    if (error) { toast.error("Error al renombrar apartado"); return; }
    toast.success("Apartado renombrado");
    setEditingId(null);
    await onRefetch();
  };

  const cancelEdit = () => setEditingId(null);

  // ── Eliminar ──
  const handleDeleteClick = async (ap: Apartado) => {
    const { count } = await supabase
      .from("exercise_library")
      .select("id", { count: "exact", head: true })
      .eq("body_region_id", ap.id);
    setDeleteTarget(ap);
    setDeleteHasExercises((count ?? 0) > 0);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("exercise_body_regions")
      .delete()
      .eq("id", deleteTarget.id);
    setShowDeleteDialog(false);
    setDeleteTarget(null);
    if (error) { toast.error("Error al eliminar apartado"); return; }
    toast.success("Apartado eliminado");
    if (selectedApartadoId === deleteTarget.id) onSelectApartado(null);
    await onRefetch();
  };

  return (
    <div className="flex flex-col gap-1">
      {/* ── Lista de apartados ── */}
      {apartados.map((ap) => (
        <div key={ap.id} className="group flex items-center gap-1">
          {editingId === ap.id ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                className="h-8 text-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") cancelEdit(); }}
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleSaveEdit}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={cancelEdit}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <button
                className={cn(
                  "flex-1 text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                  selectedApartadoId === ap.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted/60 text-foreground"
                )}
                onClick={() => onSelectApartado(ap.id)}
              >
                {ap.name}
              </button>
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(ap)} title="Renombrar">
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(ap)} title="Eliminar">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </>
          )}
        </div>
      ))}

      {/* ── Sin apartado ── */}
      <button
        className={cn(
          "text-left px-3 py-1.5 rounded-md text-sm transition-colors mt-1",
          selectedApartadoId === null
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground italic hover:bg-muted/60 hover:not-italic"
        )}
        onClick={() => onSelectApartado(null)}
      >
        Sin apartado
      </button>

      {/* ── Nuevo apartado ── */}
      {showNew ? (
        <div className="flex items-center gap-1 mt-1">
          <Input
            className="h-8 text-sm flex-1"
            placeholder="Nombre del apartado"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setShowNew(false); setNewName(""); } }}
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setShowNew(false); setNewName(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="justify-start gap-2 mt-1 text-muted-foreground hover:text-foreground" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nuevo apartado
        </Button>
      )}

      {/* ── Diálogo de confirmación de eliminación ── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar apartado</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteHasExercises
                ? `El apartado "${deleteTarget?.name}" tiene ejercicios asociados. Al eliminarlo, esos ejercicios quedarán sin apartado asignado (no se eliminarán). ¿Querés continuar?`
                : `¿Eliminar el apartado "${deleteTarget?.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
