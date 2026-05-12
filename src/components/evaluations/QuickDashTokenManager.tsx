import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuickDashSection } from "@/components/evaluations/FunctionalScales";
import {
  Link2, ClipboardCopy, Check, Clock, CheckCircle2,
  UserCheck, PencilLine, X, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, addHours } from "date-fns";
import { es } from "date-fns/locale";

// ── Types ──

type TokenRow = {
  id: string;
  token: string;
  expires_at: string;
  completed_at: string | null;
  completed_by: "patient" | "therapist" | null;
  result: { items: number[]; score: number } | null;
};

type ManagerMode =
  | "loading"
  | "idle"
  | "generating"
  | "pending"
  | "patient_completed"
  | "manual";

interface QuickDashTokenManagerProps {
  episodeId: string;
  patientId: string;
  items: (number | null)[];
  onChange: (items: (number | null)[]) => void;
}

// ── Constants ──

const EXPIRY_OPTIONS = [
  { label: "24 hs",  hours: 24  },
  { label: "48 hs",  hours: 48  },
  { label: "72 hs",  hours: 72  },
  { label: "7 días", hours: 168 },
];

const TOKEN_SELECT = "id, token, expires_at, completed_at, completed_by, result";

// ── Helper ──

function deriveInitialMode(
  token: TokenRow | null,
  items: (number | null)[]
): ManagerMode {
  const hasItems = items.some((v) => v !== null);
  if (!token) return hasItems ? "manual" : "idle";

  const expired = new Date(token.expires_at) < new Date();
  if (token.completed_at && token.completed_by === "patient") return "patient_completed";
  if (!token.completed_at && !expired) return "pending";
  return hasItems ? "manual" : "idle";
}

// ── Component ──

