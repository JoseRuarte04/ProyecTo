import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Cie10AutocompleteInline } from "../Cie10AutocompleteInline";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  userId: string;
  episodes: any[];
  onSaved: (newEpId: string) => void;
}

const emptyForm = () => ({
  admission_date: new Date().toISOString().split("T")[0],
  diagnosis: "", treatment_type: "",
  affected_side: "" as "" | "MSD" | "MSI" | "both",
  doctor_name: "", injury_mechanism: "", weeks_post_injury: "",
});

export function NewEpisodeDialog({ open, onClose, patientId, userId, episodes, onSaved }: Props) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const resetForm = () => setForm(emptyForm());

  const handleSave = async () => {
    if (!form.diagnosis.trim()) return;
    setSaving(true);
    try {
      const maxEpNum = Math.max(...episodes.map((e: any) => e.episode_number), 0);

      const { data: newEp, error: epErr } = await supabase
        .from("treatment_episodes")
        .insert({
          patient_id: patientId,
          professional_id: userId,
          episode_number: maxEpNum + 1,
          admission_date: form.admission_date,
          status: "active",
          diagnosis: form.diagnosis.trim(),
          affected_side: (form.affected_side || null) as "MSD" | "MSI" | "both" | null,
        })
        .select("id")
        .single();

      if (epErr || !newEp) throw epErr || new Error("Failed to create episode");

      await supabase.from("patient_clinical_records").insert({
        patient_id: patientId,
        episode_id: newEp.id,
        diagnosis: form.diagnosis.trim(),
        treatment_type: form.treatment_type || null,
        doctor_name: form.doctor_name || null,
        injury_mechanism: form.injury_mechanism || null,
        weeks_post_injury: form.weeks_post_injury ? parseInt(form.weeks_post_injury) : null,
      });

      const activeEps = episodes.filter((e: any) => e.status === "active");
      for (const ep of activeEps) {
        await supabase.from("treatment_episodes").update({ status: "discharged", discharge_date: form.admission_date }).eq("id", ep.id);
      }

      // Un episodio nuevo sobre un paciente que había abandonado lo reactiva
      await supabase.from("patients")
        .update({ status: "active", abandoned_at: null, abandon_reason: null })
        .eq("id", patientId)
        .eq("status", "abandoned");

      toast.success("Nuevo episodio creado correctamente");
      onSaved(newEp.id);
      navigate(`/patients/${patientId}/sessions/new?episode=${newEp.id}&type=admission`);
    } catch (err: any) {
      toast.error("Error al crear el episodio", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Episodio de Tratamiento</DialogTitle>
          <DialogDescription className="sr-only">Crear un nuevo episodio de tratamiento</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fecha de admisión *</Label>
            <Input type="date" value={form.admission_date} onChange={e => setForm({ ...form, admission_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Diagnóstico *</Label>
            <Cie10AutocompleteInline value={form.diagnosis} onChange={(v) => setForm({ ...form, diagnosis: v })} placeholder="Buscar por código o descripción CIE-10…" />
          </div>
          <div className="space-y-2">
            <Label>Tipo de tratamiento</Label>
            <Select value={form.treatment_type} onValueChange={v => setForm({ ...form, treatment_type: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">Conservador</SelectItem>
                <SelectItem value="surgery">Quirúrgico</SelectItem>
                <SelectItem value="mixed">Mixto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Lado afectado</Label>
            <Select value={form.affected_side} onValueChange={v => setForm({ ...form, affected_side: v as typeof form.affected_side })}>
              <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MSD">MSD — Miembro superior derecho</SelectItem>
                <SelectItem value="MSI">MSI — Miembro superior izquierdo</SelectItem>
                <SelectItem value="both">Ambos (MSD + MSI)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Médico derivante</Label>
            <Input value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Mecanismo de lesión</Label>
            <Input value={form.injury_mechanism} onChange={e => setForm({ ...form, injury_mechanism: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Semanas post lesión</Label>
            <Input type="number" min={0} value={form.weeks_post_injury} onChange={e => setForm({ ...form, weeks_post_injury: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.diagnosis.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear episodio"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
