import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ExercisePlanTemplate } from "@/components/exercises/plans/planLibrary";

interface ProgramRoutinePickerDialogProps {
  open: boolean;
  onClose: () => void;
  programId: string;
  excludePlanIds: string[];
  nextOrderIndex: number;
  onSaved: () => void;
}

export default function ProgramRoutinePickerDialog({ open, onClose, programId, excludePlanIds, nextOrderIndex, onSaved }: ProgramRoutinePickerDialogProps) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<ExercisePlanTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("exercise_routines")
      .select("*")
      .eq("professional_id", user.id)
      .order("name")
      .then(({ data }) => { setPlans(data ?? []); setLoading(false); });
  }, [open, user]);

  const available = plans.filter((p) => !excludePlanIds.includes(p.id));

  const handleAdd = async (plan: ExercisePlanTemplate) => {
    setAddingId(plan.id);
    const { error } = await supabase
      .from("exercise_program_routines")
      .insert({ program_id: programId, routine_id: plan.id, order_index: nextOrderIndex });
    setAddingId(null);
    if (error) { toast.error("Error al agregar el plan", { description: error.message }); return; }
    toast.success("Plan agregado al programa");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar plan al programa</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 pt-1 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : available.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {plans.length === 0
                ? "Todavía no creaste ningún plan. Armá uno desde la pestaña Planes."
                : "Ya agregaste todos tus planes a este programa."}
            </p>
          ) : (
            available.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2.5 rounded-md border border-border hover:bg-muted/50 transition-colors flex items-center justify-between gap-2"
                onClick={() => handleAdd(p)}
                disabled={addingId !== null}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
                </div>
                {addingId === p.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
