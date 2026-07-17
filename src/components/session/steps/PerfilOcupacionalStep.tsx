import { Briefcase } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, FieldLabel, inputClass, textareaClass } from "../shared";
import { EMPLOYMENT_STATUS_OPTIONS, MARITAL_STATUS_OPTIONS, EDUCATION_LEVEL_OPTIONS } from "@/components/patients/occupationalOptions";

interface PerfilOcupacionalStepProps {
  occ_dominance: string; setOccDominance: (v: string) => void;
  occ_employment_status: string; setOccEmploymentStatus: (v: string) => void;
  occ_marital_status: string; setOccMaritalStatus: (v: string) => void;
  occ_education_level: string; setOccEducationLevel: (v: string) => void;
  occ_support_network: string; setOccSupportNetwork: (v: string) => void;
  occ_education: string; setOccEducation: (v: string) => void;
  occ_job: string; setOccJob: (v: string) => void;
  occ_leisure: string; setOccLeisure: (v: string) => void;
  occ_physical_activity: string; setOccPhysicalActivity: (v: string) => void;
  occ_sleep_rest: string; setOccSleepRest: (v: string) => void;
  occ_health_management: string; setOccHealthManagement: (v: string) => void;
}

function OptionSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
        <SelectContent position="popper">
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PerfilOcupacionalStep({
  occ_dominance, setOccDominance,
  occ_employment_status, setOccEmploymentStatus,
  occ_marital_status, setOccMaritalStatus,
  occ_education_level, setOccEducationLevel,
  occ_support_network, setOccSupportNetwork,
  occ_education, setOccEducation,
  occ_job, setOccJob,
  occ_leisure, setOccLeisure,
  occ_physical_activity, setOccPhysicalActivity,
  occ_sleep_rest, setOccSleepRest,
  occ_health_management, setOccHealthManagement,
}: PerfilOcupacionalStepProps) {
  return (
    <SectionCard id="sec-ocupacional" icon={Briefcase} title="Perfil ocupacional">
      <div className="space-y-4">
        <div>
          <FieldLabel>Dominancia</FieldLabel>
          <Select value={occ_dominance} onValueChange={setOccDominance}>
            <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="right">Diestro/a</SelectItem>
              <SelectItem value="left">Zurdo/a</SelectItem>
              <SelectItem value="ambidextrous">Ambidiestro/a</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <OptionSelect label="Situación laboral" value={occ_employment_status} onChange={setOccEmploymentStatus} options={EMPLOYMENT_STATUS_OPTIONS} />
        <OptionSelect label="Estado civil" value={occ_marital_status} onChange={setOccMaritalStatus} options={MARITAL_STATUS_OPTIONS} />
        <OptionSelect label="Nivel educativo" value={occ_education_level} onChange={setOccEducationLevel} options={EDUCATION_LEVEL_OPTIONS} />
        <div><FieldLabel>Red de apoyo</FieldLabel><Textarea rows={2} value={occ_support_network} onChange={(e) => setOccSupportNetwork(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Educación (detalle)</FieldLabel><Textarea rows={2} value={occ_education} onChange={(e) => setOccEducation(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Trabajo / ocupación</FieldLabel><Textarea rows={2} value={occ_job} onChange={(e) => setOccJob(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Ocio y tiempo libre</FieldLabel><Textarea rows={2} value={occ_leisure} onChange={(e) => setOccLeisure(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Actividad física</FieldLabel><Textarea rows={2} value={occ_physical_activity} onChange={(e) => setOccPhysicalActivity(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Sueño y descanso</FieldLabel><Textarea rows={2} value={occ_sleep_rest} onChange={(e) => setOccSleepRest(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Gestión de la salud</FieldLabel><Textarea rows={2} value={occ_health_management} onChange={(e) => setOccHealthManagement(e.target.value)} className={textareaClass} /></div>
      </div>
    </SectionCard>
  );
}
