import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { ObrasSocialesAutocomplete } from "@/components/patients/InsuranceField";

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

// ── CIE-10 autocomplete ──
function Cie10Autocomplete({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Array<{ code: string; description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updateRect = () => {
    if (wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  };

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) { setResults([]); setOpen(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_cie10', { search_input: term, max_results: 10 });
      if (cancelled) return;
      setResults(data || []);
      updateRect();
      setOpen(true);
      setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); setLoading(false); };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    updateRect();
    const onResize = () => updateRect();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
  }, [open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (results.length > 0) { updateRect(); setOpen(true); } }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      {open && results.length > 0 && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: rect.top + rect.height + 4, left: rect.left, width: rect.width, zIndex: 60 }}
          className="max-h-64 overflow-auto rounded-md border bg-popover shadow-md"
        >
          {results.map((r) => (
            <button
              key={r.code}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(`${r.code} — ${r.description}`); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="font-medium">{r.code}</span> — {r.description}
            </button>
          ))}
        </div>,
        document.body
      )}
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
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split("T")[0]);

  // Step 2 — Información clínica
  const [insurance, setInsurance] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [referralReason, setReferralReason] = useState("");

  // Step 3 — Contacto
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");

  const or = (v: string) => v.trim() || null;

  // ── Validation helpers ──
  const isNumericOnly = (v: string) => /^\d+$/.test(v.trim());
  const isValidName   = (v: string) => !v.trim() || /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/.test(v.trim());
  const isValidPhone  = (v: string) => !v.trim() || /^[+\d][\d\s\-()+]*$/.test(v.trim());
  const isValidEmail  = (v: string) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!lastName.trim()) {
      errs.lastName = "Este campo es obligatorio";
    } else if (!isValidName(lastName)) {
      errs.lastName = "El apellido solo puede contener letras";
    }
    if (!firstName.trim()) {
      errs.firstName = "Este campo es obligatorio";
    } else if (!isValidName(firstName)) {
      errs.firstName = "El nombre solo puede contener letras";
    }
    if (!dni.trim()) {
      errs.dni = "El DNI es obligatorio";
    } else if (!isNumericOnly(dni)) {
      errs.dni = "El DNI debe contener solo números, sin letras ni símbolos";
    }
    if (!birthDate)    errs.birthDate    = "Este campo es obligatorio";
    if (!admissionDate) errs.admissionDate = "Este campo es obligatorio";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = () => {
    const errs: Record<string, string> = {};
    if (phone && !isValidPhone(phone))
      errs.phone = "El teléfono solo puede contener números y el signo + (ej: +54 11 1234-5678)";
    if (email && !isValidEmail(email))
      errs.email = "Ingresá un email válido (ej: nombre@dominio.com)";
    if (emergencyPhone && !isValidPhone(emergencyPhone))
      errs.emergencyPhone = "El teléfono solo puede contener números y el signo + (ej: +54 11 1234-5678)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) {
      toast.error("Completá los campos obligatorios");
      return;
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
          emergency_contact_name: or(emergencyName),
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
      }).select("id").single();
      if (epErr) throw epErr;

      // Save clinical record if any clinical fields filled
      if (diagnosis || doctorName || referralReason) {
        await supabase.from("patient_clinical_records").insert({
          patient_id: pid,
          episode_id: episode.id,
          diagnosis: or(diagnosis),
          doctor_name: or(doctorName),
          referral_reason: or(referralReason),
        });
      }

      toast.success("Paciente registrado correctamente");
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
          <Button variant="ghost" size="icon" onClick={() => navigate("/patients")} className="text-foreground hover:bg-muted shrink-0">
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
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className={cn(inputClass, fieldCls("lastName"))} />
                <ErrMsg field="lastName" />
              </div>
              <div>
                <FieldLabel required>Nombre</FieldLabel>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={cn(inputClass, fieldCls("firstName"))} />
                <ErrMsg field="firstName" />
              </div>
              <div>
                <FieldLabel required>DNI</FieldLabel>
                <Input value={dni} onChange={(e) => setDni(e.target.value)} className={cn(inputClass, fieldCls("dni"))} />
                <ErrMsg field="dni" />
              </div>
              <div>
                <FieldLabel required>Fecha de nacimiento</FieldLabel>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={cn(inputClass, fieldCls("birthDate"))} />
                <ErrMsg field="birthDate" />
              </div>
              <div>
                <FieldLabel>Género</FieldLabel>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Seleccionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Femenino</SelectItem>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                    <SelectItem value="no_data">Prefiero no decir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>Nacionalidad</FieldLabel>
                <Input value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass} />
              </div>
              <div>
                <FieldLabel required>Fecha de ingreso</FieldLabel>
                <Input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={cn(inputClass, fieldCls("admissionDate"))} />
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
                <ObrasSocialesAutocomplete value={insurance} onChange={setInsurance} placeholder="Buscar obra social…" className={inputClass} />
              </div>
              <div>
                <FieldLabel>N° de afiliado</FieldLabel>
                <Input value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} className={inputClass} />
              </div>
              <div>
                <FieldLabel>Médico derivante</FieldLabel>
                <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Diagnóstico de derivación</FieldLabel>
                <Cie10Autocomplete value={diagnosis} onChange={setDiagnosis} placeholder="Buscar por código o nombre CIE-10…" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Motivo de consulta</FieldLabel>
                <Textarea value={referralReason} onChange={(e) => setReferralReason(e.target.value)} rows={3} placeholder="Descripción del motivo de consulta o derivación…" className="rounded-md text-sm" />
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
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className={cn(inputClass, fieldCls("phone"))} placeholder="+54 11 1234-5678" />
                <ErrMsg field="phone" />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cn(inputClass, fieldCls("email"))} />
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
                  <FieldLabel>Nombre completo</FieldLabel>
                  <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Teléfono</FieldLabel>
                  <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className={cn(inputClass, fieldCls("emergencyPhone"))} />
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
                <SummaryRow label="DNI" value={dni} />
                <SummaryRow label="Nacimiento" value={birthDate} />
                {gender && <SummaryRow label="Género" value={{ female: "Femenino", male: "Masculino", other: "Otro", no_data: "Prefiero no decir" }[gender] ?? gender} />}
                {nationality && <SummaryRow label="Nacionalidad" value={nationality} />}
                <SummaryRow label="Ingreso" value={admissionDate} />
                {insurance && <SummaryRow label="Obra social" value={insurance} />}
                {insuranceNumber && <SummaryRow label="N° afiliado" value={insuranceNumber} />}
                {diagnosis && <SummaryRow label="Diagnóstico" value={diagnosis} />}
                {doctorName && <SummaryRow label="Médico" value={doctorName} />}
                {phone && <SummaryRow label="Teléfono" value={phone} />}
                {email && <SummaryRow label="Email" value={email} />}
                {address && <SummaryRow label="Domicilio" value={address} />}
                {emergencyName && <SummaryRow label="Emergencia" value={`${emergencyName}${emergencyPhone ? " · " + emergencyPhone : ""}${emergencyRelation ? " (" + emergencyRelation + ")" : ""}`} />}
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
    </div>
  );
}
