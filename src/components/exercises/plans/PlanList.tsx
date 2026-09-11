import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import PlanFormDialog from "./PlanFormDialog";
import type { ExercisePlanTemplate } from "./planLibrary";

interface PlanListProps {
  plans: ExercisePlanTemplate[];
  itemCounts: Record<string, number>;
  selectedPlanId: string | null;
  onSelectPlan: (id: string) => void;
  professionalId: string;
  onRefetch: () => Promise<void>;
}

export default function PlanList({ plans, itemCounts, selectedPlanId, onSelectPlan, professionalId, onRefetch }: PlanListProps) {
  const [showNew, setShowNew] = useState(false);
  const [editTarget, setEditTarget] = useState<ExercisePlanTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExercisePlanTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const { count: programCount } = await supabase
      .from("exercise_program_routines")
      .select("id", { count: "exact", head: true })
      .eq("routine_id", deleteTarget.id);
    if ((programCount ?? 0) > 0) {
      toast.error("Este plan está en uso en uno o más programas");
      setDeleting(false);
      setDeleteTarget(null);
      return;
    }

    const { error } = await supabase.from("exercise_routines").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) { toast.error("Error al eliminar el plan", { description: error.message }); return; }
    toast.success("Plan eliminado");
    setDeleteTarget(null);
    await onRefetch();
  };

  return (
    <div className="flex flex-col gap-1">
      {plans.map((p) => (
        <div key={p.id} className="group flex items-center gap-1">
          <button
            className={cn(
              "flex-1 min-w-0 text-left px-3 py-1.5 rounded-md text-sm transition-colors",
              selectedPlanId === p.id
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted/60 text-foreground"
            )}
            onClick={() => onSelectPlan(p.id)}
          >
            <span className="truncate block">{p.name}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {itemCounts[p.id] ?? 0} ejercicio{(itemCounts[p.id] ?? 0) === 1 ? "" : "s"}
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

      {plans.length === 0 && (
        <p className="text-xs text-muted-foreground px-3 py-2">Todavía no creaste ningún plan.</p>
      )}

      <Button variant="ghost" size="sm" className="justify-start gap-2 mt-1 text-muted-foreground hover:text-foreground" onClick={() => setShowNew(true)}>
        <Plus className="h-3.5 w-3.5" />
        Nuevo plan
      </Button>

      {showNew && (
        <PlanFormDialog
          open
          onClose={() => setShowNew(false)}
          professionalId={professionalId}
          onSaved={async (p) => { await onRefetch(); onSelectPlan(p.id); }}
        />
      )}
      {editTarget && (
        <PlanFormDialog
          open
          onClose={() => setEditTarget(null)}
          professionalId={professionalId}
          onSaved={onRefetch}
          plan={editTarget}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar plan</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar "{deleteTarget?.name}" y sus {itemCounts[deleteTarget?.id ?? ""] ?? 0} ejercicio(s)? Los programas de pacientes que ya se armaron a partir de este plan no se ven afectados. Esta acción no se puede deshacer.
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
