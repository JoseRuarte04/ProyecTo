import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useAppointments, useUpdateAppointmentStatus, useCancelAppointment, APPOINTMENTS_KEY, type AppointmentWithPatient, type FilterStatus } from "@/hooks/useAppointments";
import type { Tables } from "@/integrations/supabase/types";
import { APPOINTMENT_TYPE_STRIPE, OCCUPYING_STATUSES, appointmentStatusStyle } from "@/components/status";
import { AppointmentStatusSelect } from "@/components/AppointmentStatusSelect";
import { PageHeader } from "@/components/PageHeader";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { AlertTriangle, Plus, Loader2, Search, CheckCircle, XCircle, Clock, List, Calendar, CalendarDays, ChevronLeft, ChevronRight, Zap, X, FileText, User, MessageCircle, Video, Copy, MapPin, BellRing } from "lucide-react";
import { RemindersPanel } from "@/components/reminders/RemindersPanel";
import { whatsappUrl, buildReminderMessage } from "@/lib/whatsapp";
import { createVideoRoom } from "@/lib/videoRoom";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, subWeeks, addMonths, subMonths, isSameDay, isSameMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useDirtyDeps } from "@/hooks/useDirtyDeps";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { usePatientPriorities } from "@/hooks/usePatientPriorities";
import { PRIORITY_META } from "@/lib/priority";
import { PriorityDot } from "@/components/PriorityDot";
import { useAppointmentSettings } from "@/hooks/useAppointmentSettings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { documentTypeShortLabel } from "@/components/patients/documentTypes";

type ViewMode = "list" | "week" | "month";

const TYPE_MAP: Record<string, string> = {
  consultation: "Consulta",
  follow_up:    "Seguimiento",
  evaluation:   "Evaluación",
  admission:    "Admisión",
  discharge:    "Alta",
};

const TYPE_CHIP: Record<string, string> = {
  consultation: "bg-gray-100 text-gray-700",
  follow_up:    "bg-blue-100 text-blue-700",
  evaluation:   "bg-amber-100 text-amber-700",
  admission:    "bg-teal-100 text-teal-700",
  discharge:    "bg-emerald-100 text-emerald-700",
};

// Barra de 4px en lista (por tipo)
const TYPE_BAR = APPOINTMENT_TYPE_STRIPE;

const CANCELLATION_REASONS = [
  { value: "patient_cancelled",      label: "Canceló el paciente" },
  { value: "professional_cancelled", label: "Canceló el profesional" },
  { value: "rescheduled",            label: "Reprogramado" },
  { value: "other",                  label: "Otro" },
];

const HOUR_START = 7;
const HOUR_END = 21;
const DEFAULT_SESSION_MINUTES = 45;

/** Suma minutos a un "HH:mm" sin pasar de las 23:59 (no cruza de día). */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** true si ambos horarios están completos y el fin no es posterior al inicio. */
function isEndNotAfterStart(start: string, end: string): boolean {
  return !!start && !!end && end <= start; // "HH:mm" compara bien como string
}
const SLOT_H = 56; // px por hora

// Paciente resumido que devuelve la búsqueda del dialog de turno nuevo
type PatientLite = Pick<Tables<"patients">, "id" | "first_name" | "last_name" | "dni" | "document_type">;
// Turnos del día en el dialog (join sin phone)
type DayAppointment = Tables<"appointments"> & {
  patients: Pick<Tables<"patients">, "first_name" | "last_name"> | null;
};

type StatusValue = Database["public"]["Enums"]["appointment_status"];

// Los turnos que todavía se pueden operar (confirmar llegada, atender, cancelar, reprogramar).
const isOpen = (status: string) => (OCCUPYING_STATUSES as string[]).includes(status);

type LaidOutAppointment = { appt: AppointmentWithPatient; lane: number; lanes: number };

