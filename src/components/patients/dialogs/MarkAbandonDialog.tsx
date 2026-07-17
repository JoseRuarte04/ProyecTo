import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  activeEpisodeId: string | null;
  onSaved: () => void;
}

export function MarkAbandonDialog({ open, onClose, patientId, activeEpisodeId, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  const handleConfirm = async () => {
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("patients").update({
      status: "abandoned",
      abandoned_at: new Date().toISOString(),
      abandon_reason: reason.trim() || null,
    }).eq("id", patientId);
    if (!error && activeEpisodeId) {
      await supabase.from("treatment_episodes")
        .update({ status: "abandoned", discharge_date: today })
        .eq("id", activeEpisodeId);
    }
    setSaving(false);
    if (error) { toast.error("Error al registrar el abandono", { description: error.message }); return; }
    toast.success("Abandono registrado");
    setReason("");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar abandono de tratamiento</DialogTitle>
          <DialogDescription>
            El paciente pasa al estado "Abandonó" y se cierra el episodio activo.
            Podés revertirlo después con "Reactivar paciente".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Motivo (opcional)</Label>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: dejó de asistir, motivos personales, mudanza…" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Marcar abandono"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReactivateDialog({ open, onClose, patientId, onSaved }: {
  open: boolean; onClose: () => void; patientId: string; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    const { error } = await supabase.from("patients").update({
      status: "active",
      abandoned_at: null,
      abandon_reason: null,
    }).eq("id", patientId);
    if (!error) {
      // Reabrir los episodios cerrados por el abandono
      await supabase.from("treatment_episodes")
        .update({ status: "active", discharge_date: null })
        .eq("patient_id", patientId)
        .eq("status", "abandoned");
    }
    setSaving(false);
    if (error) { toast.error("Error al reactivar al paciente", { description: error.message }); return; }
    toast.success("Paciente reactivado");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reactivar paciente</DialogTitle>
          <DialogDescription>
            El paciente vuelve al estado "Activo" y se reabre el episodio cerrado por el abandono.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reactivar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
