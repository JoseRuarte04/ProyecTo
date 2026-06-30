import { ClipboardList } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FimSection, BarthelSection, calcFimTotal, calcBarthelTotal } from "@/components/evaluations/FunctionalScales";
import { SectionCard } from "../shared";

interface FuncionalStepProps {
  func_avd: string; setFuncAvd: (v: string) => void;
  func_aivd: string; setFuncAivd: (v: string) => void;
  fim_items: Record<string, number | null>;
  setFimItems: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
  barthel_items: Record<string, number | null>;
  setBarthelItems: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
}

export function FuncionalStep({
  func_avd, setFuncAvd,
  func_aivd, setFuncAivd,
  fim_items, setFimItems,
  barthel_items, setBarthelItems,
}: FuncionalStepProps) {
  const fimScore = calcFimTotal(fim_items);
  const barthelScore = calcBarthelTotal(barthel_items);

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
        <div className="space-y-2">
          <Label>AVD — Actividades de la vida diaria</Label>
          <Textarea rows={3} value={func_avd} onChange={(e) => setFuncAvd(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>AIVD — Actividades instrumentales</Label>
          <Textarea rows={3} value={func_aivd} onChange={(e) => setFuncAivd(e.target.value)} />
        </div>
        <BarthelSection items={barthel_items} onChange={setBarthelItems} />
        <FimSection items={fim_items} onChange={setFimItems} />
      </div>
    </SectionCard>
  );
}
