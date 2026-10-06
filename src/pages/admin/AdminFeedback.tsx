import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";

interface FeedbackRow {
  id: string;
  user_id: string;
  route: string | null;
  message: string;
  created_at: string;
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

  useEffect(() => {
    supabase
      .from("feedback")
      .select("id, user_id, route, message, created_at")
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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-semibold text-foreground">Feedback</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Reportes y sugerencias enviados desde la app (últimos 200)
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Todavía no hay feedback.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Fecha/hora</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Pantalla</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Mensaje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
