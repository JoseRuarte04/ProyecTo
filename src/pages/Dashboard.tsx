import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Search, Plus, CalendarCheck, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay, addDays, subDays, differenceInYears, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Activo", cls: "status-active" },
    paused: { label: "Pausado", cls: "status-paused" },
    discharged: { label: "Alta", cls: "status-discharged" },
    scheduled: { label: "Programado", cls: "status-scheduled" },
    completed: { label: "Completado", cls: "status-completed" },
    cancelled: { label: "Cancelado", cls: "status-cancelled" },
    confirmed: { label: "Confirmado", cls: "status-completed" },
    pending: { label: "Pendiente", cls: "status-paused" },
  };
  const s = map[status] || { label: status, cls: "" };
  return <Badge variant="outline" className={`${s.cls} text-xs font-medium px-2.5 py-0.5 rounded-full`}>{s.label}</Badge>;
}

export { StatusBadge };

const appointmentTypeMap: Record<string, string> = {
  consultation: "Consulta",
  follow_up: "Seguimiento",
  evaluation: "Evaluación",
  admission: "Admisión",
  discharge: "Alta",
};

// Color stripe por tipo de turno (3px izquierda)
const typeStripeClass: Record<string, string> = {
  admission: "bg-[hsl(192,35%,42%)]",
  follow_up: "bg-[hsl(210,65%,55%)]",
  evaluation: "bg-[hsl(38,90%,52%)]",
  discharge: "bg-[hsl(152,50%,45%)]",
  consultation: "bg-[hsl(0,0%,65%)]",
};

