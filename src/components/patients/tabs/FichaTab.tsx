import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Edit, ClipboardList, Stethoscope, User } from "lucide-react";
import { employmentStatusLabel, maritalStatusLabel, educationLevelLabel } from "@/components/patients/occupationalOptions";

interface Props {
  patient: any;
  clinical: any;
  occupational: any;
  activeEpisode: any;
  onEditFicha: () => void;
}

const Field = ({ label, value, full, showEmpty = false }: { label: string; value: any; full?: boolean; showEmpty?: boolean }) => {
  const isEmpty = value == null || value === "";
  if (isEmpty && !showEmpty) return null;
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="field-label mb-0.5">{label}</p>
      <p className={`text-sm whitespace-pre-wrap ${isEmpty ? "text-muted-foreground" : "text-foreground"}`}>
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

export function FichaTab({ patient, clinical, occupational, activeEpisode, onEditFicha }: Props) {
  const treatmentLabel = clinical?.treatment_type
    ? ({ conservative: "Conservador", surgery: "Quirúrgico", mixed: "Mixto" } as Record<string, string>)[clinical.treatment_type] || clinical.treatment_type
    : null;
  const dominanceLabel = occupational?.dominance
    ? ({ right: "Diestro/a", left: "Zurdo/a", ambidextrous: "Ambidiestro/a" } as Record<string, string>)[occupational.dominance] || occupational.dominance
    : null;
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
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onEditFicha}>
          <Edit className="h-4 w-4 mr-1" /> Editar ficha
        </Button>
      </div>

      <Section title="Episodio activo" icon={<ClipboardList className="h-4 w-4" />}>
        {clinical?.diagnosis && <Field label="Diagnóstico principal" value={clinical.diagnosis} full />}
        <Field label="Tipo de tratamiento" value={treatmentLabel} />
        <Field label="Médico derivante" value={clinical?.doctor_name} />
        <Field label="Fecha de admisión" value={patient.admission_date ? format(new Date(patient.admission_date), "d MMM yyyy", { locale: es }) : null} />
        <Field label="Nº de episodio" value={activeEpisode?.episode_number} />
        <Field label="Nº de afiliado" value={patient.insurance_number} />
        <Field label="Nacionalidad" value={patient.nationality} />
        {patient.gender && (
          <Field label="Género" value={{ female: "Femenino", male: "Masculino", other: "Otro", no_data: "Prefiero no decir" }[patient.gender as string] ?? patient.gender} />
        )}
        <Field label="Teléfono" value={patient.phone} />
        {patient.email && <Field label="Email" value={patient.email} />}
        <Field label="Domicilio" value={patient.address} full />
        {patient.emergency_contact_name && (
          <Field
            label="Contacto de emergencia"
            value={`${patient.emergency_contact_name}${patient.emergency_contact_phone ? " · " + patient.emergency_contact_phone : ""}${patient.emergency_contact_relation ? " (" + ({ parent: "Padre / Madre", spouse: "Cónyuge / Pareja", sibling: "Hermano/a", child: "Hijo/a", friend: "Amigo/a", other: "Otro" }[patient.emergency_contact_relation as string] ?? patient.emergency_contact_relation) + ")" : ""}`}
            full
          />
        )}
      </Section>

      {clinical && (clinical.injury_date || clinical.surgery_date || clinical.symptom_start_date || clinical.injury_mechanism || clinical.treatment_type || clinical.immobilization_type || clinical.studies || clinical.weeks_post_injury || clinical.weeks_post_surgery || clinical.immobilization_weeks || clinical.diagnosis || clinical.referral_reason) && (
        <Section title="Datos clínicos" icon={<Stethoscope className="h-4 w-4" />}>
          <Field label="Fecha de lesión" value={fmtDate(clinical.injury_date)} />
          <Field label="Fecha de cirugía" value={fmtDate(clinical.surgery_date)} showEmpty />
          <Field label="Mecanismo de lesión" value={clinical.injury_mechanism} full />
          <Field label="Tipo de tratamiento" value={treatmentLabel} />
          <Field label="Semanas post-lesión" value={periodStr(clinical.weeks_post_injury, clinical.days_post_injury) ?? periodFromDate(clinical.injury_date)} />
          <Field label="Semanas post-operatorio" value={periodStr(clinical.weeks_post_surgery, clinical.days_post_surgery) ?? periodFromDate(clinical.surgery_date)} />
          <Field label="Semanas de inmovilización" value={periodStr(clinical.immobilization_weeks, clinical.immobilization_days)} />
          <Field label="Tipo de inmovilización" value={clinical.immobilization_type} />
          <Field label="Estudios" value={clinical.studies} full />
          <Field label="Inicio síntomas" value={fmtDate(clinical.symptom_start_date)} />
          <Field label="Próximo OyT" value={fmtDate(clinical.next_oyt_appointment)} />
          <Field label="Tratamiento actual" value={clinical.current_treatment} full />
          <Field label="Tratamiento farmacológico" value={clinical.pharmacological_treatment} full />
          <Field label="Antecedentes personales" value={clinical.medical_history} full />
          <Field label="Motivo de consulta" value={clinical.referral_reason} full />
          <Field label="Notas clínicas" value={clinical.notes} full />
        </Section>
      )}

      {occupational && (
        <Section title="Perfil ocupacional" icon={<User className="h-4 w-4" />}>
          <Field label="Lateralidad" value={dominanceLabel} />
          <Field label="Situación laboral" value={employmentStatusLabel(occupational.employment_status)} />
          <Field label="Estado civil" value={maritalStatusLabel(occupational.marital_status)} />
          <Field label="Nivel educativo" value={educationLevelLabel(occupational.education_level)} />
          <Field label="Trabajo" value={occupational.job} />
          <Field label="Educación (detalle)" value={occupational.education} />
          <Field label="Red de apoyo" value={occupational.support_network} />
          <Field label="Ocio" value={occupational.leisure} />
          <Field label="Actividad física" value={occupational.physical_activity} />
          <Field label="Sueño y descanso" value={occupational.sleep_rest} />
          <Field label="Gestión de la salud" value={occupational.health_management} />
          {occupational.dash_score != null && (
            <Field label="Puntaje DASH" value={`${occupational.dash_score} / 100`} />
          )}
          <Field label="Notas" value={occupational.notes} full />
        </Section>
      )}

      {!clinical && !occupational && (
        <div className="bg-card rounded-[10px] border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          Sin datos clínicos ni perfil ocupacional registrado.
        </div>
      )}
    </div>
  );
}
