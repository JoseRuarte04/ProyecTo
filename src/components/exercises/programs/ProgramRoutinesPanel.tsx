import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Plus, X, ChevronUp, ChevronDown, Save, Layers } from "lucide-react";
import ProgramRoutinePickerDialog from "./ProgramRoutinePickerDialog";
import type { ExerciseProgram, ExerciseProgramRoutine } from "./programLibrary";
import { toast } from "sonner";

interface ProgramRoutinesPanelProps {
  program: ExerciseProgram;
  onItemsChanged: () => void;
}

export default function ProgramRoutinesPanel({ program, onItemsChanged }: ProgramRoutinesPanelProps) {
  const [items, setItems] = useState<ExerciseProgramRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ExerciseProgramRoutine | null>(null);
  const [removing, setRemoving] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("exercise_program_routines")
      .select("id, program_id, routine_id, order_index, created_at, routine:routine_id(id, name, description)")
      .eq("program_id", program.id)
      .order("order_index");
    if (!error && data) setItems(data as unknown as ExerciseProgramRoutine[]);
    else setItems([]);
    setOrderDirty(false);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchItems(); }, [program.id]);

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const { error } = await supabase.from("exercise_program_routines").delete().eq("id", removeTarget.id);
    if (error) { toast.error("Error al quitar el plan", { description: error.message }); setRemoving(false); return; }

    const remaining = items.filter((i) => i.id !== removeTarget.id);
    if (remaining.length > 0) {
      await Promise.all(
        remaining.map((it, idx) => supabase.from("exercise_program_routines").update({ order_index: idx }).eq("id", it.id))
      );
    }
    setRemoving(false);
    setRemoveTarget(null);
    toast.success("Plan quitado del programa");
    await fetchItems();
    onItemsChanged();
  };

  const moveItem = (idx: number, dir: "up" | "down") => {
    const next = [...items];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setItems(next);
    setOrderDirty(true);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    const results = await Promise.all(
      items.map((item, idx) => supabase.from("exercise_program_routines").update({ order_index: idx }).eq("id", item.id))
    );
    setSavingOrder(false);
    if (results.some((r) => r.error)) { toast.error("Error al guardar el orden"); return; }
    toast.success("Orden guardado");
    setOrderDirty(false);
  };

  return (
    <div className="dashboard-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-semibold text-foreground truncate">{program.name}</h3>
          </div>
          {program.description && (
            <p className="text-xs text-muted-foreground mt-1 ml-6">{program.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {orderDirty && (
            <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={saveOrder} disabled={savingOrder}>
              {savingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar orden
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> Agregar plan
          </Button>
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Este programa todavía no tiene planes.</p>
            <p className="text-xs text-muted-foreground mt-1">Usá "Agregar plan" para comenzar.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item, idx) => (
              <div key={item.id} className="group flex items-start gap-3 py-3 border-b border-border last:border-0">
                {items.length > 1 && (
                  <div className="flex flex-col gap-0.5 flex-shrink-0 mt-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" disabled={idx === 0} onClick={() => moveItem(idx, "up")}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" disabled={idx === items.length - 1} onClick={() => moveItem(idx, "down")}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{item.routine.name}</span>
                  {item.routine.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.routine.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setRemoveTarget(item)} title="Quitar del programa">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <ProgramRoutinePickerDialog
          open
          onClose={() => setShowAdd(false)}
          programId={program.id}
          excludePlanIds={items.map((i) => i.routine_id)}
          nextOrderIndex={items.length}
          onSaved={async () => { await fetchItems(); onItemsChanged(); }}
        />
      )}

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar plan del programa</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quitar "{removeTarget?.routine.name}" de este programa? El plan en sí no se borra. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove} disabled={removing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
