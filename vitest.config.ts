import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// loadEnv sin prefijo (3er arg "") para exponer vía process.env también las
// credenciales de prueba de rls.test.ts (RLS_TEST_USER_*), que a propósito
// NO llevan el prefijo VITE_ (ese prefijo es "seguro para el bundle del
// cliente"; estas nunca deben sugerir esa idea, aunque de hecho jamás se
// bundlean — este archivo de test no se importa desde main.tsx/App.tsx).
// En CI estas mismas variables llegan directo por env del workflow
// (GitHub Secrets), este loadEnv es solo para desarrollo local con .env.
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Los tests de RLS pegan contra el Supabase real por red
    testTimeout: 15_000,
    env,
    // json-summary lo lee ci.yml para la tabla en $GITHUB_STEP_SUMMARY (igual
    // que ingsoft3-tp01); text queda para ver el detalle por archivo en el
    // log de la corrida. Vitest mide TODO src/ (incluido lo que ningún test
    // importa, ahí sale la mayoría del 0%), no solo los archivos que algún
    // test toca — es a propósito, para que no haya cobertura inflada por
    // archivos nunca instrumentados.
    //
    // `include`/`exclude` acotados a `src/**` (2026-10-29, análisis pedido
    // por Jose): antes, sin include propio, el provider v8 medía TODO lo
    // que Vite llega a transformar desde la raíz del repo (confirmado
    // corriendo la suite: entraban playwright.config.ts, tailwind.config.ts,
    // e2e/*, scripts/*) — ninguno de esos va a tener nunca un test de
    // vitest, así que solo diluían el número sin aportar señal real sobre
    // `src/`. Dentro de `src/`, se excluyen 3 categorías que tampoco tiene
    // sentido testear: el bootstrap de la app (`main.tsx`, 8 líneas), los
    // tipos generados por el CLI de Supabase (`integrations/supabase/types.ts`,
    // no se edita a mano) y los componentes de `components/ui/**` (51
    // archivos boilerplate de shadcn/radix, sin lógica propia del producto).
    //
    // `thresholds.lines` queda apenas por debajo del valor real medido
    // sobre `src/` tras los PRs #114-#124 del plan de tests/cobertura
    // (medido fusionando localmente esas ramas, no corriendo CI real —
    // ver docs/DECISIONS.md [2026-10-29] para el detalle exacto y la
    // advertencia de que hay que remedir si se mergea un subconjunto
    // distinto). Solo `lines` por ahora: es la métrica más estable entre
    // archivos chicos; `branches`/`functions` quedan para subir el piso
    // una vez que haya más runs reales confirmando que no da falsos
    // positivos por archivos con pocas ramas/funciones.
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**"],
      exclude: [
        "src/main.tsx",
        "src/integrations/supabase/types.ts",
        "src/components/ui/**",
      ],
      thresholds: {
        lines: 2.8,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
