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
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Denominador honesto: solo código propio de src/. Todo lo demás
      // (e2e/, scripts/, supabase/functions/ -Deno-, configs de raíz) queda
      // afuera porque no corre bajo este runner, no porque se quiera inflar
      // el número — ver docs/DECISIONS.md.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/test/**",
        // Componentes shadcn/ui: generados por el CLI de shadcn, no se
        // escriben ni se tocan a mano — código de terceros vendorizado.
        "src/components/ui/**",
        // Tipos autogenerados por `supabase gen types typescript`.
        "src/integrations/supabase/types.ts",
        // Bootstrap sin lógica propia.
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      thresholds: {
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
