import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Video } from "lucide-react";
import { toast } from "sonner";
import { createVideoRoom } from "@/lib/videoRoom";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  userId: string;
  onSaved: () => void;
}

export function NewPatientApptDialog({ open, onClose, patientId, userId, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    appointment_date: "",
    type: "consultation" as "consultation" | "follow_up" | "evaluation",
    status: "scheduled" as "scheduled" | "completed" | "cancelled",
    modality: "in_person" as "in_person" | "virtual",
    notes: "",
  });

  const handleSave = async () => {
    if (!form.appointment_date) { toast.error("Ingresá fecha y hora"); return; }
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      patient_id: patientId, professional_id: userId,
      appointment_date: new Date(form.appointment_date).toISOString(),
      type: form.type, status: form.status, notes: form.notes || null,
      modality: form.modality,
      video_link: form.modality === "virtual" ? createVideoRoom() : null,
    });
    setSaving(false);
    if (error) { toast.error("Error al crear turno"); return; }
    toast.success("Turno creado");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nuevo Turno</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fecha y hora *</Label>
            <Input type="datetime-local" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consulta</SelectItem>
                <SelectItem value="follow_up">Seguimiento</SelectItem>
                <SelectItem value="evaluation">Evaluación</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modalidad</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, modality: "in_person" })}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  form.modality === "in_person"
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <MapPin className="h-4 w-4" /> Presencial
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, modality: "virtual" })}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  form.modality === "virtual"
                    ? "border-violet-500 bg-violet-50 text-violet-700 font-medium"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <Video className="h-4 w-4" /> Virtual
              </button>
            </div>
            {form.modality === "virtual" && (
              <p className="text-xs text-muted-foreground">
                Al guardar se genera automáticamente el link de la videollamada.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
