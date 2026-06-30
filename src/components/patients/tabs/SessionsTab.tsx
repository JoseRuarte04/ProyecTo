import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus, Activity } from "lucide-react";
import { SessionTimeline } from "@/components/patients/SessionTimeline";

interface Props {
  sessions: any[];
  analEvals: any[];
  funcEvals: any[];
  patientId: string;
  activeEpisodeId: string | null;
  isDischargedPatient: boolean;
  onDeleted: () => void;
}

export function SessionsTab({ sessions, analEvals, funcEvals, patientId, activeEpisodeId, isDischargedPatient, onDeleted }: Props) {
  const navigate = useNavigate();

  const handleNewSession = () => {
    const isFirst = sessions.length === 0;
    const params = new URLSearchParams();
    if (activeEpisodeId) params.set("episode", activeEpisodeId);
    if (isFirst) params.set("type", "admission");
    navigate(`/patients/${patientId}/sessions/new${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const dischargeSession = sessions.find(s => s.session_type === "discharge");

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-foreground">Historial de visitas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sessions.length} {sessions.length === 1 ? "visita registrada" : "visitas registradas"}
          </p>
        </div>
        <Button
          onClick={handleNewSession}
          size="sm"
          disabled={isDischargedPatient}
          title={isDischargedPatient ? "El paciente está de alta — no se pueden agregar más sesiones" : undefined}
        >
          <Plus className="h-4 w-4 mr-2" />
          {sessions.length === 0 ? "Registrar admisión" : "Nueva sesión"}
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Activity className="h-8 w-8 text-primary/50" />
          </div>
          <p className="font-medium text-foreground">Sin visitas registradas</p>
          <p className="text-sm text-muted-foreground mt-1">Registrá la primera visita con el botón de arriba</p>
        </div>
      ) : (
        <>
          <SessionTimeline sessions={sessions} analEvals={analEvals} funcEvals={funcEvals} patientId={patientId} onDeleted={onDeleted} />
          {dischargeSession && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 font-medium">
              ✓ Alta otorgada el {format(new Date(dischargeSession.session_date + "T12:00:00"), "dd/MM/yyyy")} — Objetivos de tratamiento cumplidos
            </div>
          )}
        </>
      )}
    </div>
  );
}
