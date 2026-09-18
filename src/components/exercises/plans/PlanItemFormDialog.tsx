import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X } from "lucide-react";
import { EXERCISE_TYPES, getExerciseTypes } from "@/components/exercises/exerciseLibrary";
import type { Apartado } from "@/components/exercises/ApartadosPanel";
import type { ExercisePlanTemplateItem } from "./planLibrary";
import { toast } from "sonner";
import { useDirtyDeps } from "@/hooks/useDirtyDeps";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";

interface ExerciseResult {
  id: string;
  name: string;
  exercise_type: string | null;
}

interface PlanItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  apartados: Apartado[];
  nextOrderIndex: number;
  onSaved: () => void;
  editingItem?: ExercisePlanTemplateItem;
}

export default function PlanItemFormDialog({ open, onClose, planId, apartados, nextOrderIndex, onSaved, editingItem }: PlanItemFormDialogProps) {
  const { user } = useAuth();
  const isEdit = !!editingItem;

  const [searchQuery, setSearchQuery] = useState("");
  const [apartadoFilter, setApartadoFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [searchResults, setSearchResults] = useState<ExerciseResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedEx, setSelectedEx] = useState<ExerciseResult | null>(
    editingItem ? { id: editingItem.exercise.id, name: editingItem.exercise.name, exercise_type: editingItem.exercise.exercise_type } : null
  );
  const [formSets, setFormSets] = useState(editingItem?.suggested_sets?.toString() ?? "");
  const [formReps, setFormReps] = useState(editingItem?.suggested_reps?.toString() ?? "");
  const [freqValue, setFreqValue] = useState("");
  const [freqUnit, setFreqUnit] = useState<"veces/día" | "veces/semana">("veces/semana");
  const [formNotes, setFormNotes] = useState(editingItem?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isDirty, resetDirty] = useDirtyDeps([selectedEx, formSets, formReps, freqValue, freqUnit, formNotes]);
  const { guard, confirmOpen, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
  const closeGuarded = () => guard(onClose);

  useEffect(() => {
    if (editingItem?.frequency) {
      const spaceIdx = editingItem.frequency.indexOf(" ");
      if (spaceIdx > -1) {
        setFreqValue(editingItem.frequency.slice(0, spaceIdx));
        const unit = editingItem.frequency.slice(spaceIdx + 1);
        setFreqUnit(unit === "veces/día" || unit === "veces/semana" ? unit : "veces/semana");
      } else {
        setFreqValue(editingItem.frequency);
      }
    }
  }, [editingItem]);

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
        .or(`professional_id.eq.${user.id},professional_id.is.null`)
        .eq("is_active", true)
        .limit(15);

      if (hasText) q = q.ilike("name", `%${searchQuery.trim()}%`);
      if (tipoFilter !== "all") {
        // exercise_type puede ser un valor combinado ("activo; fortalecimiento",
        // ver catálogo HEP2go) — matchea el filtro exacto o como token dentro
        // de la lista separada por "; ".
        q = q.or(`exercise_type.eq.${tipoFilter},exercise_type.ilike.${tipoFilter}; %,exercise_type.ilike.%; ${tipoFilter}`);
      }
      if (apartadoFilter === "__none__") q = q.is("body_region_id", null);
      else if (apartadoFilter !== "all") q = q.eq("body_region_id", apartadoFilter);

      const { data } = await q.order("name");
      setSearchLoading(false);
      setSearchResults(data ?? []);
    }, 300);
  }, [searchQuery, apartadoFilter, tipoFilter, user, selectedEx]);

  const handleSave = async () => {
    if (!selectedEx) { toast.error("Seleccioná un ejercicio"); return; }
    setSaving(true);
    const frequency = freqValue.trim() ? `${freqValue.trim()} ${freqUnit}` : null;
    const sets = formSets ? parseInt(formSets) : null;
    const reps = formReps ? parseInt(formReps) : null;

    if (isEdit) {
      const { error } = await supabase
        .from("exercise_routine_items")
        .update({ suggested_sets: sets, suggested_reps: reps, frequency, notes: formNotes.trim() || null })
        .eq("id", editingItem.id);
      setSaving(false);
      if (error) { toast.error("Error al guardar cambios", { description: error.message }); return; }
      toast.success("Ejercicio actualizado");
    } else {
      const { error } = await supabase
        .from("exercise_routine_items")
        .insert({
          routine_id: planId,
          exercise_id: selectedEx.id,
          order_index: nextOrderIndex,
          suggested_sets: sets,
          suggested_reps: reps,
          frequency,
          notes: formNotes.trim() || null,
        });
      setSaving(false);
      if (error) { toast.error("Error al agregar ejercicio", { description: error.message }); return; }
      toast.success("Ejercicio agregado al plan");
    }
    resetDirty();
    onSaved();
    onClose();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeGuarded(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar ejercicio del plan" : "Agregar ejercicio al plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {!isEdit ? (
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
                          const types = getExerciseTypes(ex.exercise_type);
                          return (
                            <button
                              key={ex.id}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 flex items-center gap-2 border-b border-border last:border-0"
                              onClick={() => { setSelectedEx(ex); setSearchQuery(ex.name); setSearchResults([]); }}
                            >
                              <span className="flex-1">{ex.name}</span>
                              {types.map((t) => (
                                <Badge key={t.value} variant="outline" className={`text-[10px] px-1.5 py-0 border ${t.badgeClass}`}>{t.label}</Badge>
                              ))}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="field-label mb-1.5">Series sugeridas</p>
              <Input type="number" min="1" placeholder="ej. 3" value={formSets} onChange={(e) => setFormSets(e.target.value)} />
            </div>
            <div>
              <p className="field-label mb-1.5">Reps sugeridas</p>
              <Input type="number" min="1" placeholder="ej. 15" value={formReps} onChange={(e) => setFormReps(e.target.value)} />
            </div>
          </div>

          <div>
            <p className="field-label mb-1.5">Frecuencia sugerida</p>
            <div className="flex gap-2">
              <Input type="number" min="1" placeholder="ej. 2" value={freqValue} onChange={(e) => setFreqValue(e.target.value)} className="w-24" />
              <Select value={freqUnit} onValueChange={(v) => setFreqUnit(v as "veces/día" | "veces/semana")}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="veces/día">veces/día</SelectItem>
                  <SelectItem value="veces/semana">veces/semana</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <p className="field-label mb-1.5">Notas (opcional)</p>
            <Textarea placeholder="Indicaciones adicionales..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeGuarded}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !selectedEx}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Agregar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog open={confirmOpen} onConfirm={confirmDiscard} onCancel={cancelDiscard} />
    </>
  );
}
