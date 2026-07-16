import { Component, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    // No-op si Sentry no está inicializado (dev, CI, o sin DSN configurado)
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
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
