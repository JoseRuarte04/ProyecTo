import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCheck, Calendar, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Stats {
  total_therapists: number;
  total_patients: number;
  sessions_this_week: number;
  total_teams: number;
}

const statCards = [
  { key: "total_therapists",   label: "Terapistas activos",  icon: UserCheck,  color: "text-green-600"  },
  { key: "total_patients",     label: "Pacientes totales",    icon: Users,      color: "text-blue-600"   },
  { key: "sessions_this_week", label: "Sesiones esta semana", icon: Calendar,   color: "text-purple-600" },
  { key: "total_teams",        label: "Equipos activos",      icon: Building2,  color: "text-orange-600" },
] as const;

export default function AdminDashboard() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("admin_get_stats").then(({ data, error }) => {
      if (error) setError("Error al cargar estadísticas");
      else setStats(data as unknown as Stats);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl font-semibold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Vista global del sistema</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {loading ? "—" : (stats?.[key] ?? 0)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
