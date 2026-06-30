import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Edit, Trash2, ChevronDown, ClipboardList, Activity } from "lucide-react";
import { toast } from "sonner";
import { EDEMA_POINTS, isNewEdemaFormat, normalizeEdemaValue, isCircometriaFormat, normalizeCircometriaValue } from "@/components/clinical/EdemaCircometryTable";

const FINGER_LABELS: Record<string, string> = {
  thumb: "Pulgar", index: "Índice", middle: "Medio", ring: "Anular", pinky: "Meñique",
  pulgar: "Pulgar", indice: "Índice", índice: "Índice", medio: "Medio",
  anular: "Anular", menique: "Meñique", meñique: "Meñique",
};

const SCAR_LABELS: Record<string, string> = {
  location: "Localización", localizacion: "Localización", length: "Longitud",
  longitud: "Longitud", longitud_cm: "Longitud", sensitivity: "Sensibilidad",
  sensibilidad: "Sensibilidad", temperature: "Temperatura", temperatura: "Temperatura",
  observations: "Observaciones", observaciones: "Observaciones", notes: "Observaciones",
};

const VSS_LABELS: Record<string, string> = {
  pigmentation: "Pigmentación", pigmentacion: "Pigmentación",
  vascularization: "Vascularización", vascularizacion: "Vascularización",
  pliability: "Flexibilidad", flexibility: "Flexibilidad", flexibilidad: "Flexibilidad",
  height: "Altura", altura: "Altura",
};

const PART_NAMES: Record<string, string> = {
  shoulder: "Hombro", elbow: "Codo", wrist: "Muñeca", hand: "Mano", thumb: "Pulgar",
};

const TEST_LABELS: Record<string, string> = {
  finkelstein: "Finkelstein", phalen: "Phalen", froment: "Froment",
  wartenberg: "Wartenberg", garra_cubital: "Garra cubital", jobe: "Jobe",
  pate: "Pate", yocum: "Yocum", herber: "Herber",
};

// ---------- SessionTimeline ----------

interface SessionTimelineProps {
  sessions: any[];
  analEvals: any[];
  funcEvals: any[];
  patientId: string;
  onDeleted: () => void;
}

