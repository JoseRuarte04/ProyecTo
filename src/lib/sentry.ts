import * as Sentry from "@sentry/react";

/**
 * Monitoreo de errores en producción. Solo se activa si existe
 * VITE_SENTRY_DSN (configurada en las env vars de Vercel) y el build es de
 * producción — en desarrollo y en CI queda apagado y no manda nada.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || !import.meta.env.PROD) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // App clínica: nunca mandar PII a un servicio externo.
    sendDefaultPii: false,
    // Solo errores; sin performance tracing ni session replay para no
    // acercarse a datos de pacientes ni consumir cuota del plan free.
    tracesSampleRate: 0,
  });
}
