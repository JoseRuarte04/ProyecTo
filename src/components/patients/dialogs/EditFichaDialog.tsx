import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { InsuranceField, NO_INSURANCE } from "@/components/patients/InsuranceField";
import { EMPLOYMENT_STATUS_OPTIONS, MARITAL_STATUS_OPTIONS, EDUCATION_LEVEL_OPTIONS } from "@/components/patients/occupationalOptions";
import { DiagnosisListEditor, fetchEpisodeDiagnoses, saveEpisodeDiagnoses, primaryLabel, type DiagnosisItem } from "@/components/patients/DiagnosisListEditor";

interface Props {
  open: boolean;
  onClose: () => void;
  patient: any;
  clinical: any;
  occupational: any;
  activeEpisodeId: string | null;
  onSaved: () => void;
}

export function EditFichaDialog({ open, onClose, patient, clinical, occupational, activeEpisodeId, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm({
      first_name: patient?.first_name || "",
      last_name: patient?.last_name || "",
      dni: patient?.dni || "",
      birth_date: patient?.birth_date || "",
      gender: patient?.gender || "",
      phone: patient?.phone || "",
      email: patient?.email || "",
      address: patient?.address || "",
      insurance: patient?.insurance || "",
      insurance_number: patient?.insurance_number || "",
      admission_date: patient?.admission_date || "",
      emergency_contact_name: patient?.emergency_contact_name || "",
      emergency_contact_phone: patient?.emergency_contact_phone || "",
      emergency_contact_relation: patient?.emergency_contact_relation || "",
      treatment_type: clinical?.treatment_type || "",
      injury_date: clinical?.injury_date || "",
      surgery_date: clinical?.surgery_date || "",
      symptom_start_date: clinical?.symptom_start_date || "",
      injury_mechanism: clinical?.injury_mechanism || "",
      current_treatment: clinical?.current_treatment || "",
      pharmacological_treatment: clinical?.pharmacological_treatment || "",
      medical_history: clinical?.medical_history || "",
      studies: clinical?.studies || "",
      doctor_name: clinical?.doctor_name || "",
      immobilization_type: clinical?.immobilization_type || "",
      immobilization_weeks: clinical?.immobilization_weeks ?? "",
      immobilization_days: clinical?.immobilization_days ?? "",
      next_oyt_appointment: clinical?.next_oyt_appointment || "",
      referral_reason: clinical?.referral_reason || "",
      clinical_notes: clinical?.notes || "",
      dominance: occupational?.dominance || "",
      employment_status: occupational?.employment_status || "",
      marital_status: occupational?.marital_status || "",
      education_level: occupational?.education_level || "",
      job: occupational?.job || "",
      education: occupational?.education || "",
      support_network: occupational?.support_network || "",
      leisure: occupational?.leisure || "",
      physical_activity: occupational?.physical_activity || "",
      sleep_rest: occupational?.sleep_rest || "",
      health_management: occupational?.health_management || "",
      occupational_notes: occupational?.notes || "",
    });
    (async () => {
      const list = activeEpisodeId ? await fetchEpisodeDiagnoses(activeEpisodeId) : [];
      if (list.length > 0) setDiagnoses(list);
      else setDiagnoses(clinical?.diagnosis ? [{ code: null, label: clinical.diagnosis }] : []);
    })();
  }, [open, patient, clinical, occupational, activeEpisodeId]);

  const u = (field: string, value: string) => setForm((prev: any) => ({ ...prev, [field]: value }));
  const emptyToNull = (v: any) => v === "" || v === undefined ? null : v;
  const numberOrNull = (v: any) => v === "" || v === undefined ? null : parseInt(v);

  const handleSave = async () => {
    if (!patient?.id || !user) return;
    setSaving(true);

    const patientPayload = {
      first_name: form.first_name, last_name: form.last_name, dni: form.dni,
      birth_date: emptyToNull(form.birth_date), gender: emptyToNull(form.gender),
      phone: emptyToNull(form.phone), email: emptyToNull(form.email),
      address: emptyToNull(form.address), insurance: emptyToNull(form.insurance),
      insurance_number: emptyToNull(form.insurance_number),
      admission_date: form.admission_date || patient.admission_date,
      emergency_contact_name: emptyToNull(form.emergency_contact_name),
      emergency_contact_phone: emptyToNull(form.emergency_contact_phone),
      emergency_contact_relation: emptyToNull(form.emergency_contact_relation),
    };

    const clinicalPayload = {
      patient_id: patient.id, episode_id: activeEpisodeId,
      diagnosis: primaryLabel(diagnoses), treatment_type: emptyToNull(form.treatment_type),
      injury_date: emptyToNull(form.injury_date), surgery_date: emptyToNull(form.surgery_date),
      symptom_start_date: emptyToNull(form.symptom_start_date),
      injury_mechanism: emptyToNull(form.injury_mechanism),
      current_treatment: emptyToNull(form.current_treatment),
      pharmacological_treatment: emptyToNull(form.pharmacological_treatment),
      medical_history: emptyToNull(form.medical_history), studies: emptyToNull(form.studies),
      doctor_name: emptyToNull(form.doctor_name), immobilization_type: emptyToNull(form.immobilization_type),
      immobilization_weeks: numberOrNull(form.immobilization_weeks),
      immobilization_days: numberOrNull(form.immobilization_days),
      next_oyt_appointment: emptyToNull(form.next_oyt_appointment),
      referral_reason: emptyToNull(form.referral_reason), notes: emptyToNull(form.clinical_notes),
    } as any;

    const occupationalPayload = {
      patient_id: patient.id, dominance: emptyToNull(form.dominance),
      employment_status: emptyToNull(form.employment_status),
      marital_status: emptyToNull(form.marital_status),
      education_level: emptyToNull(form.education_level),
      job: emptyToNull(form.job), education: emptyToNull(form.education),
      support_network: emptyToNull(form.support_network), leisure: emptyToNull(form.leisure),
      physical_activity: emptyToNull(form.physical_activity), sleep_rest: emptyToNull(form.sleep_rest),
      health_management: emptyToNull(form.health_management),
      notes: emptyToNull(form.occupational_notes),
    } as any;

    // Primero la tabla nueva de diagnósticos, después el principal en legacy
    if (activeEpisodeId) {
      await saveEpisodeDiagnoses(activeEpisodeId, patient.id, diagnoses);
      await supabase.from("treatment_episodes").update({ diagnosis: primaryLabel(diagnoses) }).eq("id", activeEpisodeId);
    }
    const patientRes = await supabase.from("patients").update(patientPayload).eq("id", patient.id);
    const clinicalRes = clinical?.id
      ? await supabase.from("patient_clinical_records").update(clinicalPayload).eq("id", clinical.id)
      : await supabase.from("patient_clinical_records").insert(clinicalPayload);
    const occupationalRes = occupational?.id
      ? await supabase.from("patient_occupational_profiles").update(occupationalPayload).eq("id", occupational.id)
      : await supabase.from("patient_occupational_profiles").insert(occupationalPayload);

    setSaving(false);
    if (patientRes.error || clinicalRes.error || occupationalRes.error) {
      toast.error("Error al actualizar la ficha"); return;
    }
    toast.success("Ficha actualizada correctamente");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar ficha</DialogTitle>
          <DialogDescription className="sr-only">Formulario para editar datos del paciente y ficha clínica</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Datos personales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Nombre</Label><Input value={form.first_name || ""} onChange={(e) => u("first_name", e.target.value)} /></div>
              <div><Label>Apellido</Label><Input value={form.last_name || ""} onChange={(e) => u("last_name", e.target.value)} /></div>
              <div><Label>DNI</Label><Input value={form.dni || ""} onChange={(e) => u("dni", e.target.value)} /></div>
              <div><Label>Fecha de nacimiento</Label><Input type="date" value={form.birth_date || ""} onChange={(e) => u("birth_date", e.target.value)} /></div>
              <div><Label>Género</Label>
                <Select value={form.gender || ""} onValueChange={(v) => u("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Femenino</SelectItem>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                    <SelectItem value="no_data">Prefiero no decir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Teléfono</Label><Input value={form.phone || ""} onChange={(e) => u("phone", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(e) => u("email", e.target.value)} /></div>
              <div><Label>Obra social</Label>
                <InsuranceField
                  value={form.insurance || ""}
                  onChange={(v) => setForm((prev: any) => ({ ...prev, insurance: v, insurance_number: v === NO_INSURANCE ? "" : prev.insurance_number }))}
                  placeholder="Buscar obra social…"
                />
              </div>
              <div><Label>Nº de afiliado</Label><Input value={form.insurance_number || ""} onChange={(e) => u("insurance_number", e.target.value)} disabled={form.insurance === NO_INSURANCE} /></div>
              <div className="sm:col-span-2"><Label>Dirección</Label><Input value={form.address || ""} onChange={(e) => u("address", e.target.value)} /></div>
              <div><Label>Fecha de admisión</Label><Input type="date" value={form.admission_date || ""} onChange={(e) => u("admission_date", e.target.value)} /></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Contacto de emergencia</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Nombre completo</Label><Input value={form.emergency_contact_name || ""} onChange={(e) => u("emergency_contact_name", e.target.value)} /></div>
              <div><Label>Teléfono</Label><Input value={form.emergency_contact_phone || ""} onChange={(e) => u("emergency_contact_phone", e.target.value)} /></div>
              <div><Label>Relación</Label>
                <Select value={form.emergency_contact_relation || ""} onValueChange={(v) => u("emergency_contact_relation", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Padre / Madre</SelectItem>
                    <SelectItem value="spouse">Cónyuge / Pareja</SelectItem>
                    <SelectItem value="sibling">Hermano/a</SelectItem>
                    <SelectItem value="child">Hijo/a</SelectItem>
                    <SelectItem value="friend">Amigo/a</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Datos clínicos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label>Diagnósticos</Label>
                <div className="mt-1"><DiagnosisListEditor value={diagnoses} onChange={setDiagnoses} /></div>
              </div>
              <div><Label>Tipo de tratamiento</Label>
                <Select value={form.treatment_type || ""} onValueChange={(v) => u("treatment_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservador</SelectItem>
                    <SelectItem value="surgery">Quirúrgico</SelectItem>
                    <SelectItem value="mixed">Mixto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Médico</Label><Input value={form.doctor_name || ""} onChange={(e) => u("doctor_name", e.target.value)} /></div>
              <div><Label>Fecha lesión</Label><Input type="date" value={form.injury_date || ""} onChange={(e) => u("injury_date", e.target.value)} /></div>
              <div><Label>Fecha cirugía</Label><Input type="date" value={form.surgery_date || ""} onChange={(e) => u("surgery_date", e.target.value)} /></div>
              <div><Label>Inicio síntomas</Label><Input type="date" value={form.symptom_start_date || ""} onChange={(e) => u("symptom_start_date", e.target.value)} /></div>
              <div><Label>Tipo inmovilización</Label><Input value={form.immobilization_type || ""} onChange={(e) => u("immobilization_type", e.target.value)} /></div>
              <div><Label>Próximo OyT</Label><Input type="date" value={form.next_oyt_appointment || ""} onChange={(e) => u("next_oyt_appointment", e.target.value)} /></div>
              <div><Label>Semanas inmovilización</Label><Input type="number" value={form.immobilization_weeks || ""} onChange={(e) => u("immobilization_weeks", e.target.value)} /></div>
              <div><Label>Días inmovilización</Label><Input type="number" value={form.immobilization_days || ""} onChange={(e) => u("immobilization_days", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Mecanismo de lesión</Label><Textarea value={form.injury_mechanism || ""} onChange={(e) => u("injury_mechanism", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Tratamiento actual</Label><Textarea value={form.current_treatment || ""} onChange={(e) => u("current_treatment", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Tratamiento farmacológico</Label><Textarea value={form.pharmacological_treatment || ""} onChange={(e) => u("pharmacological_treatment", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Antecedentes</Label><Textarea value={form.medical_history || ""} onChange={(e) => u("medical_history", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Estudios</Label><Textarea value={form.studies || ""} onChange={(e) => u("studies", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Motivo de consulta</Label><Textarea value={form.referral_reason || ""} onChange={(e) => u("referral_reason", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Notas clínicas</Label><Textarea value={form.clinical_notes || ""} onChange={(e) => u("clinical_notes", e.target.value)} /></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Perfil ocupacional</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Lateralidad</Label>
                <Select value={form.dominance || ""} onValueChange={(v) => u("dominance", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">Diestro/a</SelectItem>
                    <SelectItem value="left">Zurdo/a</SelectItem>
                    <SelectItem value="ambidextrous">Ambidiestro/a</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Situación laboral</Label>
                <Select value={form.employment_status || ""} onValueChange={(v) => u("employment_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_STATUS_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Estado civil</Label>
                <Select value={form.marital_status || ""} onValueChange={(v) => u("marital_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {MARITAL_STATUS_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nivel educativo</Label>
                <Select value={form.education_level || ""} onValueChange={(v) => u("education_level", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {EDUCATION_LEVEL_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Trabajo</Label><Input value={form.job || ""} onChange={(e) => u("job", e.target.value)} /></div>
              <div><Label>Educación (detalle)</Label><Input value={form.education || ""} onChange={(e) => u("education", e.target.value)} /></div>
              <div><Label>Red de apoyo</Label><Input value={form.support_network || ""} onChange={(e) => u("support_network", e.target.value)} /></div>
              <div><Label>Ocio</Label><Textarea value={form.leisure || ""} onChange={(e) => u("leisure", e.target.value)} /></div>
              <div><Label>Actividad física</Label><Textarea value={form.physical_activity || ""} onChange={(e) => u("physical_activity", e.target.value)} /></div>
              <div><Label>Sueño y descanso</Label><Textarea value={form.sleep_rest || ""} onChange={(e) => u("sleep_rest", e.target.value)} /></div>
              <div><Label>Gestión de la salud</Label><Textarea value={form.health_management || ""} onChange={(e) => u("health_management", e.target.value)} /></div>
              <div><Label>Notas ocupacionales</Label><Textarea value={form.occupational_notes || ""} onChange={(e) => u("occupational_notes", e.target.value)} /></div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name || !form.dni}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
