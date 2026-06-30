import { Stethoscope } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, FieldLabel, inputClass, textareaClass } from "../shared";
import { Cie10Autocomplete } from "../Cie10Autocomplete";

interface FichaClinicaStepProps {
  cli_diagnosis: string; setCliDiagnosis: (v: string) => void;
  cli_doctor_name: string; setCliDoctorName: (v: string) => void;
  cli_injury_date: string; setCliInjuryDate: (v: string) => void;
  cli_surgery_date: string; setCliSurgeryDate: (v: string) => void;
  cli_injury_mechanism: string; setCliInjuryMechanism: (v: string) => void;
  cli_treatment_type: string; setCliTreatmentType: (v: string) => void;
  cli_immob_weeks: string; setCliImmobWeeks: (v: string) => void;
  cli_immob_days: string; setCliImmobDays: (v: string) => void;
  cli_immob_type: string; setCliImmobType: (v: string) => void;
  cli_medical_history: string; setCliMedicalHistory: (v: string) => void;
  cli_pharma: string; setCliPharma: (v: string) => void;
  cli_studies: string; setCliStudies: (v: string) => void;
  referral_date: string; setReferralDate: (v: string) => void;
}

export function FichaClinicaStep({
  cli_diagnosis, setCliDiagnosis,
  cli_doctor_name, setCliDoctorName,
  cli_injury_date, setCliInjuryDate,
  cli_surgery_date, setCliSurgeryDate,
  cli_injury_mechanism, setCliInjuryMechanism,
  cli_treatment_type, setCliTreatmentType,
  cli_immob_weeks, setCliImmobWeeks,
  cli_immob_days, setCliImmobDays,
  cli_immob_type, setCliImmobType,
  cli_medical_history, setCliMedicalHistory,
  cli_pharma, setCliPharma,
  cli_studies, setCliStudies,
  referral_date, setReferralDate,
}: FichaClinicaStepProps) {
  return (
    <SectionCard id="sec-ficha" icon={Stethoscope} title="Ficha clínica">
      <div className="space-y-4">
        <div>
          <FieldLabel>Diagnóstico (CIE-10)</FieldLabel>
          <Cie10Autocomplete value={cli_diagnosis} onChange={setCliDiagnosis} placeholder="Buscar por código o descripción…" className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><FieldLabel>Médico derivante</FieldLabel><Input value={cli_doctor_name} onChange={(e) => setCliDoctorName(e.target.value)} className={inputClass} /></div>
          <div><FieldLabel>Fecha de derivación</FieldLabel><Input type="date" value={referral_date} onChange={(e) => setReferralDate(e.target.value)} className={inputClass} /></div>
          <div>
            <FieldLabel>Tipo de tratamiento</FieldLabel>
            <Select value={cli_treatment_type} onValueChange={setCliTreatmentType}>
              <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="conservative">Conservador</SelectItem>
                <SelectItem value="surgery">Quirúrgico</SelectItem>
                <SelectItem value="mixed">Mixto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><FieldLabel>Fecha de lesión</FieldLabel><Input type="date" value={cli_injury_date} onChange={(e) => setCliInjuryDate(e.target.value)} className={inputClass} /></div>
          <div><FieldLabel>Fecha de cirugía</FieldLabel><Input type="date" value={cli_surgery_date} onChange={(e) => setCliSurgeryDate(e.target.value)} className={inputClass} /></div>
        </div>
        <div>
          <FieldLabel>Mecanismo de lesión</FieldLabel>
          <Textarea rows={2} value={cli_injury_mechanism} onChange={(e) => setCliInjuryMechanism(e.target.value)} className={textareaClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><FieldLabel>Sem. inmovilización</FieldLabel><Input type="number" min={0} value={cli_immob_weeks} onChange={(e) => setCliImmobWeeks(e.target.value)} className={inputClass} /></div>
          <div><FieldLabel>Días inmovilización</FieldLabel><Input type="number" min={0} value={cli_immob_days} onChange={(e) => setCliImmobDays(e.target.value)} className={inputClass} /></div>
          <div><FieldLabel>Tipo de inmovilización</FieldLabel><Input value={cli_immob_type} onChange={(e) => setCliImmobType(e.target.value)} className={inputClass} /></div>
        </div>
        <div><FieldLabel>Antecedentes médicos</FieldLabel><Textarea rows={2} value={cli_medical_history} onChange={(e) => setCliMedicalHistory(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Tratamiento farmacológico</FieldLabel><Textarea rows={2} value={cli_pharma} onChange={(e) => setCliPharma(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Estudios realizados</FieldLabel><Textarea rows={2} value={cli_studies} onChange={(e) => setCliStudies(e.target.value)} className={textareaClass} /></div>
      </div>
    </SectionCard>
  );
}
