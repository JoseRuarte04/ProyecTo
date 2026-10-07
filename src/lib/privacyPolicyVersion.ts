// Separado de privacyPolicy.ts a propósito: este archivo no importa nada que
// dependa de import.meta.env, así que e2e/globalSetup.ts (que corre fuera de Vite,
// vía Playwright) puede importarlo directo sin romper.
export const CURRENT_PRIVACY_POLICY_VERSION = "2026-10-06-borrador-1";
