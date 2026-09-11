import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ProgramFormDialog from "./ProgramFormDialog";
import type { ExerciseProgram } from "./programLibrary";

interface ProgramListProps {
  programs: ExerciseProgram[];
  itemCounts: Record<string, number>;
  selectedProgramId: string | null;
  onSelectProgram: (id: string) => void;
  professionalId: string;
  onRefetch: () => Promise<void>;
}

export default function ProgramList({ programs, itemCounts, selectedProgramId, onSelectProgram, professionalId, onRefetch }: ProgramListProps) {
  const [showNew, setShowNew] = useState(false);
  const [editTarget, setEditTarget] = useState<ExerciseProgram | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExerciseProgram | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("exercise_programs").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) { toast.error("Error al eliminar el programa", { description: error.message }); return; }
    toast.success("Programa eliminado");
    setDeleteTarget(null);
    await onRefetch();
  };

  return (
    <div className="flex flex-col gap-1">
      {programs.map((p) => (
        <div key={p.id} className="group flex items-center gap-1">
          <button
            className={cn(
              "flex-1 min-w-0 text-left px-3 py-1.5 rounded-md text-sm transition-colors",
              selectedProgramId === p.id
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted/60 text-foreground"
            )}
            onClick={() => onSelectProgram(p.id)}
          >
            <span className="truncate block">{p.name}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {itemCounts[p.id] ?? 0} plan{(itemCounts[p.id] ?? 0) === 1 ? "" : "es"}
            </span>
          </button>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTarget(p)} title="Editar">
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(p)} title="Eliminar">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}

      {programs.length === 0 && (
        <p className="text-xs text-muted-foreground px-3 py-2">Todavía no creaste ningún programa.</p>
      )}

      <Button variant="ghost" size="sm" className="justify-start gap-2 mt-1 text-muted-foreground hover:text-foreground" onClick={() => setShowNew(true)}>
        <Plus className="h-3.5 w-3.5" />
        Nuevo programa
      </Button>

      {showNew && (
        <ProgramFormDialog
          open
          onClose={() => setShowNew(false)}
          professionalId={professionalId}
          onSaved={async (p) => { await onRefetch(); onSelectProgram(p.id); }}
        />
      )}
      {editTarget && (
        <ProgramFormDialog
          open
          onClose={() => setEditTarget(null)}
          professionalId={professionalId}
          onSaved={onRefetch}
          program={editTarget}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar programa</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar "{deleteTarget?.name}"? Los planes que contiene no se borran, y los programas de pacientes que ya se armaron a partir de este programa no se ven afectados. Esta acción no se puede deshacer.
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
