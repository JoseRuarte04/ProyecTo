import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ExercisePlanTemplate } from "./planLibrary";
import { useDirtyDeps } from "@/hooks/useDirtyDeps";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";

interface PlanFormDialogProps {
  open: boolean;
  onClose: () => void;
  professionalId: string;
  onSaved: (plan: ExercisePlanTemplate) => void;
  plan?: ExercisePlanTemplate;
}

export default function PlanFormDialog({ open, onClose, professionalId, onSaved, plan }: PlanFormDialogProps) {
  const isEdit = !!plan;
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [saving, setSaving] = useState(false);

  const [isDirty, resetDirty] = useDirtyDeps([name, description]);
  const { guard, confirmOpen, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
  const closeGuarded = () => guard(onClose);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);

    if (isEdit) {
      const { data, error } = await supabase
        .from("exercise_routines")
        .update({ name: name.trim(), description: description.trim() || null })
        .eq("id", plan.id)
        .select()
        .single();
      setSaving(false);
      if (error || !data) { toast.error("Error al actualizar el plan", { description: error?.message }); return; }
      toast.success("Plan actualizado");
      onSaved(data);
    } else {
      const { data, error } = await supabase
        .from("exercise_routines")
        .insert({ name: name.trim(), description: description.trim() || null, professional_id: professionalId })
        .select()
        .single();
      setSaving(false);
      if (error || !data) { toast.error("Error al crear el plan", { description: error?.message }); return; }
      toast.success("Plan creado");
      onSaved(data);
    }
    resetDirty();
    onClose();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeGuarded(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar plan" : "Nuevo plan"}</DialogTitle>
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
              placeholder="Para qué se usa este plan..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeGuarded}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear plan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog open={confirmOpen} onConfirm={confirmDiscard} onCancel={cancelDiscard} />
    </>
  );
}
