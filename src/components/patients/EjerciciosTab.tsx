import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Dumbbell, Plus, ClipboardList, Pencil, Trash2, Search, X, ChevronUp, ChevronDown, Save } from "lucide-react";
import { ExercisePlanLinkManager } from "@/components/patients/ExercisePlanLinkManager";
import { EXERCISE_TYPES } from "@/components/exercises/exerciseLibrary";
import { toast } from "sonner";

interface ExercisePlan {
  id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ExerciseResult {
  id: string;
  name: string;
  exercise_type: string | null;
}

interface Apartado {
  id: string;
  name: string;
}

interface PlanItem {
  id: string;
  order_index: number;
  assigned_sets: number | null;
  assigned_reps: number | null;
  frequency: string | null;
  notes: string | null;
  exercise: ExerciseResult;
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = Object.fromEntries(
  EXERCISE_TYPES.map((t) => [t.value, { label: t.label, className: t.badgeClass }])
);

interface Props {
  patientId: string;
}

export function EjerciciosTab({ patientId }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<ExercisePlan | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);

  // Create plan dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createNotes, setCreateNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Apartados for filter
  const [apartados, setApartados] = useState<Apartado[]>([]);

  // Add/edit exercise dialog
  const [showExDialog, setShowExDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [apartadoFilter, setApartadoFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [searchResults, setSearchResults] = useState<ExerciseResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedEx, setSelectedEx] = useState<ExerciseResult | null>(null);
  const [formSets, setFormSets] = useState("");
  const [formReps, setFormReps] = useState("");
  const [freqValue, setFreqValue] = useState("");
  const [freqUnit, setFreqUnit] = useState<"veces/día" | "veces/semana">("veces/semana");
  const [formNotes, setFormNotes] = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reorder
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<PlanItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch plan + items ──
  const fetchPlan = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("exercise_plans")
      .select("id, notes, created_at, updated_at")
      .eq("patient_id", patientId)
      .maybeSingle();

    if (error) { toast.error("Error al cargar el plan"); setLoading(false); return; }
    setPlan(data);

    if (data) {
      const { data: itemData, error: itemErr } = await supabase
        .from("exercise_plan_items")
        .select("id, order_index, assigned_sets, assigned_reps, frequency, notes, exercise:exercise_id(id, name, exercise_type)")
        .eq("plan_id", data.id)
        .order("order_index");
      if (!itemErr && itemData) setItems(itemData as PlanItem[]);
      else setItems([]);
    }
    setOrderDirty(false);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlan();
    if (user) {
      supabase
        .from("exercise_body_regions")
        .select("id, name")
        .eq("professional_id", user.id)
        .order("name")
        .then(({ data }) => setApartados(data ?? []));
    }
  }, [patientId]);

  // ── Debounced exercise search ──
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (selectedEx || !user) { setSearchResults([]); return; }

    const hasText = searchQuery.trim().length >= 2;
    const hasFilter = apartadoFilter !== "all" || tipoFilter !== "all";
    if (!hasText && !hasFilter) { setSearchResults([]); return; }

    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      let q = supabase
        .from("exercise_library")
        .select("id, name, exercise_type")
        .eq("professional_id", user.id)
        .eq("is_active", true)
        .limit(15);

      if (hasText) q = q.ilike("name", `%${searchQuery.trim()}%`);
      if (tipoFilter !== "all") q = q.eq("exercise_type", tipoFilter);
      if (apartadoFilter === "__none__") q = q.is("body_region_id", null);
      else if (apartadoFilter !== "all") q = q.eq("body_region_id", apartadoFilter);

