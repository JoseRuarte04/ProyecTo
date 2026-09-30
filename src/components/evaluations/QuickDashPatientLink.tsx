import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link2, ClipboardCopy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addHours } from "date-fns";

interface Props {
  sessionId: string | null;
  patientId: string;
}

// Uno o el otro: este link es para que lo complete el PACIENTE. Si el
// profesional también lo completa en el wizard, gana el último que se
// guarde (ver complete_quickdash_token / SessionForm.tsx).
export function QuickDashPatientLink({ sessionId, patientId }: Props) {
  const [generating, setGenerating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!sessionId) {
    return (
      <p className="text-xs text-muted-foreground">
        Guardá la sesión primero para poder enviarle este cuestionario al paciente por link.
      </p>
    );
  }

  const handleGenerate = async () => {
    setGenerating(true);
    const { data: token, error } = await supabase.rpc("create_quickdash_token", {
      p_session_id: sessionId,
      p_patient_id: patientId,
      p_expires_at: addHours(new Date(), 72).toISOString(),
    });
    setGenerating(false);
    if (error || !token) { toast.error("No se pudo generar el link"); return; }
    setUrl(`${window.location.origin}/q/${token}`);
    toast.success("Link generado");
  };

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      {!url ? (
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={generating} onClick={handleGenerate}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          {generating ? "Generando..." : "Enviar link al paciente"}
        </Button>
      ) : (
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
            className={`shrink-0 h-7 text-xs gap-1.5 ${copied ? "border-success text-success" : ""}`}
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Vence en 72 hs. Generar uno nuevo invalida el anterior para esta sesión.
      </p>
    </div>
  );
}
