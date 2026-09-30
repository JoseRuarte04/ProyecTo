import { usePatientDashboard } from "@/hooks/usePatientDashboard";
import { EstadoActualCard } from "./EstadoActualCard";
import { GraficosEvolucion } from "./GraficosEvolucion";
import { UltimaSesionResumen } from "./UltimaSesionResumen";
import { AlertasClinicas } from "./AlertasClinicas";

interface EvolucionTabProps {
  analEvals: any[];
  funcEvals: any[];
  sessions: any[];
  episode: any | null;
  patientId: string;
}

export function EvolucionTab({ analEvals, funcEvals, sessions, episode, patientId }: EvolucionTabProps) {
  const {
    eva, edema, force, arom, quickdash,
    alerts, lastSession, sessionCount,
    aromSelector, setAromSelector,
  } = usePatientDashboard(analEvals, funcEvals, sessions, episode);

  return (
    <div className="space-y-6">
      <EstadoActualCard eva={eva} edema={edema} force={force} sessionCount={sessionCount} />
      <GraficosEvolucion
        eva={eva}
        arom={arom}
        force={force}
        quickdash={quickdash}
        aromSelector={aromSelector}
        setAromSelector={setAromSelector}
      />
      <UltimaSesionResumen lastSession={lastSession} patientId={patientId} />
      <AlertasClinicas alerts={alerts} edema={edema} force={force} />
    </div>
  );
}
