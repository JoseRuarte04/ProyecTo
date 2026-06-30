import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

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
  checked,
  onChange,
  children,
  withDivider = true,
  badge,
}: {
  title: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  withDivider?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className={`space-y-3 ${withDivider ? "pt-5 mt-5 border-t border-border" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="field-label">{title}</h3>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Mostrar en evaluación</span>
          <Switch checked={checked} onCheckedChange={onChange} />
        </div>
      </div>
      {checked && <div className="space-y-3">{children}</div>}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs mb-1.5 block">
      {children}
    </Label>
  );
}
