import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { FuncEvalList } from "@/components/patients/FuncEvalList";
import { AnalEvalList } from "@/components/evaluations/AnalyticalEvalForm";

interface Props {
  funcEvals: any[];
  analEvals: any[];
  patientId: string;
  onNewFuncEval: () => void;
}

export function EvaluacionesTab({ funcEvals, analEvals, patientId, onNewFuncEval }: Props) {
  const [subTab, setSubTab] = useState("functional");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex">
          {[
            { value: "functional", label: "Funcional" },
            { value: "analytical", label: "Analítica" },
          ].map(t => (
            <button
              key={t.value}
              onClick={() => setSubTab(t.value)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                subTab === t.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {subTab === "functional" && (
          <Button onClick={onNewFuncEval} size="sm" className="mb-1">
            <Plus className="h-4 w-4 mr-1" />Nueva evaluación
          </Button>
        )}
      </div>

      {subTab === "functional" && (
        funcEvals.length === 0
          ? <p className="text-muted-foreground text-sm text-center py-8">Sin evaluaciones funcionales.</p>
          : <FuncEvalList evaluations={funcEvals} patientId={patientId} />
      )}

      {subTab === "analytical" && (
        <>
          <AnalEvalList evaluations={analEvals} patientId={patientId} />
          {analEvals.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Las evaluaciones analíticas se registran desde Sesiones.</p>
          )}
        </>
      )}
    </div>
  );
}
