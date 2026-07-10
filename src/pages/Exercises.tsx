import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Search, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { RowsSkeleton } from "@/components/skeletons";
import { exportExercisesPdf } from "@/components/exercises/ExercisePdfExport";
import ApartadosPanel, { type Apartado } from "@/components/exercises/ApartadosPanel";
import ExerciseRow from "@/components/exercises/ExerciseRow";
import ExerciseDetailDialog from "@/components/exercises/ExerciseDetailDialog";
import ExerciseFormDialog from "@/components/exercises/ExerciseFormDialog";
import { type Exercise, EXERCISE_TYPES, type ExerciseTypeValue } from "@/components/exercises/exerciseLibrary";

export default function Exercises() {
  const { user } = useAuth();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [autoSelectedDone, setAutoSelectedDone] = useState(false);
  const [selectedApartadoId, setSelectedApartadoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ExerciseTypeValue>("activo");
  const [search, setSearch] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [detailEx, setDetailEx] = useState<Exercise | null>(null);
  const [editEx, setEditEx] = useState<Exercise | null>(null);
  const [deleteEx, setDeleteEx] = useState<Exercise | null>(null);
  const [showPdfSelect, setShowPdfSelect] = useState(false);
  const [pdfSelected, setPdfSelected] = useState<Set<string>>(new Set());

  // ── Fetches ──

  const fetchExercises = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("exercise_library")
      .select("*")
      .eq("professional_id", user.id)
      .eq("is_active", true)
      .order("name");
    if (error) {
      toast.error("Error al cargar los ejercicios", { description: error.message });
    }
    setExercises(data || []);
    setLoading(false);
  };

  const fetchApartados = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("exercise_body_regions")
      .select("id, name")
      .eq("professional_id", user.id)
      .order("name");
    if (error) {
      toast.error("Error al cargar los apartados", { description: error.message });
    }
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

  // Los ejercicios sin tipo (datos legacy) se muestran en todas las pestañas
  // para que no queden inaccesibles; al editarlos el form exige asignar tipo.
  const byTab = (tab: ExerciseTypeValue) => filtered.filter((ex) => ex.exercise_type === tab || !ex.exercise_type);

  // ── Delete ──

  const handleDelete = async () => {
    if (!deleteEx) return;
    const [{ count: treatmentCount }, { count: planItemCount }] = await Promise.all([
      supabase
        .from("treatment_plan_exercises")
        .select("id", { count: "exact", head: true })
        .eq("exercise_id", deleteEx.id),
      supabase
        .from("exercise_plan_items")
        .select("id", { count: "exact", head: true })
        .eq("exercise_id", deleteEx.id),
    ]);
    if ((treatmentCount ?? 0) + (planItemCount ?? 0) > 0) {
      toast.error("Este ejercicio está en uso en el plan de uno o más pacientes");
      setDeleteEx(null);
      return;
    }
    const { error } = await supabase.from("exercise_library").delete().eq("id", deleteEx.id);
    setDeleteEx(null);
    if (error) {
      toast.error("Error al eliminar ejercicio", { description: error.message });
      return;
    }
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
      <PageHeader
        title="Biblioteca de Ejercicios"
        actions={
          <>
            <Button variant="outline" onClick={handleOpenPdfSelect} disabled={filtered.length === 0}>
              <FileDown className="h-4 w-4 mr-2" />Exportar PDF
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-2" />Nuevo Ejercicio
            </Button>
          </>
        }
      />

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
              {EXERCISE_TYPES.map((tab) => {
                const count = byTab(tab.value).length;
                return (
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
                    {tab.tabLabel}
                    {count > 0 && (
                      <span className={cn(
                        "ml-1.5 text-xs tabular-nums",
                        activeTab === tab.value ? "text-muted-foreground" : "text-muted-foreground/60"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de ejercicios */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <RowsSkeleton rows={6} />
            ) : byTab(activeTab).length === 0 ? (
              <div className="m-5 bg-card rounded-[10px] border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
                {filtered.length === 0
                  ? <>No hay ejercicios en este apartado. Creá uno con <span className="font-medium text-primary">Nuevo Ejercicio</span>.</>
                  : "No hay ejercicios de este tipo en este apartado."}
              </div>
            ) : (
              <>
                {/* Encabezado de columnas */}
                <div className="sticky top-0 z-[1] grid grid-cols-[1fr_72px_84px] md:grid-cols-[1fr_72px_150px_84px] gap-4 px-5 py-2 border-b border-border bg-muted">
                  <p className="field-label">Ejercicio</p>
                  <p className="field-label">Dosis</p>
                  <p className="field-label hidden md:block">Equipamiento</p>
                  <p className="field-label" />
                </div>

                {/* Filas */}
                <div>
                  {byTab(activeTab).map((ex) => (
                    <ExerciseRow
                      key={ex.id}
                      exercise={ex}
                      onDetail={() => setDetailEx(ex)}
                      onEdit={() => setEditEx(ex)}
                      onDelete={() => setDeleteEx(ex)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {showNew && (
        <ExerciseFormDialog
          open
          onClose={() => setShowNew(false)}
          userId={user!.id}
          onSaved={fetchExercises}
          apartados={apartados}
          defaultApartadoId={selectedApartadoId}
        />
      )}
      {editEx && (
        <ExerciseFormDialog
          open
          onClose={() => setEditEx(null)}
          userId={user!.id}
          onSaved={fetchExercises}
          exercise={editEx}
          apartados={apartados}
          defaultApartadoId={selectedApartadoId}
        />
      )}
      {detailEx && (
        <ExerciseDetailDialog
          exercise={detailEx}
          onClose={() => setDetailEx(null)}
          onEdit={() => { setEditEx(detailEx); setDetailEx(null); }}
        />
      )}

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
