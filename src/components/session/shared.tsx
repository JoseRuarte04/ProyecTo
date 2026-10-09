import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, RotateCcw } from "lucide-react";

export const inputClass = "rounded-md h-10 text-sm";
export const textareaClass = "rounded-lg";

export function numFieldErr(v: string, min: number, max: number, unit: string): string | null {
  if (!v.trim()) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return "Solo se admiten números";
  if (n < min || n > max) return `Debe estar entre ${min} y ${max}${unit ? " " + unit : ""}`;
  return null;
}

export function SectionCard({
  id,
  icon: Icon,
  title,
  action,
  children,
  toggle,
}: {
  id?: string;
  icon: any;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  toggle?: { checked: boolean; onChange: (v: boolean) => void; label?: string };
}) {
  const isOff = toggle && !toggle.checked;
  return (
    <Card id={id} className="rounded-xl border-border bg-card mb-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-muted">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-serif text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {action}
          {toggle && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{toggle.label || (toggle.checked ? "Incluido" : "Incluir")}</span>
              <Switch checked={toggle.checked} onCheckedChange={toggle.onChange} />
            </div>
          )}
        </div>
      </div>
      {!isOff && <CardContent className="p-5">{children}</CardContent>}
    </Card>
  );
}

export function SubSection({
  title,
  children,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-gray-200 bg-white">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="field-label">{title}</h3>
          {badge}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs mb-1.5 block">
      {children}
    </Label>
  );
}

export type CarryOverMode = "choice" | "maintain" | "update";

export interface CarryOverState {
  mode: CarryOverMode;
  previousDateLabel: string;
  onChooseMaintain: () => void;
  onChooseUpdate: () => void;
  onSwitchToUpdate: () => void;
}

export function CarryOverChoice({
  previousDateLabel,
  onChooseMaintain,
  onChooseUpdate,
}: Pick<CarryOverState, "previousDateLabel" | "onChooseMaintain" | "onChooseUpdate">) {
  return (
    <div className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">
        Última vez registrada: <span className="font-medium text-foreground">{previousDateLabel}</span>.
        ¿Actualizamos los datos o continuamos con los mismos?
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onChooseUpdate}>Actualizar</Button>
        <Button type="button" variant="secondary" onClick={onChooseMaintain}>Continuar</Button>
      </div>
    </div>
  );
}

export function CarryOverSummary({
  previousDateLabel,
  onSwitchToUpdate,
}: Pick<CarryOverState, "previousDateLabel" | "onSwitchToUpdate">) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <p className="text-sm text-muted-foreground">
        Se continúa con los datos de la sesión del <span className="font-medium text-foreground">{previousDateLabel}</span>.
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={onSwitchToUpdate} className="gap-1.5 text-xs">
        <RotateCcw className="h-3 w-3" /> Actualizar
      </Button>
    </div>
  );
}
