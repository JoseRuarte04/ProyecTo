import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ClipboardList, Stethoscope, User, CreditCard, Phone, AlertTriangle } from "lucide-react";
import { maritalStatusLabel, educationLevelLabel } from "@/components/patients/occupationalOptions";
import { sexLabel } from "@/components/patients/sexOptions";
import { cn } from "@/lib/utils";

interface Props {
  patient: any;
  clinical: any;
  occupational: any;
  diagnoses?: { code: string | null; label: string }[];
  activeEpisode: any;
}

const Field = ({ label, value, full, showEmpty = false }: { label: string; value: any; full?: boolean; showEmpty?: boolean }) => {
  const isEmpty = value == null || value === "";
  if (isEmpty && !showEmpty) return null;
  return (
    <div className={cn("min-w-0", full ? "col-span-2" : "")}>
      <p className="field-label mb-0.5">{label}</p>
      <p className={`text-sm whitespace-pre-wrap break-words ${isEmpty ? "text-muted-foreground" : "text-foreground"}`}>
        {isEmpty ? "Sin registrar" : value}
      </p>
    </div>
  );
};

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="bg-card rounded-[10px] border border-border overflow-hidden">
    <div className="px-5 py-3 border-b border-border flex items-center gap-2.5 bg-muted">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-4">
      {children}
    </div>
  </div>
);

const EMERGENCY_RELATION_LABELS: Record<string, string> = {
  parent: "Padre / Madre", spouse: "Cónyuge / Pareja", sibling: "Hermano/a",
  child: "Hijo/a", friend: "Amigo/a", other: "Otro",
};

