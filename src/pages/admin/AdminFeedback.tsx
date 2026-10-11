import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Loader2, Eye, CheckCircle2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FeedbackStatus = "new" | "seen" | "resolved";

interface FeedbackRow {
  id: string;
  user_id: string;
  route: string | null;
  message: string;
  created_at: string;
  status: FeedbackStatus;
}

type TabKey = "all" | FeedbackStatus;

function StatusBadge({ status }: { status: FeedbackStatus }) {
  if (status === "resolved")
    return <Badge className="text-[11px] bg-green-100 text-green-700 border border-green-200 hover:bg-green-100">Resuelto</Badge>;
  if (status === "seen")
    return <Badge className="text-[11px] bg-yellow-100 text-yellow-700 border border-yellow-200 hover:bg-yellow-100">Visto</Badge>;
  return <Badge variant="secondary" className="text-[11px]">Nuevo</Badge>;
}

// Mismo patrón que AdminActivity.tsx (lista simple, sin acciones) — a diferencia
// de ahí, no hay una RPC con el join ya hecho, así que se resuelve el nombre del
// usuario con una segunda consulta a profiles (is_super_admin() ya puede leer
// cualquier perfil, ver "profiles: ver compañeros de equipo").
export default function AdminFeedback() {
  const [rows, setRows]       = useState<FeedbackRow[]>([]);
  const [names, setNames]     = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tab, setTab]         = useState<TabKey>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("feedback")
      .select("id, user_id, route, message, created_at, status")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(async ({ data, error }) => {
        if (error) {
          setError("Error al cargar feedback");
          setLoading(false);
          return;
        }
        const feedbackRows = (data as FeedbackRow[]) || [];
        setRows(feedbackRows);

        const userIds = [...new Set(feedbackRows.map((r) => r.user_id))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds);
          const map: Record<string, string> = {};
          (profiles || []).forEach((p) => {
            map[p.id] = p.full_name || p.email;
          });
          setNames(map);
        }
        setLoading(false);
      });
  }, []);

  const handleUpdateStatus = async (id: string, status: FeedbackStatus) => {
    setUpdatingId(id);
    const { error } = await supabase.rpc("admin_update_feedback_status", {
      p_feedback_id: id,
      p_status: status,
    });
    setUpdatingId(null);
    if (error) { toast.error("Error: " + error.message); return; }
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  const filtered = tab === "all" ? rows : rows.filter((r) => r.status === tab);
  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "new", label: "Nuevo" },
    { key: "seen", label: "Visto" },
    { key: "resolved", label: "Resuelto" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-semibold text-foreground">Feedback</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Reportes y sugerencias enviados desde la app (últimos 200)
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.key !== "all" && (
              <span className="ml-1.5 text-[11px] text-muted-foreground">
                ({rows.filter((r) => r.status === t.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          {tab === "all" ? "Todavía no hay feedback." : "No hay feedback en este estado."}
        </p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Fecha/hora</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Pantalla</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Mensaje</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                    {format(parseISO(r.created_at), "dd/MM/yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-3 text-foreground hidden md:table-cell">
                    {names[r.user_id] || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs font-mono">
                    {r.route || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground max-w-md">
                    {r.message}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== "seen" && (
                        <Button
                          variant="ghost" size="sm" className="h-7 text-[11px] gap-1"
                          disabled={updatingId === r.id}
                          onClick={() => handleUpdateStatus(r.id, "seen")}
                        >
                          <Eye className="h-3.5 w-3.5" /> Visto
                        </Button>
                      )}
                      {r.status !== "resolved" && (
                        <Button
                          variant="ghost" size="sm" className="h-7 text-[11px] gap-1"
                          disabled={updatingId === r.id}
                          onClick={() => handleUpdateStatus(r.id, "resolved")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Resolver
                        </Button>
                      )}
                      {r.status !== "new" && (
                        <Button
                          variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-muted-foreground"
                          disabled={updatingId === r.id}
                          onClick={() => handleUpdateStatus(r.id, "new")}
                        >
                          {updatingId === r.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RotateCcw className="h-3.5 w-3.5" />}
                          Reabrir
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
