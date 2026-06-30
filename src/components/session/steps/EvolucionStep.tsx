import { FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard, FieldLabel, textareaClass } from "../shared";

interface EvolucionStepProps {
  general_observations: string; setGeneralObservations: (v: string) => void;
  symptom_changes: string; setSymptomChanges: (v: string) => void;
  clinical_changes: string; setClinicalChanges: (v: string) => void;
  avd_followup: string; setAvdFollowup: (v: string) => void;
  session_number: string;
  week_at_session: string;
}

export function EvolucionStep({
  general_observations, setGeneralObservations,
  symptom_changes, setSymptomChanges,
  clinical_changes, setClinicalChanges,
  avd_followup, setAvdFollowup,
  session_number,
  week_at_session,
}: EvolucionStepProps) {
  return (
    <SectionCard id="sec-evolucion" icon={FileText} title="Evolución">
      <div className="space-y-4">
        <div>
          <FieldLabel>Nota general de la sesión</FieldLabel>
          <Textarea
            rows={4}
            placeholder={`Paciente asiste a ${session_number ? session_number + "ra" : "X"} sesión, cursando su ${week_at_session || "X"}ma semana POP/PL...`}
            value={general_observations}
            onChange={(e) => setGeneralObservations(e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Cambios en síntomas</FieldLabel>
          <Textarea rows={2} value={symptom_changes} onChange={(e) => setSymptomChanges(e.target.value)} className={textareaClass} />
        </div>
        <div>
          <FieldLabel>Cambios clínicos</FieldLabel>
          <Textarea rows={2} value={clinical_changes} onChange={(e) => setClinicalChanges(e.target.value)} className={textareaClass} />
        </div>
        <div>
          <FieldLabel>AVD — seguimiento</FieldLabel>
          <Textarea
            rows={2}
            placeholder="Baño, vestido, alimentación, traslados..."
            value={avd_followup}
            onChange={(e) => setAvdFollowup(e.target.value)}
            className={textareaClass}
          />
        </div>
      </div>
    </SectionCard>
  );
}
