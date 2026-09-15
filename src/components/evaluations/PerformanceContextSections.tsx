import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown } from "lucide-react";
import type { PerformanceContextValues } from "./performanceContextTypes";

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ApartadoSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-gray-200 bg-white">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function PerformanceContextSections({
  values,
  onChange,
}: {
  values: PerformanceContextValues;
  onChange: <K extends keyof PerformanceContextValues>(field: K, value: PerformanceContextValues[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <ApartadoSection title="Contextos">
        <TextField label="Factores ambientales" value={values.context_environmental_factors} onChange={(v) => onChange("context_environmental_factors", v)} />
        <TextField label="Factores personales" value={values.context_personal_factors} onChange={(v) => onChange("context_personal_factors", v)} />
      </ApartadoSection>

      <ApartadoSection title="Patrones de desempeño">
        <TextField label="Hábitos" value={values.performance_pattern_habits} onChange={(v) => onChange("performance_pattern_habits", v)} />
        <TextField label="Rutinas" value={values.performance_pattern_routines} onChange={(v) => onChange("performance_pattern_routines", v)} />
        <TextField label="Roles" value={values.performance_pattern_roles} onChange={(v) => onChange("performance_pattern_roles", v)} />
        <TextField label="Rituales" value={values.performance_pattern_rituals} onChange={(v) => onChange("performance_pattern_rituals", v)} />
      </ApartadoSection>

      <ApartadoSection title="Habilidades de desempeño">
        <TextField label="Habilidades motoras" value={values.performance_skill_motor} onChange={(v) => onChange("performance_skill_motor", v)} />
        <TextField label="Habilidades de procesamiento" value={values.performance_skill_processing} onChange={(v) => onChange("performance_skill_processing", v)} />
        <TextField label="Habilidades de interacción social" value={values.performance_skill_social_interaction} onChange={(v) => onChange("performance_skill_social_interaction", v)} />
      </ApartadoSection>

      <ApartadoSection title="Factores del cliente">
        <TextField label="Valores, creencias y espiritualidad" value={values.client_factor_values_beliefs_spirituality} onChange={(v) => onChange("client_factor_values_beliefs_spirituality", v)} />
        <TextField label="Funciones corporales" value={values.client_factor_body_functions} onChange={(v) => onChange("client_factor_body_functions", v)} />
        <TextField label="Estructuras corporales" value={values.client_factor_body_structures} onChange={(v) => onChange("client_factor_body_structures", v)} />
      </ApartadoSection>
    </div>
  );
}