export function FichaTab({ patient, clinical, occupational, diagnoses = [], activeEpisode }: Props) {
  const primaryDx = diagnoses[0]?.label || clinical?.diagnosis || null;
  const secondaryDx = diagnoses.slice(1);
  const treatmentLabel = clinical?.treatment_type
    ? ({ conservative: "Conservador", surgery: "Quirúrgico", mixed: "Mixto" } as Record<string, string>)[clinical.treatment_type] || clinical.treatment_type
    : null;
  const dominanceLabel = occupational?.dominance
    ? ({ right: "Diestro/a", left: "Zurdo/a", ambidextrous: "Ambidiestro/a" } as Record<string, string>)[occupational.dominance] || occupational.dominance
    : null;
  const affectedSideLabel = activeEpisode?.affected_side
    ? (activeEpisode.affected_side === "both" ? "MSD + MSI" : activeEpisode.affected_side)
    : null;

  const hasOccupationalData = occupational && (occupational.dominance || occupational.marital_status || occupational.education_level || occupational.job || occupational.support_network);
  const hasInsuranceData = patient.insurance || patient.insurance_number;
  const hasContactData = patient.phone || patient.email || patient.address;
  const hasEmergencyContact = patient.emergency_contact_first_name || patient.emergency_contact_last_name;
  const hasClinicalData = Boolean(
    primaryDx || clinical?.doctor_name || activeEpisode?.referral_date || affectedSideLabel ||
    clinical?.referral_reason || clinical?.injury_date || clinical?.surgery_date || clinical?.injury_mechanism ||
    clinical?.treatment_type || clinical?.immobilization_type || clinical?.studies ||
    clinical?.weeks_post_injury || clinical?.weeks_post_surgery || clinical?.immobilization_weeks ||
    clinical?.medical_history || clinical?.pharmacological_treatment || patient.allergies
  );

  const fmtDate = (d: string | null | undefined) =>
    d ? format(new Date(d + "T12:00:00"), "d MMM yyyy", { locale: es }) : null;
  const periodStr = (w: number | null | undefined, d: number | null | undefined) => {
    if (w == null && d == null) return null;
    return [w != null ? `${w} sem` : "", d != null ? `${d} días` : ""].filter(Boolean).join(" · ");
  };
  const periodFromDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const diff = Math.floor((Date.now() - new Date(dateStr + "T12:00:00").getTime()) / 86400000);
    if (diff < 0) return null;
    return `${Math.floor(diff / 7)} sem · ${diff % 7} días`;
  };

  return (
    <div className="space-y-5">
      <Section title="Datos personales" icon={<ClipboardList className="h-4 w-4" />}>
        <Field label="Nombre preferido" value={patient.preferred_name} />
        <Field label="Fecha de nacimiento" value={fmtDate(patient.birth_date)} />
        {patient.gender && <Field label="Sexo" value={sexLabel(patient.gender)} />}
        <Field label="Nacionalidad" value={patient.nationality} />
        <Field label="Fecha de admisión" value={fmtDate(patient.admission_date)} />
      </Section>

      {hasInsuranceData && (
        <Section title="Obra social" icon={<CreditCard className="h-4 w-4" />}>
          <Field label="Obra social" value={patient.insurance} />
          <Field label="Nº de afiliado" value={patient.insurance_number} />
        </Section>
      )}

      {hasClinicalData && (
        <Section title="Datos clínicos" icon={<Stethoscope className="h-4 w-4" />}>
          {primaryDx && <Field label="Diagnóstico principal" value={primaryDx} full />}
          {secondaryDx.length > 0 && (
            <Field label="Diagnósticos secundarios" value={secondaryDx.map((d) => d.label).join("\n")} full />
          )}
          <Field label="Nº de episodio" value={activeEpisode?.episode_number} />
          <Field label="Tipo de tratamiento" value={treatmentLabel} />
          <Field label="Médico derivante" value={clinical?.doctor_name} />
          <Field label="Fecha de derivación" value={fmtDate(activeEpisode?.referral_date)} />
          <Field label="Lado afectado" value={affectedSideLabel} />
          <Field label="Motivo de consulta" value={clinical?.referral_reason} full />
          <Field label="Fecha de lesión" value={fmtDate(clinical?.injury_date)} />
          <Field label="Fecha de cirugía" value={fmtDate(clinical?.surgery_date)} />
          <Field label="Mecanismo de lesión" value={clinical?.injury_mechanism} full />
          <Field label="Semanas post-lesión" value={periodStr(clinical?.weeks_post_injury, clinical?.days_post_injury) ?? periodFromDate(clinical?.injury_date)} />
          <Field label="Semanas post-operatorio" value={periodStr(clinical?.weeks_post_surgery, clinical?.days_post_surgery) ?? periodFromDate(clinical?.surgery_date)} />
          <Field label="Semanas de inmovilización" value={periodStr(clinical?.immobilization_weeks, clinical?.immobilization_days)} />
          <Field label="Tipo de inmovilización" value={clinical?.immobilization_type} />
          <Field label="Antecedentes personales" value={clinical?.medical_history} full />
          <Field label="Tratamiento farmacológico" value={clinical?.pharmacological_treatment} full />
          <Field label="Estudios" value={clinical?.studies} full />
          {patient.allergies && (
            <div className="col-span-2 min-w-0">
              <p className="field-label mb-0.5">Alergias</p>
              <p className="text-sm text-red-700 flex items-center gap-1.5 whitespace-pre-wrap break-words">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {patient.allergies}
              </p>
            </div>
          )}
        </Section>
      )}

      {hasContactData && (
        <Section title="Contacto" icon={<Phone className="h-4 w-4" />}>
          <Field label="Teléfono" value={patient.phone} />
          <Field label="Email" value={patient.email} />
          <Field label="Domicilio" value={patient.address} full />
        </Section>
      )}

      {hasEmergencyContact && (
        <Section title="Contacto de emergencia" icon={<Phone className="h-4 w-4" />}>
          <Field label="Nombre" value={patient.emergency_contact_first_name} />
          <Field label="Apellido" value={patient.emergency_contact_last_name} />
          <Field label="Teléfono" value={patient.emergency_contact_phone} />
          <Field
            label="Relación"
            value={patient.emergency_contact_relation ? (EMERGENCY_RELATION_LABELS[patient.emergency_contact_relation] ?? patient.emergency_contact_relation) : null}
          />
        </Section>
      )}

      {hasOccupationalData && (
        <Section title="Perfil ocupacional" icon={<User className="h-4 w-4" />}>
          <Field label="Nivel educativo" value={educationLevelLabel(occupational.education_level)} />
          <Field label="Trabajo" value={occupational.job} />
          <Field label="Estado civil" value={maritalStatusLabel(occupational.marital_status)} />
          <Field label="Red de apoyo" value={occupational.support_network} />
          <Field label="Lateralidad" value={dominanceLabel} />
        </Section>
      )}

      {!hasInsuranceData && !hasClinicalData && !hasContactData && !hasEmergencyContact && !hasOccupationalData && (
        <div className="bg-card rounded-[10px] border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          Sin datos clínicos ni perfil ocupacional registrado.
        </div>
      )}
    </div>
  );
}
