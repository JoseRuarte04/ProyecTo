import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Users, UserCheck, Calendar, Building2,
  TrendingUp, TrendingDown, Minus,
  UserPlus, Plus, RefreshCw, Loader2, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { InviteTherapistDialog } from "@/components/admin/InviteTherapistDialog";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Stats {
  total_therapists: number;
  total_patients: number;
  sessions_this_week: number;
  total_teams: number;
}

interface Trends {
  therapists_this_week: number;
  therapists_last_week: number;
  patients_this_week: number;
  patients_last_week: number;
  sessions_this_week: number;
  sessions_last_week: number;
}

interface MonthlySession {
  month: string;
  session_count: number;
}

interface ActiveTeam {
  team_id: string;
  team_name: string;
  session_count: number;
  patient_count: number;
  member_count: number;
}

interface StaleInvitation {
  invitation_id: string;
  team_id: string;
  team_name: string;
  email: string;
  invited_by_name: string;
  created_at: string;
  days_pending: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff > 0) return (
    <span className="flex items-center gap-0.5 text-[11px] font-medium text-green-600">
      <TrendingUp className="h-3 w-3" />+{diff} esta semana
    </span>
  );
  if (diff < 0) return (
    <span className="flex items-center gap-0.5 text-[11px] font-medium text-destructive">
      <TrendingDown className="h-3 w-3" />{diff} esta semana
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
      <Minus className="h-3 w-3" />Sin cambios
    </span>
  );
}

const chartConfig = {
  session_count: { label: "Sesiones", color: "hsl(var(--primary))" },
};

// ── Componente principal ─────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats]           = useState<Stats | null>(null);
  const [trends, setTrends]         = useState<Trends | null>(null);
  const [monthly, setMonthly]       = useState<MonthlySession[]>([]);
  const [activeTeams, setActiveTeams] = useState<ActiveTeam[]>([]);
  const [staleInvitations, setStaleInvitations] = useState<StaleInvitation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resending, setResending]   = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    const [statsRes, trendsRes, monthlyRes, teamsRes, invRes] = await Promise.all([
      supabase.rpc("admin_get_stats"),
      supabase.rpc("admin_get_trends"),
      supabase.rpc("admin_get_monthly_sessions"),
      supabase.rpc("admin_get_active_teams"),
      supabase.rpc("admin_get_stale_invitations", { p_days: 7 }),
    ]);
    if (statsRes.data)  setStats(statsRes.data as unknown as Stats);
    if (trendsRes.data) setTrends(trendsRes.data as unknown as Trends);
    if (monthlyRes.data) setMonthly(monthlyRes.data as unknown as MonthlySession[]);
    if (teamsRes.data)  setActiveTeams(teamsRes.data as unknown as ActiveTeam[]);
    if (invRes.data)    setStaleInvitations(invRes.data as unknown as StaleInvitation[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleResend = async (invId: string, email: string) => {
    setResending(invId);
    const { error } = await supabase.rpc("resend_invitation", { p_invitation_id: invId });
    setResending(null);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success(`Invitación reenviada a ${email}`);
    loadAll();
  };

  const statCards = [
    {
      key: "total_therapists" as const,
      label: "Terapistas activos",
      icon: UserCheck,
      color: "text-green-600",
      trendKey: "therapists" as const,
    },
    {
      key: "total_patients" as const,
      label: "Pacientes totales",
      icon: Users,
      color: "text-blue-600",
      trendKey: "patients" as const,
    },
    {
      key: "sessions_this_week" as const,
      label: "Sesiones esta semana",
      icon: Calendar,
      color: "text-purple-600",
      trendKey: "sessions" as const,
    },
    {
      key: "total_teams" as const,
      label: "Equipos activos",
      icon: Building2,
      color: "text-orange-600",
      trendKey: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado con accesos rápidos */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Vista global del sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => navigate("/admin/teams")}>
            <Plus className="h-3.5 w-3.5" /> Nuevo equipo
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Invitar terapista
          </Button>
        </div>
      </div>

      {/* Stats con tendencia semanal */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ key, label, icon: Icon, color, trendKey }) => (
          <Card key={key}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground mb-1.5">
                {loading ? "—" : (stats?.[key] ?? 0)}
              </p>
              {trendKey && trends && !loading && (
                <DeltaBadge
                  current={trends[`${trendKey}_this_week`]}
                  previous={trends[`${trendKey}_last_week`]}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fila: gráfico + equipos activos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de sesiones por mes */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Sesiones por mes</CardTitle>
            <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted))" }} />
                    <Bar dataKey="session_count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Equipos más activos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Equipos más activos</CardTitle>
            <p className="text-xs text-muted-foreground">Últimos 30 días</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activeTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin equipos activos.</p>
            ) : (
              <div className="space-y-3">
                {activeTeams.map((t) => (
                  <div
                    key={t.team_id}
                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/40 -mx-2 px-2 py-1.5 rounded-md transition-colors"
                    onClick={() => navigate(`/admin/teams/${t.team_id}`)}
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.team_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.patient_count} pac. · {t.member_count} miembros
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-primary shrink-0">{t.session_count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invitaciones pendientes vencidas */}
      {!loading && staleInvitations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  Invitaciones sin aceptar
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Pendientes hace más de 7 días</p>
              </div>
              <Badge variant="secondary" className="text-[11px]">{staleInvitations.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {staleInvitations.map((inv) => (
                <div key={inv.invitation_id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Equipo: {inv.team_name} · {inv.days_pending} días pendiente
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 shrink-0"
                    disabled={resending === inv.invitation_id}
                    onClick={() => handleResend(inv.invitation_id, inv.email)}
                  >
                    {resending === inv.invitation_id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RefreshCw className="h-3 w-3" />}
                    Reenviar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <InviteTherapistDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={loadAll}
      />
    </div>
  );
}
