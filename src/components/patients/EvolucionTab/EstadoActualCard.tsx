import { TrendingDown, TrendingUp, Minus, AlertTriangle, Activity, Dumbbell, Calendar, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvaData, EdemaData, ForceData } from "@/hooks/usePatientDashboard";

// ── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 space-y-2", className)}>
      {children}
    </div>
  );
}

function MetricLabel({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function EmptyValue({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="text-2xl font-light">—</span>
      <span className="text-xs leading-tight">{message}</span>
    </div>
  );
}

// ── EVA ─────────────────────────────────────────────────────────────────────

function EvaSegments({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5 mt-1">
      {Array.from({ length: 10 }, (_, i) => {
        const filled = i < value;
        const color = i < 3 ? "bg-emerald-400" : i < 6 ? "bg-amber-400" : "bg-red-400";
        return (
          <div
            key={i}
            className={cn("h-2 flex-1 rounded-sm transition-colors", filled ? color : "bg-muted")}
          />
        );
      })}
    </div>
  );
}

function EvaTrend({ trend, previous }: { trend: EvaData["trend"]; previous: number | null }) {
  if (!trend || previous == null) return null;
  const config = {
    mejora:  { Icon: TrendingDown, color: "text-emerald-600", label: "vs. sesión anterior" },
    empeora: { Icon: TrendingUp,   color: "text-red-600",     label: "vs. sesión anterior" },
    estable: { Icon: Minus,        color: "text-muted-foreground", label: "sin cambio" },
  }[trend];
  const { Icon, color, label } = config;
  return (
    <div className={cn("flex items-center gap-1 text-xs", color)}>
      <Icon className="h-3.5 w-3.5" />
      <span>{previous}/10 {label}</span>
    </div>
  );
}

function EvaCard({ eva }: { eva: EvaData }) {
  const { current, previous, trend } = eva;

  const evaColor =
    current == null ? "text-foreground"
    : current <= 3 ? "text-emerald-600"
    : current <= 6 ? "text-amber-600"
    : "text-red-600";

  return (
    <MetricCard>
      <MetricLabel icon={Activity} label="Dolor (EVA)" />
      {current == null ? (
        <EmptyValue message="Sin registro" />
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-3xl font-bold tabular-nums", evaColor)}>{current}</span>
            <span className="text-sm text-muted-foreground">/10</span>
          </div>
          <EvaSegments value={current} />
          <EvaTrend trend={trend} previous={previous} />
        </>
      )}
    </MetricCard>
  );
}

// ── Edema ───────────────────────────────────────────────────────────────────

function EdemaCard({ edema }: { edema: EdemaData }) {
  const { maxDelta, hasAlert, format } = edema;

  return (
    <MetricCard>
      <MetricLabel icon={Activity} label="Edema Δ bilateral" />
      {format === "no_data" && <EmptyValue message="Sin registro" />}
      {format === "incompatible" && (
        <div className="flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-xs text-muted-foreground leading-snug">
            Formato legacy — no comparable.<br />Usá circometría bilateral en nuevas sesiones.
          </span>
        </div>
      )}
      {format === "calculable" && (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-3xl font-bold tabular-nums", hasAlert ? "text-red-600" : "text-emerald-600")}>
              {maxDelta != null ? maxDelta.toFixed(1) : "—"}
            </span>
            <span className="text-sm text-muted-foreground">mm</span>
          </div>
          {hasAlert ? (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>≥ 5 mm — diferencia significativa</span>
            </div>
          ) : (
            <span className="text-xs text-emerald-600">Dentro del rango normal</span>
          )}
        </>
      )}
    </MetricCard>
  );
}

// ── Fuerza ───────────────────────────────────────────────────────────────────

function ForceBar({ percent }: { percent: number }) {
  const color =
    percent >= 80 ? "bg-emerald-500"
    : percent >= 50 ? "bg-amber-500"
    : percent >= 25 ? "bg-orange-500"
    : "bg-red-500";

  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden mt-1">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function ForceCard({ force }: { force: ForceData }) {
  const { percent, affectedSide, affectedAvg, sanaAvg, hasAlert50, hasAlert25 } = force;

  const percentColor =
    percent == null ? "text-foreground"
    : percent >= 80 ? "text-emerald-600"
    : percent >= 50 ? "text-amber-600"
    : percent >= 25 ? "text-orange-600"
    : "text-red-600";

  const noSide = affectedSide == null || affectedSide === "both";

  return (
    <MetricCard>
      <MetricLabel icon={Dumbbell} label="Fuerza bilateral" />
      {noSide ? (
        <EmptyValue message="Configurá el lado afectado en el episodio" />
      ) : percent == null && affectedAvg == null ? (
        <EmptyValue message="Sin datos de dinamometría" />
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-3xl font-bold tabular-nums", percentColor)}>
              {percent != null ? `${percent}%` : "—"}
            </span>
          </div>
          {percent != null && <ForceBar percent={percent} />}
          <div className="text-xs text-muted-foreground">
            {affectedSide} afectado:{" "}
            <span className="font-medium text-foreground">
              {affectedAvg != null ? `${affectedAvg} kgf` : "—"}
            </span>
            {" "}/ sano:{" "}
            <span className="font-medium text-foreground">
              {sanaAvg != null ? `${sanaAvg} kgf` : "—"}
            </span>
          </div>
          {hasAlert25 && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{"< 25% — restricción laboral significativa"}</span>
            </div>
          )}
          {!hasAlert25 && hasAlert50 && (
            <div className="flex items-center gap-1.5 text-xs text-orange-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{"< 50% — alerta funcional"}</span>
            </div>
          )}
        </>
      )}
    </MetricCard>
  );
}

// ── Sesiones ─────────────────────────────────────────────────────────────────

function SessionCountCard({ count }: { count: number }) {
  return (
    <MetricCard>
      <MetricLabel icon={Calendar} label="Sesiones" />
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-foreground">{count}</span>
        <span className="text-sm text-muted-foreground">completadas</span>
      </div>
      {count === 0 && (
        <span className="text-xs text-muted-foreground">Sin sesiones registradas aún</span>
      )}
    </MetricCard>
  );
}

// ── Exported component ────────────────────────────────────────────────────────

interface EstadoActualCardProps {
  eva: EvaData;
  edema: EdemaData;
  force: ForceData;
  sessionCount: number;
}

export function EstadoActualCard({ eva, edema, force, sessionCount }: EstadoActualCardProps) {
  return (
    <div className="space-y-3">
      <h2 className="font-serif text-base font-semibold text-foreground">Estado actual</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <EvaCard eva={eva} />
        <EdemaCard edema={edema} />
        <ForceCard force={force} />
        <SessionCountCard count={sessionCount} />
      </div>
    </div>
  );
}
