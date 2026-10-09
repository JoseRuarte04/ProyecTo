import { Component, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkReload: boolean;
}

// Después de un deploy, un tab que ya tenía la app cargada puede intentar
// pedir un chunk de React.lazy() con el hash de la versión vieja — ese
// archivo ya no existe, Vercel cae en el rewrite de SPA y devuelve
// index.html en vez de un 404, lo que revienta el import() dinámico con
// este mensaje. Se recarga la página una sola vez por pestaña (la bandera
// en sessionStorage evita un loop si el reload no soluciona nada).
const CHUNK_RELOAD_KEY = "chunk-load-reload-attempted";

function isChunkLoadError(error: Error): boolean {
  return /dynamically imported module|importing a module script failed|loading chunk .* failed/i.test(error.message);
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, isChunkReload: false };

  static getDerivedStateFromError(error: Error): State {
    const isChunkReload = isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY);
    return { hasError: true, error, isChunkReload };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    // No-op si Sentry no está inicializado (dev, CI, o sin DSN configurado)
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });

    if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
    }
  }

  reset = () => this.setState({ hasError: false, error: null, isChunkReload: false });

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkReload) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Hay una versión nueva disponible, actualizando…</p>
          </div>
        );
      }

      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
          <p className="text-lg font-medium text-destructive">Algo salió mal</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Ocurrió un error inesperado. Podés intentar recargar la sección o volver al inicio.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.reset}>
              Reintentar
            </Button>
            <Button onClick={() => (window.location.href = "/dashboard")}>
              Ir al inicio
            </Button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-4 text-xs text-left bg-muted p-4 rounded max-w-xl overflow-auto">
              {this.state.error?.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
