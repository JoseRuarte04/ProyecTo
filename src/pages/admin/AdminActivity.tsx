import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ActivityRow {
  id: string;
  action: string;
  table_name: string;
  description: string | null;
  created_at: string;
  performed_by: string | null;
  full_name: string | null;
  email: string | null;
}

function ActionBadge({ action }: { action: string }) {
  if (action === "insert")
    return <Badge className="text-[11px] bg-green-100 text-green-700 border border-green-200 hover:bg-green-100">Alta</Badge>;
  if (action === "update")
    return <Badge className="text-[11px] bg-yellow-100 text-yellow-700 border border-yellow-200 hover:bg-yellow-100">Edición</Badge>;
  if (action === "delete" || action === "soft_delete")
    return <Badge className="text-[11px] bg-red-100 text-red-700 border border-red-200 hover:bg-red-100">Baja</Badge>;
  return <Badge variant="secondary" className="text-[11px]">{action}</Badge>;
}

export default function AdminActivity() {
  const [rows, setRows]       = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("admin_get_activity").then(({ data, error }) => {
      if (error) setError("Error al cargar actividad");
      else setRows((data as unknown as ActivityRow[]) || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-semibold text-foreground">Actividad</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Últimos 100 eventos del sistema</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Sin actividad registrada.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Fecha/hora</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Terapista</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Acción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Tabla</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                    {format(parseISO(r.created_at), "dd/MM/yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-3 text-foreground hidden md:table-cell">
                    {r.full_name || r.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ActionBadge action={r.action} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs font-mono">
                    {r.table_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {r.description || "—"}
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
