import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "beta_banner_dismissed";
// Nombre de la CSS var que expone el alto real del banner (contenido + su
// propio mb-4) a páginas de layout fijo a viewport (ver PatientProfile.tsx,
// que no puede usar flex-fill porque el contenedor ancestro es min-h-screen,
// no h-screen, y necesita esto para no quedar ni tapado por el banner ni con
// un hueco de más cuando está cerrado).
const HEIGHT_VAR = "--beta-banner-height";

// Dismissible por localStorage, mismo criterio liviano que otros flags de UI
// del proyecto (no hace falta persistirlo en la base, es solo "no me lo
// muestres más en este navegador").
export function BetaBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useLayoutEffect(() => {
    if (dismissed || !ref.current) {
      document.documentElement.style.setProperty(HEIGHT_VAR, "0px");
      return;
    }
    const el = ref.current;
    const update = () => {
      // offsetHeight no incluye el margin-bottom (mb-4 = 16px) del propio div.
      document.documentElement.style.setProperty(HEIGHT_VAR, `${el.offsetHeight + 16}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [dismissed]);

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
    <div ref={ref} className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 mb-4 text-sm">
      <p className="flex-1 text-foreground">
        <span className="font-medium">Estás usando una versión beta.</span> Tu experiencia
        define lo que viene: cualquier error, duda o idea, mandanosla desde el botón de
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
