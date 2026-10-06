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
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