      const { data } = await q.order("name");
      setSearchLoading(false);
      setSearchResults(data ?? []);
    }, 300);
  }, [searchQuery, apartadoFilter, tipoFilter, user, selectedEx]);

  // ── Create plan ──
  const handleCreatePlan = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("exercise_plans")
      .insert({ patient_id: patientId, professional_id: user.id, notes: createNotes.trim() || null });
    setSaving(false);
    if (error) { toast.error("Error al crear el plan"); return; }
    toast.success("Plan creado");
    setShowCreate(false);
    setCreateNotes("");
    await fetchPlan();
  };

  // ── Open add dialog ──
  const openAdd = () => {
    setEditingItem(null);
    setSearchQuery("");
    setApartadoFilter("all");
    setTipoFilter("all");
    setSearchResults([]);
    setSelectedEx(null);
    setFormSets("");
    setFormReps("");
    setFreqValue("");
    setFreqUnit("veces/semana");
    setFormNotes("");
    setShowExDialog(true);
  };

  // ── Open edit dialog ──
  const openEdit = (item: PlanItem) => {
    setEditingItem(item);
    setSelectedEx({ id: item.exercise.id, name: item.exercise.name, exercise_type: item.exercise.exercise_type });
    setFormSets(item.assigned_sets?.toString() ?? "");
    setFormReps(item.assigned_reps?.toString() ?? "");
    if (item.frequency) {
      const spaceIdx = item.frequency.indexOf(" ");
      if (spaceIdx > -1) {
        setFreqValue(item.frequency.slice(0, spaceIdx));
        const unit = item.frequency.slice(spaceIdx + 1);
        setFreqUnit(unit === "veces/día" || unit === "veces/semana" ? unit : "veces/semana");
      } else {
        setFreqValue(item.frequency);
        setFreqUnit("veces/semana");
      }
    } else {
      setFreqValue("");
      setFreqUnit("veces/semana");
    }
    setFormNotes(item.notes ?? "");
    setSearchQuery("");
    setSearchResults([]);
    setShowExDialog(true);
  };

  const closeExDialog = () => {
    setShowExDialog(false);
    setEditingItem(null);
    setSelectedEx(null);
    setSearchQuery("");
    setApartadoFilter("all");
    setTipoFilter("all");
    setSearchResults([]);
    setFormSets("");
    setFormReps("");
    setFreqValue("");
    setFreqUnit("veces/semana");
    setFormNotes("");
  };

  // ── Save exercise (add or edit) ──
  const handleSaveExercise = async () => {
    if (!plan) return;
    if (!selectedEx) { toast.error("Seleccioná un ejercicio"); return; }
    setSaving(true);
    const frequency = freqValue.trim() ? `${freqValue.trim()} ${freqUnit}` : null;
    const sets = formSets ? parseInt(formSets) : null;
    const reps = formReps ? parseInt(formReps) : null;

    if (editingItem) {
      const { error } = await supabase
        .from("exercise_plan_items")
        .update({ assigned_sets: sets, assigned_reps: reps, frequency, notes: formNotes.trim() || null })
        .eq("id", editingItem.id);
      setSaving(false);
      if (error) { toast.error("Error al guardar cambios"); return; }
      toast.success("Ejercicio actualizado");
    } else {
      const { error } = await supabase
        .from("exercise_plan_items")
        .insert({ plan_id: plan.id, exercise_id: selectedEx.id, order_index: items.length, assigned_sets: sets, assigned_reps: reps, frequency, notes: formNotes.trim() || null });
      setSaving(false);
      if (error) { toast.error("Error al agregar ejercicio"); return; }
      toast.success("Ejercicio agregado");
    }
    closeExDialog();
    await fetchPlan();
  };

  // ── Delete exercise ──
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("exercise_plan_items").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Error al eliminar ejercicio"); setDeleting(false); return; }

    const remaining = items.filter(i => i.id !== deleteTarget.id);
    if (remaining.length > 0) {
      await Promise.all(
        remaining.map((it, idx) => supabase.from("exercise_plan_items").update({ order_index: idx }).eq("id", it.id))
      );
    }
    setDeleting(false);
    setDeleteTarget(null);
    toast.success("Ejercicio eliminado");
    await fetchPlan();
  };

  // ── Reorder ──
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
      items.map((item, idx) =>
        supabase.from("exercise_plan_items").update({ order_index: idx }).eq("id", item.id)
      )
    );
    setSavingOrder(false);
    if (results.some((r) => r.error)) { toast.error("Error al guardar el orden"); return; }
    toast.success("Orden guardado");
    setOrderDirty(false);
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!plan ? (
        /* ── Empty state ── */
        <div className="dashboard-card flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="rounded-full bg-muted p-4">
            <Dumbbell className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Sin plan de ejercicios</p>
            <p className="text-xs text-muted-foreground mt-1">Creá un plan para asignar ejercicios domiciliarios.</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Crear plan
          </Button>
        </div>
      ) : (
        /* ── Plan view ── */
        <div className="dashboard-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted">
            <div className="flex items-center gap-2.5">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Plan de ejercicios domiciliarios</h3>
            </div>
            <div className="flex items-center gap-2">
              {orderDirty && (
                <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={saveOrder} disabled={savingOrder}>
                  {savingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Guardar orden
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" /> Agregar ejercicio
              </Button>
            </div>
          </div>

          {plan.notes && (
            <div className="px-5 py-3 border-b border-border">
              <p className="field-label mb-1">Notas del plan</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{plan.notes}</p>
            </div>
          )}

          <div className="px-5 py-4">
            {items.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No hay ejercicios en el plan.</p>
                <p className="text-xs text-muted-foreground mt-1">Usá "Agregar ejercicio" para comenzar.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {items.map((item, idx) => {
                  const badge = item.exercise.exercise_type ? TYPE_BADGE[item.exercise.exercise_type] : null;
                  const dosage = item.assigned_sets && item.assigned_reps
                    ? `${item.assigned_sets} series × ${item.assigned_reps} reps`
                    : item.assigned_sets ? `${item.assigned_sets} series`
                    : item.assigned_reps ? `${item.assigned_reps} reps`
                    : null;

                  return (
                    <div key={item.id} className="group flex items-start gap-3 py-3 border-b border-border last:border-0">
                      {/* Reorder buttons */}
                      {items.length > 1 && (
                        <div className="flex flex-col gap-0.5 flex-shrink-0 mt-0.5">
                          <Button
                            variant="ghost" size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            disabled={idx === 0}
                            onClick={() => moveItem(idx, "up")}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            disabled={idx === items.length - 1}
                            onClick={() => moveItem(idx, "down")}
                          >
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
                          {badge && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${badge.className}`}>
                              {badge.label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {dosage && <span className="text-xs text-muted-foreground">{dosage}</span>}
                          {item.frequency && <span className="text-xs text-muted-foreground">{item.frequency}</span>}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
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
        </div>
      )}

      {/* ── Dialog crear plan ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear plan de ejercicios</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="field-label mb-1.5">Notas (opcional)</p>
              <Textarea
                placeholder="Indicaciones generales del plan..."
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowCreate(false); setCreateNotes(""); }}>
                Cancelar
              </Button>
              <Button onClick={handleCreatePlan} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Crear plan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Link manager (solo cuando hay plan) ── */}
      {plan && (
        <ExercisePlanLinkManager planId={plan.id} patientId={patientId} />
      )}

      {/* ── Dialog agregar / editar ejercicio ── */}
      <Dialog open={showExDialog} onOpenChange={(open) => { if (!open) closeExDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar dosificación" : "Agregar ejercicio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Búsqueda (solo en modo agregar) */}
            {!editingItem ? (
              <div>
                <p className="field-label mb-1.5">Ejercicio</p>
                {selectedEx ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/50">
                    <span className="flex-1 text-sm font-medium">{selectedEx.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => { setSelectedEx(null); setSearchQuery(""); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Filtros: apartado + tipo */}
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={apartadoFilter} onValueChange={setApartadoFilter}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Apartado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los apartados</SelectItem>
                          {apartados.map((ap) => (
                            <SelectItem key={ap.id} value={ap.id}>{ap.name}</SelectItem>
                          ))}
                          <SelectItem value="__none__">Sin apartado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={tipoFilter} onValueChange={setTipoFilter}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los tipos</SelectItem>
                          {EXERCISE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Búsqueda por nombre */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pl-8"
                        placeholder="Buscar por nombre..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                      {(searchLoading || searchResults.length > 0) && (
                        <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-52 overflow-y-auto">
                          {searchLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : searchResults.map((ex) => {
                            const b = ex.exercise_type ? TYPE_BADGE[ex.exercise_type] : null;
                            return (
                              <button
                                key={ex.id}
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 flex items-center gap-2 border-b border-border last:border-0"
                                onClick={() => { setSelectedEx(ex); setSearchQuery(ex.name); setSearchResults([]); }}
                              >
                                <span className="flex-1">{ex.name}</span>
                                {b && <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${b.className}`}>{b.label}</Badge>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="field-label mb-1.5">Ejercicio</p>
                <div className="px-3 py-2 rounded-md border border-border bg-muted/50">
                  <span className="text-sm font-medium">{selectedEx?.name}</span>
                </div>
              </div>
            )}

            {/* Dosage fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="field-label mb-1.5">Series</p>
                <Input
                  type="number"
                  min="1"
                  placeholder="ej. 3"
                  value={formSets}
                  onChange={(e) => setFormSets(e.target.value)}
                />
              </div>
              <div>
                <p className="field-label mb-1.5">Repeticiones</p>
                <Input
                  type="number"
                  min="1"
                  placeholder="ej. 15"
                  value={formReps}
                  onChange={(e) => setFormReps(e.target.value)}
                />
              </div>
            </div>

            <div>
              <p className="field-label mb-1.5">Frecuencia</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  placeholder="ej. 2"
                  value={freqValue}
                  onChange={(e) => setFreqValue(e.target.value)}
                  className="w-24"
                />
                <Select value={freqUnit} onValueChange={(v) => setFreqUnit(v as "veces/día" | "veces/semana")}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veces/día">veces/día</SelectItem>
                    <SelectItem value="veces/semana">veces/semana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="field-label mb-1.5">Notas (opcional)</p>
              <Textarea
                placeholder="Indicaciones adicionales..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeExDialog}>Cancelar</Button>
              <Button onClick={handleSaveExercise} disabled={saving || (!editingItem && !selectedEx)}>
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {editingItem ? "Guardar cambios" : "Agregar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm delete ── */}
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
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
