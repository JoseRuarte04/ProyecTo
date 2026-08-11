import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Search, X, Trash2, ClipboardList } from "lucide-react";
import { EXERCISE_TYPES } from "@/components/exercises/exerciseLibrary";
import type { Routine } from "@/components/exercises/routines/routineLibrary";
import { toast } from "sonner";

const TYPE_BADGE: Record<string, { label: string; className: string }> = Object.fromEntries(
  EXERCISE_TYPES.map((t) => [t.value, { label: t.label, className: t.badgeClass }])
);

interface ExerciseResult {
  id: string;
  name: string;
  exercise_type: string | null;
}

interface DraftItem {
  exercise_id: string;
  name: string;
  exercise_type: string | null;
  assigned_sets: string;
  assigned_reps: string;
  frequency: string;
  notes: string;
}

interface ApplyRoutineWizardProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  currentPlan: { start_date: string | null; duration_weeks: number | null; notes: string | null } | null;
  onApplied: () => void;
}

export function ApplyRoutineWizard({ open, onClose, patientId, currentPlan, onApplied }: ApplyRoutineWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Paso 1
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routinesLoading, setRoutinesLoading] = useState(true);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);

  // Paso 2
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<ExerciseResult[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const addDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paso 3
  const [startDate, setStartDate] = useState(currentPlan?.start_date ?? "");
  const [durationWeeks, setDurationWeeks] = useState(currentPlan?.duration_weeks?.toString() ?? "");
  const [planNotes, setPlanNotes] = useState(currentPlan?.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setStep(1);
    setSelectedRoutine(null);
    setDraftItems([]);
    setStartDate(currentPlan?.start_date ?? "");
    setDurationWeeks(currentPlan?.duration_weeks?.toString() ?? "");
    setPlanNotes(currentPlan?.notes ?? "");
    setRoutinesLoading(true);
    supabase
      .from("exercise_routines")
      .select("*")
      .eq("professional_id", user.id)
      .order("name")
      .then(({ data }) => { setRoutines(data ?? []); setRoutinesLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const goToStep2 = async (routine: Routine) => {
    setSelectedRoutine(routine);
    setItemsLoading(true);
    setStep(2);
    const { data, error } = await supabase
      .from("exercise_routine_items")
      .select("exercise_id, suggested_sets, suggested_reps, frequency, notes, order_index, exercise:exercise_id(id, name, exercise_type)")
      .eq("routine_id", routine.id)
      .order("order_index");
    setItemsLoading(false);
    if (error) { toast.error("Error al cargar los ejercicios de la rutina", { description: error.message }); return; }
    setDraftItems(
      (data ?? []).map((row) => ({
        exercise_id: row.exercise_id,
        name: row.exercise?.name ?? "",
        exercise_type: row.exercise?.exercise_type ?? null,
        assigned_sets: row.suggested_sets?.toString() ?? "",
        assigned_reps: row.suggested_reps?.toString() ?? "",
        frequency: row.frequency ?? "",
        notes: row.notes ?? "",
      }))
    );
  };

  // ── Búsqueda para agregar ejercicios extra en el paso 2 ──
  useEffect(() => {
    if (addDebounce.current) clearTimeout(addDebounce.current);
    if (!user || addQuery.trim().length < 2) { setAddResults([]); return; }
    addDebounce.current = setTimeout(async () => {
      setAddSearching(true);
      const { data } = await supabase
        .from("exercise_library")
        .select("id, name, exercise_type")
        .eq("professional_id", user.id)
        .eq("is_active", true)
        .ilike("name", `%${addQuery.trim()}%`)
        .limit(10)
        .order("name");
      setAddSearching(false);
      setAddResults((data ?? []).filter((ex) => !draftItems.some((d) => d.exercise_id === ex.id)));
    }, 300);
  }, [addQuery, user, draftItems]);

  const addDraftItem = (ex: ExerciseResult) => {
    setDraftItems((prev) => [...prev, {
      exercise_id: ex.id, name: ex.name, exercise_type: ex.exercise_type,
      assigned_sets: "", assigned_reps: "", frequency: "", notes: "",
    }]);
    setAddQuery("");
    setAddResults([]);
  };

  const removeDraftItem = (idx: number) => setDraftItems((prev) => prev.filter((_, i) => i !== idx));

  const updateDraftItem = (idx: number, patch: Partial<DraftItem>) =>
    setDraftItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const handleConfirm = async () => {
    if (draftItems.length === 0) { toast.error("Agregá al menos un ejercicio"); return; }
    const duration = durationWeeks ? parseInt(durationWeeks) : null;
    if (durationWeeks && (!Number.isInteger(duration) || (duration ?? 0) <= 0)) {
      toast.error("La duración debe ser un número entero mayor a 0");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("add_routine_to_exercise_plan", {
      p_patient_id: patientId,
      p_routine_id: selectedRoutine?.id ?? null,
      p_items: draftItems.map((it, idx) => ({
        exercise_id: it.exercise_id,
        order_index: idx,
        assigned_sets: it.assigned_sets || null,
        assigned_reps: it.assigned_reps || null,
        frequency: it.frequency.trim() || null,
        notes: it.notes.trim() || null,
      })),
      p_start_date: startDate || null,
      p_duration_weeks: duration,
      p_notes: planNotes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Error al aplicar la rutina", { description: error.message }); return; }
    toast.success("Rutina aplicada al programa del paciente");
    onApplied();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Aplicar rutina — Paso {step} de 3
          </DialogTitle>
        </DialogHeader>

        {/* ── Paso 1: elegir rutina ── */}
        {step === 1 && (
          <div className="space-y-3 pt-1">
            {routinesLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : routines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Todavía no creaste ninguna rutina. Armá una desde Biblioteca de Ejercicios → tab Rutinas.
              </p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {routines.map((r) => (
                  <button
                    key={r.id}
                    className="w-full text-left px-3 py-2.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
                    onClick={() => goToStep2(r)}
                  >
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* ── Paso 2: revisar / editar ejercicios ── */}
        {step === 2 && (
          <div className="space-y-3 pt-1">
            {itemsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Ajustá las cantidades para este paciente — no modifica la rutina original.
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {draftItems.map((it, idx) => {
                    const badge = it.exercise_type ? TYPE_BADGE[it.exercise_type] : null;
                    return (
                      <div key={`${it.exercise_id}-${idx}`} className="border border-border rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate">{it.name}</span>
                            {badge && <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border shrink-0 ${badge.className}`}>{badge.label}</Badge>}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => removeDraftItem(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input placeholder="Series" type="number" min="1" value={it.assigned_sets} onChange={(e) => updateDraftItem(idx, { assigned_sets: e.target.value })} className="h-8 text-xs" />
                          <Input placeholder="Reps" type="number" min="1" value={it.assigned_reps} onChange={(e) => updateDraftItem(idx, { assigned_reps: e.target.value })} className="h-8 text-xs" />
                          <Input placeholder="Frecuencia" value={it.frequency} onChange={(e) => updateDraftItem(idx, { frequency: e.target.value })} className="h-8 text-xs" />
                        </div>
                      </div>
                    );
                  })}
                  {draftItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Sin ejercicios — agregá alguno abajo.</p>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input className="pl-8" placeholder="Agregar otro ejercicio..." value={addQuery} onChange={(e) => setAddQuery(e.target.value)} />
                  {(addSearching || addResults.length > 0) && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {addSearching ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : addResults.map((ex) => (
                        <button key={ex.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 border-b border-border last:border-0" onClick={() => addDraftItem(ex)}>
                          {ex.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-1">
                  <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
                  <Button onClick={() => setStep(3)} disabled={draftItems.length === 0}>Siguiente</Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Paso 3: programación ── */}
        {step === 3 && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha de inicio</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Duración (semanas)</Label>
                <Input type="number" min="1" placeholder="ej. 6" value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas del programa (opcional)</Label>
              <Textarea value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} rows={3} placeholder="Indicaciones generales..." />
            </div>
            <div className="flex justify-between pt-1">
              <Button variant="outline" onClick={() => setStep(2)}>Atrás</Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Aplicar rutina
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
