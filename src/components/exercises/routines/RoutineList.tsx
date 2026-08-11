import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import RoutineFormDialog from "./RoutineFormDialog";
import type { Routine } from "./routineLibrary";

interface RoutineListProps {
  routines: Routine[];
  itemCounts: Record<string, number>;
  selectedRoutineId: string | null;
  onSelectRoutine: (id: string) => void;
  professionalId: string;
  onRefetch: () => Promise<void>;
}

export default function RoutineList({ routines, itemCounts, selectedRoutineId, onSelectRoutine, professionalId, onRefetch }: RoutineListProps) {
  const [showNew, setShowNew] = useState(false);
  const [editTarget, setEditTarget] = useState<Routine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("exercise_routines").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) { toast.error("Error al eliminar la rutina", { description: error.message }); return; }
    toast.success("Rutina eliminada");
    setDeleteTarget(null);
    await onRefetch();
  };

  return (
    <div className="flex flex-col gap-1">
      {routines.map((r) => (
        <div key={r.id} className="group flex items-center gap-1">
          <button
            className={cn(
              "flex-1 min-w-0 text-left px-3 py-1.5 rounded-md text-sm transition-colors",
              selectedRoutineId === r.id
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted/60 text-foreground"
            )}
            onClick={() => onSelectRoutine(r.id)}
          >
            <span className="truncate block">{r.name}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {itemCounts[r.id] ?? 0} ejercicio{(itemCounts[r.id] ?? 0) === 1 ? "" : "s"}
            </span>
          </button>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTarget(r)} title="Editar">
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(r)} title="Eliminar">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}

      {routines.length === 0 && (
        <p className="text-xs text-muted-foreground px-3 py-2">Todavía no creaste ninguna rutina.</p>
      )}

      <Button variant="ghost" size="sm" className="justify-start gap-2 mt-1 text-muted-foreground hover:text-foreground" onClick={() => setShowNew(true)}>
        <Plus className="h-3.5 w-3.5" />
        Nueva rutina
      </Button>

      {showNew && (
        <RoutineFormDialog
          open
          onClose={() => setShowNew(false)}
          professionalId={professionalId}
          onSaved={async (r) => { await onRefetch(); onSelectRoutine(r.id); }}
        />
      )}
      {editTarget && (
        <RoutineFormDialog
          open
          onClose={() => setEditTarget(null)}
          professionalId={professionalId}
          onSaved={onRefetch}
          routine={editTarget}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar rutina</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar "{deleteTarget?.name}" y sus {itemCounts[deleteTarget?.id ?? ""] ?? 0} ejercicio(s)? Los programas de pacientes que ya se armaron a partir de esta rutina no se ven afectados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
