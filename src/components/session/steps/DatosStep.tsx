import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, FieldLabel, inputClass, textareaClass } from "../shared";

interface DatosStepProps {
  session_date: string; setSessionDate: (v: string) => void;
  session_type: string; setSessionType: (v: string) => void;
  session_number: string; setSessionNumber: (v: string) => void;
  week_at_session: string; setWeekAtSession: (v: string) => void;
  discharge_summary: string; setDischargeSummary: (v: string) => void;
  weekCalcSource: "injury" | "symptom" | null;
  isAdmission: boolean;
}

export function DatosStep({
  session_date, setSessionDate,
  session_type, setSessionType,
  session_number, setSessionNumber,
  week_at_session, setWeekAtSession,
  discharge_summary, setDischargeSummary,
  weekCalcSource,
  isAdmission,
}: DatosStepProps) {
  return (
    <SectionCard id="sec-datos" icon={Calendar} title="Datos de la sesión">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Fecha *</FieldLabel>
          <Input
            type="date"
            value={session_date}
            onChange={(e) => setSessionDate(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel>Tipo de sesión</FieldLabel>
          <Select value={session_type} onValueChange={setSessionType} disabled={isAdmission}>
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {isAdmission && <SelectItem value="admission">Admisión</SelectItem>}
              <SelectItem value="follow_up">Seguimiento</SelectItem>
              <SelectItem value="discharge">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>Nº de sesión</FieldLabel>
          <Input
            type="number"
            min={1}
            value={session_number}
            onChange={(e) => setSessionNumber(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel>Semanas POP/PL</FieldLabel>
          <Input
            type="number"
            min={0}
            placeholder="ej: 6"
            value={week_at_session}
            onChange={(e) => setWeekAtSession(e.target.value)}
            className={inputClass}
          />
          {weekCalcSource && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Calculado desde {weekCalcSource === "injury" ? "fecha de lesión" : "inicio de síntomas"} (editable)
            </p>
          )}
        </div>
      </div>
      {session_type === "discharge" && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <FieldLabel>Resumen de alta / objetivos cumplidos</FieldLabel>
          <Textarea
            rows={3}
            value={discharge_summary}
            onChange={(e) => setDischargeSummary(e.target.value)}
            placeholder="Motivo del alta, objetivos cumplidos..."
            className={textareaClass}
          />
        </div>
      )}
    </SectionCard>
  );
}
