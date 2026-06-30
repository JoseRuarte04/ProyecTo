import { ClipboardList, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard, FieldLabel, textareaClass } from "../shared";

interface CierreStepProps {
  interventions: string; setInterventions: (v: string) => void;
  home_instructions_sent: string; setHomeInstructionsSent: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
}

export function CierreStep({
  interventions, setInterventions,
  home_instructions_sent, setHomeInstructionsSent,
  notes, setNotes,
}: CierreStepProps) {
  return (
    <>
      <SectionCard id="sec-intervenciones" icon={ClipboardList} title="Intervenciones">
        <FieldLabel>En el día de hoy se abordó</FieldLabel>
        <Textarea rows={5} value={interventions} onChange={(e) => setInterventions(e.target.value)} className={textareaClass} />
      </SectionCard>

      <SectionCard id="sec-notas" icon={MessageSquare} title="Indicaciones y notas">
        <div className="space-y-4">
          <div>
            <FieldLabel>Indicaciones enviadas al paciente</FieldLabel>
            <Textarea rows={3} value={home_instructions_sent} onChange={(e) => setHomeInstructionsSent(e.target.value)} className={textareaClass} />
          </div>
          <div>
            <FieldLabel>Notas internas</FieldLabel>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass} />
            <p className="text-xs text-muted-foreground mt-1">Campo interno, no visible en el resumen clínico</p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
