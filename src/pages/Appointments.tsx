import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "./Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, Loader2, Search, CheckCircle, XCircle, Clock, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | "scheduled" | "completed" | "cancelled";
type ViewMode = "list" | "week";

const TYPE_MAP: Record<string, string> = {
  consultation: "Consulta",
  follow_up: "Seguimiento",
  evaluation: "Evaluación",
  admission: "Admisión",
  discharge: "Alta",
};

const TYPE_COLOR: Record<string, string> = {
  admission:   "bg-[hsl(192,35%,42%)] text-white",
  follow_up:   "bg-[hsl(210,65%,55%)] text-white",
  evaluation:  "bg-[hsl(38,90%,52%)] text-white",
  discharge:   "bg-[hsl(152,50%,45%)] text-white",
  consultation:"bg-[hsl(0,0%,55%)] text-white",
};

const HOUR_START = 7;
const HOUR_END = 21;
const SLOT_H = 48; // px per hour

export default function Appointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("scheduled");
  const [view, setView] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showNew, setShowNew] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);

  const fetchAppointments = async () => {
    setLoading(true);
    let q = supabase
      .from("appointments")
      .select("*, patients(first_name, last_name)")
      .order("appointment_date", { ascending: true });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setAppointments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, [filter]);

  const handleComplete = async (id: string) => {
    await supabase.from("appointments").update({ status: "completed" as const }).eq("id", id);
    toast.success("Turno completado");
    fetchAppointments();
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    await supabase.from("appointments").update({ status: "cancelled" as const }).eq("id", cancelId);
    setCancelId(null);
    toast.success("Turno cancelado");
    fetchAppointments();
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
    if (!end) return SLOT_H * 0.5;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max((mins / 60) * SLOT_H, 20);
  };

  return (
    <div className="h-full flex flex-col space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <h1 className="font-serif text-2xl font-semibold text-foreground tracking-tight">Turnos</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
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
          <Button onClick={() => setShowNew(true)} size="sm" className="gap-1.5">
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
        <div className="flex-1 overflow-y-auto pt-4 space-y-1">
          {appointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No hay turnos.</p>
          ) : (
            <TooltipProvider>
              <div className="dashboard-card overflow-hidden">
                {appointments.map((a, idx) => (
                  <div
                    key={a.id}
                    className={cn(
                      "grid grid-cols-[4px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group",
                      idx !== appointments.length - 1 && "border-b border-border/60"
                    )}
                  >
                    <div className={cn("w-1 self-stretch rounded-full", TYPE_COLOR[a.type]?.split(" ")[0] || "bg-muted")} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {a.patients?.last_name}, {a.patients?.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(a.appointment_date), "EEE d MMM, HH:mm", { locale: es })}
                        {a.appointment_end && ` — ${format(parseISO(a.appointment_end), "HH:mm")}`}
                        {" · "}{TYPE_MAP[a.type] || a.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={a.status} />
                      {a.status === "scheduled" && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleComplete(a.id)}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Completado</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-red-50" onClick={() => setCancelId(a.id)}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancelar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setRescheduleAppt(a)}>
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
        /* ── VISTA SEMANA ── */
        <div className="flex-1 flex flex-col overflow-hidden pt-3">
          {/* Week navigator */}
          <div className="flex items-center justify-between mb-2 shrink-0">
            <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-foreground">
              {format(weekStart, "d MMM", { locale: es })} — {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
            </span>
            <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Grid */}
          <div className="flex flex-1 overflow-hidden border border-border rounded-xl bg-card">
            {/* Hour labels */}
            <div className="w-12 shrink-0 border-r border-border pt-9">
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                <div key={i} style={{ height: SLOT_H }} className="border-b border-border/40 relative">
                  <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground tabular-nums">
                    {String(HOUR_START + i).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div className="flex flex-1 overflow-x-auto overflow-y-auto">
              {weekDays.map(day => {
                const dayAppts = apptsByDay(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={day.toISOString()} className="flex-1 min-w-[100px] border-r border-border last:border-r-0 flex flex-col">
                    {/* Day header */}
                    <div className={cn("h-9 shrink-0 flex flex-col items-center justify-center border-b border-border sticky top-0 z-10 bg-card", isToday && "bg-primary/5")}>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{format(day, "EEE", { locale: es })}</span>
                      <span className={cn("text-sm font-semibold leading-tight", isToday ? "text-primary" : "text-foreground")}>
                        {format(day, "d")}
                      </span>
                    </div>

                    {/* Time grid */}
                    <div className="relative flex-1" style={{ height: (HOUR_END - HOUR_START) * SLOT_H }}>
                      {/* Hour lines */}
                      {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                        <div key={i} className="absolute w-full border-b border-border/30" style={{ top: i * SLOT_H }} />
                      ))}

                      {/* Appointment blocks */}
                      {dayAppts.map(a => {
                        const startStr = format(parseISO(a.appointment_date), "HH:mm");
                        const endStr = a.appointment_end ? format(parseISO(a.appointment_end), "HH:mm") : null;
                        const top = topForTime(startStr);
                        const height = heightForDuration(startStr, endStr);
                        const colorCls = TYPE_COLOR[a.type] || "bg-muted text-foreground";
                        return (
                          <TooltipProvider key={a.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn("absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 overflow-hidden cursor-default", colorCls, a.status === "cancelled" && "opacity-40 line-through")}
                                  style={{ top, height }}
                                >
                                  <p className="text-[10px] font-semibold leading-tight truncate">
                                    {a.patients?.last_name}
                                  </p>
                                  <p className="text-[9px] opacity-80 leading-tight">
                                    {startStr}{endStr ? `–${endStr}` : ""}
                                  </p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[200px]">
                                <p className="font-semibold">{a.patients?.last_name}, {a.patients?.first_name}</p>
                                <p className="text-xs">{TYPE_MAP[a.type]} · {startStr}{endStr ? ` — ${endStr}` : ""}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <NewAppointmentDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        userId={user!.id}
        onSaved={fetchAppointments}
        existingAppointments={appointments.filter(a => a.status === "scheduled")}
      />

      <AlertDialog open={!!cancelId} onOpenChange={open => { if (!open) setCancelId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar turno?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar turno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rescheduleAppt && (
        <RescheduleDialog appt={rescheduleAppt} onClose={() => setRescheduleAppt(null)} onSaved={fetchAppointments} />
      )}
    </div>
  );
}

/* ────────────────────── Reschedule Dialog ────────────────────── */

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
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────── New Appointment Dialog ────────────────────── */

function NewAppointmentDialog({
  open, onClose, userId, onSaved, existingAppointments,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSaved: () => void;
  existingAppointments: any[];
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

  // Fetch appointments for selected day
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

  // Timeline: 07:00–21:00, mark occupied 30-min slots
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

  // When picking end: would choosing this slot as end create an overlap with any existing appt?
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

  // Validate no overlap on save
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
      toast.error(`Conflicto con turno de ${conflict}`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      patient_id: selectedPatient.id,
      professional_id: userId,
      appointment_date: new Date(`${selectedDate}T${startTime}:00`).toISOString(),
      appointment_end: new Date(`${selectedDate}T${endTime}:00`).toISOString(),
      type: form.type,
      status: "scheduled",
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) { toast.error("Error al crear turno"); return; }
    toast.success("Turno agendado");
    setSelectedPatient(null); setSearchTerm(""); setSelectedDate("");
    setStartTime(""); setEndTime("");
    setForm({ type: "consultation", notes: "" });
    onSaved();
    onClose();
  };

  const canSave = !!selectedPatient && !!selectedDate && !!startTime && !!endTime;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo turno</DialogTitle></DialogHeader>
        <div className="space-y-4">

          {/* Patient */}
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

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Fecha *</Label>
            <Input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setStartTime(""); setEndTime(""); }} />
          </div>

          {/* Time inputs */}
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
                // When picking start: show 07:00–20:30
                // When picking end: show startTime+30min → 21:00 (first slot = earliest end)
                const pickingEnd = !!startTime && !endTime;
                const startMin = startTime ? timeToMin(startTime) : HOUR_START * 60;
                const visibleSlots = allSlots;

                const hoursInRange: string[] = [];
                for (let h = HOUR_START; h <= HOUR_END; h++) {
                  hoursInRange.push(String(h).padStart(2, "0"));
                }

                return (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        {pickingEnd ? "Seleccioná la hora de fin" : startTime ? "Turno marcado — ajustá si querés" : "Seleccioná la hora de inicio"}
                      </Label>
                      {startTime && (
                        <button onClick={() => { setStartTime(""); setEndTime(""); }} className="text-[10px] text-muted-foreground hover:text-foreground underline">
                          Limpiar
                        </button>
                      )}
                    </div>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="flex h-8 bg-muted/30">
                        {visibleSlots.map(slot => {
                          const slotMin = timeToMin(slot);
                          const tooEarlyForEnd = pickingEnd && slotMin <= startMin;
                          const occupied = !tooEarlyForEnd && isOccupied(slot);
                          const conflict = pickingEnd && !tooEarlyForEnd ? wouldEndConflict(slot) : null;
                          const blocked = tooEarlyForEnd || occupied || !!conflict;
                          const isSelected = pickingEnd ? slot === endTime : slot === startTime;
                          const isInRange = !pickingEnd && startTime && endTime &&
                            slotMin >= timeToMin(startTime) && slotMin < timeToMin(endTime);
                          const tooltipMsg = tooEarlyForEnd ? "" :
                            occupied ? `${slot} — ocupado (${occupied})` :
                            conflict ? `${slot} — conflicto con ${conflict}` : slot;
                          return (
                            <TooltipProvider key={slot}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (blocked) {
                                        if (!tooEarlyForEnd) toast.warning(`Conflicto con ${occupied || conflict}`);
                                        return;
                                      }
                                      if (pickingEnd) { setEndTime(slot); return; }
                                      setStartTime(slot); setEndTime("");
                                    }}
                                    className={cn(
                                      "flex-1 h-full border-r border-border/50 last:border-r-0 transition-colors",
                                      tooEarlyForEnd ? "bg-muted/40 cursor-not-allowed" :
                                      occupied || conflict ? "bg-destructive/25 cursor-not-allowed" :
                                      isSelected ? "bg-primary/60" :
                                      isInRange ? "bg-primary/25" :
                                      "hover:bg-primary/10 cursor-pointer"
                                    )}
                                  />
                                </TooltipTrigger>
                                {tooltipMsg && (
                                  <TooltipContent><p className="text-xs">{tooltipMsg}</p></TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                      {/* Hour labels */}
                      <div className="flex bg-muted/10 px-0">
                        {hoursInRange.map(h => (
                          <div key={h} className="flex-1 text-center">
                            <span className="text-[9px] text-muted-foreground">{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {dayAppts.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {dayAppts.map(a => (
                    <span key={a.id} className="text-[10px] bg-destructive/10 text-destructive rounded px-1.5 py-0.5">
                      {format(parseISO(a.appointment_date), "HH:mm")}
                      {a.appointment_end && `–${format(parseISO(a.appointment_end), "HH:mm")}`} {a.patients?.last_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Type */}
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

          {/* Notes */}
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
  );
}