// Asigna a cada turno del día una "lane" (columna) y el total de lanes de su
// grupo de solapamiento, para que los sobreturnos se dibujen lado a lado en
// la grilla en vez de tapar al turno con el que chocan.
function layoutDayAppointments(dayAppts: AppointmentWithPatient[]): LaidOutAppointment[] {
  const toMin = (iso: string) => {
    const d = parseISO(iso);
    return d.getHours() * 60 + d.getMinutes();
  };
  const items = dayAppts
    .map(appt => {
      const startMin = toMin(appt.appointment_date);
      const endMin = appt.appointment_end ? toMin(appt.appointment_end) : startMin + 30;
      return { appt, startMin, endMin, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  let active: { endMin: number; lane: number }[] = [];
  let cluster: typeof items = [];
  let clusterMaxActive = 0;

  const flushCluster = () => {
    const lanes = Math.max(clusterMaxActive, 1);
    for (const item of cluster) item.lanes = lanes;
    cluster = [];
    clusterMaxActive = 0;
  };

  for (const item of items) {
    active = active.filter(a => a.endMin > item.startMin);
    if (active.length === 0 && cluster.length > 0) flushCluster();

    const usedLanes = new Set(active.map(a => a.lane));
    let lane = 0;
    while (usedLanes.has(lane)) lane++;

    item.lane = lane;
    active.push({ endMin: item.endMin, lane });
    cluster.push(item);
    clusterMaxActive = Math.max(clusterMaxActive, active.length);
  }
  flushCluster();

  return items.map(({ appt, lane, lanes }) => ({ appt, lane, lanes }));
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════ */

export default function Appointments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>("all");
  // La vista "Semana" (grilla de 7 columnas) es ilegible en mobile — arrancar
  // en "Lista" ahí. Solo el valor inicial: no pisa un toggle manual del
  // usuario si el viewport cambia después (ej. rotar el celular).
  const [view, setView] = useState<ViewMode>(() => (window.innerWidth < 768 ? "list" : "week"));
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));
  const [showNew, setShowNew] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState("");
  const [prefilledTime, setPrefilledTime] = useState("");
  const [rescheduleAppt, setRescheduleAppt] = useState<AppointmentWithPatient | null>(null);

  // Detail panel
  const [selectedAppt, setSelectedAppt] = useState<AppointmentWithPatient | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancelWholeSeries, setCancelWholeSeries] = useState(false);
  const [cancellingSeries, setCancellingSeries] = useState(false);

  // Buscador de paciente — filtra los turnos ya cargados (Lista y Semana), no dispara ninguna query nueva.
  const [patientQuery, setPatientQuery] = useState("");

  // Panel de Recordatorios — se abre solo con ?reminders=1 (link desde el Dashboard).
  const [searchParams] = useSearchParams();
  const [remindersOpen, setRemindersOpen] = useState(() => searchParams.get("reminders") === "1");

  const { data: appointments = [], isLoading: loading, isError: appointmentsError } = useAppointments(filter);
  const priorities = usePatientPriorities(appointments.map(a => a.patient_id));
  const { mutate: updateStatus, isPending: updatingStatus } = useUpdateAppointmentStatus();
  const changeStatus = (appt: AppointmentWithPatient, status: string) => {
    updateStatus(
      { id: appt.id, status: status as StatusValue },
      { onSuccess: () => setSelectedAppt(cur => (cur?.id === appt.id ? { ...cur, status: status as StatusValue, cancellation_reason: null, cancellation_notes: null } : cur)) }
    );
  };
  const { mutate: cancelAppointment } = useCancelAppointment();

  const refreshAppointments = () =>
    queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });

  const openDetail = (appt: AppointmentWithPatient) => {
    setSelectedAppt(appt);
    setDetailOpen(true);
  };

  const openCancelDialog = (id: string) => {
    setCancelTarget(id);
    setCancelReason("");
    setCancelNotes("");
    setCancelWholeSeries(false);
  };

  const cancelTargetAppt = appointments.find(a => a.id === cancelTarget) ?? null;

  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason) return;
    if (cancelWholeSeries && cancelTargetAppt?.recurrence_id) {
      setCancellingSeries(true);
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled", cancellation_reason: cancelReason, cancellation_notes: cancelNotes || null })
        .eq("recurrence_id", cancelTargetAppt.recurrence_id)
        .in("status", OCCUPYING_STATUSES);
      setCancellingSeries(false);
      if (error) { toast.error("No se pudo cancelar la serie"); return; }
      toast.success("Serie de turnos cancelada");
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setCancelTarget(null); setCancelReason(""); setCancelNotes(""); setCancelWholeSeries(false);
      return;
    }
    cancelAppointment(
      { id: cancelTarget, reason: cancelReason, notes: cancelNotes },
      { onSuccess: () => { setCancelTarget(null); setCancelReason(""); setCancelNotes(""); setCancelWholeSeries(false); } }
    );
  };

  const filterTabs: { label: string; value: FilterStatus }[] = [
    { label: "Todos", value: "all" },
    { label: "Pendientes", value: "pending" },
    { label: "Atendidos", value: "completed" },
    { label: "Ausentes", value: "absent" },
    { label: "Cancelados", value: "cancelled" },
  ];

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const matchesPatientQuery = (a: AppointmentWithPatient) => {
    const q = normalize(patientQuery.trim());
    if (!q) return true;
    const name = normalize(`${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`);
    return name.includes(q);
  };
  const visibleAppointments = appointments.filter(matchesPatientQuery);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const apptsByDay = (day: Date) =>
    visibleAppointments.filter(a => isSameDay(parseISO(a.appointment_date), day));

  // Grilla de mes: siempre empieza un lunes y termina un domingo, aunque eso
  // traiga días del mes anterior/siguiente (se dibujan atenuados).
  const monthGridStart = startOfWeek(startOfMonth(monthStart), { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
  const monthDaysCount = Math.round((monthGridEnd.getTime() - monthGridStart.getTime()) / 86400000) + 1;
  const monthDays = Array.from({ length: monthDaysCount }, (_, i) => addDays(monthGridStart, i));
  const goToWeekOf = (day: Date) => {
    setWeekStart(startOfWeek(day, { weekStartsOn: 1 }));
    setView("week");
  };

  const topForTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return ((h - HOUR_START) + m / 60) * SLOT_H;
  };

  const heightForDuration = (start: string, end: string | null) => {
    if (!end) return SLOT_H * 0.75;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max((mins / 60) * SLOT_H, 22);
  };

  // Línea de tiempo actual
  const now = new Date();
  const currentTimeTop = topForTime(format(now, "HH:mm"));
  const isCurrentHourInRange =
    now.getHours() >= HOUR_START && now.getHours() < HOUR_END;

  // Y relativo dentro de la grilla -> hora redondeada a 30 min, o null si cae fuera de 07:00-21:00.
  const roundedTimeFromY = (relY: number): string | null => {
    const totalMins = HOUR_START * 60 + (relY / SLOT_H) * 60;
    const roundedMins = Math.round(totalMins / 30) * 30;
    const h = Math.floor(roundedMins / 60);
    const m = roundedMins % 60;
    if (h < HOUR_START || h >= HOUR_END) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const timeStr = roundedTimeFromY(e.clientY - rect.top);
    if (!timeStr) return;
    setPrefilledDate(format(day, "yyyy-MM-dd"));
    setPrefilledTime(timeStr);
    setShowNew(true);
  };

  // Reprogramar arrastrando un turno a otro horario/día en la vista Semana.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ id: string; start: Date; end: Date; conflictWith: string } | null>(null);
  const timeToMinOfDay = (iso: string) => { const d = parseISO(iso); return d.getHours() * 60 + d.getMinutes(); };

  const handleDayDrop = (e: React.DragEvent<HTMLDivElement>, day: Date) => {
    e.preventDefault();
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;
    const dragged = appointments.find(a => a.id === id);
    if (!dragged) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const timeStr = roundedTimeFromY(e.clientY - rect.top);
    if (!timeStr) return;

    const durationMin = dragged.appointment_end
      ? timeToMinOfDay(dragged.appointment_end) - timeToMinOfDay(dragged.appointment_date)
      : 30;
    const [h, m] = timeStr.split(":").map(Number);
    const newStartMin = h * 60 + m;
    const newEndMin = newStartMin + durationMin;

    const conflict = appointments.find(a =>
      a.id !== id &&
      isSameDay(parseISO(a.appointment_date), day) &&
      isOpen(a.status) &&
      (() => {
        const aStart = timeToMinOfDay(a.appointment_date);
        const aEnd = a.appointment_end ? timeToMinOfDay(a.appointment_end) : aStart + 30;
        return newStartMin < aEnd && newEndMin > aStart;
      })()
    );
    const dateStr = format(day, "yyyy-MM-dd");
    const newStart = new Date(`${dateStr}T${timeStr}:00`);
    const newEnd = new Date(newStart.getTime() + durationMin * 60000);
    const move = { id, start: newStart, end: newEnd };
    if (conflict) {
      setPendingDrop({ ...move, conflictWith: `${conflict.patients?.last_name}, ${conflict.patients?.first_name}` });
      return;
    }
    applyDrop(move, false);
  };

  const applyDrop = (move: { id: string; start: Date; end: Date }, isOvertime: boolean) => {
    supabase.from("appointments").update({
      appointment_date: move.start.toISOString(),
      appointment_end: move.end.toISOString(),
      is_overtime: isOvertime,
    }).eq("id", move.id).then(({ error }) => {
      if (error) { toast.error("No se pudo reprogramar el turno"); return; }
      toast.success(isOvertime ? "Turno reprogramado como sobreturno" : "Turno reprogramado");
      refreshAppointments();
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <PageHeader
        className="pb-4 shrink-0"
        title="Turnos"
        actions={
          <>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setView("list")}
                className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
              >
                <List className="h-3.5 w-3.5" /> Lista
              </button>
              <button
                onClick={() => setView("week")}
                className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors border-l border-border", view === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Semana
              </button>
              <button
                onClick={() => setView("month")}
                className={cn("px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors border-l border-border", view === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
              >
                <Calendar className="h-3.5 w-3.5" /> Mes
              </button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRemindersOpen(true)}>
              <BellRing className="h-4 w-4" /> Recordatorios
            </Button>
            <Button onClick={() => { setPrefilledDate(""); setPrefilledTime(""); setShowNew(true); }} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo turno
            </Button>
          </>
        }
      />

      {/* Filter tabs + buscador de paciente */}
      <div className="flex items-center justify-between border-b border-border shrink-0">
        <div className="flex">
          {filterTabs.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                filter === f.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative pr-2 w-44 sm:w-56 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={patientQuery}
            onChange={e => setPatientQuery(e.target.value)}
            placeholder="Buscar paciente…"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="pt-4">
          <ListSkeleton rows={7} withHeader={false} />
        </div>
      ) : appointmentsError ? (
        <p className="text-destructive text-center py-12">No se pudieron cargar los turnos. Recargá la página.</p>
      ) : view === "list" ? (
        /* ── VISTA LISTA ── */
        <div className="flex-1 overflow-y-auto pt-4">
          {visibleAppointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              {patientQuery.trim() ? "Ningún turno coincide con esa búsqueda." : "No hay turnos."}
            </p>
          ) : (
            <TooltipProvider>
              <div className="dashboard-card overflow-hidden">
                {visibleAppointments.map((a, idx) => (
                  <div
                    key={a.id}
                    className={cn(
                      "grid grid-cols-[4px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group cursor-pointer",
                      idx !== visibleAppointments.length - 1 && "border-b border-border/60"
                    )}
                    onClick={() => openDetail(a)}
                  >
                    <div className={cn("w-1 self-stretch rounded-full", TYPE_BAR[a.type] || "bg-muted")} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {priorities[a.patient_id] && <PriorityDot level={priorities[a.patient_id]} />}
                        <p className="font-semibold text-sm text-foreground truncate">
                          {a.patients?.last_name}, {a.patients?.first_name}
                        </p>
                        {a.is_overtime && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-orange-100 text-orange-600 rounded px-1 py-0.5 shrink-0">
                            <Zap className="h-2.5 w-2.5" /> Sobreturno
                          </span>
                        )}
                        {a.modality === "virtual" && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-violet-100 text-violet-600 rounded px-1 py-0.5 shrink-0">
                            <Video className="h-2.5 w-2.5" /> Virtual
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(a.appointment_date), "EEE d MMM, HH:mm", { locale: es })}
                        {a.appointment_end && ` — ${format(parseISO(a.appointment_end), "HH:mm")}`}
                        {" · "}{TYPE_MAP[a.type] || a.type}
                      </p>
                      {a.status === "cancelled" && a.cancellation_notes && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">"{a.cancellation_notes}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <AppointmentStatusSelect status={a.status} onChange={next => changeStatus(a, next)} disabled={updatingStatus} />
                      {isOpen(a.status) && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => changeStatus(a, "completed")}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Marcar atendido</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-red-50"
                                onClick={() => openCancelDialog(a.id)}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancelar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                                onClick={() => setRescheduleAppt(a)}>
                                <Clock className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reprogramar</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
          )}
        </div>
      ) : view === "month" ? (
        /* ── VISTA MES ── */
        <div className="flex-1 flex flex-col overflow-hidden pt-3 min-h-0">
          {/* Navegación de mes */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <button onClick={() => setMonthStart(m => subMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground capitalize">
              {format(monthStart, "MMMM yyyy", { locale: es })}
            </span>
            <button onClick={() => setMonthStart(m => addMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Encabezado de días de la semana */}
          <div className="grid grid-cols-7 shrink-0 border-b border-border">
            {monthDays.slice(0, 7).map(d => (
              <div key={d.toISOString()} className="text-center text-[10px] font-medium text-muted-foreground uppercase tracking-widest py-1.5">
                {format(d, "EEE", { locale: es })}
              </div>
            ))}
          </div>

          {/* Grilla de días */}
          <div className="grid grid-cols-7 flex-1 overflow-y-auto" style={{ gridAutoRows: "minmax(5.5rem, 1fr)" }}>
            {monthDays.map(day => {
              const dayAppts = apptsByDay(day);
              const inMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());
              const visible = dayAppts.slice(0, 3);
              const extra = dayAppts.length - visible.length;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => goToWeekOf(day)}
                  className={cn(
                    "border-b border-r border-border p-1.5 text-left flex flex-col gap-1 hover:bg-muted/40 transition-colors",
                    !inMonth && "bg-muted/20"
                  )}
                >
                  <span className={cn(
                    "text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full shrink-0",
                    isToday ? "bg-sky-500 text-white" : inMonth ? "text-foreground" : "text-muted-foreground/60"
                  )}>
                    {format(day, "d")}
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    {visible.map(a => (
                      <div key={a.id} className={cn(
                        "flex items-center gap-1 text-[10px] rounded px-1 py-0.5 truncate",
                        appointmentStatusStyle(a.status).block
                      )}>
                        <span className="truncate">{a.patients?.last_name}</span>
                      </div>
                    ))}
                    {extra > 0 && (
                      <span className="text-[10px] text-muted-foreground px-1">+{extra} más</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── VISTA SEMANA (Google Calendar style) ── */
        <div className="flex-1 flex flex-col overflow-hidden pt-3 min-h-0">
          {/* Navegación de semana */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <button onClick={() => setWeekStart(w => subWeeks(w, 1))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">
              {format(weekStart, "d 'de' MMMM", { locale: es })} — {format(addDays(weekStart, 6), "d 'de' MMMM yyyy", { locale: es })}
            </span>
            <button onClick={() => setWeekStart(w => addWeeks(w, 1))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Grid principal */}
          <div className="flex flex-1 overflow-hidden rounded-xl border border-border bg-card min-h-0">
            {/* Columna de horas */}
            <div className="w-14 shrink-0 border-r border-border overflow-hidden">
              <div className="h-12 border-b border-border" /> {/* espacio del header */}
              <div className="overflow-hidden">
                {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                  <div key={i} style={{ height: SLOT_H }} className="relative border-b border-border/20">
                    {i > 0 && (
                      <span className="absolute -top-2 right-2 text-[10px] text-muted-foreground tabular-nums select-none">
                        {String(HOUR_START + i).padStart(2, "0")}:00
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Columnas de días */}
            <div className="flex flex-1 overflow-x-auto overflow-y-auto">
              {weekDays.map(day => {
                const dayAppts = layoutDayAppointments(apptsByDay(day));
                const isToday = isSameDay(day, new Date());

                return (
                  <div key={day.toISOString()} className="flex-1 min-w-[110px] flex flex-col border-r border-border last:border-r-0">
                    {/* Header del día */}
                    <div className={cn(
                      "h-12 shrink-0 flex flex-col items-center justify-center gap-0.5 border-b border-border sticky top-0 z-10 bg-card",
                      isToday && "bg-sky-50/60"
                    )}>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                        {format(day, "EEE", { locale: es })}
                      </span>
                      <span className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold leading-none",
                        isToday ? "bg-sky-500 text-white" : "text-foreground"
                      )}>
                        {format(day, "d")}
                      </span>
                    </div>

                    {/* Área de tiempo */}
                    <div
                      className="relative flex-1"
                      style={{ height: (HOUR_END - HOUR_START) * SLOT_H }}
                      onClick={e => handleGridClick(e, day)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleDayDrop(e, day)}
                    >
                      {/* Líneas de hora */}
                      {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                        <div key={i} className="absolute w-full border-b border-border/25"
                          style={{ top: i * SLOT_H }} />
                      ))}
                      {/* Líneas de media hora */}
                      {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                        <div key={`h-${i}`} className="absolute w-full border-b border-border/10 border-dashed"
                          style={{ top: i * SLOT_H + SLOT_H / 2 }} />
                      ))}

                      {/* Indicador de hora actual */}
                      {isToday && isCurrentHourInRange && (
                        <div
                          className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                          style={{ top: currentTimeTop }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5 shadow-sm" />
                          <div className="flex-1 h-px bg-red-500 shadow-sm" />
                        </div>
                      )}

                      {/* Bloques de turnos — lado a lado cuando hay sobreturno (se solapan en el tiempo) */}
                      {dayAppts.map(({ appt: a, lane, lanes }) => {
                        const startStr = format(parseISO(a.appointment_date), "HH:mm");
                        const endStr = a.appointment_end ? format(parseISO(a.appointment_end), "HH:mm") : null;
                        const top = topForTime(startStr);
                        const height = heightForDuration(startStr, endStr);
                        const isSelected = selectedAppt?.id === a.id && detailOpen;

                        return (
                          <div
                            key={a.id}
                            data-appointment-block="true"
                            draggable={isOpen(a.status)}
                            onDragStart={e => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", a.id); setDraggingId(a.id); }}
                            onDragEnd={() => setDraggingId(null)}
                            onClick={e => { e.stopPropagation(); openDetail(a); }}
                            className={cn(
                              "absolute rounded-md border-l-[3px] px-1.5 py-1 overflow-hidden transition-all duration-150 hover:shadow-sm",
                              isOpen(a.status) ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                              appointmentStatusStyle(a.status).block,
                              a.is_overtime && "border border-dashed border-orange-400",
                              isSelected && "ring-2 ring-sky-400 ring-offset-1 z-10",
                              draggingId === a.id && "opacity-40"
                            )}
                            style={{
                              top,
                              height,
                              zIndex: isSelected ? 15 : 5,
                              left: `calc(${(lane / lanes) * 100}% + 2px)`,
                              width: `calc(${100 / lanes}% - 4px)`,
                            }}
                          >
                            <div className="flex items-center gap-0.5 min-w-0">
                              {a.is_overtime && <Zap className="h-2.5 w-2.5 shrink-0 text-orange-500" />}
                              {a.modality === "virtual" && <Video className="h-2.5 w-2.5 shrink-0" />}
                              <p className="text-[11px] font-semibold truncate leading-tight">
                                {a.patients?.last_name}
                              </p>
                            </div>
                            {height > 30 && (
                              <p className="text-[9px] opacity-60 leading-tight mt-0.5">
                                {startStr}{endStr ? `–${endStr}` : ""} · {a.status === "scheduled" ? (TYPE_MAP[a.type] || a.type) : appointmentStatusStyle(a.status).label}
                              </p>
                            )}
                          </div>
                        );
                      })}

                      {/* Hint de clic vacío */}
                      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="w-full h-full bg-sky-50/40" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Panel de detalle lateral (slide-in, sin overlay) */}
      <AppointmentDetailPanel
        appt={selectedAppt}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onStatusChange={(a, status) => changeStatus(a, status)}
        statusPending={updatingStatus}
        onReschedule={a => { setRescheduleAppt(a); setDetailOpen(false); }}
        onCancel={id => { openCancelDialog(id); setDetailOpen(false); }}
        onUpdated={a => { setSelectedAppt(a); refreshAppointments(); }}
      />

      {/* Dialogs */}
      <NewAppointmentDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        userId={user!.id}
        onSaved={refreshAppointments}
        prefilledDate={prefilledDate}
        prefilledTime={prefilledTime}
      />

      <Dialog open={!!cancelTarget} onOpenChange={open => { if (!open) setCancelTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancelar turno</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un motivo" /></SelectTrigger>
                <SelectContent>
                  {CANCELLATION_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observaciones <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                value={cancelNotes}
                onChange={e => setCancelNotes(e.target.value)}
                placeholder="Agregá notas si es necesario..."
                rows={2}
              />
            </div>
            {cancelTargetAppt?.recurrence_id && (
              <div className="flex items-center gap-2">
                <Checkbox id="cancel-series" checked={cancelWholeSeries} onCheckedChange={v => setCancelWholeSeries(!!v)} />
                <Label htmlFor="cancel-series" className="cursor-pointer text-sm">
                  Este turno es parte de una serie — cancelar todas las ocurrencias
                </Label>
              </div>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Volver</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={!cancelReason || cancellingSeries}>
              {cancellingSeries ? <Loader2 className="h-4 w-4 animate-spin" /> : cancelWholeSeries ? "Cancelar toda la serie" : "Cancelar turno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rescheduleAppt && (
        <RescheduleDialog appt={rescheduleAppt} onClose={() => setRescheduleAppt(null)} onSaved={refreshAppointments} />
      )}

      <AlertDialog open={!!pendingDrop} onOpenChange={(v) => { if (!v) setPendingDrop(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" /> ¿Reprogramar como sobreturno?
            </AlertDialogTitle>
            <AlertDialogDescription>
              El nuevo horario se superpone con el turno de <strong>{pendingDrop?.conflictWith}</strong>. Podés reprogramarlo igual como sobreturno.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => { if (pendingDrop) applyDrop(pendingDrop, true); setPendingDrop(null); }}
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" /> Reprogramar como sobreturno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RemindersPanel open={remindersOpen} onOpenChange={setRemindersOpen} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANEL DE DETALLE (slide-in desde la derecha, sin overlay)
═══════════════════════════════════════════════════════════ */

function AppointmentDetailPanel({
  appt, open, onClose, onStatusChange, statusPending, onReschedule, onCancel, onUpdated,
}: {
  appt: AppointmentWithPatient | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (appt: AppointmentWithPatient, status: string) => void;
  statusPending: boolean;
  onReschedule: (appt: AppointmentWithPatient) => void;
  onCancel: (id: string) => void;
  onUpdated: (appt: AppointmentWithPatient) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const { maxAbsences } = useAppointmentSettings();
  const [absenceCount, setAbsenceCount] = useState<number | null>(null);

  // Ausencias del paciente contra el máximo configurado en Ajustes — antes solo se avisaba al agendar un turno nuevo.
  useEffect(() => {
    if (!open || !appt?.patient_id || maxAbsences === null) { setAbsenceCount(null); return; }
    let cancelled = false;
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", appt.patient_id)
      .eq("status", "absent")
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) { console.error("Error contando ausencias:", error); setAbsenceCount(null); return; }
        setAbsenceCount(count ?? 0);
      });
    return () => { cancelled = true; };
  }, [open, appt?.patient_id, maxAbsences]);

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    const url = createVideoRoom();
    const { error } = await supabase.from("appointments").update({ video_link: url }).eq("id", appt.id);
    setGeneratingLink(false);
    if (error) { toast.error("No se pudo guardar el link"); return; }
    toast.success("Link de videollamada generado");
    onUpdated({ ...appt, video_link: url });
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const inPanel = panelRef.current?.contains(target);
      const inBlock = !!target.closest("[data-appointment-block]");
      // El menú de estados se renderiza en un portal, fuera del panel
      const inMenu = !!target.closest("[role='menu']");
      if (!inPanel && !inBlock && !inMenu) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 80);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [open, onClose]);

  if (!appt) return null;

  const startStr = format(parseISO(appt.appointment_date), "HH:mm");
  const endStr = appt.appointment_end ? format(parseISO(appt.appointment_end), "HH:mm") : null;
  const dateStr = format(parseISO(appt.appointment_date), "EEEE d 'de' MMMM, yyyy", { locale: es });
  const cancelLabel = CANCELLATION_REASONS.find(r => r.value === appt.cancellation_reason)?.label;

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed top-0 right-0 h-full w-80 bg-background border-l border-border shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Barra de color por estado */}
      <div className={cn("h-1.5 shrink-0", appointmentStatusStyle(appt.status).header)} />

      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground font-medium">Paciente</p>
            </div>
            <h2 className="text-base font-bold text-foreground leading-snug mt-0.5 truncate">
              {appt.patients?.last_name}, {appt.patients?.first_name}
            </h2>
            {maxAbsences !== null && absenceCount !== null && (
              <span className={cn(
                "inline-block mt-1 text-[10px] font-medium rounded px-1.5 py-0.5",
                absenceCount >= maxAbsences ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground"
              )}>
                {absenceCount}/{maxAbsences} ausencias
              </span>
            )}
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 -mt-0.5" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Fecha y hora */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="capitalize">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium">{startStr}{endStr ? ` — ${endStr}` : ""}</span>
          </div>
        </div>

        {/* Chips: tipo + estado + sobreturno */}
        <div className="flex flex-wrap gap-1.5">
          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", TYPE_CHIP[appt.type] || "bg-muted text-foreground")}>
            {TYPE_MAP[appt.type] || appt.type}
          </span>
          <AppointmentStatusSelect status={appt.status} onChange={next => onStatusChange(appt, next)} disabled={statusPending} />
          {appt.is_overtime && (
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-orange-100 text-orange-600 rounded-full px-2.5 py-1">
              <Zap className="h-3 w-3" /> Sobreturno
            </span>
          )}
          {appt.modality === "virtual" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-violet-100 text-violet-600 rounded-full px-2.5 py-1">
              <Video className="h-3 w-3" /> Virtual
            </span>
          )}
        </div>

        {/* Info de cancelación */}
        {appt.status === "cancelled" && (cancelLabel || appt.cancellation_notes) && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            {cancelLabel && (
              <p className="text-xs font-semibold text-slate-700">{cancelLabel}</p>
            )}
            {appt.cancellation_notes && (
              <p className="text-xs text-slate-600 italic">"{appt.cancellation_notes}"</p>
            )}
          </div>
        )}

        {/* Notas */}
        {appt.notes && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Notas</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-sm text-foreground leading-relaxed">{appt.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Acciones (solo para turnos programados) */}
      {isOpen(appt.status) && (
        <div className="px-4 py-4 border-t border-border space-y-2 shrink-0">
          {appt.modality === "virtual" && (
            appt.video_link ? (
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                  size="sm"
                  onClick={() => window.open(appt.video_link, "_blank")}
                >
                  <Video className="h-4 w-4" /> Unirse a la llamada
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0"
                        onClick={() => { navigator.clipboard.writeText(appt.video_link); toast.success("Link copiado"); }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copiar link</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <Button
                className="w-full gap-2 text-violet-700 border-violet-300 hover:bg-violet-50 hover:border-violet-400"
                variant="outline"
                size="sm"
                onClick={handleGenerateLink}
                disabled={generatingLink}
              >
                {generatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                Generar link de videollamada
              </Button>
            )
          )}
          <Button
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            size="sm"
            onClick={() => onStatusChange(appt, "completed")}
          >
            <CheckCircle className="h-4 w-4" /> Marcar atendido
          </Button>
          <Button
            className="w-full gap-2"
            variant="outline"
            size="sm"
            onClick={() => onReschedule(appt)}
          >
            <Clock className="h-4 w-4" /> Reprogramar
          </Button>
          {appt.patients?.phone && (() => {
            const message = buildReminderMessage(appt, appt.patients.first_name);
            const url = whatsappUrl(appt.patients.phone, message);
            return url ? (
              <Button
                className="w-full gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400"
                variant="outline"
                size="sm"
                onClick={() => window.open(url, "_blank")}
              >
                <MessageCircle className="h-4 w-4" /> Recordar por WhatsApp
              </Button>
            ) : null;
          })()}
          <Button
            className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50"
            variant="outline"
            size="sm"
            onClick={() => onCancel(appt.id)}
          >
            <XCircle className="h-4 w-4" /> Cancelar turno
          </Button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   REPROGRAMAR DIALOG
═══════════════════════════════════════════════════════════ */

function RescheduleDialog({ appt, onClose, onSaved }: { appt: AppointmentWithPatient; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(appt.appointment_date ? format(parseISO(appt.appointment_date), "yyyy-MM-dd") : "");
  const [startTime, setStartTime] = useState(appt.appointment_date ? format(parseISO(appt.appointment_date), "HH:mm") : "");
  const [endTime, setEndTime] = useState(appt.appointment_end ? format(parseISO(appt.appointment_end), "HH:mm") : "");
  const [notes, setNotes] = useState(appt.notes || "");

  const [isDirty, resetDirty] = useDirtyDeps([date, startTime, endTime, notes]);
  const { guard, confirmOpen, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
  const closeGuarded = () => guard(onClose);

  const [overtimeConflict, setOvertimeConflict] = useState<string | null>(null);

  const doSave = async (isOvertime: boolean) => {
    setSaving(true);
    const appointmentDate = new Date(`${date}T${startTime}:00`).toISOString();
    const appointmentEnd = endTime ? new Date(`${date}T${endTime}:00`).toISOString() : null;
    const { error } = await supabase.from("appointments").update({
      appointment_date: appointmentDate,
      appointment_end: appointmentEnd,
      notes: notes || null,
      is_overtime: isOvertime,
    }).eq("id", appt.id);
    setSaving(false);
    if (error) { toast.error("Error al reprogramar turno"); return; }
    toast.success(isOvertime ? "Turno reprogramado como sobreturno" : "Turno reprogramado");
    resetDirty();
    onSaved();
    onClose();
  };

  const handleSave = async () => {
    if (!date || !startTime) { toast.error("Completá la fecha y hora"); return; }
    if (isEndNotAfterStart(startTime, endTime)) {
      toast.error("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    // Choque con otro turno abierto del mismo día (aunque el horario no coincida exacto).
    // Se avisa siempre, aunque este turno ya fuera sobreturno antes de reprogramarlo.
    setSaving(true);
    const newStart = new Date(`${date}T${startTime}:00`);
    const newEnd = endTime ? new Date(`${date}T${endTime}:00`) : new Date(newStart.getTime() + 30 * 60000);
    const { data: dayAppts, error: fetchError } = await supabase
      .from("appointments")
      .select("id, appointment_date, appointment_end, patients(first_name, last_name)")
      .in("status", OCCUPYING_STATUSES)
      .neq("id", appt.id)
      .gte("appointment_date", `${date}T00:00:00`)
      .lt("appointment_date", `${date}T23:59:59`);
    setSaving(false);
    if (fetchError) { toast.error("No se pudieron validar los horarios existentes"); return; }
    const conflict = (dayAppts || []).find(a => {
      const aStart = parseISO(a.appointment_date);
      const aEnd = a.appointment_end ? parseISO(a.appointment_end) : new Date(aStart.getTime() + 30 * 60000);
      return newStart < aEnd && newEnd > aStart;
    });
    if (conflict) {
      setOvertimeConflict(`${conflict.patients?.last_name}, ${conflict.patients?.first_name}`);
      return;
    }
    await doSave(false);
  };

  return (
    <>
    <Dialog open onOpenChange={(v) => { if (!v) closeGuarded(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Reprogramar turno</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Hora inicio</Label><Input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); if (e.target.value) setEndTime(addMinutesToTime(e.target.value, DEFAULT_SESSION_MINUTES)); }} /></div>
            <div className="space-y-1.5"><Label>Hora fin</Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} aria-invalid={isEndNotAfterStart(startTime, endTime)} /></div>
          </div>
          {isEndNotAfterStart(startTime, endTime) && (
            <p className="text-xs text-destructive -mt-2">La hora de fin debe ser posterior a la de inicio.</p>
          )}
          <div className="space-y-1.5"><Label>Notas</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeGuarded}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || isEndNotAfterStart(startTime, endTime)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!overtimeConflict} onOpenChange={(v) => { if (!v) setOvertimeConflict(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-500" /> ¿Reprogramar como sobreturno?
          </AlertDialogTitle>
          <AlertDialogDescription>
            El nuevo horario se superpone con el turno de <strong>{overtimeConflict}</strong>. Podés reprogramarlo igual como sobreturno.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={async () => { setOvertimeConflict(null); await doSave(true); }}
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Reprogramar como sobreturno
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <UnsavedChangesDialog open={confirmOpen} onConfirm={confirmDiscard} onCancel={cancelDiscard} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   NUEVO TURNO DIALOG
═══════════════════════════════════════════════════════════ */

function NewAppointmentDialog({
  open, onClose, userId, onSaved, prefilledDate, prefilledTime,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSaved: () => void;
  prefilledDate?: string;
  prefilledTime?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientLite | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dayAppts, setDayAppts] = useState<DayAppointment[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ type: "consultation" as string, modality: "in_person" as "in_person" | "virtual", notes: "" });
  const [repeat, setRepeat] = useState<{ enabled: boolean; frequency: "weekly" | "biweekly"; count: number }>({ enabled: false, frequency: "weekly", count: 4 });
  const [overtimeConflict, setOvertimeConflict] = useState<string | null>(null);
  const [showOvertimeConfirm, setShowOvertimeConfirm] = useState(false);
  const [seriesConflicts, setSeriesConflicts] = useState<string[] | null>(null);
  const { maxAbsences } = useAppointmentSettings();
  const priorities = usePatientPriorities([...patients.map(p => p.id), ...(selectedPatient ? [selectedPatient.id] : [])]);
  const [absenceCount, setAbsenceCount] = useState(0);

  const [isDirty, resetDirty] = useDirtyDeps([selectedPatient, selectedDate, startTime, endTime, form]);
  const { guard, confirmOpen, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
  const closeGuarded = () => guard(onClose);
  const navigate = useNavigate();

  // Pre-fill cuando se abre desde clic en el calendario
  useEffect(() => {
    if (open) {
      if (prefilledDate) setSelectedDate(prefilledDate);
      if (prefilledTime) {
        setStartTime(prefilledTime);
        setEndTime(addMinutesToTime(prefilledTime, DEFAULT_SESSION_MINUTES));
      }
      resetDirty();
    } else {
      // Reset al cerrar
      setSelectedPatient(null);
      setSearchTerm("");
      setSelectedDate("");
      setStartTime("");
      setEndTime("");
      setForm({ type: "consultation", modality: "in_person", notes: "" });
      setOvertimeConflict(null);
      setRepeat({ enabled: false, frequency: "weekly", count: 4 });
    }
  }, [open, prefilledDate, prefilledTime, resetDirty]);

  useEffect(() => {
    if (!selectedDate) { setDayAppts([]); return; }
    let cancelled = false;
    setLoadingSlots(true);
    supabase
      .from("appointments")
      .select("*, patients(first_name, last_name)")
      .in("status", OCCUPYING_STATUSES)
      .gte("appointment_date", `${selectedDate}T00:00:00`)
      .lt("appointment_date", `${selectedDate}T23:59:59`)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Error cargando turnos del día:", error);
          toast.error("No se pudieron cargar los turnos ya agendados", { description: "Los horarios que se muestran libres pueden no serlo — recargá antes de confirmar." });
        }
        setDayAppts(data || []); setLoadingSlots(false);
      });
    return () => { cancelled = true; };
  }, [selectedDate]);

  // Ausencias previas del paciente elegido, para advertir si alcanzó el máximo configurado.
  useEffect(() => {
    if (!selectedPatient || maxAbsences === null) { setAbsenceCount(0); return; }
    let cancelled = false;
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", selectedPatient.id)
      .eq("status", "absent")
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) { console.error("Error contando ausencias:", error); setAbsenceCount(0); return; }
        setAbsenceCount(count ?? 0);
      });
    return () => { cancelled = true; };
  }, [selectedPatient, maxAbsences]);

  const absenceLimitReached = maxAbsences !== null && absenceCount >= maxAbsences;

  const searchPatients = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) { setPatients([]); return; }
    const { data, error } = await supabase
      .from("patients")
      .select("id, first_name, last_name, dni, document_type")
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,dni.ilike.%${term}%`)
      .limit(10);
    if (error) {
      console.error("Error buscando pacientes:", error);
      toast.error("No se pudo buscar el paciente");
    }
    setPatients(data || []);
  };

  const timeToMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  const allSlots = Array.from({ length: (HOUR_END - HOUR_START) * 2 }, (_, i) => {
    const totalMin = HOUR_START * 60 + i * 30;
    return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
  });

  // Nombre del paciente cuyo turno se superpone con [rangeStart, rangeEnd) en minutos desde medianoche, o null si no hay choque.
  const overlap = (rangeStart: number, rangeEnd: number): string | null => {
    for (const a of dayAppts) {
      const aStart = timeToMin(format(parseISO(a.appointment_date), "HH:mm"));
      const aEnd = a.appointment_end ? timeToMin(format(parseISO(a.appointment_end), "HH:mm")) : aStart + 30;
      if (rangeStart < aEnd && rangeEnd > aStart)
        return `${a.patients?.last_name}, ${a.patients?.first_name}`;
    }
    return null;
  };

  const isOccupied = (slot: string): string | null => {
    const slotMin = timeToMin(slot);
    for (const a of dayAppts) {
      const aStart = timeToMin(format(parseISO(a.appointment_date), "HH:mm"));
      const aEnd = a.appointment_end ? timeToMin(format(parseISO(a.appointment_end), "HH:mm")) : aStart + 30;
      if (slotMin >= aStart && slotMin < aEnd)
        return `${a.patients?.last_name}, ${a.patients?.first_name}`;
    }
    return null;
  };

  const wouldEndConflict = (endSlot: string): string | null => {
    if (!startTime) return null;
    return overlap(timeToMin(startTime), timeToMin(endSlot));
  };

  const hasOverlap = (): string | null => {
    if (!startTime || !endTime) return null;
    return overlap(timeToMin(startTime), timeToMin(endTime));
  };

  const doSave = async (isOvertime: boolean) => {
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      patient_id: selectedPatient.id,
      professional_id: userId,
      appointment_date: new Date(`${selectedDate}T${startTime}:00`).toISOString(),
      appointment_end: new Date(`${selectedDate}T${endTime}:00`).toISOString(),
      type: form.type as Database["public"]["Enums"]["appointment_type"],
      status: "scheduled",
      notes: form.notes || null,
      is_overtime: isOvertime,
      modality: form.modality,
      video_link: form.modality === "virtual" ? createVideoRoom() : null,
    });
    setSaving(false);
    if (error) { toast.error("Error al crear turno"); return; }
    toast.success(isOvertime ? "Sobreturno agendado" : "Turno agendado");
    resetDirty();
    onSaved();
    onClose();
  };

  // Serie de turnos recurrentes: cada ocurrencia es su propia fila (mismo
  // recurrence_id), gobernada por las mismas RLS de appointments de siempre
  // — no hace falta tabla ni policies nuevas. Si alguna ocurrencia choca con
  // un turno existente, se pregunta UNA vez para toda la serie (no fila por
  // fila): agendar las que chocan como sobreturno, o saltearlas.
  const doSaveRecurring = async (onConflict?: "overtime" | "skip") => {
    setSaving(true);
    const stepDays = repeat.frequency === "weekly" ? 7 : 14;
    const baseStart = new Date(`${selectedDate}T${startTime}:00`);
    const baseEnd = new Date(`${selectedDate}T${endTime}:00`);
    const durationMs = baseEnd.getTime() - baseStart.getTime();
    const occurrences = Array.from({ length: repeat.count }, (_, k) => {
      const start = new Date(baseStart.getTime() + k * stepDays * 86400000);
      return { start, end: new Date(start.getTime() + durationMs) };
    });

    const { data: existing, error: fetchError } = await supabase
      .from("appointments")
      .select("appointment_date, appointment_end, patients(first_name, last_name)")
      .in("status", OCCUPYING_STATUSES)
      .gte("appointment_date", occurrences[0].start.toISOString())
      .lt("appointment_date", occurrences[occurrences.length - 1].end.toISOString());
    if (fetchError) {
      setSaving(false);
      toast.error("No se pudieron validar los horarios existentes");
      return;
    }

    const findConflict = (occ: { start: Date; end: Date }) => (existing || []).find(a => {
      const aStart = parseISO(a.appointment_date);
      const aEnd = a.appointment_end ? parseISO(a.appointment_end) : new Date(aStart.getTime() + 30 * 60000);
      return occ.start < aEnd && occ.end > aStart;
    });

    if (!onConflict) {
      const conflicts = occurrences.flatMap(occ => {
        const c = findConflict(occ);
        return c ? [`${format(occ.start, "d/MM", { locale: es })} (${c.patients?.last_name}, ${c.patients?.first_name})`] : [];
      });
      if (conflicts.length > 0) {
        setSaving(false);
        setSeriesConflicts(conflicts);
        return;
      }
    }

    const recurrenceId = crypto.randomUUID();
    const toInsert: Database["public"]["Tables"]["appointments"]["Insert"][] = [];
    const skipped: string[] = [];

    for (const occ of occurrences) {
      const conflict = findConflict(occ);
      if (conflict && onConflict === "skip") {
        skipped.push(`${format(occ.start, "d/MM", { locale: es })} (choca con ${conflict.patients?.last_name}, ${conflict.patients?.first_name})`);
        continue;
      }
      toInsert.push({
        patient_id: selectedPatient.id,
        professional_id: userId,
        appointment_date: occ.start.toISOString(),
        appointment_end: occ.end.toISOString(),
        type: form.type as Database["public"]["Enums"]["appointment_type"],
        status: "scheduled",
        notes: form.notes || null,
        is_overtime: !!conflict,
        modality: form.modality,
        video_link: form.modality === "virtual" ? createVideoRoom() : null,
        recurrence_id: recurrenceId,
      });
    }

    if (toInsert.length === 0) {
      setSaving(false);
      toast.error("No se pudo agendar ningún turno de la serie", { description: "Todos los horarios elegidos ya están ocupados." });
      return;
    }

    const { error } = await supabase.from("appointments").insert(toInsert);
    setSaving(false);
    if (error) { toast.error("Error al crear los turnos de la serie"); return; }

    if (skipped.length > 0) {
      toast.success(`Se agendaron ${toInsert.length} de ${repeat.count} turnos`, { description: `No se pudo: ${skipped.join("; ")}` });
    } else if (toInsert.some(t => t.is_overtime)) {
      toast.success(`Se agendaron los ${toInsert.length} turnos de la serie`, { description: `${toInsert.filter(t => t.is_overtime).length} como sobreturno` });
    } else {
      toast.success(`Se agendaron los ${toInsert.length} turnos de la serie`);
    }
    resetDirty();
    onSaved();
    onClose();
  };

  const handleSave = async () => {
    if (!selectedPatient || !selectedDate || !startTime || !endTime) {
      toast.error("Completá todos los campos obligatorios");
      return;
    }
    if (timeToMin(endTime) <= timeToMin(startTime)) {
      toast.error("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    if (repeat.enabled) {
      await doSaveRecurring();
      return;
    }
    const conflict = hasOverlap();
    if (conflict) {
      setOvertimeConflict(conflict);
      setShowOvertimeConfirm(true);
      return;
    }
    await doSave(false);
  };

  const canSave = !!selectedPatient && !!selectedDate && !!startTime && !!endTime && !isEndNotAfterStart(startTime, endTime);
  const hoursInRange = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) =>
    String(HOUR_START + i).padStart(2, "0")
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeGuarded(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo turno</DialogTitle></DialogHeader>
          <div className="space-y-4">

            {/* Paciente */}
            <div className="space-y-1.5">
              <Label>Paciente *</Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-muted px-3 py-2 rounded-md">
                  <span className="text-sm flex items-center gap-2">
                    {priorities[selectedPatient.id] && <PriorityDot level={priorities[selectedPatient.id]} />}
                    {selectedPatient.last_name}, {selectedPatient.first_name}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedPatient(null)}>Cambiar</Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar paciente..." value={searchTerm} onChange={e => searchPatients(e.target.value)} className="pl-10" />
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Nuevo paciente"
                            onClick={() => guard(() => { onClose(); navigate("/patients/new"); })}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Nuevo paciente</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {patients.length > 0 && (
                    <div className="border border-border rounded-md divide-y divide-border max-h-36 overflow-y-auto">
                      {patients.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPatient(p); setPatients([]); setSearchTerm(""); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2">
                          {priorities[p.id] && <PriorityDot level={priorities[p.id]} />}
                          <span>{p.last_name}, {p.first_name} — {documentTypeShortLabel(p.document_type)}: {p.dni}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedPatient && absenceLimitReached && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Este paciente acumula {absenceCount} {absenceCount === 1 ? "ausencia" : "ausencias"}</AlertTitle>
                <AlertDescription>
                  Alcanzó el máximo de {maxAbsences} que configuraste. Podés agendar el turno igual.
                </AlertDescription>
              </Alert>
            )}

            {selectedPatient && priorities[selectedPatient.id] && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 -mt-2">
                <PriorityDot level={priorities[selectedPatient.id]} />
                {PRIORITY_META[priorities[selectedPatient.id]].label}: {PRIORITY_META[priorities[selectedPatient.id]].hint.toLowerCase()}.
              </p>
            )}

            {/* Fecha */}
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <Input type="date" value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setStartTime(""); setEndTime(""); }} />
            </div>

            {/* Horas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hora inicio *</Label>
                <Input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); if (e.target.value) setEndTime(addMinutesToTime(e.target.value, DEFAULT_SESSION_MINUTES)); }} min="07:00" max="21:00" />
              </div>
              <div className="space-y-1.5">
                <Label>Hora fin *</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} min="07:00" max="21:00" aria-invalid={isEndNotAfterStart(startTime, endTime)} />
              </div>
            </div>
            {isEndNotAfterStart(startTime, endTime) && (
              <p className="text-xs text-destructive -mt-2">La hora de fin debe ser posterior a la de inicio.</p>
            )}

            {/* Mini timeline */}
            {selectedDate && (
              <div className="space-y-2">
                {loadingSlots ? (
                  <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                ) : (() => {
                  const pickingEnd = !!startTime && !endTime;
                  const startMin = startTime ? timeToMin(startTime) : HOUR_START * 60;

                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          {pickingEnd ? "Seleccioná la hora de fin" : startTime ? "Turno marcado" : "Seleccioná la hora de inicio"}
                        </Label>
                        {startTime && (
                          <button onClick={() => { setStartTime(""); setEndTime(""); }}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline">
                            Limpiar
                          </button>
                        )}
                      </div>
                      <div className="border border-border rounded-lg overflow-hidden">
                        <div className="flex h-8 bg-muted/30">
                          {allSlots.map(slot => {
                            const slotMin = timeToMin(slot);
                            const tooEarlyForEnd = pickingEnd && slotMin <= startMin;
                            const occupied = !tooEarlyForEnd ? isOccupied(slot) : null;
                            const conflict = pickingEnd && !tooEarlyForEnd ? wouldEndConflict(slot) : null;
                            const isSelected = pickingEnd ? slot === endTime : slot === startTime;
                            const isInRange = !pickingEnd && startTime && endTime &&
                              slotMin >= timeToMin(startTime) && slotMin < timeToMin(endTime);
                            const isOvertimeSlot = !tooEarlyForEnd && !!occupied;
                            const isConflictEnd = !!conflict;

                            const tooltipMsg = tooEarlyForEnd ? "" :
                              isOvertimeSlot ? `${slot} — ocupado (${occupied}) · sobreturno posible` :
                              isConflictEnd ? `${slot} — conflicto con ${conflict}` : slot;

                            return (
                              <TooltipProvider key={slot}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (tooEarlyForEnd) return;
                                        if (isConflictEnd) { toast.warning(`Conflicto con ${conflict}`); return; }
                                        if (pickingEnd) { setEndTime(slot); return; }
                                        setStartTime(slot); setEndTime("");
                                      }}
                                      className={cn(
                                        "flex-1 h-full border-r border-border/50 last:border-r-0 transition-colors",
                                        tooEarlyForEnd ? "bg-muted/40 cursor-not-allowed" :
                                        isConflictEnd ? "bg-destructive/25 cursor-not-allowed" :
                                        isOvertimeSlot ? "bg-orange-200 cursor-pointer hover:bg-orange-300" :
                                        isSelected ? "bg-primary/60" :
                                        isInRange ? "bg-primary/25" :
                                        "hover:bg-primary/10 cursor-pointer"
                                      )}
                                    />
                                  </TooltipTrigger>
                                  {tooltipMsg && <TooltipContent><p className="text-xs">{tooltipMsg}</p></TooltipContent>}
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                        <div className="flex bg-muted/10">
                          {hoursInRange.map(h => (
                            <div key={h} className="flex-1 text-center">
                              <span className="text-[9px] text-muted-foreground">{h}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {dayAppts.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {dayAppts.map(a => (
                            <span key={a.id} className="text-[10px] bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">
                              {format(parseISO(a.appointment_date), "HH:mm")}
                              {a.appointment_end && `–${format(parseISO(a.appointment_end), "HH:mm")}`} {a.patients?.last_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Modalidad */}
            <div className="space-y-1.5">
              <Label>Modalidad</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, modality: "in_person" }))}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    form.modality === "in_person"
                      ? "border-primary bg-primary/10 text-foreground font-medium"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <MapPin className="h-4 w-4" /> Presencial
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, modality: "virtual" }))}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    form.modality === "virtual"
                      ? "border-violet-500 bg-violet-50 text-violet-700 font-medium"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Video className="h-4 w-4" /> Virtual
                </button>
              </div>
              {form.modality === "virtual" && (
                <p className="text-xs text-muted-foreground">
                  Al guardar se genera automáticamente el link de la videollamada.
                </p>
              )}
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consulta</SelectItem>
                  <SelectItem value="follow_up">Seguimiento</SelectItem>
                  <SelectItem value="evaluation">Evaluación</SelectItem>
                  <SelectItem value="admission">Admisión</SelectItem>
                  <SelectItem value="discharge">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            {/* Repetir (turnos recurrentes) */}
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="repeat-enabled"
                  checked={repeat.enabled}
                  onCheckedChange={v => setRepeat(r => ({ ...r, enabled: !!v }))}
                />
                <Label htmlFor="repeat-enabled" className="cursor-pointer">Repetir este turno</Label>
              </div>
              {repeat.enabled && (
                <div className="flex items-center gap-2 pl-6">
                  <Select value={repeat.frequency} onValueChange={(v: "weekly" | "biweekly") => setRepeat(r => ({ ...r, frequency: v }))}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Quincenal</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">×</span>
                  <Select value={String(repeat.count)} onValueChange={v => setRepeat(r => ({ ...r, count: Number(v) }))}>
                    <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 6, 8, 10, 12].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">veces</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeGuarded}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !canSave}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : repeat.enabled ? "Guardar serie" : "Guardar turno"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Serie con choques */}
      <AlertDialog open={!!seriesConflicts} onOpenChange={(v) => { if (!v) setSeriesConflicts(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" /> Hay turnos de la serie que se superponen
            </AlertDialogTitle>
            <AlertDialogDescription>
              {seriesConflicts?.length} de {repeat.count} turnos chocan con otros ya agendados: {seriesConflicts?.join("; ")}. Podés agendarlos igual como sobreturno u omitir esas fechas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={async () => { setSeriesConflicts(null); await doSaveRecurring("skip"); }}>
              Omitir esas fechas
            </Button>
            <AlertDialogAction
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={async () => { setSeriesConflicts(null); await doSaveRecurring("overtime"); }}
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" /> Agendar como sobreturno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar sobreturno */}
      <AlertDialog open={showOvertimeConfirm} onOpenChange={setShowOvertimeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" /> ¿Crear como sobreturno?
            </AlertDialogTitle>
            <AlertDialogDescription>
              El horario se superpone con el turno de <strong>{overtimeConflict}</strong>. Podés guardarlo igual como sobreturno.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={async () => { setShowOvertimeConfirm(false); await doSave(true); }}
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" /> Guardar como sobreturno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesDialog open={confirmOpen} onConfirm={confirmDiscard} onCancel={cancelDiscard} />
    </>
  );
}