export function QuickDashTokenManager({
  episodeId,
  patientId,
  items,
  onChange,
}: QuickDashTokenManagerProps) {
  const [mode, setMode]               = useState<ManagerMode>("loading");
  const [tokenData, setTokenData]     = useState<TokenRow | null>(null);
  const [selectedHours, setSelectedHours] = useState(48);
  const [customDate, setCustomDate]   = useState("");
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [busy, setBusy]               = useState(false);

  const tokenUrl = tokenData
    ? `${window.location.origin}/q/${tokenData.token}`
    : "";

  // ── Initial fetch ──
  useEffect(() => {
    supabase
      .from("quickdash_tokens")
      .select(TOKEN_SELECT)
      .eq("episode_id", episodeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const token = data as TokenRow | null;
        setTokenData(token);
        setMode(deriveInitialMode(token, items));
      });
  // items only used at mount to determine initial mode — intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  // ── Poll when pending (cada 15s) ──
  useEffect(() => {
    if (mode !== "pending" || !tokenData) return;
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("quickdash_tokens")
        .select(TOKEN_SELECT)
        .eq("id", tokenData.id)
        .maybeSingle();
      if (data?.completed_at && data.completed_by === "patient") {
        setTokenData(data as TokenRow);
        setMode("patient_completed");
      }
    }, 15_000);
    return () => clearInterval(poll);
  }, [mode, tokenData?.id]);

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

    // Fetch full row to get the UUID we need for the URL
    const { data: fresh } = await supabase
      .from("quickdash_tokens")
      .select(TOKEN_SELECT)
      .eq("token", newToken)
      .single();

    setTokenData(fresh as TokenRow);
    setMode("pending");
    setBusy(false);
  }

  async function handleInvalidateToken() {
    if (!tokenData) return;
    await supabase
      .from("quickdash_tokens")
      .update({ completed_at: new Date().toISOString(), completed_by: "therapist" })
      .eq("id", tokenData.id);
    setTokenData(null);
  }

  async function handleCancelLink() {
    setBusy(true);
    await handleInvalidateToken();
    setBusy(false);
    const hasItems = items.some((v) => v !== null);
    setMode(hasItems ? "manual" : "idle");
  }

  async function handleSwitchToManual() {
    // Si hay token pendiente, invalidarlo antes de pasar a manual
    if (tokenData && !tokenData.completed_at) {
      setBusy(true);
      await handleInvalidateToken();
      setBusy(false);
    }
    setMode("manual");
  }

  function handleApplyResult() {
    if (!tokenData?.result?.items) return;
    onChange(tokenData.result.items as (number | null)[]);
    setMode("manual");
    toast.success("Resultado del paciente aplicado a la evaluación.");
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(tokenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ──

  if (mode === "loading") {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando QuickDASH...
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <div className="space-y-2">
        {tokenData?.completed_by === "patient" && tokenData.result && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <UserCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              El paciente completó el cuestionario (puntaje:{" "}
              <strong>{tokenData.result.score}/100</strong>). La carga manual
              reemplazará ese resultado al guardar la sesión.
            </span>
          </div>
        )}
        <QuickDashSection items={items} onChange={onChange} />
      </div>
    );
  }

  if (mode === "idle") {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">QuickDASH</span>
          <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200">
            Sin datos
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50"
            onClick={() => setMode("generating")}
          >
            <Link2 className="h-3.5 w-3.5" />
            Generar link para paciente
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
      </div>
    );
  }

  if (mode === "generating") {
    return (
      <div className="rounded-lg border border-teal-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Generar link para paciente
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMode("idle")}
          >
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
          {busy
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Link2 className="h-3.5 w-3.5" />
          }
          {busy ? "Generando..." : "Generar link"}
        </Button>
      </div>
    );
  }

  if (mode === "pending" && tokenData) {
    const expiresAt  = new Date(tokenData.expires_at);
    const timeLeft   = formatDistanceToNow(expiresAt, { locale: es, addSuffix: true });
    const hasManual  = items.some((v) => v !== null);

    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">QuickDASH</span>
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 text-[10px]">
              <Clock className="h-3 w-3 mr-1" />
              Pendiente
            </Badge>
          </div>
          <span className="text-xs text-amber-600">Vence {timeLeft}</span>
        </div>

        {/* URL copiable */}
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
            className={`shrink-0 gap-1.5 transition-colors ${
              copied ? "border-teal-500 bg-teal-50 text-teal-700" : ""
            }`}
            onClick={copyUrl}
          >
            {copied
              ? <Check className="h-3.5 w-3.5" />
              : <ClipboardCopy className="h-3.5 w-3.5" />
            }
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>

        <p className="text-xs text-amber-700 leading-relaxed">
          Compartí este link con tu paciente por WhatsApp o email. No necesita
          cuenta para completarlo. Se actualiza automáticamente cuando responde.
        </p>

        {hasManual && (
          <p className="text-xs text-amber-600 bg-amber-100 rounded-md px-2 py-1.5">
            Hay datos cargados manualmente en esta sesión. Se guardarán si no
            aplicás el resultado del paciente.
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs bg-white"
            disabled={busy}
            onClick={handleSwitchToManual}
          >
            {busy
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <PencilLine className="h-3.5 w-3.5" />
            }
            Cargar manualmente
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
            disabled={busy}
            onClick={handleCancelLink}
          >
            <X className="h-3.5 w-3.5" />
            Cancelar link
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "patient_completed" && tokenData?.result) {
    const { score } = tokenData.result;

    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">QuickDASH</span>
          <Badge className="bg-teal-100 text-teal-700 border border-teal-200 hover:bg-teal-100 text-[10px]">
            <UserCheck className="h-3 w-3 mr-1" />
            Completado por el paciente
          </Badge>
          <Badge className="bg-teal-600 text-white border-0 hover:bg-teal-600 text-[10px]">
            {score}/100
          </Badge>
        </div>

        <p className="text-xs text-teal-700 leading-relaxed">
          El paciente completó el cuestionario desde el link enviado. Aplicá el
          resultado para registrarlo en la evaluación funcional, o cargalo
          manualmente si preferís.
        </p>

        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-xs"
            onClick={handleApplyResult}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aplicar a evaluación funcional
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={busy}
            onClick={handleSwitchToManual}
          >
            {busy
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <PencilLine className="h-3.5 w-3.5" />
            }
            Reemplazar con carga manual
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
