import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAppointments, useCompleteAppointment, useCancelAppointment, APPOINTMENTS_KEY } from "@/hooks/useAppointments";
import { StatusBadge } from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, Loader2, Search, CheckCircle, XCircle, Clock, List, CalendarDays, ChevronLeft, ChevronRight, Zap, X, FileText, User } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | "scheduled" | "completed" | "cancelled";
type ViewMode = "list" | "week";

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
const TYPE_BAR: Record<string, string> = {
  admission:    "bg-teal-500",
  follow_up:    "bg-blue-500",
  evaluation:   "bg-amber-500",
  discharge:    "bg-emerald-500",
  consultation: "bg-gray-400",
};

// Bloque en calendario: fondo suave + borde izquierdo por estado (Google Calendar style)
const STATUS_BLOCK: Record<string, string> = {
  scheduled: "bg-sky-100 border-l-[3px] border-sky-500 text-sky-900 hover:bg-sky-200 hover:shadow-sm",
  completed: "bg-emerald-50 border-l-[3px] border-emerald-500 text-emerald-900 hover:bg-emerald-100 hover:shadow-sm",
  cancelled: "bg-red-50 border-l-[3px] border-red-400 text-red-800 opacity-60",
};

// Barra de color superior en el panel de detalle
const STATUS_HEADER_COLOR: Record<string, string> = {
  scheduled: "bg-sky-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-400",
};

const CANCELLATION_REASONS = [
  { value: "no_show",                label: "No asistió" },
  { value: "patient_cancelled",      label: "Canceló el paciente" },
  { value: "professional_cancelled", label: "Canceló el profesional" },
  { value: "rescheduled",            label: "Reprogramado" },
  { value: "other",                  label: "Otro" },
];

const HOUR_START = 7;
const HOUR_END = 21;
const SLOT_H = 56; // px por hora

