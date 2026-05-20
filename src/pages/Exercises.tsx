import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Loader2, Search, Video, Pencil, Trash2, FileDown, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { exportExercisesPdf } from "@/components/exercises/ExercisePdfExport";
import ApartadosPanel, { type Apartado } from "@/components/exercises/ApartadosPanel";

type Exercise = any;

type ExerciseTab = "activo" | "activo_asistido" | "fortalecimiento";

const TABS: { value: ExerciseTab; label: string }[] = [
  { value: "activo", label: "Activos" },
  { value: "activo_asistido", label: "Activos asistidos" },
  { value: "fortalecimiento", label: "Fortalecimiento" },
];

export default function Exercises() {
  const { user } = useAuth();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [autoSelectedDone, setAutoSelectedDone] = useState(false);
  const [selectedApartadoId, setSelectedApartadoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ExerciseTab>("activo");
  const [search, setSearch] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [detailEx, setDetailEx] = useState<Exercise | null>(null);
  const [editEx, setEditEx] = useState<Exercise | null>(null);
  const [deleteEx, setDeleteEx] = useState<Exercise | null>(null);
  const [showPdfSelect, setShowPdfSelect] = useState(false);
  const [pdfSelected, setPdfSelected] = useState<Set<string>>(new Set());

  // ── Fetches ──

  const fetchExercises = async () => {
    const { data } = await supabase
      .from("exercise_library")
      .select("*")
      .order("name");
    setExercises(data || []);
    setLoading(false);
  };

  const fetchApartados = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("exercise_body_regions")
      .select("id, name")
      .eq("professional_id", user.id)
      .order("name");
    const list = data || [];
    setApartados(list);
    if (!autoSelectedDone) {
      setSelectedApartadoId(list[0]?.id ?? null);
      setAutoSelectedDone(true);
    }
  };

  useEffect(() => {
    fetchExercises();
    fetchApartados();
  }, [user]);

  // ── Filtrado ──

  const byApartado = useMemo(() => {
    if (selectedApartadoId === null) {
      return exercises.filter((ex) => ex.body_region_id == null);
    }
    return exercises.filter((ex) => ex.body_region_id === selectedApartadoId);
  }, [exercises, selectedApartadoId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return byApartado;
    const s = search.toLowerCase();
    return byApartado.filter((ex) =>
      ex.name?.toLowerCase().includes(s) || ex.instructions?.toLowerCase().includes(s)
    );
  }, [byApartado, search]);

  const byTab = (tab: ExerciseTab) => filtered.filter((ex) => ex.exercise_type === tab);

  // ── Delete ──

  const handleDelete = async () => {
    if (!deleteEx) return;
    const { count } = await supabase
      .from("treatment_plan_exercises")
      .select("id", { count: "exact", head: true })
      .eq("exercise_id", deleteEx.id);
    if ((count ?? 0) > 0) {
      toast.error("Este ejercicio está en uso en el plan de uno o más pacientes");
      setDeleteEx(null);
      return;
    }
    const { error } = await supabase.from("exercise_library").delete().eq("id", deleteEx.id);
    setDeleteEx(null);
    if (error) { toast.error("Error al eliminar ejercicio"); return; }
    toast.success("Ejercicio eliminado correctamente");
    fetchExercises();
  };

  // ── PDF ──

  const handleOpenPdfSelect = () => {
    setPdfSelected(new Set(filtered.map((ex) => ex.id)));
    setShowPdfSelect(true);
  };

  const handleExportPdf = () => {
    const selected = filtered.filter((ex) => pdfSelected.has(ex.id));
    if (selected.length === 0) { toast.error("Seleccioná al menos un ejercicio"); return; }
    exportExercisesPdf(selected);
    setShowPdfSelect(false);
    toast.success(`PDF exportado con ${selected.length} ejercicio(s)`);
  };

  const togglePdfSelect = (id: string) => {
    setPdfSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Render ──

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-serif text-2xl font-semibold text-foreground tracking-tight">Biblioteca de Ejercicios</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleOpenPdfSelect} disabled={filtered.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />Exportar PDF
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-2" />Nuevo Ejercicio
          </Button>
        </div>
      </div>

      {/* Tablet: apartado select */}
      <div className="lg:hidden">
        <Select
          value={selectedApartadoId ?? "__sin_apartado__"}
          onValueChange={(v) => setSelectedApartadoId(v === "__sin_apartado__" ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccioná un apartado" />
          </SelectTrigger>
          <SelectContent>
            {apartados.map((ap) => (
              <SelectItem key={ap.id} value={ap.id}>{ap.name}</SelectItem>
            ))}
            <SelectItem value="__sin_apartado__">Sin apartado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Two-panel layout */}
      <div className="dashboard-card overflow-hidden flex flex-1 min-h-0">
        {/* Left panel — desktop */}
        <div className="hidden lg:flex flex-col w-52 shrink-0 border-r border-border bg-muted/30 p-4 gap-0">
          <p className="field-label text-muted-foreground mb-3">Apartados</p>
          <ApartadosPanel
            apartados={apartados}
            onRefetch={fetchApartados}
            selectedApartadoId={selectedApartadoId}
            onSelectApartado={setSelectedApartadoId}
          />
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0 flex flex-col gap-0">
          {/* Search + Tabs header */}
          <div className="px-5 pt-4 pb-0 flex flex-col gap-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ejercicios..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 max-w-sm h-9 text-sm"
              />
            </div>

            <div className="flex">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                    activeTab === tab.value
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise grid */}
          <div className="p-5 overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : byTab(activeTab).length === 0 ? (
              <div className="bg-card rounded-[10px] border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
                {filtered.length === 0
                  ? <>No hay ejercicios en este apartado. Creá uno con <span className="font-medium text-primary">Nuevo Ejercicio</span>.</>
                  : "No hay ejercicios de este tipo en este apartado."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
                {byTab(activeTab).map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    onDetail={() => setDetailEx(ex)}
                    onEdit={() => setEditEx(ex)}
                    onDelete={() => setDeleteEx(ex)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <ExerciseFormDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        userId={user!.id}
        onSaved={fetchExercises}
        selectedApartadoId={selectedApartadoId}
      />
      {editEx && (
        <ExerciseFormDialog
          open
          onClose={() => setEditEx(null)}
          userId={user!.id}
          onSaved={fetchExercises}
          exercise={editEx}
          selectedApartadoId={selectedApartadoId}
        />
      )}
      {detailEx && <ExerciseDetailDialog exercise={detailEx} onClose={() => setDetailEx(null)} />}

      {/* PDF dialog */}
      <Dialog open={showPdfSelect} onOpenChange={setShowPdfSelect}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Seleccioná ejercicios para exportar</DialogTitle>
            <DialogDescription className="sr-only">Elegí qué ejercicios incluir en el PDF</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{pdfSelected.size} de {filtered.length} seleccionados</p>
              <Button variant="ghost" size="sm" onClick={() => {
                if (pdfSelected.size === filtered.length) setPdfSelected(new Set());
                else setPdfSelected(new Set(filtered.map((ex) => ex.id)));
              }}>
                {pdfSelected.size === filtered.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </Button>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {filtered.map((ex) => (
                <label key={ex.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfSelected.has(ex.id)}
                    onChange={() => togglePdfSelect(ex.id)}
                    className="rounded"
                  />
                  <p className="text-sm font-medium truncate">{ex.name}</p>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPdfSelect(false)}>Cancelar</Button>
              <Button onClick={handleExportPdf} disabled={pdfSelected.size === 0}>
                <FileDown className="h-4 w-4 mr-1" />Exportar ({pdfSelected.size})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteEx} onOpenChange={(open) => { if (!open) setDeleteEx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este ejercicio permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ────────── Exercise Card ────────── */

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  activo:            { label: "Activo",           className: "bg-info/10 text-info border-info/20" },
  activo_asistido:   { label: "Activo asistido",  className: "bg-success/10 text-success border-success/20" },
  fortalecimiento:   { label: "Fortalecimiento",  className: "bg-warning/10 text-warning border-warning/20" },
};

function ExerciseCard({ exercise: ex, onDetail, onEdit, onDelete }: {
  exercise: Exercise;
  onDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dosage = [
    ex.suggested_sets ? `${ex.suggested_sets} series` : null,
    ex.suggested_reps ? `${ex.suggested_reps} rep.` : null,
  ].filter(Boolean).join(" × ");

  const typeBadge = ex.exercise_type ? TYPE_BADGE[ex.exercise_type] : null;

  return (
    <div className="dashboard-card flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2 bg-muted/20">
        <p className="font-medium text-foreground text-sm leading-snug line-clamp-2" title={ex.name}>
          {ex.name}
        </p>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {ex.video_url && (
            <button
              onClick={() => window.open(ex.video_url, "_blank")}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="Ver video"
            >
              <Video className="h-3.5 w-3.5" />
            </button>
          )}
          {typeBadge && (
            <span className={cn("field-label px-1.5 py-0.5 rounded border", typeBadge.className)}>
              {typeBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex-1 flex flex-col gap-2">
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
          {ex.instructions || ex.description || <span className="italic">Sin instrucciones.</span>}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-auto">
          {dosage && (
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{dosage}</span>
            </span>
          )}
          {ex.equipment && (
            <span className="text-xs text-muted-foreground truncate max-w-[160px]" title={ex.equipment}>
              {ex.equipment}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border flex items-center gap-2 bg-muted/10">
        <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={onDetail}>
          Detalle
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={onEdit}>
          <Pencil className="h-3 w-3" />Editar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ────────── Detail Dialog ────────── */

function ExerciseDetailDialog({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const typeLabel: Record<string, string> = {
    activo: "Activo",
    activo_asistido: "Activo asistido",
    fortalecimiento: "Fortalecimiento",
  };
  const ytId = extractYoutubeId(exercise.video_url || "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />{exercise.name}
          </DialogTitle>
          <DialogDescription className="sr-only">Detalle del ejercicio</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {exercise.exercise_type && <Field label="Tipo" value={typeLabel[exercise.exercise_type] ?? exercise.exercise_type} />}
          {exercise.description && <Field label="Descripción" value={exercise.description} />}
          {exercise.starting_position && <Field label="Posición inicial" value={exercise.starting_position} />}
          {exercise.instructions && <Field label="Instrucciones" value={exercise.instructions} />}
          {exercise.precautions && <Field label="Precauciones" value={exercise.precautions} />}
          {exercise.equipment && <Field label="Equipamiento" value={exercise.equipment} />}
          {(exercise.suggested_sets || exercise.suggested_reps) && (
            <Field
              label="Dosificación sugerida"
              value={[
                exercise.suggested_sets ? `${exercise.suggested_sets} series` : null,
                exercise.suggested_reps ? `${exercise.suggested_reps} reps` : null,
              ].filter(Boolean).join(" × ")}
            />
          )}
          {exercise.video_url && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Video</p>
              {ytId ? (
                <img
                  src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                  alt="Preview del video"
                  className="w-full rounded-md border border-border mb-1"
                />
              ) : null}
              <a href={exercise.video_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs break-all">
                {exercise.video_url}
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
      <p className="text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}

/* ────────── Helpers ────────── */

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/* ────────── Create / Edit Dialog ────────── */

function ExerciseFormDialog({ open, onClose, userId, onSaved, exercise, selectedApartadoId }: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSaved: () => void;
  exercise?: Exercise;
  selectedApartadoId: string | null;
}) {
  const isEdit = !!exercise;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: exercise?.name || "",
    exercise_type: exercise?.exercise_type || "",
    description: exercise?.description || "",
    starting_position: exercise?.starting_position || "",
    instructions: exercise?.instructions || "",
    precautions: exercise?.precautions || "",
    equipment: exercise?.equipment || "",
    suggested_sets: exercise?.suggested_sets ? String(exercise.suggested_sets) : "",
    suggested_reps: exercise?.suggested_reps ? String(exercise.suggested_reps) : "",
    video_url: exercise?.video_url || "",
  });

  const ytId = extractYoutubeId(form.video_url);
  const canSave = form.name.trim() !== "";

  const handleSave = async () => {
    if (!canSave) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      exercise_type: form.exercise_type || null,
      description: form.description || null,
      starting_position: form.starting_position || null,
      instructions: form.instructions || null,
      precautions: form.precautions || null,
      equipment: form.equipment || null,
      suggested_sets: form.suggested_sets ? parseInt(form.suggested_sets) : null,
      suggested_reps: form.suggested_reps ? parseInt(form.suggested_reps) : null,
      video_url: form.video_url || null,
      body_region_id: isEdit ? exercise.body_region_id : selectedApartadoId,
    };

    if (isEdit) {
      const { error } = await supabase.from("exercise_library").update(payload).eq("id", exercise.id);
      if (error) { setSaving(false); toast.error("Error al actualizar ejercicio"); return; }
    } else {
      const { error } = await supabase.from("exercise_library").insert({
        ...payload,
        professional_id: userId,
        is_active: true,
      });
      if (error) { setSaving(false); toast.error("Error al crear ejercicio"); return; }
    }

    toast.success(isEdit ? "Ejercicio actualizado" : "Ejercicio creado");
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Ejercicio" : "Nuevo Ejercicio"}</DialogTitle>
          <DialogDescription className="sr-only">{isEdit ? "Modificá los datos del ejercicio" : "Completá los datos del nuevo ejercicio"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Tipo de ejercicio</Label>
            <Select value={form.exercise_type} onValueChange={(v) => setForm({ ...form, exercise_type: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccioná un tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="activo_asistido">Activo asistido</SelectItem>
                <SelectItem value="fortalecimiento">Fortalecimiento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Posición inicial</Label>
            <Textarea value={form.starting_position} onChange={(e) => setForm({ ...form, starting_position: e.target.value })} rows={2} placeholder="ej: Paciente sentado con codo apoyado..." />
          </div>

          <div className="space-y-2">
            <Label>Instrucciones</Label>
            <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Precauciones</Label>
            <Textarea value={form.precautions} onChange={(e) => setForm({ ...form, precautions: e.target.value })} rows={2} placeholder="ej: Evitar movimientos bruscos..." />
          </div>

          <div className="space-y-2">
            <Label>Equipamiento</Label>
            <Input value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder="ej: Banda elástica, pelota de goma" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Series sugeridas</Label>
              <Input type="number" min="1" value={form.suggested_sets} onChange={(e) => setForm({ ...form, suggested_sets: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Reps sugeridas</Label>
              <Input type="number" min="1" value={form.suggested_reps} onChange={(e) => setForm({ ...form, suggested_reps: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>URL de video</Label>
            <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="ej: https://youtube.com/watch?v=..." />
            {ytId && (
              <img
                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                alt="Preview del video"
                className="w-full rounded-md border border-border mt-1"
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
