import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link2, ClipboardCopy, Check, Loader2, X, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, addHours } from "date-fns";
import { es } from "date-fns/locale";

interface TokenRow {
  id: string;
  token: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

interface Props {
  planId: string;
  patientId: string;
}

const EXPIRY_OPTIONS = [
  { label: "24 hs",  hours: 24  },
  { label: "48 hs",  hours: 48  },
  { label: "72 hs",  hours: 72  },
  { label: "7 días", hours: 168 },
];

function tokenStatus(t: TokenRow): "active" | "expired" | "revoked" {
  if (t.revoked_at) return "revoked";
  if (new Date(t.expires_at) < new Date()) return "expired";
  return "active";
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:  { label: "Activo",   className: "bg-success/10 text-success border-success/20" },
  expired: { label: "Expirado", className: "bg-muted text-muted-foreground border-border" },
  revoked: { label: "Revocado", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function ExercisePlanLinkManager({ planId, patientId }: Props) {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedHours, setSelectedHours] = useState(48);
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<TokenRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchTokens = async () => {
    const { data } = await supabase
      .from("exercise_plan_tokens")
      .select("id, token, created_at, expires_at, revoked_at")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false })
      .limit(10);
    setTokens(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTokens(); }, [planId]);

  const handleGenerate = async () => {
    setGenerating(true);
    const expiresAt = useCustomDate && customDate
      ? new Date(customDate)
      : addHours(new Date(), selectedHours);

    const { data: newToken, error } = await supabase.rpc("create_exercise_plan_token", {
      p_plan_id:    planId,
      p_patient_id: patientId,
      p_expires_at: expiresAt.toISOString(),
    });

    setGenerating(false);
    if (error || !newToken) { toast.error("No se pudo generar el link"); return; }
    toast.success("Link generado");
    setShowGenerator(false);
    setUseCustomDate(false);
    setCustomDate("");
    await fetchTokens();
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const { error } = await supabase
      .from("exercise_plan_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", revokeTarget.id);
    setRevoking(false);
    if (error) { toast.error("Error al revocar el link"); return; }
    toast.success("Link revocado");
    setRevokeTarget(null);
    await fetchTokens();
  };

  const copyUrl = async (t: TokenRow) => {
    const url = `${window.location.origin}/plan/${t.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeToken = tokens.find((t) => tokenStatus(t) === "active");

  return (
    <div className="dashboard-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted">
        <div className="flex items-center gap-2.5">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Links compartibles</h3>
        </div>
        {!showGenerator && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowGenerator(true)}>
            <Link2 className="h-3.5 w-3.5" />
            {activeToken ? "Nuevo link" : "Generar link"}
          </Button>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* ── Generador inline ── */}
        {showGenerator && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Vencimiento del link</p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowGenerator(false); setUseCustomDate(false); setCustomDate(""); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {activeToken && (
              <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>El link activo actual quedará revocado automáticamente al generar uno nuevo.</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.hours}
                  type="button"
                  onClick={() => { setSelectedHours(opt.hours); setUseCustomDate(false); }}
                  className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                    !useCustomDate && selectedHours === opt.hours
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUseCustomDate(true)}
                className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                  useCustomDate
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/60"
                }`}
              >
                Fecha personalizada
              </button>
            </div>
            {useCustomDate && (
              <input
                type="datetime-local"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="text-xs rounded-md border border-border bg-background px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}
            <Button
              size="sm"
              className="gap-1.5"
              disabled={generating || (useCustomDate && !customDate)}
              onClick={handleGenerate}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              {generating ? "Generando..." : "Generar link"}
            </Button>
          </div>
        )}

        {/* ── Lista de tokens ── */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No hay links generados todavía.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => {
              const st = tokenStatus(t);
              const badge = STATUS_BADGE[st];
              const url = `${window.location.origin}/plan/${t.token}`;
              const expiresAt = new Date(t.expires_at);
              const isCopied = copiedId === t.id;

              return (
                <div key={t.id} className="rounded-lg border border-border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${badge.className}`}>
                        {badge.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Creado {format(new Date(t.created_at), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {st === "active"
                        ? `Vence ${formatDistanceToNow(expiresAt, { locale: es, addSuffix: true })}`
                        : `Venció ${format(expiresAt, "d MMM yyyy", { locale: es })}`
                      }
                    </div>
                  </div>

                  {/* URL copiable solo si activo */}
                  {st === "active" && (
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={url}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 min-w-0 text-xs rounded-md border border-border bg-muted/40 px-3 py-1.5 text-muted-foreground focus:outline-none truncate"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className={`shrink-0 h-7 text-xs gap-1.5 transition-colors ${isCopied ? "border-success text-success" : ""}`}
                        onClick={() => copyUrl(t)}
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                        {isCopied ? "Copiado" : "Copiar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setRevokeTarget(t)}
                      >
                        Revocar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm revoke */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocar link</AlertDialogTitle>
            <AlertDialogDescription>
              El paciente no podrá acceder más con este link. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Revocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