function displayStatus(a: any): string {
  return a.status === "cancelled" && a.cancellation_reason === "no_show" ? "no_show" : a.status;
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════ */

export default function Appointments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>("scheduled");
  const [view, setView] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showNew, setShowNew] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState("");
  const [prefilledTime, setPrefilledTime] = useState("");
  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);

  // Detail panel
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");

  const { data: appointments = [], isLoading: loading } = useAppointments(filter);
  const { mutate: completeAppointment } = useCompleteAppointment();
  const { mutate: cancelAppointment } = useCancelAppointment();

  const refreshAppointments = () =>
    queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });

  const openDetail = (appt: any) => {
    setSelectedAppt(appt);
    setDetailOpen(true);
  };

  const openCancelDialog = (id: string) => {
    setCancelTarget(id);
    setCancelReason("");
    setCancelNotes("");
  };

  const handleCancel = () => {
    if (!cancelTarget || !cancelReason) return;
    cancelAppointment(
      { id: cancelTarget, reason: cancelReason, notes: cancelNotes },
      { onSuccess: () => { setCancelTarget(null); setCancelReason(""); setCancelNotes(""); } }
    );
  };

  const filterTabs: { label: string; value: FilterStatus }[] = [
    { label: "Programados", value: "scheduled" },
    { label: "Completados", value: "completed" },
    { label: "Cancelados", value: "cancelled" },
    { label: "Todos", value: "all" },
  ];

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const apptsByDay = (day: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.appointment_date), day));

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

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const totalMins = HOUR_START * 60 + (relY / SLOT_H) * 60;
    const roundedMins = Math.round(totalMins / 30) * 30;
    const h = Math.floor(roundedMins / 60);
    const m = roundedMins % 60;
    if (h < HOUR_START || h >= HOUR_END) return;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    setPrefilledDate(format(day, "yyyy-MM-dd"));
    setPrefilledTime(timeStr);
    setShowNew(true);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <h1 className="font-serif text-2xl font-semibold text-foreground tracking-tight">Turnos</h1>
        <div className="flex items-center gap-2">
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
          </div>
          <Button onClick={() => { setPrefilledDate(""); setPrefilledTime(""); setShowNew(true); }} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nuevo turno
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border shrink-0">
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

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : view === "list" ? (
        /* ── VISTA LISTA ── */
        <div className="flex-1 overflow-y-auto pt-4">
          {appointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No hay turnos.</p>
          ) : (
            <TooltipProvider>
              <div className="dashboard-card overflow-hidden">
                {appointments.map((a, idx) => (
                  <div
                    key={a.id}
                    className={cn(
                      "grid grid-cols-[4px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group cursor-pointer",
                      idx !== appointments.length - 1 && "border-b border-border/60"
                    )}
                    onClick={() => openDetail(a)}
                  >
                    <div className={cn("w-1 self-stretch rounded-full", TYPE_BAR[a.type] || "bg-muted")} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {a.patients?.last_name}, {a.patients?.first_name}
                        </p>
                        {a.is_overtime && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-orange-100 text-orange-600 rounded px-1 py-0.5 shrink-0">
                            <Zap className="h-2.5 w-2.5" /> Sobreturno
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
                      <StatusBadge status={displayStatus(a)} />
                      {a.status === "scheduled" && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => completeAppointment(a.id)}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Completar</TooltipContent>
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
                const dayAppts = apptsByDay(day);
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

                      {/* Bloques de turnos */}
                      {dayAppts.map(a => {
                        const startStr = format(parseISO(a.appointment_date), "HH:mm");
                        const endStr = a.appointment_end ? format(parseISO(a.appointment_end), "HH:mm") : null;
                        const top = topForTime(startStr);
                        const height = heightForDuration(startStr, endStr);
                        const isSelected = selectedAppt?.id === a.id && detailOpen;

                        return (
                          <div
                            key={a.id}
                            data-appointment-block="true"
                            onClick={e => { e.stopPropagation(); openDetail(a); }}
                            className={cn(
                              "absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 overflow-hidden cursor-pointer transition-all duration-150",
                              STATUS_BLOCK[a.status] || "bg-muted text-foreground",
                              a.is_overtime && "border border-dashed border-orange-400",
                              isSelected && "ring-2 ring-sky-400 ring-offset-1 z-10"
                            )}
                            style={{ top, height, zIndex: isSelected ? 15 : 5 }}
                          >
                            <div className="flex items-center gap-0.5 min-w-0">
                              {a.is_overtime && <Zap className="h-2.5 w-2.5 shrink-0 text-orange-500" />}
                              <p className="text-[11px] font-semibold truncate leading-tight">
                                {a.patients?.last_name}
                              </p>
                            </div>
                            {height > 30 && (
                              <p className="text-[9px] opacity-60 leading-tight mt-0.5">
                                {startStr}{endStr ? `–${endStr}` : ""} · {TYPE_MAP[a.type] || a.type}
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
        onComplete={id => { completeAppointment(id); setDetailOpen(false); }}
        onReschedule={a => { setRescheduleAppt(a); setDetailOpen(false); }}
        onCancel={id => { openCancelDialog(id); setDetailOpen(false); }}
      />

      {/* Dialogs */}
      <NewAppointmentDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        userId={user!.id}
        onSaved={refreshAppointments}
        existingAppointments={appointments.filter(a => a.status === "scheduled")}
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
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Volver</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={!cancelReason}>
              Cancelar turno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rescheduleAppt && (
        <RescheduleDialog appt={rescheduleAppt} onClose={() => setRescheduleAppt(null)} onSaved={refreshAppointments} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANEL DE DETALLE (slide-in desde la derecha, sin overlay)
═══════════════════════════════════════════════════════════ */

function AppointmentDetailPanel({
  appt, open, onClose, onComplete, onReschedule, onCancel,
}: {
  appt: any | null;
  open: boolean;
  onClose: () => void;
  onComplete: (id: string) => void;
  onReschedule: (appt: any) => void;
  onCancel: (id: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const inPanel = panelRef.current?.contains(target);
      const inBlock = !!target.closest("[data-appointment-block]");
      if (!inPanel && !inBlock) onClose();
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
      <div className={cn("h-1.5 shrink-0", STATUS_HEADER_COLOR[appt.status] || "bg-muted")} />

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
          <StatusBadge status={displayStatus(appt)} />
          {appt.is_overtime && (
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-orange-100 text-orange-600 rounded-full px-2.5 py-1">
              <Zap className="h-3 w-3" /> Sobreturno
            </span>
          )}
        </div>

        {/* Info de cancelación */}
        {appt.status === "cancelled" && (cancelLabel || appt.cancellation_notes) && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-1">
            {cancelLabel && (
              <p className="text-xs font-semibold text-red-700">{cancelLabel}</p>
            )}
            {appt.cancellation_notes && (
              <p className="text-xs text-red-600 italic">"{appt.cancellation_notes}"</p>
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
      {appt.status === "scheduled" && (
        <div className="px-4 py-4 border-t border-border space-y-2 shrink-0">
          <Button
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            size="sm"
            onClick={() => onComplete(appt.id)}
          >
            <CheckCircle className="h-4 w-4" /> Completar
          </Button>
          <Button
            className="w-full gap-2"
            variant="outline"
            size="sm"
            onClick={() => onReschedule(appt)}
          >
            <Clock className="h-4 w-4" /> Reprogramar
          </Button>
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

function RescheduleDialog({ appt, onClose, onSaved }: { appt: any; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(appt.appointment_date ? format(parseISO(appt.appointment_date), "yyyy-MM-dd") : "");
  const [startTime, setStartTime] = useState(appt.appointment_date ? format(parseISO(appt.appointment_date), "HH:mm") : "");
  const [endTime, setEndTime] = useState(appt.appointment_end ? format(parseISO(appt.appointment_end), "HH:mm") : "");
  const [notes, setNotes] = useState(appt.notes || "");

  const handleSave = async () => {
    if (!date || !startTime) { toast.error("Completá la fecha y hora"); return; }
    setSaving(true);
    const appointmentDate = new Date(`${date}T${startTime}:00`).toISOString();
    const appointmentEnd = endTime ? new Date(`${date}T${endTime}:00`).toISOString() : null;
    const { error } = await supabase.from("appointments").update({
      appointment_date: appointmentDate,
      appointment_end: appointmentEnd,
      notes: notes || null,
    }).eq("id", appt.id);
    setSaving(false);
    if (error) { toast.error("Error al reprogramar turno"); return; }
    toast.success("Turno reprogramado");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Reprogramar turno</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Hora inicio</Label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Hora fin</Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notas</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════
   NUEVO TURNO DIALOG
═══════════════════════════════════════════════════════════ */

function NewAppointmentDialog({
  open, onClose, userId, onSaved, existingAppointments, prefilledDate, prefilledTime,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSaved: () => void;
  existingAppointments: any[];
  prefilledDate?: string;
  prefilledTime?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dayAppts, setDayAppts] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ type: "consultation" as string, notes: "" });
  const [overtimeConflict, setOvertimeConflict] = useState<string | null>(null);
  const [showOvertimeConfirm, setShowOvertimeConfirm] = useState(false);

  // Pre-fill cuando se abre desde clic en el calendario
  useEffect(() => {
    if (open) {
      if (prefilledDate) setSelectedDate(prefilledDate);
      if (prefilledTime) setStartTime(prefilledTime);
    } else {
      // Reset al cerrar
      setSelectedPatient(null);
      setSearchTerm("");
      setSelectedDate("");
      setStartTime("");
      setEndTime("");
      setForm({ type: "consultation", notes: "" });
      setOvertimeConflict(null);
    }
  }, [open, prefilledDate, prefilledTime]);

  useEffect(() => {
    if (!selectedDate) { setDayAppts([]); return; }
    setLoadingSlots(true);
    supabase
      .from("appointments")
      .select("*, patients(first_name, last_name)")
      .eq("status", "scheduled")
      .gte("appointment_date", `${selectedDate}T00:00:00`)
      .lt("appointment_date", `${selectedDate}T23:59:59`)
      .then(({ data }) => { setDayAppts(data || []); setLoadingSlots(false); });
  }, [selectedDate]);

  const searchPatients = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) { setPatients([]); return; }
    const { data } = await supabase
      .from("patients")
      .select("id, first_name, last_name, dni")
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,dni.ilike.%${term}%`)
      .limit(10);
    setPatients(data || []);
  };

  const timeToMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  const allSlots = Array.from({ length: (HOUR_END - HOUR_START) * 2 }, (_, i) => {
    const totalMin = HOUR_START * 60 + i * 30;
    return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
  });

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
    const newStart = timeToMin(startTime);
    const newEnd = timeToMin(endSlot);
    for (const a of dayAppts) {
      const aStart = timeToMin(format(parseISO(a.appointment_date), "HH:mm"));
      const aEnd = a.appointment_end ? timeToMin(format(parseISO(a.appointment_end), "HH:mm")) : aStart + 30;
      if (newStart < aEnd && newEnd > aStart)
        return `${a.patients?.last_name}, ${a.patients?.first_name}`;
    }
    return null;
  };

  const hasOverlap = (): string | null => {
    if (!startTime || !endTime) return null;
    const newStart = timeToMin(startTime);
    const newEnd = timeToMin(endTime);
    for (const a of dayAppts) {
      const aStart = timeToMin(format(parseISO(a.appointment_date), "HH:mm"));
      const aEnd = a.appointment_end ? timeToMin(format(parseISO(a.appointment_end), "HH:mm")) : aStart + 30;
      if (newStart < aEnd && newEnd > aStart)
        return `${a.patients?.last_name}, ${a.patients?.first_name}`;
    }
    return null;
  };

  const doSave = async (isOvertime: boolean) => {
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      patient_id: selectedPatient.id,
      professional_id: userId,
      appointment_date: new Date(`${selectedDate}T${startTime}:00`).toISOString(),
      appointment_end: new Date(`${selectedDate}T${endTime}:00`).toISOString(),
      type: form.type,
      status: "scheduled",
      notes: form.notes || null,
      is_overtime: isOvertime,
    });
    setSaving(false);
    if (error) { toast.error("Error al crear turno"); return; }
    toast.success(isOvertime ? "Sobreturno agendado" : "Turno agendado");
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
    const conflict = hasOverlap();
    if (conflict) {
      setOvertimeConflict(conflict);
      setShowOvertimeConfirm(true);
      return;
    }
    await doSave(false);
  };

  const canSave = !!selectedPatient && !!selectedDate && !!startTime && !!endTime;
  const hoursInRange = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) =>
    String(HOUR_START + i).padStart(2, "0")
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo turno</DialogTitle></DialogHeader>
          <div className="space-y-4">

            {/* Paciente */}
            <div className="space-y-1.5">
              <Label>Paciente *</Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-muted px-3 py-2 rounded-md">
                  <span className="text-sm">{selectedPatient.last_name}, {selectedPatient.first_name}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedPatient(null)}>Cambiar</Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar paciente..." value={searchTerm} onChange={e => searchPatients(e.target.value)} className="pl-10" />
                  </div>
                  {patients.length > 0 && (
                    <div className="border border-border rounded-md divide-y divide-border max-h-36 overflow-y-auto">
                      {patients.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPatient(p); setPatients([]); setSearchTerm(""); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                          {p.last_name}, {p.first_name} — DNI: {p.dni}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

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
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} min="07:00" max="21:00" />
              </div>
              <div className="space-y-1.5">
                <Label>Hora fin *</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} min="07:00" max="21:00" />
              </div>
            </div>

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

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !canSave}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar turno"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
