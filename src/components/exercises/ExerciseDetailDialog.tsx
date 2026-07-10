import { Dialog, DialogContentFullScreen, DialogClose, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Pencil, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Exercise, getExerciseType, extractYoutubeId } from "./exerciseLibrary";

interface ExerciseDetailDialogProps {
  exercise: Exercise;
  onClose: () => void;
  onEdit?: () => void;
}

export default function ExerciseDetailDialog({ exercise, onClose, onEdit }: ExerciseDetailDialogProps) {
  const type = getExerciseType(exercise.exercise_type);
  const ytId = extractYoutubeId(exercise.video_url || "");
  const hasStats = !!(exercise.suggested_sets || exercise.suggested_reps || exercise.equipment);
  const hasAside = !!ytId || hasStats;
  const hasContent = !!(
    exercise.description || exercise.starting_position || exercise.instructions ||
    exercise.precautions || (exercise.video_url && !ytId)
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContentFullScreen>
        {/* Barra superior */}
        <div className="shrink-0 h-14 px-4 sm:px-6 border-b border-border bg-card flex items-center justify-between gap-3">
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Biblioteca de Ejercicios</span>
              <span className="sm:hidden">Volver</span>
            </Button>
          </DialogClose>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-2" />Editar ejercicio
            </Button>
          )}
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto">
          <div className={cn("mx-auto w-full px-4 sm:px-6 py-8", hasAside ? "max-w-5xl" : "max-w-3xl")}>
            {/* Encabezado */}
            {type && (
              <span className={cn("field-label inline-block px-2 py-1 rounded border mb-3", type.badgeClass)}>
                {type.label}
              </span>
            )}
            <DialogTitle className="font-serif text-3xl sm:text-4xl font-semibold leading-tight tracking-tight text-foreground">
              {exercise.name}
            </DialogTitle>
            <DialogDescription className="sr-only">Detalle del ejercicio</DialogDescription>

            <div className={cn("mt-8 grid gap-6 items-start", hasAside && "lg:grid-cols-[1fr_320px]")}>
              {/* Ficha principal */}
              <div className="dashboard-card p-5 sm:p-7 space-y-6 min-w-0">
                {exercise.description && <Section label="Descripción" value={exercise.description} />}
                {exercise.starting_position && <Section label="Posición inicial" value={exercise.starting_position} />}
                {exercise.instructions && <Section label="Instrucciones" value={exercise.instructions} />}

                {exercise.precautions && (
                  <div className="flex gap-3 rounded-[10px] border border-warning/30 bg-warning/10 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="field-label mb-1">Precauciones</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{exercise.precautions}</p>
                    </div>
                  </div>
                )}

                {/* Video no-YouTube: link simple */}
                {exercise.video_url && !ytId && (
                  <a
                    href={exercise.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary text-xs underline break-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {exercise.video_url}
                  </a>
                )}

                {!hasContent && (
                  <p className="text-sm text-muted-foreground italic">
                    Este ejercicio todavía no tiene descripción ni instrucciones.
                  </p>
                )}
              </div>

              {/* Columna lateral */}
              {hasAside && (
                <aside className="space-y-6">
                  {ytId && (
                    <button
                      onClick={() => window.open(exercise.video_url!, "_blank")}
                      className="group dashboard-card relative block w-full overflow-hidden"
                      title="Ver video"
                    >
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        alt={`Video de ${exercise.name}`}
                        className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-foreground/20 group-hover:bg-foreground/30 transition-colors">
                        <span className="flex items-center justify-center h-12 w-12 rounded-full bg-card/95 text-primary">
                          <Play className="h-5 w-5 ml-0.5 fill-current" />
                        </span>
                      </span>
                    </button>
                  )}

                  {hasStats && (
                    <div className="dashboard-card overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                        <p className="field-label">Dosificación sugerida</p>
                      </div>
                      <div className="divide-y divide-border">
                        <StatRow label="Series" value={exercise.suggested_sets ? String(exercise.suggested_sets) : null} />
                        <StatRow label="Repeticiones" value={exercise.suggested_reps ? String(exercise.suggested_reps) : null} />
                        <StatRow label="Equipamiento" value={exercise.equipment} />
                      </div>
                    </div>
                  )}
                </aside>
              )}
            </div>
          </div>
        </div>
      </DialogContentFullScreen>
    </Dialog>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="field-label mb-1.5">{label}</p>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground text-right truncate" title={value ?? undefined}>
        {value || <span className="text-muted-foreground font-normal">—</span>}
      </p>
    </div>
  );
}
