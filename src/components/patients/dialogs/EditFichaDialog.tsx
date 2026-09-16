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
import { SEX_OPTIONS } from "@/components/patients/sexOptions";
import { DiagnosisListEditor } from "@/components/patients/DiagnosisListEditor";
import { fetchEpisodeDiagnoses, saveEpisodeDiagnoses, primaryLabel, type DiagnosisItem } from "@/components/patients/diagnoses";
import { useDirtyDeps } from "@/hooks/useDirtyDeps";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  patient: any;
  clinical: any;
  activeEpisodeId: string | null;
  onSaved: () => void;
}

export function EditFichaDialog({ open, onClose, patient, clinical, activeEpisodeId, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);
  const [diagnosesLoadFailed, setDiagnosesLoadFailed] = useState(false);

  const [isDirty, resetDirty] = useDirtyDeps([form, diagnoses]);
  const { guard, confirmOpen, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (!open) return;
    setForm({
      first_name: patient?.first_name || "",
      last_name: patient?.last_name || "",
      dni: patient?.dni || "",
      birth_date: patient?.birth_date || "",
      gender: patient?.gender || "",
      nationality: patient?.nationality || "",
      phone: patient?.phone || "",
      email: patient?.email || "",
      address: patient?.address || "",
      insurance: patient?.insurance || "",
      insurance_number: patient?.insurance_number || "",
      allergies: patient?.allergies || "",
      admission_date: patient?.admission_date || "",
      emergency_contact_first_name: patient?.emergency_contact_first_name || "",
      emergency_contact_last_name: patient?.emergency_contact_last_name || "",
      emergency_contact_phone: patient?.emergency_contact_phone || "",
      emergency_contact_relation: patient?.emergency_contact_relation || "",
      doctor_name: clinical?.doctor_name || "",
      referral_reason: clinical?.referral_reason || "",
    });
    setDiagnosesLoadFailed(false);
    resetDirty();
    (async () => {
      try {
        const list = activeEpisodeId ? await fetchEpisodeDiagnoses(activeEpisodeId) : [];
        if (list.length > 0) setDiagnoses(list);
        else setDiagnoses(clinical?.diagnosis ? [{ code: null, label: clinical.diagnosis }] : []);
      } catch (err) {
        console.error("Error cargando diagnósticos:", err);
        setDiagnosesLoadFailed(true);
        toast.error("No se pudieron cargar los diagnósticos", { description: "Se van a dejar sin tocar al guardar — recargá la página para reintentar." });
      } finally {
        resetDirty();
      }
    })();
  }, [open, patient, clinical, activeEpisodeId, resetDirty]);

  const u = (field: string, value: string) => setForm((prev: any) => ({ ...prev, [field]: value }));
  const emptyToNull = (v: any) => v === "" || v === undefined ? null : v;

  const handleSave = async () => {
    if (!patient?.id || !user) return;
    setSaving(true);

    const patientPayload = {
      first_name: form.first_name, last_name: form.last_name, dni: form.dni,
      birth_date: emptyToNull(form.birth_date), gender: emptyToNull(form.gender),
      nationality: emptyToNull(form.nationality),
      phone: emptyToNull(form.phone), email: emptyToNull(form.email),
      address: emptyToNull(form.address), insurance: emptyToNull(form.insurance),
      insurance_number: emptyToNull(form.insurance_number),
      allergies: emptyToNull(form.allergies),
      admission_date: form.admission_date || patient.admission_date,
      emergency_contact_first_name: emptyToNull(form.emergency_contact_first_name),
      emergency_contact_last_name: emptyToNull(form.emergency_contact_last_name),
      emergency_contact_phone: emptyToNull(form.emergency_contact_phone),
      emergency_contact_relation: emptyToNull(form.emergency_contact_relation),
    };

    const clinicalPayload = {
      patient_id: patient.id, episode_id: activeEpisodeId,
      diagnosis: primaryLabel(diagnoses),
      doctor_name: emptyToNull(form.doctor_name),
      referral_reason: emptyToNull(form.referral_reason),
    } as any;

    // Primero la tabla nueva de diagnósticos, después el principal en legacy.
    // Si la carga inicial de diagnósticos falló, NO los tocamos — guardarlos
    // ahora haría un reemplazo completo sobre una lista que puede estar vacía
    // por el error, no porque el paciente no tenga diagnósticos.
    if (activeEpisodeId && !diagnosesLoadFailed) {
      await saveEpisodeDiagnoses(activeEpisodeId, patient.id, diagnoses);
      await supabase.from("treatment_episodes").update({ diagnosis: primaryLabel(diagnoses) }).eq("id", activeEpisodeId);
    }
    const patientRes = await supabase.from("patients").update(patientPayload).eq("id", patient.id);
    const clinicalRes = clinical?.id
      ? await supabase.from("patient_clinical_records").update(clinicalPayload).eq("id", clinical.id)
      : await supabase.from("patient_clinical_records").insert(clinicalPayload);

    setSaving(false);
    if (patientRes.error || clinicalRes.error) {
      toast.error("Error al actualizar la ficha"); return;
    }
    toast.success("Ficha actualizada correctamente");
    onSaved();
    onClose();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) guard(onClose); }}>
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
              <div><Label>Sexo</Label>
                <Select value={form.gender || ""} onValueChange={(v) => u("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {SEX_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nacionalidad</Label><Input value={form.nationality || ""} onChange={(e) => u("nationality", e.target.value)} /></div>
              <div><Label>Fecha de admisión</Label><Input type="date" value={form.admission_date || ""} onChange={(e) => u("admission_date", e.target.value)} /></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Información clínica</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label>Obra social</Label>
                <InsuranceField
                  value={form.insurance || ""}
                  onChange={(v) => setForm((prev) => ({ ...prev, insurance: v, insurance_number: v === NO_INSURANCE ? "" : prev.insurance_number }))}
                  placeholder="Buscar obra social…"
                />
              </div>
              <div><Label>Nº de afiliado</Label><Input value={form.insurance_number || ""} onChange={(e) => u("insurance_number", e.target.value)} disabled={form.insurance === NO_INSURANCE} /></div>
              <div><Label>Médico derivante</Label><Input value={form.doctor_name || ""} onChange={(e) => u("doctor_name", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Diagnósticos</Label>
                <div className="mt-1"><DiagnosisListEditor value={diagnoses} onChange={setDiagnoses} /></div>
              </div>
              <div className="sm:col-span-2"><Label>Motivo de consulta</Label><Textarea value={form.referral_reason || ""} onChange={(e) => u("referral_reason", e.target.value)} placeholder="Descripción del motivo de consulta o derivación…" /></div>
              <div className="sm:col-span-2"><Label>Alergias</Label><Textarea value={form.allergies || ""} onChange={(e) => u("allergies", e.target.value)} placeholder="Alergias conocidas (medicamentos, alimentos, etc.)…" /></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Contacto</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Teléfono</Label><Input value={form.phone || ""} onChange={(e) => u("phone", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(e) => u("email", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Dirección</Label><Input value={form.address || ""} onChange={(e) => u("address", e.target.value)} /></div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Contacto de emergencia</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Nombre</Label><Input value={form.emergency_contact_first_name || ""} onChange={(e) => u("emergency_contact_first_name", e.target.value)} /></div>
              <div><Label>Apellido</Label><Input value={form.emergency_contact_last_name || ""} onChange={(e) => u("emergency_contact_last_name", e.target.value)} /></div>
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
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => guard(onClose)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name || !form.dni}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog open={confirmOpen} onConfirm={confirmDiscard} onCancel={cancelDiscard} />
    </>
  );
}
