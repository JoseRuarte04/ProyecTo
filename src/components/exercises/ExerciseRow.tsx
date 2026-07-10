import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Video, Pencil, Trash2, MoreHorizontal, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Exercise, getExerciseType } from "./exerciseLibrary";

interface ExerciseRowProps {
  exercise: Exercise;
  onDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ExerciseRow({ exercise: ex, onDetail, onEdit, onDelete }: ExerciseRowProps) {
  const dosage = [
    ex.suggested_sets ? `${ex.suggested_sets}` : null,
    ex.suggested_reps ? `${ex.suggested_reps}` : null,
  ].filter(Boolean).join("×");

  const type = getExerciseType(ex.exercise_type);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onDetail}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDetail(); } }}
      className={cn(
        "group grid grid-cols-[1fr_72px_84px] md:grid-cols-[1fr_72px_150px_84px] items-center gap-4",
        "px-5 py-3 border-b border-border last:border-b-0 cursor-pointer transition-colors hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:bg-muted/40"
      )}
    >
      {/* Nombre + instrucciones */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm text-foreground truncate">{ex.name}</p>
          {!type && (
            <span className="field-label shrink-0 px-1.5 py-0.5 rounded border bg-muted text-muted-foreground border-border">
              Sin tipo
            </span>
          )}
        </div>
        {(ex.instructions || ex.description) && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {ex.instructions || ex.description}
          </p>
        )}
      </div>

      {/* Dosis */}
      <p className="text-sm text-foreground tabular-nums">
        {dosage || <span className="text-muted-foreground">—</span>}
      </p>

      {/* Equipamiento — oculto en pantallas chicas */}
      <p className="hidden md:block text-sm text-muted-foreground truncate" title={ex.equipment ?? undefined}>
        {ex.equipment || "—"}
      </p>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
        {ex.video_url && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={() => window.open(ex.video_url!, "_blank")}
            title="Ver video"
          >
            <Video className="h-4 w-4" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground data-[state=open]:bg-muted"
              title="Acciones"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onDetail}>
              <Eye className="h-4 w-4 mr-2" />Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
