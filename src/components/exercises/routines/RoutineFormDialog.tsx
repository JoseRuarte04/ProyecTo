import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Routine } from "./routineLibrary";

interface RoutineFormDialogProps {
  open: boolean;
  onClose: () => void;
  professionalId: string;
  onSaved: (routine: Routine) => void;
  routine?: Routine;
}

export default function RoutineFormDialog({ open, onClose, professionalId, onSaved, routine }: RoutineFormDialogProps) {
  const isEdit = !!routine;
  const [name, setName] = useState(routine?.name ?? "");
  const [description, setDescription] = useState(routine?.description ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);

    if (isEdit) {
      const { data, error } = await supabase
        .from("exercise_routines")
        .update({ name: name.trim(), description: description.trim() || null })
        .eq("id", routine.id)
        .select()
        .single();
      setSaving(false);
      if (error || !data) { toast.error("Error al actualizar la rutina", { description: error?.message }); return; }
      toast.success("Rutina actualizada");
      onSaved(data);
    } else {
      const { data, error } = await supabase
        .from("exercise_routines")
        .insert({ name: name.trim(), description: description.trim() || null, professional_id: professionalId })
        .select()
        .single();
      setSaving(false);
      if (error || !data) { toast.error("Error al crear la rutina", { description: error?.message }); return; }
      toast.success("Rutina creada");
      onSaved(data);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar rutina" : "Nueva rutina"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Rodilla post-quirúrgica"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Para qué se usa esta rutina..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear rutina"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
