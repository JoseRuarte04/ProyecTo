import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Save, ClipboardList } from "lucide-react";
import { getExerciseTypes } from "@/components/exercises/exerciseLibrary";
import type { Apartado } from "@/components/exercises/ApartadosPanel";
import PlanItemFormDialog from "./PlanItemFormDialog";
import type { ExercisePlanTemplate, ExercisePlanTemplateItem } from "./planLibrary";
import { toast } from "sonner";

interface PlanItemsPanelProps {
  plan: ExercisePlanTemplate;
  apartados: Apartado[];
  onItemsChanged: () => void;
}

export default function PlanItemsPanel({ plan, apartados, onItemsChanged }: PlanItemsPanelProps) {
  const [items, setItems] = useState<ExercisePlanTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<ExercisePlanTemplateItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExercisePlanTemplateItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("exercise_routine_items")
      .select("id, routine_id, exercise_id, order_index, suggested_sets, suggested_reps, frequency, notes, created_at, exercise:exercise_id(id, name, exercise_type)")
      .eq("routine_id", plan.id)
      .order("order_index");
    if (!error && data) setItems(data as unknown as ExercisePlanTemplateItem[]);
    else setItems([]);
    setOrderDirty(false);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchItems(); }, [plan.id]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("exercise_routine_items").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Error al eliminar ejercicio", { description: error.message }); setDeleting(false); return; }

    const remaining = items.filter((i) => i.id !== deleteTarget.id);
    if (remaining.length > 0) {
      await Promise.all(
        remaining.map((it, idx) => supabase.from("exercise_routine_items").update({ order_index: idx }).eq("id", it.id))
      );
    }
    setDeleting(false);
    setDeleteTarget(null);
    toast.success("Ejercicio eliminado del plan");
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
      items.map((item, idx) => supabase.from("exercise_routine_items").update({ order_index: idx }).eq("id", item.id))
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
            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-semibold text-foreground truncate">{plan.name}</h3>
          </div>
          {plan.description && (
            <p className="text-xs text-muted-foreground mt-1 ml-6">{plan.description}</p>
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
            <Plus className="h-3.5 w-3.5" /> Agregar ejercicio
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
            <p className="text-sm text-muted-foreground">Este plan todavía no tiene ejercicios.</p>
            <p className="text-xs text-muted-foreground mt-1">Usá "Agregar ejercicio" para comenzar.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item, idx) => {
              const badges = getExerciseTypes(item.exercise.exercise_type);
              const dosage = item.suggested_sets && item.suggested_reps
                ? `${item.suggested_sets} series × ${item.suggested_reps} reps`
                : item.suggested_sets ? `${item.suggested_sets} series`
                : item.suggested_reps ? `${item.suggested_reps} reps`
                : null;

              return (
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{item.exercise.name}</span>
                      {badges.map((badge) => (
                        <Badge key={badge.value} variant="outline" className={`text-[10px] px-1.5 py-0 border ${badge.badgeClass}`}>{badge.label}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {dosage && <span className="text-xs text-muted-foreground">{dosage}</span>}
                      {item.frequency && <span className="text-xs text-muted-foreground">{item.frequency}</span>}
                    </div>
                    {item.notes && <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(item)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <PlanItemFormDialog
          open
          onClose={() => setShowAdd(false)}
          planId={plan.id}
          apartados={apartados}
          nextOrderIndex={items.length}
          onSaved={async () => { await fetchItems(); onItemsChanged(); }}
        />
      )}
      {editingItem && (
        <PlanItemFormDialog
          open
          onClose={() => setEditingItem(null)}
          planId={plan.id}
          apartados={apartados}
          nextOrderIndex={items.length}
          onSaved={fetchItems}
          editingItem={editingItem}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ejercicio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar "{deleteTarget?.exercise.name}" del plan? Esta acción no se puede deshacer.
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
