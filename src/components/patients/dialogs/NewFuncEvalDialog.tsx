import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  userId: string;
  onSaved: () => void;
}

const emptyForm = () => ({
  evaluation_date: new Date().toISOString().split("T")[0],
  barthel_score: "", dash_score: "",
  avd: "", aivd: "", work_education: "", leisure: "",
  physical_activity: "", sleep_rest: "", health_management: "",
  observations: "",
});

export function NewFuncEvalDialog({ open, onClose, patientId, userId, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const resetForm = () => setForm(emptyForm());

  const buildNotes = () => {
    const parts: string[] = [];
    if (form.work_education.trim()) parts.push(`Trabajo/Educación: ${form.work_education.trim()}`);
    if (form.leisure.trim()) parts.push(`Ocio: ${form.leisure.trim()}`);
    if (form.observations.trim()) parts.push(`Observaciones: ${form.observations.trim()}`);
    return parts.length > 0 ? parts.join("\n\n") : null;
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("functional_evaluations").insert({
      patient_id: patientId, professional_id: userId,
      evaluation_date: form.evaluation_date,
      barthel_score: form.barthel_score ? parseInt(form.barthel_score) : null,
      dash_score: form.dash_score ? parseInt(form.dash_score) : null,
      avd: form.avd || null, aivd: form.aivd || null,
      physical_activity: form.physical_activity || null,
      sleep_rest: form.sleep_rest || null,
      health_management: form.health_management || null,
      notes: buildNotes(),
    });
    setSaving(false);
    if (error) { toast.error("Error al guardar la evaluación funcional"); return; }
    toast.success("Evaluación funcional registrada correctamente");
    resetForm();
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Evaluación Funcional</DialogTitle>
          <DialogDescription className="sr-only">Formulario de evaluación funcional</DialogDescription>
        </DialogHeader>
        <Accordion type="multiple" defaultValue={["general", "occupational", "health", "notes"]} className="w-full">
          <AccordionItem value="general">
            <AccordionTrigger className="text-sm font-semibold">Datos Generales</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Fecha de evaluación *</Label>
                <Input type="date" value={form.evaluation_date} onChange={(e) => setForm({ ...form, evaluation_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Puntaje Barthel (0-100)</Label>
                <Input type="number" min={0} max={100} value={form.barthel_score} onChange={(e) => setForm({ ...form, barthel_score: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Puntaje DASH (0-100)</Label>
                <Input type="number" min={0} max={100} value={form.dash_score} onChange={(e) => setForm({ ...form, dash_score: e.target.value })} />
                <p className="text-xs text-muted-foreground">0 = sin discapacidad, 100 = máxima discapacidad</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="occupational">
            <AccordionTrigger className="text-sm font-semibold">Desempeño Ocupacional</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>AVD — Actividades de la vida diaria</Label>
                <Textarea value={form.avd} onChange={(e) => setForm({ ...form, avd: e.target.value })} rows={3} placeholder="Higiene, alimentación, vestido, traslados..." />
              </div>
              <div className="space-y-2">
                <Label>AIVD — Actividades instrumentales</Label>
                <Textarea value={form.aivd} onChange={(e) => setForm({ ...form, aivd: e.target.value })} rows={3} placeholder="Preparación de comidas, manejo de dinero, uso del teléfono, compras..." />
              </div>
              <div className="space-y-2">
                <Label>Trabajo / Educación</Label>
                <Textarea value={form.work_education} onChange={(e) => setForm({ ...form, work_education: e.target.value })} rows={3} placeholder="Situación laboral/educativa actual, limitaciones, objetivos..." />
              </div>
              <div className="space-y-2">
                <Label>Ocio y tiempo libre</Label>
                <Textarea value={form.leisure} onChange={(e) => setForm({ ...form, leisure: e.target.value })} rows={2} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="health">
            <AccordionTrigger className="text-sm font-semibold">Hábitos de Salud</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Actividad física</Label>
                <Textarea value={form.physical_activity} onChange={(e) => setForm({ ...form, physical_activity: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Descanso y sueño</Label>
                <Textarea value={form.sleep_rest} onChange={(e) => setForm({ ...form, sleep_rest: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Gestión de la salud</Label>
                <Textarea value={form.health_management} onChange={(e) => setForm({ ...form, health_management: e.target.value })} rows={2} placeholder="Adherencia a turnos médicos, automedicación, hábitos preventivos..." />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notes">
            <AccordionTrigger className="text-sm font-semibold">Notas de Evaluación</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Observaciones adicionales</Label>
                <Textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows={3} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.evaluation_date}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
