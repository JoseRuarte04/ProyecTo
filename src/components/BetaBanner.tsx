import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "beta_banner_dismissed";

// BORRADOR de texto — revisar antes de la beta. Dismissible por localStorage,
// mismo criterio liviano que otros flags de UI del proyecto (no hace falta
// persistirlo en la base, es solo "no me lo muestres más en este navegador").
export function BetaBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage puede no estar disponible (modo privado, etc.) — no bloquea el dismiss visual
    }
    setDismissed(true);
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 mb-4 text-sm">
      <p className="flex-1 text-foreground">
        <span className="font-medium">Esto es una beta.</span> Puede fallar y todavía
        no funciona sin conexión — si encontrás algo raro, reportalo con el botón de
        la esquina.
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
        aria-label="Cerrar aviso"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
