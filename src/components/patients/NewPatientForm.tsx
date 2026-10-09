import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Check, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { InsuranceField, NO_INSURANCE } from "@/components/patients/InsuranceField";
import { resolveInsuranceName } from "@/components/patients/insuranceCatalog";
import { DiagnosisListEditor } from "@/components/patients/DiagnosisListEditor";
import { primaryLabel, type DiagnosisItem } from "@/components/patients/diagnoses";
import { SEX_OPTIONS, sexLabel } from "@/components/patients/sexOptions";
import { useDirtyDeps } from "@/hooks/useDirtyDeps";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { DOCUMENT_TYPE_OPTIONS, DEFAULT_DOCUMENT_TYPE, documentTypeLabel } from "@/components/patients/documentTypes";

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs mb-1.5 block">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );
}

const inputClass = "rounded-md h-10 text-sm";

// ── Step indicator ──
function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                done ? "bg-primary text-primary-foreground" :
                active ? "bg-primary/15 text-primary border-2 border-primary" :
                "bg-muted text-muted-foreground"
              )}>
                {done ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : step}
              </div>
              <span className={cn("text-[10px] font-medium whitespace-nowrap", active ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={cn("h-[2px] w-12 sm:w-20 mx-1 mb-5 rounded-full transition-colors", done ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Summary field ──
function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="field-label w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

export default function NewPatientForm() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1 — Datos personales
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [documentType, setDocumentType] = useState<string>(DEFAULT_DOCUMENT_TYPE);
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split("T")[0]);

  // Step 2 — Información clínica
  const [insurance, setInsurance] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);
  const [doctorName, setDoctorName] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [allergies, setAllergies] = useState("");

  // Step 3 — Contacto
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyFirstName, setEmergencyFirstName] = useState("");
  const [emergencyLastName, setEmergencyLastName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");

  const [isDirty] = useDirtyDeps([
    lastName, firstName, dni, birthDate, gender, nationality, admissionDate,
    insurance, insuranceNumber, diagnoses, doctorName, referralReason, allergies,
    phone, email, address, emergencyFirstName, emergencyLastName, emergencyPhone, emergencyRelation,
  ]);
  const { guard, confirmOpen, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const or = (v: string) => v.trim() || null;

  // ── Validation helpers ──
  const isValidDni    = (v: string) => /^\d{7,8}$/.test(v.trim());
  const isValidName   = (v: string) => !v.trim() || /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/.test(v.trim());
  const isValidPhone  = (v: string) => !v.trim() || /^[+\d][\d\s\-()+]*$/.test(v.trim());
  const isValidEmail  = (v: string) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const REQUIRED_MSG = "Este campo es obligatorio";
  const PHONE_MSG = "El teléfono solo puede contener números y el signo + (ej: +54 11 1234-5678)";
  const EMAIL_MSG = "Ingresá un email válido (ej: nombre@dominio.com)";

  // Mensaje de error de un campo para un valor dado ("" = válido). Lo usan la validación al salir del
  // campo y "Siguiente"/"Confirmar y guardar", así los mensajes son siempre los mismos.
  const fieldError = (field: string, v: string): string => {
    switch (field) {
      case "lastName":
        if (!v.trim()) return REQUIRED_MSG;
        return isValidName(v) ? "" : "El apellido solo puede contener letras";
      case "firstName":
        if (!v.trim()) return REQUIRED_MSG;
        return isValidName(v) ? "" : "El nombre solo puede contener letras";
      case "dni":
        if (!v.trim()) return REQUIRED_MSG;
        return documentType === "dni" && !isValidDni(v) ? "El DNI debe tener 7 u 8 números, sin letras ni símbolos" : "";
      case "birthDate":
      case "admissionDate":
        return v ? "" : REQUIRED_MSG;
      case "nationality":
        return v.trim() ? "" : REQUIRED_MSG;
      case "phone":
      case "emergencyPhone":
        return !v || isValidPhone(v) ? "" : PHONE_MSG;
      case "email":
        return !v || isValidEmail(v) ? "" : EMAIL_MSG;
      default:
        return "";
    }
  };

  const STEP1_FIELDS = ["lastName", "firstName", "dni", "birthDate", "nationality", "admissionDate"];
  const STEP3_FIELDS = ["phone", "email", "emergencyPhone"];
  const fieldValues: Record<string, string> = {
    lastName, firstName, dni, birthDate, nationality, admissionDate, phone, email, emergencyPhone,
  };

  const validateFields = (fields: string[]) => {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const msg = fieldError(f, fieldValues[f]);
      if (msg) errs[f] = msg;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep1 = () => validateFields(STEP1_FIELDS);
  const validateStep3 = () => validateFields(STEP3_FIELDS);

  // Al salir del campo: muestra (o limpia) el error de ese campo en el momento, sin esperar a "Siguiente".
  const checkField = (field: string, v: string = fieldValues[field]) =>
    setErrors((prev) => {
      const msg = fieldError(field, v);
      if (msg) return { ...prev, [field]: msg };
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  // Mientras escribe: solo actualiza si el campo ya tenía error, para que desaparezca apenas queda bien.
  const liveCheck = (field: string, v: string) => {
    if (errors[field]) checkField(field, v);
  };

  const handleNext = async () => {
    if (step === 1 && !validateStep1()) {
      toast.error("Completá los campos obligatorios");
      return;
    }
    // La obra social tiene que existir en el catálogo: texto libre dejaría pacientes con coberturas
    // que no se pueden renombrar ni contar como "en uso". Si coincide, se guarda con la grafía del catálogo.
    if (step === 2 && insurance.trim() && insurance !== NO_INSURANCE) {
      const r = await resolveInsuranceName(insurance);
      if (r.status === "error") {
        toast.error("No se pudo verificar la obra social", { description: "Probá de nuevo." });
        return;
      }
      if (r.status === "missing") {
        toast.error("Esa obra social no está en el catálogo", {
          description: "Elegila de la lista o agregala con \"Agregar … como nueva obra social\".",
        });
        return;
      }
      if (r.name !== insurance) setInsurance(r.name);
    }
    setErrors({});
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => s - 1);
  };

  const handleSave = async () => {
    if (!validateStep3()) {
      toast.error("Corregí los campos con error antes de guardar");
      return;
    }
    setSaving(true);
    try {
      const { data: patient, error: patErr } = await supabase
        .from("patients")
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          preferred_name: or(preferredName),
          document_type: documentType,
          dni: dni.trim(),
          birth_date: or(birthDate),
          gender: or(gender),
          nationality: or(nationality),
          admission_date: admissionDate,
          phone: or(phone),
          email: or(email),
          address: or(address),
          insurance: or(insurance),
          insurance_number: or(insuranceNumber),
          allergies: or(allergies),
          emergency_contact_first_name: or(emergencyFirstName),
          emergency_contact_last_name: or(emergencyLastName),
          emergency_contact_phone: or(emergencyPhone),
          emergency_contact_relation: or(emergencyRelation),
          professional_id: user!.id,
          team_id: workspace.type === "team" ? workspace.teamId : null,
        })
        .select("id")
        .single();
      if (patErr) throw patErr;
      const pid = patient.id;

      const { error: epErr, data: episode } = await supabase.from("treatment_episodes").insert({
        patient_id: pid,
        professional_id: user!.id,
        episode_number: 1,
        admission_date: admissionDate,
        status: "active",
        diagnosis: primaryLabel(diagnoses),
      }).select("id").single();
      if (epErr) throw epErr;

      // El paciente y el episodio ya existen: si fallan estas dos escrituras no se corta (reintentar
      // chocaría con el DNI duplicado), pero tampoco se muestra éxito — se avisa y se lleva a la ficha.
      const failed: string[] = [];

      if (diagnoses.length > 0) {
        const { error: dxErr } = await supabase.from("episode_diagnoses").insert(
          diagnoses.map((d, i) => ({ episode_id: episode.id, patient_id: pid, code: d.code, label: d.label, position: i }))
        );
        if (dxErr) failed.push("los diagnósticos");
      }

      // Save clinical record if any clinical fields filled
      if (diagnoses.length > 0 || doctorName || referralReason) {
        const { error: recErr } = await supabase.from("patient_clinical_records").insert({
          patient_id: pid,
          episode_id: episode.id,
          diagnosis: primaryLabel(diagnoses),
          doctor_name: or(doctorName),
          referral_reason: or(referralReason),
        });
        if (recErr) failed.push("los datos de la ficha clínica");
      }

      if (failed.length > 0) {
        toast.error("El paciente se registró, pero no se guardaron " + failed.join(" ni "), {
          description: "Cargalos de nuevo desde \"Editar ficha\".",
        });
      } else {
        toast.success("Paciente registrado correctamente");
      }
      navigate(`/patients/${pid}`);
    } catch (err: any) {
      const isDuplicateDni = err?.code === "23505" && (
        err?.message?.includes("uq_patients_dni_personal_active") ||
        err?.message?.includes("uq_patients_dni_team_active")
      );
      toast.error(
        isDuplicateDni ? "Ya tenés un paciente activo con ese DNI" : "Error al registrar al paciente",
        { description: isDuplicateDni ? undefined : err.message }
      );
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = (k: string) => errors[k] ? "border-destructive ring-1 ring-destructive" : "";
  const ErrMsg = ({ field }: { field: string }) =>
    errors[field] ? <p className="text-xs text-destructive mt-1">{errors[field]}</p> : null;

  const STEP_LABELS = ["Datos personales", "Info clínica", "Contacto"];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border h-14 shrink-0">
        <div className="max-w-xl mx-auto h-full px-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => guard(() => navigate("/patients"))} className="text-foreground hover:bg-muted shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-sm font-semibold text-foreground truncate">
            {firstName || lastName ? `${lastName}${firstName ? ", " + firstName : ""}` : "Nuevo paciente"}
          </h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-8">
        {/* Step indicator */}
        <div className="flex justify-center mb-10">
          <StepIndicator current={step} total={3} labels={STEP_LABELS} />
        </div>

        {/* ── Step 1: Datos personales ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-1">Datos personales</h2>
              <p className="text-sm text-muted-foreground">Información básica del paciente.</p>
            </div>

            {/* Indicador de workspace activo */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">
              {workspace.type === "personal" ? (
                <>
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span>Paciente <span className="font-medium text-foreground">personal</span></span>
                </>
              ) : (
                <>
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    Paciente del equipo{" "}
                    <span className="font-medium text-foreground">{workspace.teamName}</span>
                  </span>
                </>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground/60">
                Cambiá el workspace desde el menú lateral
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Apellido</FieldLabel>
                <Input data-testid="patient-last-name" value={lastName} onChange={(e) => { setLastName(e.target.value); liveCheck("lastName", e.target.value); }} onBlur={() => checkField("lastName")} className={cn(inputClass, fieldCls("lastName"))} />
                <ErrMsg field="lastName" />
              </div>
              <div>
                <FieldLabel required>Nombre</FieldLabel>
                <Input data-testid="patient-first-name" value={firstName} onChange={(e) => { setFirstName(e.target.value); liveCheck("firstName", e.target.value); }} onBlur={() => checkField("firstName")} className={cn(inputClass, fieldCls("firstName"))} />
                <ErrMsg field="firstName" />
              </div>
              <div>
                <FieldLabel>Nombre preferido</FieldLabel>
                <Input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} className={inputClass} placeholder="Cómo le gusta que le llamen" />
              </div>
              <div>
                <FieldLabel required>Tipo de documento</FieldLabel>
                <Select value={documentType} onValueChange={(v) => {
                  setDocumentType(v);
                  // El formato válido depende del tipo de documento: se revalida al salir del campo o en "Siguiente".
                  setErrors((prev) => { const next = { ...prev }; delete next.dni; return next; });
                }}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Seleccionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPE_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel required>N° de documento</FieldLabel>
                <Input data-testid="patient-dni" value={dni} onChange={(e) => { setDni(e.target.value); liveCheck("dni", e.target.value); }} onBlur={() => checkField("dni")} className={cn(inputClass, fieldCls("dni"))} />
                <ErrMsg field="dni" />
              </div>
              <div>
                <FieldLabel required>Fecha de nacimiento</FieldLabel>
                <Input data-testid="patient-birth-date" type="date" value={birthDate} onChange={(e) => { setBirthDate(e.target.value); liveCheck("birthDate", e.target.value); }} onBlur={() => checkField("birthDate")} className={cn(inputClass, fieldCls("birthDate"))} />
                <ErrMsg field="birthDate" />
              </div>
              <div>
                <FieldLabel>Sexo</FieldLabel>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Seleccionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEX_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel required>Nacionalidad</FieldLabel>
                <Input data-testid="patient-nationality" value={nationality} onChange={(e) => { setNationality(e.target.value); liveCheck("nationality", e.target.value); }} onBlur={() => checkField("nationality")} className={cn(inputClass, fieldCls("nationality"))} />
                <ErrMsg field="nationality" />
              </div>
              <div>
                <FieldLabel required>Fecha de ingreso</FieldLabel>
                <Input type="date" value={admissionDate} onChange={(e) => { setAdmissionDate(e.target.value); liveCheck("admissionDate", e.target.value); }} onBlur={() => checkField("admissionDate")} className={cn(inputClass, fieldCls("admissionDate"))} />
                <ErrMsg field="admissionDate" />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Info clínica ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-1">Información clínica</h2>
              <p className="text-sm text-muted-foreground">Todos los campos son opcionales y se pueden completar más tarde.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <FieldLabel>Obra social</FieldLabel>
                <InsuranceField
                  value={insurance}
                  onChange={(v) => { setInsurance(v); if (v === NO_INSURANCE) setInsuranceNumber(""); }}
                  placeholder="Buscar obra social…"
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>N° de afiliado</FieldLabel>
                <Input value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} disabled={insurance === NO_INSURANCE} className={inputClass} />
              </div>
              <div>
                <FieldLabel>Médico derivante</FieldLabel>
                <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Diagnósticos de derivación</FieldLabel>
                <DiagnosisListEditor value={diagnoses} onChange={setDiagnoses} />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Motivo de consulta</FieldLabel>
                <Textarea value={referralReason} onChange={(e) => setReferralReason(e.target.value)} rows={3} placeholder="Descripción del motivo de consulta o derivación…" className="rounded-md text-sm" />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Alergias</FieldLabel>
                <Textarea value={allergies} onChange={(e) => setAllergies(e.target.value)} rows={2} placeholder="Alergias conocidas (medicamentos, alimentos, etc.)…" className="rounded-md text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Contacto + Resumen ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-1">Contacto</h2>
              <p className="text-sm text-muted-foreground">Datos de contacto del paciente.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Teléfono</FieldLabel>
                <Input value={phone} onChange={(e) => { setPhone(e.target.value); liveCheck("phone", e.target.value); }} onBlur={() => checkField("phone")} className={cn(inputClass, fieldCls("phone"))} placeholder="+54 11 1234-5678" />
                <ErrMsg field="phone" />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); liveCheck("email", e.target.value); }} onBlur={() => checkField("email")} className={cn(inputClass, fieldCls("email"))} />
                <ErrMsg field="email" />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Domicilio</FieldLabel>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
              </div>
            </div>

            {/* Contacto de emergencia */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Contacto de emergencia</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Nombre</FieldLabel>
                  <Input value={emergencyFirstName} onChange={(e) => setEmergencyFirstName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Apellido</FieldLabel>
                  <Input value={emergencyLastName} onChange={(e) => setEmergencyLastName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Teléfono</FieldLabel>
                  <Input value={emergencyPhone} onChange={(e) => { setEmergencyPhone(e.target.value); liveCheck("emergencyPhone", e.target.value); }} onBlur={() => checkField("emergencyPhone")} className={cn(inputClass, fieldCls("emergencyPhone"))} />
                  <ErrMsg field="emergencyPhone" />
                </div>
                <div>
                  <FieldLabel>Relación</FieldLabel>
                  <Select value={emergencyRelation} onValueChange={setEmergencyRelation}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Seleccionar…" />
                    </SelectTrigger>
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

            {/* Resumen visual */}
            <div className="bg-muted/50 border border-border rounded-xl p-5 space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Resumen</p>
              <div className="space-y-2">
                <SummaryRow label="Paciente" value={`${lastName}, ${firstName}`} />
                <SummaryRow
                  label="Contexto"
                  value={workspace.type === "personal" ? "Personal" : `Equipo: ${workspace.teamName}`}
                />
                <SummaryRow label={documentTypeLabel(documentType) ?? "Documento"} value={dni} />
                <SummaryRow label="Nacimiento" value={birthDate} />
                {gender && <SummaryRow label="Sexo" value={sexLabel(gender)} />}
                {nationality && <SummaryRow label="Nacionalidad" value={nationality} />}
                <SummaryRow label="Ingreso" value={admissionDate} />
                {insurance && <SummaryRow label="Obra social" value={insurance} />}
                {insuranceNumber && <SummaryRow label="N° afiliado" value={insuranceNumber} />}
                {diagnoses.length > 0 && <SummaryRow label={diagnoses.length > 1 ? "Diagnósticos" : "Diagnóstico"} value={diagnoses.map((d) => d.label).join(" · ")} />}
                {doctorName && <SummaryRow label="Médico" value={doctorName} />}
                {allergies && <SummaryRow label="Alergias" value={allergies} />}
                {phone && <SummaryRow label="Teléfono" value={phone} />}
                {email && <SummaryRow label="Email" value={email} />}
                {address && <SummaryRow label="Domicilio" value={address} />}
                {(emergencyFirstName || emergencyLastName) && <SummaryRow label="Emergencia" value={`${emergencyFirstName}${emergencyLastName ? " " + emergencyLastName : ""}${emergencyPhone ? " · " + emergencyPhone : ""}${emergencyRelation ? " (" + emergencyRelation + ")" : ""}`} />}
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          {step > 1 ? (
            <Button variant="ghost" onClick={handleBack} className="text-muted-foreground">
              ← Anterior
            </Button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <Button onClick={handleNext} className="bg-primary hover:bg-primary/85">
              Siguiente →
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/85 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Guardando..." : "Confirmar y guardar"}
            </Button>
          )}
        </div>
      </div>
      <UnsavedChangesDialog open={confirmOpen} onConfirm={confirmDiscard} onCancel={cancelDiscard} />
    </div>
  );
}