// Dot de estado (reemplaza el badge grande en la agenda)
function StatusDot({ status }: { status: string }) {
  const dotMap: Record<string, string> = {
    active: "bg-emerald-500",
    scheduled: "bg-blue-400",
    confirmed: "bg-emerald-500",
    pending: "bg-amber-400",
    paused: "bg-amber-400",
    cancelled: "bg-red-400",
    completed: "bg-slate-400",
    discharged: "bg-slate-400",
  };
  const labelMap: Record<string, string> = {
    active: "Activo", scheduled: "Programado", confirmed: "Confirmado",
    pending: "Pendiente", paused: "Pausado", cancelled: "Cancelado",
    completed: "Completado", discharged: "Alta",
  };
  const cls = dotMap[status] || "bg-slate-300";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${cls} shrink-0`}
      title={labelMap[status] || status}
    />
  );
}

const sessionTypeMap: Record<string, string> = {
  admission: "Admisión",
  follow_up: "Seguimiento",
  discharge: "Alta",
};

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agendaDate, setAgendaDate] = useState(new Date());
  const [dayAppointments, setDayAppointments] = useState<any[]>([]);
  const [activePatients, setActivePatients] = useState<any[]>([]);
  const [activePatientsCount, setActivePatientsCount] = useState(0);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [stalePatients, setStalePatients] = useState<any[]>([]);

  useEffect(() => {
    fetchAgenda(agendaDate);
    fetchActivePatients();
    fetchRecentSessions();
    fetchStalePatients();
  }, []);

  useEffect(() => {
    fetchAgenda(agendaDate);
  }, [agendaDate]);

  const fetchAgenda = async (date: Date) => {
    const dayStart = startOfDay(date).toISOString();
    const dayEnd = endOfDay(date).toISOString();

    const { data } = await supabase
      .from("appointments")
      .select("id, appointment_date, appointment_end, type, status, notes, patients(id, first_name, last_name, birth_date)")
      .gte("appointment_date", dayStart)
      .lte("appointment_date", dayEnd)
      .order("appointment_date");

    setDayAppointments(data || []);
    setLoading(false);
  };

  const fetchActivePatients = async () => {
    const { data, count } = await supabase
      .from("patients")
      .select("id, first_name, last_name, admission_date", { count: "exact" })
      .eq("status", "active")
      .eq("is_deleted", false)
      .order("admission_date", { ascending: false })
      .limit(3);

    setActivePatients(data || []);
    setActivePatientsCount(count || 0);
  };

  const fetchRecentSessions = async () => {
    const { data } = await supabase
      .from("therapy_sessions")
      .select("id, session_date, session_type, session_number, patient_id, patients(first_name, last_name)")
      .eq("is_deleted", false)
      .order("session_date", { ascending: false })
      .limit(3);

    setRecentSessions(data || []);
  };

  const fetchStalePatients = async () => {
    const cutoff = subDays(new Date(), 14).toISOString().split("T")[0];

    // Pacientes con sesión reciente
    const { data: recentData } = await supabase
      .from("therapy_sessions")
      .select("patient_id")
      .gte("session_date", cutoff)
      .eq("is_deleted", false);

    const recentIds = [...new Set((recentData || []).map((r: any) => r.patient_id))];

    let query = supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("status", "active")
      .eq("is_deleted", false)
      .limit(4);

    if (recentIds.length > 0) {
      query = query.not("id", "in", `(${recentIds.join(",")})`);
    }

    const { data } = await query;
    setStalePatients(data || []);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = profile?.full_name?.split(" ")[0] || "";
  const now = new Date();
  const dateStr = format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const totalMinutes = dayAppointments.reduce((sum, a) => {
    const mins = a.appointment_end ? differenceInMinutes(new Date(a.appointment_end), new Date(a.appointment_date)) : 30;
    return sum + mins;
  }, 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const nextAppt = dayAppointments.find(a => new Date(a.appointment_date) >= now && a.status !== "cancelled");
  const nextTime = nextAppt ? format(new Date(nextAppt.appointment_date), "HH:mm") : null;
  const nextPatient = nextAppt?.patients ? `${nextAppt.patients.first_name} ${nextAppt.patients.last_name}` : null;

  const incompleteTodayCount = dayAppointments.filter(
    a => !["completed", "cancelled", "discharged"].includes(a.status)
  ).length;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <p className="field-label mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.1em' }}>{dateStr}</p>
        <h1 className="font-serif text-[1.75rem] font-normal text-foreground leading-tight tracking-tight">
          Buenos días, <span className="font-semibold">{firstName}</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-[14px] leading-relaxed">
          {dayAppointments.length} turno{dayAppointments.length !== 1 ? "s" : ""} hoy
          {nextTime && (
            <> · próximo a las <span className="font-semibold text-foreground">{nextTime}</span> con {nextPatient}</>
          )}
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2.5">
        <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => navigate("/patients")}>
          <Plus className="h-4 w-4" /> Nueva sesión
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/appointments")}>
          <CalendarCheck className="h-4 w-4" /> Nuevo turno
        </Button>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => navigate("/patients")}>
          <Search className="h-4 w-4" /> Buscar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        {/* Agenda principal */}
        <div className="dashboard-card p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Agenda del {format(agendaDate, "d/M/yyyy")}</h2>
              <p className="text-sm text-muted-foreground">
                {dayAppointments.length} turno{dayAppointments.length !== 1 ? "s" : ""}
                {totalMinutes > 0 && <> · {hours > 0 ? `${hours}h ` : ""}{mins > 0 ? `${mins}min` : ""}</>}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setAgendaDate(d => subDays(d, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => setAgendaDate(d => addDays(d, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {dayAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Sin turnos para este día.</p>
          ) : (
            <div className="divide-y divide-border">
              {dayAppointments.map((a) => {
                const time = format(new Date(a.appointment_date), "HH:mm");
                const dur = a.appointment_end ? differenceInMinutes(new Date(a.appointment_end), new Date(a.appointment_date)) : 30;
                const patient = a.patients;
                const age = patient?.birth_date ? differenceInYears(new Date(), new Date(patient.birth_date)) : null;
                const typeName = appointmentTypeMap[a.type] || a.type;
                const isNow = Math.abs(new Date(a.appointment_date).getTime() - now.getTime()) < 30 * 60 * 1000 && a.status !== "cancelled";
                const isCancelled = a.status === "cancelled";
                const isCompleted = a.status === "completed";
                const stripeClass = typeStripeClass[a.type] || "bg-slate-300";

                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-4 py-4 ${isCancelled ? "opacity-50" : ""} ${isCompleted ? "opacity-60" : ""}`}
                  >
                    {/* Franja de color por tipo */}
                    <div className={`w-[3px] self-stretch rounded-full shrink-0 ${stripeClass}`} />

                    <div className="w-14 shrink-0">
                      <p className={`text-sm font-bold tabular-nums font-mono ${isCancelled ? "line-through text-muted-foreground" : "text-foreground"}`}>{time}</p>
                      <p className="text-[10px] text-muted-foreground">{dur}min</p>
                    </div>

                    <div className="flex-1 min-w-0">
                      {patient ? (
                        <Link to={`/patients/${patient.id}`} className="hover:text-primary transition-colors">
                          <p className="font-medium text-sm text-foreground">{patient.last_name}, {patient.first_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {age !== null ? `${age} a` : ""}{age !== null && typeName ? " · " : ""}{typeName}
                          </p>
                        </Link>
                      ) : (
                        <p className="text-sm text-muted-foreground">Paciente no asignado</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isNow && <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Ahora</span>}
                      {isCompleted && <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Completado</span>}
                      <StatusDot status={a.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div className="space-y-5">
          {/* Pacientes activos */}
          <div className="dashboard-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground text-sm">Pacientes activos</h3>
              <span className="text-xs text-muted-foreground tabular-nums">{activePatientsCount}</span>
            </div>
            {activePatients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pacientes activos.</p>
            ) : (
              <div className="space-y-2.5">
                {activePatients.map((p) => (
                  <Link key={p.id} to={`/patients/${p.id}`} className="flex items-center justify-between group">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {p.last_name}, {p.first_name}
                    </p>
                    {p.admission_date && (
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                        {format(new Date(p.admission_date + "T12:00:00"), "dd/MM")}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
            <Link to="/patients" className="block mt-3 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              Ver todos →
            </Link>
          </div>

          {/* Últimas sesiones */}
          <div className="dashboard-card p-5">
            <h3 className="font-semibold text-foreground mb-3 text-sm">Últimas sesiones</h3>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin sesiones registradas.</p>
            ) : (
              <div className="space-y-2.5">
                {recentSessions.map((s) => {
                  const patient = s.patients;
                  const typeName = sessionTypeMap[s.session_type] || s.session_type;
                  return (
                    <Link key={s.id} to={`/patients/${s.patient_id}`} className="flex items-center justify-between group">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {patient?.last_name}, {patient?.first_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{typeName}</p>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                        {format(new Date(s.session_date + "T12:00:00"), "dd/MM")}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pendientes */}
          <div className="dashboard-card p-5">
            <h3 className="font-semibold text-foreground mb-3 text-sm">Pendientes</h3>
            <div className="space-y-3">
              {/* Turnos de hoy sin completar */}
              <div className="flex items-start gap-2.5">
                <Clock className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-foreground">
                    {incompleteTodayCount > 0
                      ? <><span className="font-semibold">{incompleteTodayCount}</span> turno{incompleteTodayCount !== 1 ? "s" : ""} sin completar hoy</>
                      : "Todos los turnos de hoy completados"
                    }
                  </p>
                </div>
              </div>

              {/* Pacientes sin sesión en >14 días */}
              {stalePatients.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Sin sesión en +14 días</p>
                    <div className="space-y-1">
                      {stalePatients.map(p => (
                        <Link key={p.id} to={`/patients/${p.id}`} className="block text-sm text-foreground hover:text-primary transition-colors">
                          {p.last_name}, {p.first_name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {stalePatients.length === 0 && incompleteTodayCount === 0 && (
                <p className="text-xs text-muted-foreground">Sin pendientes.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
