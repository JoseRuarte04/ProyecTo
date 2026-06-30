import { Briefcase } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, FieldLabel, inputClass, textareaClass } from "../shared";

interface PerfilOcupacionalStepProps {
  occ_dominance: string; setOccDominance: (v: string) => void;
  occ_support_network: string; setOccSupportNetwork: (v: string) => void;
  occ_education: string; setOccEducation: (v: string) => void;
  occ_job: string; setOccJob: (v: string) => void;
  occ_leisure: string; setOccLeisure: (v: string) => void;
  occ_physical_activity: string; setOccPhysicalActivity: (v: string) => void;
  occ_sleep_rest: string; setOccSleepRest: (v: string) => void;
  occ_health_management: string; setOccHealthManagement: (v: string) => void;
}

export function PerfilOcupacionalStep({
  occ_dominance, setOccDominance,
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
        <div><FieldLabel>Red de apoyo</FieldLabel><Textarea rows={2} value={occ_support_network} onChange={(e) => setOccSupportNetwork(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Educación</FieldLabel><Textarea rows={2} value={occ_education} onChange={(e) => setOccEducation(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Trabajo / ocupación</FieldLabel><Textarea rows={2} value={occ_job} onChange={(e) => setOccJob(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Ocio y tiempo libre</FieldLabel><Textarea rows={2} value={occ_leisure} onChange={(e) => setOccLeisure(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Actividad física</FieldLabel><Textarea rows={2} value={occ_physical_activity} onChange={(e) => setOccPhysicalActivity(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Sueño y descanso</FieldLabel><Textarea rows={2} value={occ_sleep_rest} onChange={(e) => setOccSleepRest(e.target.value)} className={textareaClass} /></div>
        <div><FieldLabel>Gestión de la salud</FieldLabel><Textarea rows={2} value={occ_health_management} onChange={(e) => setOccHealthManagement(e.target.value)} className={textareaClass} /></div>
      </div>
    </SectionCard>
  );
}
