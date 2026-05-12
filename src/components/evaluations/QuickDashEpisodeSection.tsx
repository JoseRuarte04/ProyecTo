import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  QuickDashSection,
  calcQuickDashScore,
  emptyQuickDash,
} from "@/components/evaluations/FunctionalScales";
import {
  Link2, ClipboardCopy, Check, Clock, UserCheck, PencilLine, X, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, addHours, format } from "date-fns";
import { es } from "date-fns/locale";

// ── Types ──

type HistoryEntry = {
  id: string;
  completed_at: string;
  completed_by: "patient" | "therapist";
  result: { items: number[]; score: number };
};

type ActiveToken = {
  id: string;
  token: string;
  expires_at: string;
};

type Mode = "loading" | "view" | "generating" | "pending" | "manual";

interface QuickDashEpisodeSectionProps {
  episodeId: string;
  patientId: string;
}

// ── Constants ──

const EXPIRY_OPTIONS = [
  { label: "24 hs",  hours: 24  },
  { label: "48 hs",  hours: 48  },
  { label: "72 hs",  hours: 72  },
  { label: "7 días", hours: 168 },
];

const TOKEN_SELECT = "id, token, expires_at, completed_at, completed_by, result";

// ── Component ──

export function QuickDashEpisodeSection({ episodeId, patientId }: QuickDashEpisodeSectionProps) {
  const { user } = useAuth();

  const [mode, setMode]                   = useState<Mode>("loading");
  const [history, setHistory]             = useState<HistoryEntry[]>([]);
  const [activeToken, setActiveToken]     = useState<ActiveToken | null>(null);
  const [manualItems, setManualItems]     = useState<(number | null)[]>(emptyQuickDash());
  const [selectedHours, setSelectedHours] = useState(48);
  const [customDate, setCustomDate]       = useState("");
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [copied, setCopied]               = useState(false);
  const [busy, setBusy]                   = useState(false);

  const tokenUrl = activeToken
    ? `${window.location.origin}/q/${activeToken.token}`
    : "";

  // ── Data fetch ──

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("quickdash_tokens")
      .select(TOKEN_SELECT)
      .eq("episode_id", episodeId)
      .order("created_at", { ascending: false });

    if (!data) { setMode("view"); return; }

    const completed = data.filter((r) => r.completed_at !== null && r.result !== null) as HistoryEntry[];
    const pending   = data.find(
      (r) => !r.completed_at && new Date(r.expires_at) > new Date()
    ) as ActiveToken | undefined;

    setHistory(completed);
    setActiveToken(pending ?? null);
    setMode(pending ? "pending" : "view");
  }, [episodeId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Poll pending token (cada 15s) ──

  useEffect(() => {
    if (mode !== "pending" || !activeToken) return;
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("quickdash_tokens")
        .select("id, completed_at, completed_by")
        .eq("id", activeToken.id)
        .maybeSingle();
      if (data?.completed_at) {
        await loadData();
        if (data.completed_by === "patient") {
          toast.success("El paciente completó el QuickDASH.");
        }
      }
    }, 15_000);
    return () => clearInterval(poll);
  }, [mode, activeToken?.id, loadData]);

  // ── Handlers ──

  async function handleGenerateLink() {
    setBusy(true);
    const expiresAt = useCustomDate && customDate
      ? new Date(customDate)
      : addHours(new Date(), selectedHours);

    const { data: newToken, error } = await supabase.rpc("create_quickdash_token", {
      p_episode_id: episodeId,
      p_patient_id: patientId,
      p_expires_at: expiresAt.toISOString(),
    });

    if (error || !newToken) {
      toast.error("No se pudo generar el link. Intentá de nuevo.");
      setBusy(false);
      return;
    }

    const { data: row } = await supabase
      .from("quickdash_tokens")
      .select("id, token, expires_at")
      .eq("token", newToken)
      .single();

    setActiveToken(row as ActiveToken);
    setMode("pending");
    setBusy(false);
  }

  async function handleCancelToken() {
    if (!activeToken) return;
    setBusy(true);
    await supabase
      .from("quickdash_tokens")
      .update({ completed_at: new Date().toISOString(), completed_by: "therapist" })
      .eq("id", activeToken.id);
    await loadData();
    setBusy(false);
  }

  async function handleSaveManual() {
    const score = calcQuickDashScore(manualItems);
    if (score === null) {
      toast.error("Completá todas las preguntas antes de guardar.");
      return;
    }
    setBusy(true);

    if (activeToken) {
      await supabase
        .from("quickdash_tokens")
        .update({ completed_at: new Date().toISOString(), completed_by: "therapist" })
        .eq("id", activeToken.id);
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("quickdash_tokens").insert({
      patient_id:   patientId,
      episode_id:   episodeId,
      created_by:   user!.id,
      expires_at:   now,
      completed_at: now,
      completed_by: "therapist",
      result:       { items: manualItems, score },
    });

    if (error) {
      toast.error("No se pudo guardar. Intentá de nuevo.");
      setBusy(false);
      return;
    }

    toast.success("QuickDASH guardado.");
    setManualItems(emptyQuickDash());
    await loadData();
    setBusy(false);
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(tokenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render helpers ──

  function renderPendingBanner() {
    if (!activeToken) return null;
    const expiresAt = new Date(activeToken.expires_at);
    const timeLeft  = formatDistanceToNow(expiresAt, { locale: es, addSuffix: true });

    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">Link activo</span>
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 text-[10px]">
              Esperando respuesta
            </Badge>
          </div>
          <span className="text-xs text-amber-600">Vence {timeLeft}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={tokenUrl}
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 text-xs rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-600 focus:outline-none truncate"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`shrink-0 gap-1.5 transition-colors ${copied ? "border-teal-500 bg-teal-50 text-teal-700" : ""}`}
            onClick={copyUrl}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
            disabled={busy}
            onClick={handleCancelToken}
            title="Cancelar link"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <p className="text-xs text-amber-700">
          Compartí este link con tu paciente. Se actualizará automáticamente cuando responda.
        </p>
      </div>
    );
  }

  function renderHistory() {
    if (history.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-6">
          Sin registros de QuickDASH para este episodio.
        </p>
      );
    }
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2 bg-muted border-b border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Historial del episodio</p>
        </div>
        <div className="divide-y divide-border">
          {history.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(entry.completed_at), "dd/MM/yyyy", { locale: es })}
                </span>
                {entry.completed_by === "patient"
                  ? (
                    <Badge className="bg-teal-100 text-teal-700 border border-teal-200 hover:bg-teal-100 text-[10px] gap-1">
                      <UserCheck className="h-2.5 w-2.5" />Paciente
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Terapeuta</Badge>
                  )
                }
              </div>
              <span className="text-sm font-semibold text-gray-700">
                {entry.result.score}
                <span className="text-xs font-normal text-muted-foreground">/100</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderActionButtons() {
    return (
      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50"
          disabled={mode === "pending"}
          onClick={() => setMode("generating")}
          title={mode === "pending" ? "Ya hay un link activo" : undefined}
        >
          <Link2 className="h-3.5 w-3.5" />
          {mode === "pending" ? "Link activo" : "Enviar link al paciente"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setMode("manual")}
        >
          <PencilLine className="h-3.5 w-3.5" />
          Cargar manualmente
        </Button>
      </div>
    );
  }

  // ── Render ──

  if (mode === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando QuickDASH...
      </div>
    );
  }

  if (mode === "generating") {
    return (
      <div className="rounded-lg border border-teal-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Generar link para el paciente</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMode("view")}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Vencimiento del link:</p>
          <div className="flex flex-wrap gap-2">
            {EXPIRY_OPTIONS.map((opt) => (
              <button
                key={opt.hours}
                type="button"
                onClick={() => { setSelectedHours(opt.hours); setUseCustomDate(false); }}
                className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                  !useCustomDate && selectedHours === opt.hours
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-gray-200 text-gray-600 hover:border-teal-200 hover:bg-gray-50"
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
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-gray-200 text-gray-600 hover:border-teal-200 hover:bg-gray-50"
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
              className="text-xs rounded-md border border-gray-200 px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          )}
        </div>

        <Button
          type="button"
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
          disabled={busy || (useCustomDate && !customDate)}
          onClick={handleGenerateLink}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          {busy ? "Generando..." : "Generar link"}
        </Button>
      </div>
    );
  }

  if (mode === "manual") {
    const score       = calcQuickDashScore(manualItems);
    const allAnswered = manualItems.every((v) => v !== null);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Carga manual de QuickDASH</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => { setManualItems(emptyQuickDash()); setMode("view"); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <QuickDashSection items={manualItems} onChange={setManualItems} />
        <Button
          type="button"
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
          disabled={!allAnswered || busy}
          onClick={handleSaveManual}
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {allAnswered && score !== null
            ? `Guardar QuickDASH (${score.toFixed(0)}/100)`
            : "Guardar QuickDASH"}
        </Button>
      </div>
    );
  }

  // view / pending
  const lastScore = history[0]?.result?.score ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">QuickDASH</span>
        {lastScore !== null && (
          <Badge className="bg-teal-600 text-white border-0 hover:bg-teal-600 text-[10px]">
            Último: {lastScore}/100
          </Badge>
        )}
      </div>
      {renderPendingBanner()}
      {renderHistory()}
      {renderActionButtons()}
    </div>
  );
}
