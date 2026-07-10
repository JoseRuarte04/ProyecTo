import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContentFullScreen, DialogClose, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Play, X } from "lucide-react";
import { type Exercise, EXERCISE_TYPES, extractYoutubeId } from "./exerciseLibrary";
import type { Apartado } from "./ApartadosPanel";

const SIN_APARTADO = "__none__";

// "" → null (campo vacío), entero ≥ 1 → número, cualquier otra cosa → undefined (inválido)
function parseCount(raw: string): number | null | undefined {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}

interface ExerciseFormDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSaved: () => void;
  exercise?: Exercise;
  apartados: Apartado[];
  defaultApartadoId: string | null;
}

export default function ExerciseFormDialog({ open, onClose, userId, onSaved, exercise, apartados, defaultApartadoId }: ExerciseFormDialogProps) {
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
    body_region_id: (isEdit ? exercise.body_region_id : defaultApartadoId) ?? SIN_APARTADO,
  });

  const ytId = extractYoutubeId(form.video_url);
  const canSave = form.name.trim() !== "" && form.exercise_type !== "";

  const handleSave = async () => {
    if (form.name.trim() === "") { toast.error("El nombre es obligatorio"); return; }
    if (form.exercise_type === "") { toast.error("El tipo de ejercicio es obligatorio"); return; }

    const sets = parseCount(form.suggested_sets);
    const reps = parseCount(form.suggested_reps);
    if (sets === undefined || reps === undefined) {
      toast.error("Series y repeticiones deben ser números enteros mayores a 0");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      exercise_type: form.exercise_type,
      description: form.description || null,
      starting_position: form.starting_position || null,
      instructions: form.instructions || null,
      precautions: form.precautions || null,
      equipment: form.equipment || null,
      suggested_sets: sets,
      suggested_reps: reps,
      video_url: form.video_url || null,
      body_region_id: form.body_region_id === SIN_APARTADO ? null : form.body_region_id,
    };

    if (isEdit) {
      const { error } = await supabase.from("exercise_library").update(payload).eq("id", exercise.id);
      if (error) {
        setSaving(false);
        toast.error("Error al actualizar ejercicio", { description: error.message });
        return;
      }
    } else {
      const { error } = await supabase.from("exercise_library").insert({
        ...payload,
        professional_id: userId,
        is_active: true,
      });
      if (error) {
        setSaving(false);
        toast.error("Error al crear ejercicio", { description: error.message });
        return;
      }
    }

    toast.success(isEdit ? "Ejercicio actualizado" : "Ejercicio creado");
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContentFullScreen>
        {/* Barra superior */}
        <div className="shrink-0 h-14 px-4 sm:px-6 border-b border-border bg-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1 shrink-0 text-muted-foreground hover:text-foreground" title="Cerrar">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
            <DialogTitle className="font-serif text-lg font-semibold tracking-tight truncate">
              {isEdit ? "Editar Ejercicio" : "Nuevo Ejercicio"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEdit ? "Modificá los datos del ejercicio de tu biblioteca" : "Completá los datos para agregarlo a tu biblioteca"}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <p className="hidden md:block text-xs text-muted-foreground mr-2">* Campos obligatorios</p>
            <Button variant="outline" onClick={onClose} className="hidden sm:inline-flex">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !canSave} className="min-w-[130px]">
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : isEdit ? "Guardar cambios" : "Crear ejercicio"}
            </Button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 grid gap-6 items-start lg:grid-cols-[1fr_340px]">
            {/* Columna principal */}
            <div className="space-y-6 min-w-0">
              <section className="dashboard-card p-5 sm:p-6 space-y-4">
                <p className="field-label">Información general</p>

                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ej: Flexión de codo con banda"
                    autoFocus={!isEdit}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="Breve descripción del objetivo del ejercicio"
                  />
                </div>
              </section>

              <section className="dashboard-card p-5 sm:p-6 space-y-4">
                <p className="field-label">Ejecución</p>

                <div className="space-y-2">
                  <Label>Posición inicial</Label>
                  <Textarea value={form.starting_position} onChange={(e) => setForm({ ...form, starting_position: e.target.value })} rows={2} placeholder="ej: Paciente sentado con codo apoyado..." />
                </div>

                <div className="space-y-2">
                  <Label>Instrucciones</Label>
                  <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={4} placeholder="Paso a paso de cómo realizar el ejercicio" />
                </div>

                <div className="space-y-2">
                  <Label>Precauciones</Label>
                  <Textarea value={form.precautions} onChange={(e) => setForm({ ...form, precautions: e.target.value })} rows={2} placeholder="ej: Evitar movimientos bruscos..." />
                </div>
              </section>
            </div>

            {/* Columna lateral */}
            <div className="space-y-6">
              <section className="dashboard-card p-5 sm:p-6 space-y-4">
                <p className="field-label">Clasificación</p>

                <div className="space-y-2">
                  <Label>Tipo de ejercicio *</Label>
                  <Select value={form.exercise_type} onValueChange={(v) => setForm({ ...form, exercise_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccioná un tipo" /></SelectTrigger>
                    <SelectContent>
                      {EXERCISE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Apartado</Label>
                  <Select value={form.body_region_id} onValueChange={(v) => setForm({ ...form, body_region_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccioná un apartado" /></SelectTrigger>
                    <SelectContent>
                      {apartados.map((ap) => (
                        <SelectItem key={ap.id} value={ap.id}>{ap.name}</SelectItem>
                      ))}
                      <SelectItem value={SIN_APARTADO}>Sin apartado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>

              <section className="dashboard-card p-5 sm:p-6 space-y-4">
                <p className="field-label">Dosificación y equipamiento</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Series</Label>
                    <Input type="number" min="1" step="1" value={form.suggested_sets} onChange={(e) => setForm({ ...form, suggested_sets: e.target.value })} placeholder="3" />
                  </div>
                  <div className="space-y-2">
                    <Label>Reps</Label>
                    <Input type="number" min="1" step="1" value={form.suggested_reps} onChange={(e) => setForm({ ...form, suggested_reps: e.target.value })} placeholder="12" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Equipamiento</Label>
                  <Input value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder="ej: Banda elástica" />
                </div>
              </section>

              <section className="dashboard-card p-5 sm:p-6 space-y-4">
                <p className="field-label">Video</p>

                <div className="space-y-2">
                  <Label>URL de video</Label>
                  <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="ej: https://youtube.com/watch?v=..." />
                  {ytId && (
                    <div className="relative overflow-hidden rounded-[10px] border border-border mt-1">
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        alt="Preview del video"
                        className="w-full aspect-video object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-foreground/15 pointer-events-none">
                        <span className="flex items-center justify-center h-10 w-10 rounded-full bg-card/95 text-primary">
                          <Play className="h-4 w-4 ml-0.5 fill-current" />
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </DialogContentFullScreen>
    </Dialog>
  );
}
