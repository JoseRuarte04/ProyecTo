import { Badge } from "@/components/ui/badge";

// Fuente única de verdad para estados y tipos de turno/sesión.
// Antes había 3 sistemas de color duplicados entre Dashboard y Turnos.

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  active:     { label: "Activo",     badgeClass: "status-active",     dotClass: "bg-emerald-500" },
  paused:     { label: "Pausado",    badgeClass: "status-paused",     dotClass: "bg-amber-400" },
  discharged: { label: "Alta",       badgeClass: "status-discharged", dotClass: "bg-slate-400" },
  scheduled:  { label: "Pendiente",  badgeClass: "status-scheduled",  dotClass: "bg-blue-400" },
  completed:  { label: "Completado", badgeClass: "status-completed",  dotClass: "bg-slate-400" },
  cancelled:  { label: "Cancelado",  badgeClass: "status-cancelled",  dotClass: "bg-red-400" },
  no_show:    { label: "No asistió", badgeClass: "status-cancelled",  dotClass: "bg-red-400" },
  confirmed:  { label: "Confirmado", badgeClass: "status-completed",  dotClass: "bg-emerald-500" },
  pending:    { label: "Pendiente",  badgeClass: "status-paused",     dotClass: "bg-amber-400" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || { label: status, badgeClass: "" };
  return (
    <Badge variant="outline" className={`${s.badgeClass} text-xs font-medium px-2.5 py-0.5 rounded-full`}>
      {s.label}
    </Badge>
  );
}

export function StatusDot({ status }: { status: string }) {
  const s = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${s?.dotClass || "bg-slate-300"} shrink-0`}
      title={s?.label || status}
    />
  );
}

// ── Tipos de turno ──

export const APPOINTMENT_TYPE_LABEL: Record<string, string> = {
  consultation: "Consulta",
  follow_up:    "Seguimiento",
  evaluation:   "Evaluación",
  admission:    "Admisión",
  discharge:    "Alta",
};

// Franja de color por tipo de turno (barra vertical a la izquierda de cada fila)
export const APPOINTMENT_TYPE_STRIPE: Record<string, string> = {
  admission:    "bg-[hsl(192,35%,42%)]",
  follow_up:    "bg-[hsl(210,65%,55%)]",
  evaluation:   "bg-[hsl(38,90%,52%)]",
  discharge:    "bg-[hsl(152,50%,45%)]",
  consultation: "bg-[hsl(0,0%,65%)]",
};

// ── Tipos de sesión ──

export const SESSION_TYPE_LABEL: Record<string, string> = {
  admission: "Admisión",
  follow_up: "Seguimiento",
  discharge: "Alta",
};
