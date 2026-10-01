import { Badge } from "@/components/ui/badge";

// Fuente única de verdad para estados y tipos de turno/sesión.
// Antes había 3 sistemas de color duplicados entre Dashboard y Turnos.

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  active:     { label: "Activo",     badgeClass: "status-active",     dotClass: "bg-emerald-500" },
  paused:     { label: "Pausado",    badgeClass: "status-paused",     dotClass: "bg-amber-400" },
  discharged: { label: "Alta",       badgeClass: "status-discharged", dotClass: "bg-slate-400" },
  abandoned:  { label: "Abandonó",   badgeClass: "status-cancelled",  dotClass: "bg-red-400" },
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

// ── Estados de turno ──
// Cada estado tiene su color en todas las vistas (badge, punto, bloque del
// calendario y barra del panel). Los colores son los que pidió el equipo:
// rojo = ausente, naranja = ausente con aviso, amarillo = sala de espera,
// verde = atendido. "Cancelado" queda en gris para no confundirse con ausente.

export type AppointmentStatus =
  | "scheduled" | "waiting" | "completed" | "absent" | "absent_with_notice" | "cancelled";

type AppointmentStatusStyle = {
  label: string;
  badge: string;
  dot: string;
  block: string;
  header: string;
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, AppointmentStatusStyle> = {
  scheduled: {
    label: "Programado",
    badge: "border-sky-300 bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
    block: "bg-sky-100 border-sky-500 text-sky-900 hover:bg-sky-200",
    header: "bg-sky-500",
  },
  waiting: {
    label: "En sala de espera",
    badge: "border-yellow-400 bg-yellow-50 text-yellow-800",
    dot: "bg-yellow-400",
    block: "bg-yellow-100 border-yellow-500 text-yellow-900 hover:bg-yellow-200",
    header: "bg-yellow-400",
  },
  completed: {
    label: "Atendido",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    block: "bg-emerald-100 border-emerald-500 text-emerald-900 hover:bg-emerald-200",
    header: "bg-emerald-500",
  },
  absent: {
    label: "Ausente",
    badge: "border-red-300 bg-red-50 text-red-700",
    dot: "bg-red-500",
    block: "bg-red-100 border-red-500 text-red-900 hover:bg-red-200",
    header: "bg-red-500",
  },
  absent_with_notice: {
    label: "Ausente con aviso",
    badge: "border-orange-300 bg-orange-50 text-orange-700",
    dot: "bg-orange-500",
    block: "bg-orange-100 border-orange-500 text-orange-900 hover:bg-orange-200",
    header: "bg-orange-500",
  },
  cancelled: {
    label: "Cancelado",
    badge: "border-slate-300 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
    block: "bg-slate-100 border-slate-400 text-slate-600 line-through opacity-70",
    header: "bg-slate-400",
  },
};

// Estados que el profesional puede elegir desde el selector (orden del flujo del día).
export const APPOINTMENT_STATUS_OPTIONS: AppointmentStatus[] = [
  "scheduled", "waiting", "completed", "absent", "absent_with_notice",
];

// Los que todavía ocupan el horario en la agenda.
export const OCCUPYING_STATUSES: AppointmentStatus[] = ["scheduled", "waiting"];

export function appointmentStatusStyle(status: string): AppointmentStatusStyle {
  return APPOINTMENT_STATUS[status as AppointmentStatus] ?? APPOINTMENT_STATUS.scheduled;
}

export function AppointmentStatusBadge({ status }: { status: string }) {
  const s = appointmentStatusStyle(status);
  return (
    <Badge variant="outline" className={`${s.badge} text-xs font-medium px-2.5 py-0.5 rounded-full`}>
      {s.label}
    </Badge>
  );
}

export function AppointmentStatusDot({ status }: { status: string }) {
  const s = appointmentStatusStyle(status);
  return <span className={`inline-block w-2 h-2 rounded-full ${s.dot} shrink-0`} title={s.label} />;
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
