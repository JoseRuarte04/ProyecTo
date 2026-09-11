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
import PlanList from "@/components/exercises/plans/PlanList";
import PlanItemsPanel from "@/components/exercises/plans/PlanItemsPanel";
import type { ExercisePlanTemplate } from "@/components/exercises/plans/planLibrary";
import ProgramList from "@/components/exercises/programs/ProgramList";
import ProgramRoutinesPanel from "@/components/exercises/programs/ProgramRoutinesPanel";
import type { ExerciseProgram } from "@/components/exercises/programs/programLibrary";

type LibraryTab = "ejercicios" | "planes" | "programas";
type TypeFilter = ExerciseTypeValue | "all";

export default function Exercises() {
  const { user } = useAuth();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [autoSelectedDone, setAutoSelectedDone] = useState(false);
  const [selectedApartadoId, setSelectedApartadoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LibraryTab>("ejercicios");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");

  const [plans, setPlans] = useState<ExercisePlanTemplate[]>([]);
  const [planItemCounts, setPlanItemCounts] = useState<Record<string, number>>({});
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const [programs, setPrograms] = useState<ExerciseProgram[]>([]);
  const [programItemCounts, setProgramItemCounts] = useState<Record<string, number>>({});
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

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

  const fetchPlans = async () => {
    if (!user) return;
    const [{ data: planData, error: planErr }, { data: itemData }] = await Promise.all([
      supabase.from("exercise_routines").select("*").eq("professional_id", user.id).order("name"),
      supabase.from("exercise_routine_items").select("routine_id"),
    ]);
    if (planErr) {
      toast.error("Error al cargar los planes", { description: planErr.message });
    }
    const list = planData || [];
    setPlans(list);
    const counts: Record<string, number> = {};
    (itemData || []).forEach((row) => { counts[row.routine_id] = (counts[row.routine_id] ?? 0) + 1; });
    setPlanItemCounts(counts);
    setSelectedPlanId((prev) => (prev && list.some((p) => p.id === prev)) ? prev : (list[0]?.id ?? null));
  };

  const fetchPrograms = async () => {
    if (!user) return;
    const [{ data: programData, error: programErr }, { data: itemData }] = await Promise.all([
      supabase.from("exercise_programs").select("*").eq("professional_id", user.id).order("name"),
      supabase.from("exercise_program_routines").select("program_id"),
    ]);
    if (programErr) {
      toast.error("Error al cargar los programas", { description: programErr.message });
    }
    const list = programData || [];
    setPrograms(list);
    const counts: Record<string, number> = {};
    (itemData || []).forEach((row) => { counts[row.program_id] = (counts[row.program_id] ?? 0) + 1; });
    setProgramItemCounts(counts);
    setSelectedProgramId((prev) => (prev && list.some((p) => p.id === prev)) ? prev : (list[0]?.id ?? null));
  };

  useEffect(() => {
    fetchExercises();
    fetchApartados();
    fetchPlans();
    fetchPrograms();
  }, [user]);

  // ── Filtrado ──

  const byApartado = useMemo(() => {
    if (selectedApartadoId === null) {
      return exercises.filter((ex) => ex.body_region_id == null);
    }
    return exercises.filter((ex) => ex.body_region_id === selectedApartadoId);
  }, [exercises, selectedApartadoId]);

  const bySearch = useMemo(() => {
    if (!search.trim()) return byApartado;
    const s = search.toLowerCase();
    return byApartado.filter((ex) =>
      ex.name?.toLowerCase().includes(s) || ex.instructions?.toLowerCase().includes(s)
    );
  }, [byApartado, search]);

  // Los ejercicios sin tipo (datos legacy) se muestran siempre, para que no
  // queden inaccesibles al filtrar; al editarlos el form exige asignar tipo.
  const filtered = useMemo(
    () => bySearch.filter((ex) => typeFilter === "all" || ex.exercise_type === typeFilter || !ex.exercise_type),
    [bySearch, typeFilter]
  );

  const typeCount = (type: ExerciseTypeValue) => bySearch.filter((ex) => ex.exercise_type === type || !ex.exercise_type).length;

  // ── Delete ──

  const handleDelete = async () => {
    if (!deleteEx) return;
    const [{ count: treatmentCount }, { count: planItemCount }, { count: routineItemCount }] = await Promise.all([
      supabase
        .from("treatment_plan_exercises")
        .select("id", { count: "exact", head: true })
        .eq("exercise_id", deleteEx.id),
      supabase
        .from("exercise_plan_items")
        .select("id", { count: "exact", head: true })
        .eq("exercise_id", deleteEx.id),
      supabase
        .from("exercise_routine_items")
        .select("id", { count: "exact", head: true })
        .eq("exercise_id", deleteEx.id),
    ]);
    if ((treatmentCount ?? 0) + (planItemCount ?? 0) > 0) {
      toast.error("Este ejercicio está en uso en el programa de uno o más pacientes");
      setDeleteEx(null);
      return;
    }
    if ((routineItemCount ?? 0) > 0) {
      toast.error("Este ejercicio está en uso en uno o más planes");
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
          activeTab === "ejercicios" ? (
            <>
              <Button variant="outline" onClick={handleOpenPdfSelect} disabled={filtered.length === 0}>
                <FileDown className="h-4 w-4 mr-2" />Exportar PDF
              </Button>
              <Button onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4 mr-2" />Nuevo Ejercicio
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Tablet: apartado / plan / programa select */}
      <div className="lg:hidden">
        {activeTab === "planes" ? (
          <Select value={selectedPlanId ?? ""} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccioná un plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : activeTab === "programas" ? (
          <Select value={selectedProgramId ?? ""} onValueChange={setSelectedProgramId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccioná un programa" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
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
        )}
      </div>

      {/* Two-panel layout */}
      <div className="dashboard-card overflow-hidden flex flex-1 min-h-0">
        {/* Left panel — desktop */}
        <div className="hidden lg:flex flex-col w-52 shrink-0 border-r border-border bg-muted/30 p-4 gap-0">
          {activeTab === "planes" ? (
            <>
              <p className="field-label text-muted-foreground mb-3">Planes</p>
              <PlanList
                plans={plans}
                itemCounts={planItemCounts}
                selectedPlanId={selectedPlanId}
                onSelectPlan={setSelectedPlanId}
                professionalId={user!.id}
                onRefetch={fetchPlans}
              />
            </>
          ) : activeTab === "programas" ? (
            <>
              <p className="field-label text-muted-foreground mb-3">Programas</p>
              <ProgramList
                programs={programs}
                itemCounts={programItemCounts}
                selectedProgramId={selectedProgramId}
                onSelectProgram={setSelectedProgramId}
                professionalId={user!.id}
                onRefetch={fetchPrograms}
              />
            </>
          ) : (
            <>
              <p className="field-label text-muted-foreground mb-3">Apartados</p>
              <ApartadosPanel
                apartados={apartados}
                onRefetch={fetchApartados}
                selectedApartadoId={selectedApartadoId}
                onSelectApartado={setSelectedApartadoId}
              />
            </>
          )}
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0 flex flex-col gap-0">
          {/* Pestañas de primer nivel + búsqueda/filtro */}
          <div className="px-5 pt-4 pb-0 flex flex-col gap-3 border-b border-border">
            <div className="flex">
              {([
                ["ejercicios", "Ejercicios", exercises.length],
                ["planes", "Planes", plans.length],
                ["programas", "Programas", programs.length],
              ] as const).map(([tab, label, count]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                    activeTab === tab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span className={cn(
                      "ml-1.5 text-xs tabular-nums",
                      activeTab === tab ? "text-muted-foreground" : "text-muted-foreground/60"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === "ejercicios" && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar ejercicios..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 max-w-sm h-9 text-sm"
                  />
                </div>

                {/* Filtro por tipo — no es una pestaña, filtra la lista de abajo */}
                <div className="flex flex-wrap gap-1.5 pb-3">
                  <button
                    onClick={() => setTypeFilter("all")}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                      typeFilter === "all"
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    Todos <span className="opacity-70">{bySearch.length}</span>
                  </button>
                  {EXERCISE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTypeFilter(t.value)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                        typeFilter === t.value
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      {t.tabLabel} <span className="opacity-70">{typeCount(t.value)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Contenido */}
          {activeTab === "planes" ? (
            <div className="overflow-y-auto flex-1 p-5">
              {(() => {
                const selectedPlan = plans.find((p) => p.id === selectedPlanId);
                if (!selectedPlan) {
                  return (
                    <div className="bg-card rounded-[10px] border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
                      {plans.length === 0
                        ? <>No creaste ningún plan todavía. Usá <span className="font-medium text-primary">Nuevo plan</span> para armar el primero.</>
                        : "Seleccioná un plan para ver sus ejercicios."}
                    </div>
                  );
                }
                return (
                  <PlanItemsPanel
                    plan={selectedPlan}
                    apartados={apartados}
                    onItemsChanged={fetchPlans}
                  />
                );
              })()}
            </div>
          ) : activeTab === "programas" ? (
            <div className="overflow-y-auto flex-1 p-5">
              {(() => {
                const selectedProgram = programs.find((p) => p.id === selectedProgramId);
                if (!selectedProgram) {
                  return (
                    <div className="bg-card rounded-[10px] border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
                      {programs.length === 0
                        ? <>No creaste ningún programa todavía. Usá <span className="font-medium text-primary">Nuevo programa</span> para armar el primero.</>
                        : "Seleccioná un programa para ver sus planes."}
                    </div>
                  );
                }
                return (
                  <ProgramRoutinesPanel
                    program={selectedProgram}
                    onItemsChanged={fetchPrograms}
                  />
                );
              })()}
            </div>
          ) : (
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <RowsSkeleton rows={6} />
            ) : filtered.length === 0 ? (
              <div className="m-5 bg-card rounded-[10px] border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
                {bySearch.length === 0
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
                  {filtered.map((ex) => (
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
          )}
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
