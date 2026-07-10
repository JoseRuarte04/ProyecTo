import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Eye, Edit, FileDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { StatusBadge } from "@/components/status";
import { exportPlanPdf } from "@/components/plans/PlanPdfExport";

export interface SelectedExercise {
  id: string;
  name: string;
  body_region: string | null;
  repetitions: number | null;
  sets: number | null;
  frequency: string;
  duration: string;
  notes: string;
}

const emptyPlanForm = () => ({
  title: "", objective: "", indications: "", skin_care: "",
  joint_protection_guidelines: "", home_item_recommendations: "",
  start_date: new Date().toISOString().split("T")[0], end_date: "", notes: "",
});

// ---------- Exercise picker (shared between New and Edit) ----------

interface ExercisePickerProps {
  exercises: any[];
  loadingEx: boolean;
  searchEx: string;
  onSearch: (v: string) => void;
  selectedExercises: SelectedExercise[];
  onToggle: (ex: any) => void;
  onUpdate: (id: string, field: string, value: any) => void;
}

function ExercisePicker({ exercises, loadingEx, searchEx, onSearch, selectedExercises, onToggle, onUpdate }: ExercisePickerProps) {
  const filtered = exercises.filter(e => e.name.toLowerCase().includes(searchEx.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar ejercicio..." value={searchEx} onChange={(e) => onSearch(e.target.value)} />
      </div>
      {loadingEx ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {filtered.map((ex) => {
            const selected = selectedExercises.find(s => s.id === ex.id);
            return (
              <div key={ex.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox checked={!!selected} onCheckedChange={() => onToggle(ex)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ex.name}</p>
                    {ex.exercise_body_regions?.name && <p className="text-xs text-muted-foreground">{ex.exercise_body_regions.name}</p>}
                  </div>
                </div>
                {selected && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-7">
                    <div className="space-y-1"><Label className="text-xs">Repeticiones</Label><Input type="number" className="h-8 text-xs" value={selected.repetitions ?? ""} onChange={(e) => onUpdate(ex.id, "repetitions", e.target.value ? parseInt(e.target.value) : null)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Series</Label><Input type="number" className="h-8 text-xs" value={selected.sets ?? ""} onChange={(e) => onUpdate(ex.id, "sets", e.target.value ? parseInt(e.target.value) : null)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Frecuencia</Label><Input className="h-8 text-xs" value={selected.frequency} onChange={(e) => onUpdate(ex.id, "frequency", e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Duración</Label><Input className="h-8 text-xs" value={selected.duration} onChange={(e) => onUpdate(ex.id, "duration", e.target.value)} /></div>
                    <div className="col-span-2 sm:col-span-4 space-y-1"><Label className="text-xs">Notas</Label><Input className="h-8 text-xs" value={selected.notes} onChange={(e) => onUpdate(ex.id, "notes", e.target.value)} /></div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No se encontraron ejercicios.</p>}
        </div>
      )}
      {selectedExercises.length > 0 && (
        <p className="text-xs text-muted-foreground">{selectedExercises.length} ejercicio(s) seleccionado(s)</p>
      )}
    </div>
  );
}

// ---------- NewPlanDialog ----------

interface NewPlanProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  userId: string;
  onSaved: () => void;
}

export function NewPlanDialog({ open, onClose, patientId, userId, onSaved }: NewPlanProps) {
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyPlanForm());
  const [exercises, setExercises] = useState<any[]>([]);
  const [searchEx, setSearchEx] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);

  useEffect(() => {
    if (step === 2 && exercises.length === 0) {
      setLoadingEx(true);
      supabase.from("exercise_library").select("id, name, suggested_sets, suggested_reps, exercise_body_regions(name)").eq("professional_id", userId).eq("is_active", true)
        .then(({ data }) => { setExercises(data || []); setLoadingEx(false); });
    }
  }, [step]);

  const resetAndClose = () => {
    setStep(1); setForm(emptyPlanForm()); setSelectedExercises([]); setSearchEx(""); onClose();
  };

  const toggleExercise = (ex: any) => {
    const exists = selectedExercises.find(s => s.id === ex.id);
    if (exists) {
      setSelectedExercises(selectedExercises.filter(s => s.id !== ex.id));
    } else {
      setSelectedExercises([...selectedExercises, { id: ex.id, name: ex.name, body_region: ex.exercise_body_regions?.name ?? null, repetitions: ex.suggested_reps, sets: ex.suggested_sets, frequency: "", duration: "", notes: "" }]);
    }
  };

  const updateSelected = (id: string, field: string, value: any) =>
    setSelectedExercises(selectedExercises.map(s => s.id === id ? { ...s, [field]: value } : s));

  const handleSave = async () => {
    setSaving(true);
    const { data: plan, error } = await supabase.from("treatment_plans").insert({
      patient_id: patientId, professional_id: userId, title: form.title,
      objective: form.objective || null, indications: form.indications || null,
      skin_care: form.skin_care || null, joint_protection_guidelines: form.joint_protection_guidelines || null,
      home_item_recommendations: form.home_item_recommendations || null,
      start_date: form.start_date, end_date: form.end_date || null, notes: form.notes || null, status: "active" as const,
    }).select().single();

    if (error || !plan) { setSaving(false); toast.error("Error al crear el plan de tratamiento"); return; }

    if (selectedExercises.length > 0) {
      await supabase.from("treatment_plan_exercises").insert(
        selectedExercises.map((ex, i) => ({ treatment_plan_id: plan.id, exercise_id: ex.id, repetitions: ex.repetitions, sets: ex.sets, frequency: ex.frequency || null, duration: ex.duration || null, notes: ex.notes || null, order_index: i }))
      );
    }

    setSaving(false);
    toast.success("Plan de tratamiento creado correctamente");
    onSaved();
    resetAndClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Plan de Tratamiento — Paso {step} de 2</DialogTitle>
          <DialogDescription className="sr-only">Formulario para crear un nuevo plan de tratamiento</DialogDescription>
        </DialogHeader>
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Plan de rehabilitación mano derecha" /></div>
            <div className="space-y-2"><Label>Objetivo terapéutico</Label><Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Indicaciones generales</Label><Textarea value={form.indications} onChange={(e) => setForm({ ...form, indications: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Cuidado de piel</Label><Textarea value={form.skin_care} onChange={(e) => setForm({ ...form, skin_care: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Pautas de protección articular</Label><Textarea value={form.joint_protection_guidelines} onChange={(e) => setForm({ ...form, joint_protection_guidelines: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Recomendaciones para el hogar</Label><Textarea value={form.home_item_recommendations} onChange={(e) => setForm({ ...form, home_item_recommendations: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Fecha inicio</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fecha fin (opcional)</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button onClick={() => setStep(2)} disabled={!form.title.trim()}>Siguiente →</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <>
            <ExercisePicker exercises={exercises} loadingEx={loadingEx} searchEx={searchEx} onSearch={setSearchEx} selectedExercises={selectedExercises} onToggle={toggleExercise} onUpdate={updateSelected} />
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Volver</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Plan"}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- PlanDetailDialog ----------

interface PlanDetailProps {
  plan: any;
  onClose: () => void;
}

export function PlanDetailDialog({ plan, onClose }: PlanDetailProps) {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (plan) {
      setLoading(true);
      supabase.from("treatment_plan_exercises").select("*, exercise_library(name, exercise_body_regions(name))").eq("treatment_plan_id", plan.id).order("order_index")
        .then(({ data }) => { setExercises(data || []); setLoading(false); });
    } else {
      setExercises([]);
    }
  }, [plan]);

  return (
    <Dialog open={!!plan} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan?.title}</DialogTitle>
          <DialogDescription className="sr-only">Detalle del plan de tratamiento</DialogDescription>
        </DialogHeader>
        {plan && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={plan.status} />
              <span className="text-sm text-muted-foreground">
                {format(new Date(plan.start_date), "dd/MM/yyyy")}
                {plan.end_date ? ` — ${format(new Date(plan.end_date), "dd/MM/yyyy")}` : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                ["Objetivo", plan.objective], ["Indicaciones", plan.indications],
                ["Cuidado de piel", plan.skin_care], ["Protección articular", plan.joint_protection_guidelines],
                ["Recomendaciones hogar", plan.home_item_recommendations], ["Notas", plan.notes],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-muted-foreground text-xs font-medium">{label as string}</p>
                  <p className="text-foreground">{(value as string) || "—"}</p>
                </div>
              ))}
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">Ejercicios asignados</h3>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : exercises.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ejercicios asignados.</p>
              ) : (
                <div className="space-y-2">
                  {exercises.map((ex) => (
                    <div key={ex.id} className="border rounded-lg p-3 text-sm">
                      <p className="font-medium">{ex.custom_name || ex.exercise_library?.name || "Ejercicio"}</p>
                      {ex.exercise_library?.exercise_body_regions?.name && <p className="text-xs text-muted-foreground">{ex.exercise_library.exercise_body_regions.name}</p>}
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {ex.repetitions && <span>Rep: {ex.repetitions}</span>}
                        {ex.sets && <span>Series: {ex.sets}</span>}
                        {ex.frequency && <span>Frec: {ex.frequency}</span>}
                        {ex.duration && <span>Dur: {ex.duration}</span>}
                      </div>
                      {ex.notes && <p className="text-xs text-muted-foreground mt-1">{ex.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- EditPlanDialog ----------

interface EditPlanProps {
  plan: any;
  onClose: () => void;
  patientId: string;
  userId: string;
  onSaved: () => void;
}

export function EditPlanDialog({ plan, onClose, patientId, userId, onSaved }: EditPlanProps) {
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...emptyPlanForm(), status: "active" as string });
  const [exercises, setExercises] = useState<any[]>([]);
  const [searchEx, setSearchEx] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (plan && !initialized) {
      setForm({
        title: plan.title || "", objective: plan.objective || "", indications: plan.indications || "",
        skin_care: plan.skin_care || "", joint_protection_guidelines: plan.joint_protection_guidelines || "",
        home_item_recommendations: plan.home_item_recommendations || "",
        start_date: plan.start_date || "", end_date: plan.end_date || "",
        notes: plan.notes || "", status: plan.status || "active",
      });
      setStep(1);
      setInitialized(true);
      supabase.from("treatment_plan_exercises").select("*, exercise_library(name, exercise_body_regions(name))").eq("treatment_plan_id", plan.id).order("order_index")
        .then(({ data }) => {
          if (data) {
            setSelectedExercises(data.map((ex: any) => ({
              id: ex.exercise_id, name: ex.custom_name || ex.exercise_library?.name || "",
              body_region: ex.exercise_library?.exercise_body_regions?.name || null,
              repetitions: ex.repetitions, sets: ex.sets,
              frequency: ex.frequency || "", duration: ex.duration || "", notes: ex.notes || "",
            })));
          }
        });
    }
    if (!plan) { setInitialized(false); setSelectedExercises([]); setExercises([]); setSearchEx(""); }
  }, [plan, initialized]);

  useEffect(() => {
    if (plan && step === 2 && exercises.length === 0) {
      setLoadingEx(true);
      supabase.from("exercise_library").select("id, name, suggested_sets, suggested_reps, exercise_body_regions(name)").eq("professional_id", userId).eq("is_active", true)
        .then(({ data }) => { setExercises(data || []); setLoadingEx(false); });
    }
  }, [step, plan]);

  const resetAndClose = () => { setStep(1); setInitialized(false); onClose(); };

  const toggleExercise = (ex: any) => {
    const exists = selectedExercises.find(s => s.id === ex.id);
    if (exists) {
      setSelectedExercises(selectedExercises.filter(s => s.id !== ex.id));
    } else {
      setSelectedExercises([...selectedExercises, { id: ex.id, name: ex.name, body_region: ex.exercise_body_regions?.name ?? null, repetitions: ex.suggested_reps, sets: ex.suggested_sets, frequency: "", duration: "", notes: "" }]);
    }
  };

  const updateSelected = (id: string, field: string, value: any) =>
    setSelectedExercises(selectedExercises.map(s => s.id === id ? { ...s, [field]: value } : s));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("treatment_plans").update({
      title: form.title, objective: form.objective || null, indications: form.indications || null,
      skin_care: form.skin_care || null, joint_protection_guidelines: form.joint_protection_guidelines || null,
      home_item_recommendations: form.home_item_recommendations || null,
      start_date: form.start_date, end_date: form.end_date || null,
      notes: form.notes || null, status: form.status as any,
    }).eq("id", plan.id);

    if (error) { setSaving(false); toast.error("Error al actualizar el plan"); return; }

    await supabase.from("treatment_plan_exercises").delete().eq("treatment_plan_id", plan.id);
    if (selectedExercises.length > 0) {
      await supabase.from("treatment_plan_exercises").insert(
        selectedExercises.map((ex, i) => ({ treatment_plan_id: plan.id, exercise_id: ex.id, repetitions: ex.repetitions, sets: ex.sets, frequency: ex.frequency || null, duration: ex.duration || null, notes: ex.notes || null, order_index: i }))
      );
    }

    setSaving(false);
    toast.success("Plan actualizado correctamente");
    onSaved();
    resetAndClose();
  };

  return (
    <Dialog open={!!plan} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Plan — Paso {step} de 2</DialogTitle>
          <DialogDescription className="sr-only">Formulario para editar plan de tratamiento</DialogDescription>
        </DialogHeader>
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="archived">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Objetivo terapéutico</Label><Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Indicaciones generales</Label><Textarea value={form.indications} onChange={(e) => setForm({ ...form, indications: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Cuidado de piel</Label><Textarea value={form.skin_care} onChange={(e) => setForm({ ...form, skin_care: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Pautas de protección articular</Label><Textarea value={form.joint_protection_guidelines} onChange={(e) => setForm({ ...form, joint_protection_guidelines: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Recomendaciones para el hogar</Label><Textarea value={form.home_item_recommendations} onChange={(e) => setForm({ ...form, home_item_recommendations: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Fecha inicio</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fecha fin (opcional)</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button onClick={() => setStep(2)} disabled={!form.title.trim()}>Siguiente →</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <>
            <ExercisePicker exercises={exercises} loadingEx={loadingEx} searchEx={searchEx} onSearch={setSearchEx} selectedExercises={selectedExercises} onToggle={toggleExercise} onUpdate={updateSelected} />
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Volver</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- DeletePlanConfirm ----------

interface DeletePlanProps {
  plan: any;
  onClose: () => void;
  onSaved: () => void;
}

export function DeletePlanConfirm({ plan, onClose, onSaved }: DeletePlanProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("treatment_plans").update({ is_deleted: true }).eq("id", plan.id);
    setDeleting(false);
    if (error) { toast.error("Error al eliminar el plan"); return; }
    toast.success("Plan eliminado correctamente");
    onSaved();
    onClose();
  };

  return (
    <AlertDialog open={!!plan} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar plan de tratamiento?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará el plan "{plan?.title}". Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- PlanCardActions ----------

interface PlanCardActionsProps {
  plan: any;
  patient: any;
  onDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PlanCardActions({ plan, patient, onDetail, onEdit, onDelete }: PlanCardActionsProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPlanPdf(plan, patient);
      toast.success("PDF exportado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("Error al exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
      <Button variant="default" size="sm" className="flex-1 min-w-0" onClick={onDetail}>
        <Eye className="h-4 w-4 mr-1 shrink-0" /> Detalle
      </Button>
      <Button variant="outline" size="sm" className="flex-1 min-w-0" onClick={onEdit}>
        <Edit className="h-4 w-4 mr-1 shrink-0" /> Editar
      </Button>
      <Button variant="outline" size="sm" className="flex-1 min-w-0" onClick={handleExport} disabled={exporting}>
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4 mr-1 shrink-0" /> PDF</>}
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