export function SessionTimeline({ sessions, analEvals, funcEvals, patientId, onDeleted }: SessionTimelineProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteSession, setDeleteSession] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const typeLabel: Record<string, string> = { admission: "Admisión", follow_up: "Seguimiento", discharge: "Alta" };
  const typeColor: Record<string, string> = {
    admission: "border-primary/40 text-primary bg-transparent",
    follow_up: "border-border text-muted-foreground bg-transparent",
    discharge: "border-emerald-400 text-emerald-600 bg-transparent",
  };

  const ordinal = (n: number) => {
    if (n === 1) return "1ra"; if (n === 2) return "2da"; if (n === 3) return "3ra";
    if (n === 4) return "4ta"; if (n === 5) return "5ta"; return `${n}ma`;
  };

  const nn = (v: any) => v != null && v !== "";

  const sameDate = (a: string | null | undefined, b: string | null | undefined) => {
    if (!a || !b) return false;
    return a.slice(0, 10) === b.slice(0, 10);
  };

  const matchesSessionEval = (session: any, evaluation: any) => {
    if (evaluation.session_id && evaluation.session_id === session.id) return true;
    if (evaluation.session_id) return false;
    return !!(evaluation.episode_id && session.episode_id && evaluation.episode_id === session.episode_id && sameDate(evaluation.evaluation_date, session.session_date));
  };

  const handleDeleteSession = async () => {
    if (!deleteSession || deleteSession.session_type === "admission") return;
    setDeleting(true);
    const wasDischarge = deleteSession.session_type === "discharge";
    const episodeId = deleteSession.episode_id;

    const { error } = await supabase.rpc("soft_delete_session", { p_session_id: deleteSession.id });
    if (error) {
      console.error("Error al eliminar la sesión:", error);
      setDeleting(false);
      toast.error(`Error al eliminar la sesión: ${error.message}`);
      return;
    }

    if (wasDischarge && episodeId) {
      const { data: remaining } = await supabase.from("therapy_sessions").select("id").eq("patient_id", patientId).eq("session_type", "discharge").eq("is_deleted", false).limit(1);
      if (!remaining || remaining.length === 0) {
        await supabase.from("treatment_episodes").update({ status: "active", discharge_date: null }).eq("id", episodeId);
      }
    }

    setDeleting(false);
    toast.success("Sesión eliminada correctamente");
    setDeleteSession(null);
    onDeleted();
  };

  const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <p className="field-label mb-2">{children}</p>
  );
  const Line = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm text-foreground whitespace-pre-wrap">{children}</p>
  );

  return (
    <>
      <div className="space-y-3">
        {sessions.map((s) => {
          const isOpen = expanded === s.id;
          const linkedEval = analEvals.find(e => matchesSessionEval(s, e));
          const linkedFuncEval = funcEvals.find(e => matchesSessionEval(s, e));

          return (
            <div key={s.id} className="bg-card rounded-[10px] border border-border overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : s.id)}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-[13px]">{format(new Date(s.session_date), "dd/MM/yyyy")}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {s.session_type && <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${typeColor[s.session_type] || "border-border text-muted-foreground bg-transparent"}`}>{typeLabel[s.session_type] || s.session_type}</span>}
                    {s.session_number != null && <span className="text-[11px] text-muted-foreground">Sesión Nº {s.session_number}</span>}
                    {s.week_at_session != null && <span className="text-[11px] text-muted-foreground">· Semana {s.week_at_session} POP/PL</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/patients/${patientId}/sessions/${s.id}/edit`)} aria-label="Editar sesión">
                    <Edit className="h-4 w-4" />
                  </Button>
                  {s.session_type !== "admission" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteSession(s)} aria-label="Eliminar sesión">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border px-5 py-4 space-y-4 text-sm text-foreground">
                  <p className="italic text-muted-foreground mb-3">
                    {s.session_number != null ? `Paciente asiste a ${ordinal(s.session_number)} sesión` : "Paciente asiste a sesión"}
                    {s.week_at_session != null && (`, cursando su ${s.week_at_session} semana ${s.session_type === "admission" ? "de admisión" : s.session_type === "discharge" ? "de alta" : "POP/PL"}`)}
                    {s.week_at_session == null && s.session_type === "admission" && " de admisión"}
                    {s.week_at_session == null && s.session_type === "discharge" && " de alta"}.
                  </p>

                  {(nn(s.general_observations) || nn(s.evolution) || nn(s.symptom_changes) || nn(s.clinical_changes) || nn(s.treatment_adjustments)) && (
                    <div className="space-y-2">
                      <SectionHeading>Evolución</SectionHeading>
                      {nn(s.general_observations) && <Line>{s.general_observations}</Line>}
                      {nn(s.evolution) && <Line>{s.evolution}</Line>}
                      {nn(s.symptom_changes) && <Line>Cambios en síntomas: {s.symptom_changes}</Line>}
                      {nn(s.clinical_changes) && <Line>Cambios clínicos: {s.clinical_changes}</Line>}
                      {nn(s.treatment_adjustments) && <Line>Ajustes al tratamiento: {s.treatment_adjustments}</Line>}
                    </div>
                  )}
                  {nn(s.avd_followup) && (
                    <div className="space-y-2"><SectionHeading>AVD en sesión</SectionHeading><Line>{s.avd_followup}</Line></div>
                  )}
                  {nn(s.interventions) && (
                    <div><SectionHeading>En el día de hoy se abordó</SectionHeading><Line>{s.interventions}</Line></div>
                  )}
                  {nn(s.home_instructions_sent) && (
                    <div><SectionHeading>Indicaciones enviadas</SectionHeading><Line>{s.home_instructions_sent}</Line></div>
                  )}
                  {nn(s.notes) && (
                    <div><SectionHeading>Notas</SectionHeading><Line>{s.notes}</Line></div>
                  )}
                  <p className="text-right text-xs text-muted-foreground pt-2">{format(new Date(s.session_date), "dd/MM/yyyy")}</p>
                </div>
              )}

              {(linkedEval || linkedFuncEval) && (
                <div className="border-t border-border/50 px-5 py-3 flex flex-wrap gap-2" onClick={(ev) => ev.stopPropagation()}>
                  {linkedEval && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(`/patients/${patientId}/evaluations/analytical/${linkedEval.id}`)}>
                      <ClipboardList className="h-3.5 w-3.5" /> Ver evaluación analítica
                    </Button>
                  )}
                  {linkedFuncEval && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(`/patients/${patientId}/evaluations/functional/${linkedFuncEval.id}`)}>
                      <Activity className="h-3.5 w-3.5" /> Ver evaluación funcional
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteSession} onOpenChange={(open) => !open && setDeleteSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar sesión</AlertDialogTitle>
            <AlertDialogDescription>Esta acción ocultará la sesión del historial. No se puede eliminar la sesión de admisión.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
