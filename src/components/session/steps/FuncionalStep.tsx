import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FimSection, BarthelSection, calcFimTotal, calcBarthelTotal } from "@/components/evaluations/FunctionalScales";
import { OccupationsChecklist } from "@/components/evaluations/OccupationsChecklist";
import { PerformanceContextSections } from "@/components/evaluations/PerformanceContextSections";
import type { PerformanceContextValues } from "@/components/evaluations/performanceContextTypes";
import type { IndependenceLevel } from "@/components/evaluations/occupationsTaxonomy";
import type { EvaluationKey } from "@/lib/evaluationSettings";
import { SectionCard } from "../shared";

interface FuncionalStepProps {
  occupations_items: Record<string, IndependenceLevel>;
  setOccupationsItems: (items: Record<string, IndependenceLevel>) => void;
  occupations_notes: string;
  setOccupationsNotes: (v: string) => void;
  performance_context: PerformanceContextValues;
  setPerformanceContext: <K extends keyof PerformanceContextValues>(field: K, value: PerformanceContextValues[K]) => void;
  fim_items: Record<string, number | null>;
  setFimItems: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
  barthel_items: Record<string, number | null>;
  setBarthelItems: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
  showEval: (key: EvaluationKey) => boolean;
}

export function FuncionalStep({
  occupations_items, setOccupationsItems,
  occupations_notes, setOccupationsNotes,
  performance_context, setPerformanceContext,
  fim_items, setFimItems,
  barthel_items, setBarthelItems,
  showEval,
}: FuncionalStepProps) {
  const fimScore = calcFimTotal(fim_items);
  const barthelScore = calcBarthelTotal(barthel_items);
  const nothingEnabled = !showEval("barthel") && !showEval("fim") && !showEval("occupations") && !showEval("performance_context");

  return (
    <SectionCard
      id="sec-funcional"
      icon={ClipboardList}
      title="Evaluación funcional"
      action={
        <div className="flex gap-1">
          {fimScore !== null && <Badge variant="secondary" className="text-[10px]">FIM {fimScore}/126</Badge>}
          {barthelScore !== null && <Badge variant="secondary" className="text-[10px]">Barthel {barthelScore}/100</Badge>}
        </div>
      }
    >
      <div className="space-y-5">
        {nothingEnabled && (
          <p className="text-sm text-muted-foreground">
            No hay evaluaciones habilitadas para este paso — configuralas en "Evaluaciones" desde el sidebar.
          </p>
        )}
        {showEval("barthel") && <BarthelSection items={barthel_items} onChange={setBarthelItems} />}
        {showEval("fim") && <FimSection items={fim_items} onChange={setFimItems} />}

        {showEval("occupations") && (
          <div className="pt-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">1. Ocupaciones</p>
            <OccupationsChecklist
              items={occupations_items}
              onChange={setOccupationsItems}
              notes={occupations_notes}
              onNotesChange={setOccupationsNotes}
            />
          </div>
        )}

        {showEval("performance_context") && (
          <PerformanceContextSections values={performance_context} onChange={setPerformanceContext} />
        )}
      </div>
    </SectionCard>
  );
}
