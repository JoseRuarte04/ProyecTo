import { AlertTriangle, CheckCircle2, TrendingUp, Droplets, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardAlerts, EdemaData, ForceData } from "@/hooks/usePatientDashboard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AlertasClinicasProps {
  alerts: DashboardAlerts;
  edema: EdemaData;
  force: ForceData;
}

// ── Alert item ────────────────────────────────────────────────────────────────

interface AlertItemProps {
  severity: "red" | "yellow";
  icon: React.ReactNode;
  title: string;
  description: string;
}

function AlertItem({ severity, icon, title, description }: AlertItemProps) {
  const colors = {
    red:    "border-red-200    bg-red-50    text-red-700",
    yellow: "border-amber-200  bg-amber-50  text-amber-700",
  }[severity];

  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5", colors)}>
      <span className="mt-0.5 shrink-0 h-4 w-4">{icon}</span>
      <div className="space-y-0.5">
        <p className="text-xs font-semibold">{title}</p>
        <p className="text-xs leading-snug opacity-80">{description}</p>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AlertasClinicas({ alerts, edema, force }: AlertasClinicasProps) {
  const activeAlerts: AlertItemProps[] = [];

  if (alerts.evaHigh) {
    activeAlerts.push({
      severity: "red",
      icon: <AlertTriangle className="h-4 w-4" />,
      title: "Dolor elevado (EVA ≥ 7)",
      description: "Nivel de dolor crítico. Revisar causa antes de continuar con el plan.",
    });
  }

  if (alerts.evaPlateau && !alerts.evaHigh) {
    activeAlerts.push({
      severity: "yellow",
      icon: <TrendingUp className="h-4 w-4" />,
      title: "EVA sin descenso en 3 sesiones",
      description: "El dolor no mejoró en las últimas 3 evaluaciones consecutivas. Revisar plan de tratamiento.",
    });
  }

  if (alerts.edema) {
    activeAlerts.push({
      severity: "yellow",
      icon: <Droplets className="h-4 w-4" />,
      title: `Edema bilateral significativo (Δ ${edema.maxDelta?.toFixed(1)} mm)`,
      description: "Diferencia entre MSD y MSI ≥ 5 mm. Considerar técnicas de drenaje linfático.",
    });
  }

  if (alerts.force25) {
    activeAlerts.push({
      severity: "red",
      icon: <Dumbbell className="h-4 w-4" />,
      title: `Fuerza muy reducida (${force.percent}% bilateral)`,
      description: "Menos del 25% respecto al lado sano. Restricción laboral significativa.",
    });
  } else if (alerts.force50) {
    activeAlerts.push({
      severity: "yellow",
      icon: <Dumbbell className="h-4 w-4" />,
      title: `Fuerza reducida (${force.percent}% bilateral)`,
      description: "Menos del 50% respecto al lado sano. Alerta funcional — evaluar adaptaciones.",
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="font-serif text-base font-semibold text-foreground">Alertas clínicas</h2>
      {activeAlerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm text-emerald-700">Sin alertas activas — evolución dentro de parámetros.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {activeAlerts.map((a, i) => (
            <AlertItem key={i} {...a} />
          ))}
        </div>
      )}
    </div>
  );
}
