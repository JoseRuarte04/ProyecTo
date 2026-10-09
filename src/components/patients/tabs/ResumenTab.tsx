import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, CalendarDays, AlertTriangle, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  patient: any;
  clinical: any;
  diagnoses?: { code: string | null; label: string }[];
  sessions: any[];
  onViewSession: (sessionId: string) => void;
}

const Field = ({ label, value, full }: { label: string; value: any; full?: boolean }) => {
  if (value == null || value === "") return null;
  return (
    <div className={cn("min-w-0", full ? "col-span-2" : "")}>
      <p className="field-label mb-0.5">{label}</p>
      <p className="text-sm whitespace-pre-wrap break-words text-foreground">{value}</p>
    </div>
  );
};

const sessionTypeLabel = (type: string | null) => {
  const map: Record<string, string> = { admission: "Admisión", follow_up: "Seguimiento", discharge: "Alta" };
  return type ? (map[type] ?? type) : null;
};

const treatmentLabel = (value: string | null | undefined) =>
  value ? ({ conservative: "Conservador", surgery: "Quirúrgico", mixed: "Mixto" } as Record<string, string>)[value] || value : null;

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d + "T12:00:00"), "d MMM yyyy", { locale: es }) : null);

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

export function ResumenTab({ patient, clinical, diagnoses = [], sessions, onViewSession }: Props) {
  const primaryDx = diagnoses[0]?.label || clinical?.diagnosis || null;
  const secondaryDx = diagnoses.slice(1);

  const hasClinicalContext = clinical && (
    clinical.injury_mechanism || clinical.treatment_type || clinical.immobilization_type ||
    clinical.injury_date || clinical.surgery_date || clinical.weeks_post_injury || clinical.weeks_post_surgery ||
    clinical.immobilization_weeks || clinical.pharmacological_treatment || clinical.medical_history
  ) || patient?.allergies;

  const lastSession = sessions[0] ?? null;

  return (
    <div className="space-y-5">
      {primaryDx && (
        <div className="space-y-2">
          <h2 className="font-serif text-base font-semibold text-foreground">Diagnóstico</h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <p className="text-sm text-foreground">{primaryDx}</p>
            {secondaryDx.map((d, i) => (
              <p key={i} className="text-sm text-muted-foreground">{d.label}</p>
            ))}
          </div>
        </div>
      )}

      {hasClinicalContext && (
        <div className="space-y-2">
          <h2 className="font-serif text-base font-semibold text-foreground">Datos clínicos</h2>
          <div className="bg-card rounded-[10px] border border-border overflow-hidden">
            <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-4">
              <Field label="Mecanismo de lesión" value={clinical?.injury_mechanism} full />
              <Field label="Tipo de tratamiento" value={treatmentLabel(clinical?.treatment_type)} />
              <Field label="Tipo de inmovilización" value={clinical?.immobilization_type} />
              <Field label="Fecha de lesión" value={fmtDate(clinical?.injury_date)} />
              <Field label="Fecha de cirugía" value={fmtDate(clinical?.surgery_date)} />
              <Field label="Semanas post-lesión" value={periodStr(clinical?.weeks_post_injury, clinical?.days_post_injury) ?? periodFromDate(clinical?.injury_date)} />
              <Field label="Semanas post-operatorio" value={periodStr(clinical?.weeks_post_surgery, clinical?.days_post_surgery) ?? periodFromDate(clinical?.surgery_date)} />
              <Field label="Semanas de inmovilización" value={periodStr(clinical?.immobilization_weeks, clinical?.immobilization_days)} />
              <Field label="Tratamiento farmacológico" value={clinical?.pharmacological_treatment} full />
              <Field label="Antecedentes personales" value={clinical?.medical_history} full />
              {patient?.allergies && (
                <div className="col-span-2 min-w-0">
                  <p className="field-label mb-0.5">Alergias</p>
                  <p className="text-sm text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {patient.allergies}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-serif text-base font-semibold text-foreground">Última sesión</h2>
        {!lastSession ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Sin sesiones registradas aún.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {format(parseISO(lastSession.session_date), "d 'de' MMMM yyyy", { locale: es })}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {lastSession.session_number != null && (
                      <span className="text-xs text-muted-foreground">Sesión {lastSession.session_number}</span>
                    )}
                    {sessionTypeLabel(lastSession.session_type) && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">{sessionTypeLabel(lastSession.session_type)}</Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline" size="sm" className="gap-1.5 text-xs h-7 shrink-0"
                onClick={() => onViewSession(lastSession.id)}
              >
                Ver sesión completa <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {(lastSession.session_goals || lastSession.interventions || lastSession.home_instructions_sent || lastSession.notes) && (
              <div className="border-t border-border pt-3 grid grid-cols-1 gap-3">
                <Field label="Objetivo" value={lastSession.session_goals} />
                <Field label="Intervenciones" value={lastSession.interventions} />
                <Field label="Indicaciones enviadas al paciente" value={lastSession.home_instructions_sent} />
                <Field label="Notas internas" value={lastSession.notes} />
              </div>
            )}
          </div>
        )}
      </div>

      {!primaryDx && !hasClinicalContext && !lastSession && (
        <div className="bg-card rounded-[10px] border border-dashed border-border p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
          <Stethoscope className="h-6 w-6" />
          Todavía no hay información clínica registrada para este paciente.
        </div>
      )}
    </div>
  );
}
