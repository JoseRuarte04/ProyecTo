---
project_name: 'RehabOT'
user_name: 'Jose'
date: '2026-05-28'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 95
optimized_for_llm: true
---

# Project Context for AI Agents

_Reglas críticas y patrones que los agentes de IA deben seguir al implementar código en RehabOT. Enfocado en detalles no obvios que los agentes podrían omitir._

---

## Technology Stack & Versions

- **React** 18.3.1 — NO usar hooks de React 19 (`use()`, nueva `useOptimistic`, RSC, `'use client'`)
- **TypeScript** 5.8.3 — alias `@/*` → `./src/*`, modo permisivo (ver reglas TS)
- **Vite** 5.4.19 + `@vitejs/plugin-react-swc` (SWC, no Babel)
- **Supabase JS** 2.101.1 — cliente tipado con `Database` en `src/integrations/supabase/types.ts`
- **React Router DOM** 6.30.1 — v6 API (`<Routes>`, `useNavigate()`, `element={}`). Future flags v7 activados en BrowserRouter. NO usar v5: `<Switch>`, `useHistory()`, `component={}`
- **TanStack React Query** 5.83.0 — fetching con caché
- **React Hook Form** 7.61.1 + **Zod** 3.25.76 — validación de formularios
- **Shadcn/ui** sobre Radix UI + **Tailwind CSS** 3.4.17 — único sistema UI permitido (no MUI, Chakra, Mantine, Ant Design)
- **Sonner** 1.7.4 — única librería de toasts. `toast.tsx`/`useToast` de Shadcn NO usar aunque existen en el proyecto
- **jsPDF** 4.2.1 + **html2canvas** 1.4.1 — exportación PDF
- **date-fns** 3.6.0 — NO usar moment.js; verificar API v3 en imports de locale
- **Recharts** 2.15.4 — gráficos de evolución clínica
- **Vitest** 3.2.4 + Testing Library — tests unitarios
- **Playwright** 1.57.0 — tests E2E
- **Deno** — runtime de Edge Functions; imports SIEMPRE con `jsr:` o `npm:` prefix (ej: `jsr:@supabase/supabase-js@2`). Nunca bare imports de npm
- Puerto de dev: **8080**

---

## Critical Implementation Rules

### TypeScript Rules

- **Modo permisivo**: `strictNullChecks: false`, `noImplicitAny: false`, `noUnusedLocals: false` — NO activar strict mode
- **Alias obligatorio**: siempre `@/` para imports internos, nunca rutas relativas entre módulos distantes
- **`any` es aceptable** en estado local de componentes complejos — no reemplazar sin validar impacto
- **Tipos JSONB**: para campos JSONB de Supabase usar el tipo `Json` importado de `src/integrations/supabase/types.ts`, nunca `object` ni `Record<string, any>`
- **Exports**: páginas con `export default`, componentes reutilizables con named exports — verificar cómo `App.tsx` los importa antes de cambiar el export type
- **Tipos generados**: nunca castear manualmente respuestas de Supabase — usar los tipos de `Database` siempre
- **Union literals**: preferir union literal tipada sobre `string` cuando el dominio es acotado (ej: `"patient" | "therapist" | null`)
- **`as unknown as T`**: patrón aceptable para joins de Supabase donde TypeScript no infiere correctamente el tipo anidado

### Framework Rules (React + Supabase)

**Autenticación & Roles:**
- `useAuth()` de `@/contexts/AuthContext` → expone `user`, `session`, `profile`, `loading`
- `profile` incluye: `id`, `full_name`, `email`, `role`, `specialty`, `license_number`
- Toda escritura con ownership requiere `professional_id: user.id`
- Verificar `loading` antes de asumir que `profile` no es null
- Admin → tabla `admin_users`; verificar con `useIsAdmin()` de `@/hooks/useIsAdmin`
- `useIsAdmin()` devuelve `null` mientras carga (mostrar spinner), `true/false` cuando resuelve — nunca asumir que `null === false`

**Workspace (multi-tenancy contextual):**
- `useWorkspace()` de `@/contexts/WorkspaceContext` → `{ workspace, teams, setWorkspace, loading }`
- `workspace.type` es `"personal"` o `"team"` — nunca asumir cuál sin leerlo
- En modo team: `workspace.teamId` y `workspace.teamName` disponibles (castear tipo explícitamente)
- Persistencia: `localStorage` con key `rehab_workspace_v1`; elección de sesión en `sessionStorage` con key `workspace_chosen`
- Si usuario tiene equipos y no eligió workspace esta sesión → `AppLayout` redirige a `/workspace-picker`
- Si usuario es admin → `AppLayout` redirige a `/admin` (verificado via `useIsAdmin`)

**Cliente Supabase:**
- Importar solo desde `@/integrations/supabase/client` — nunca crear nuevas instancias
- Usar tipos generados de `Database` — no castear manualmente las respuestas
- Supabase directo para CRUD simples; React Query para datos con caché/refetch
- `.maybeSingle()` cuando el registro puede no existir; `.single()` solo cuando DEBE existir (lanza error 406 si no hay fila)

**Routing:**
- Rutas autenticadas dentro de `<AppLayout />` (verifica auth + admin + workspace)
- Rutas admin dentro de `<AdminLayout />` (verifica auth + `useIsAdmin`)
- Rutas públicas fuera de ambos layouts: `/q/:token`, `/plan/:token`, `/registro`, `/accept-invite`, `/workspace-picker`
- `useParams<{ id: string }>()` con tipado explícito
- Navegación programática con `useNavigate()`

**Edge Functions (Deno):**
- Patrón: verificar auth del caller con `SUPABASE_ANON_KEY` + JWT antes de usar `SUPABASE_SERVICE_ROLE_KEY`
- Siempre incluir CORS headers + manejar `OPTIONS` preflight
- Variables disponibles: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `APP_URL`
- Funciones actuales: `invite-therapist`, `cancel-therapist-invitation`, `send-team-invitation`, `generate-discharge-report`

**UI:**
- Usar SIEMPRE componentes de `@/components/ui/` (Shadcn/Radix)
- Notificaciones: `import { toast } from "sonner"` — no `useToast`
- Iconos: solo `lucide-react`
- `cn()` de `@/lib/utils` para clases condicionales — importar explícitamente (fácil de omitir en archivos grandes)

**Dropdowns sobre overlays:**
- Usar `createPortal` de `react-dom` para autocomplete dentro de modales/drawers
- Calcular posición con `getBoundingClientRect()` + listeners de `scroll`/`resize`
- Referencia: `ObrasSocialesAutocomplete` en `NewPatientForm.tsx`

**PDF Export:**
- Patrón: `html2canvas` sobre elemento DOM → `jsPDF`
- Referencias: `PlanPdfExport.tsx`, `ExercisePdfExport.tsx`

**Tipografía:**
- `font-sans` → Inter (UI general)
- `font-serif` → Playfair Display (títulos de sección, encabezados de cards)

### Testing Rules

- Tests unitarios en `src/test/` con extensión `.test.ts` / `.test.tsx`
- Setup global en `src/test/setup.ts` — no duplicar configuración
- Mockear `@/integrations/supabase/client` en unit tests — sin llamadas reales a DB
- Tests E2E (Playwright) separados de unitarios — no mezclar carpetas
- Priorizar tests para lógica de escalas funcionales: `calcBarthelTotal()`, `calcQuickDashScore()`, `calcFimTotal()`
- No hay cobertura mínima configurada — el proyecto tiene tests básicos actualmente
- `npm run test` ejecuta Vitest en modo run (no watch); `npm run test:watch` para desarrollo

### Code Quality & Style Rules

**ESLint:**
- `@typescript-eslint/no-unused-vars`: OFF — no eliminar vars "no usadas"
- `react-hooks/rules-of-hooks` y `exhaustive-deps`: activos — respetar reglas de hooks

**Naming:**
- Componentes y archivos de componentes: PascalCase (`.tsx`)
- Hooks custom: camelCase con prefijo `use` (ej: `use-mobile.tsx`)
- Páginas: PascalCase en `src/pages/`
- Utilidades: camelCase en `src/lib/`

**Estructura de carpetas:**
- `src/pages/` — una página por ruta
- `src/components/` — por dominio: `evaluations/`, `clinical/`, `patients/`, `plans/`, `exercises/`, `ui/`, `admin/`
- `src/contexts/` — React contexts globales (`AuthContext`, `WorkspaceContext`)
- `src/hooks/` — hooks custom reutilizables (`useIsAdmin`, `useMyTeams`, `usePatientDashboard`)
- `src/integrations/supabase/` — solo cliente y tipos generados
- `src/lib/` — utilidades puras

**Tailwind:**
- Usar tokens semánticos (`bg-card`, `text-muted-foreground`, `border-border`) — no hardcodear colores
- `cn()` de `@/lib/utils` para clases condicionales — importar siempre explícitamente
- Colores custom disponibles: `success`, `warning`, `info`, `label`

**Patrón de tabs con subrayado (estándar del proyecto):**
- Botón tab: `px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors`
- Activo: `border-primary text-foreground` | Inactivo: `border-transparent text-muted-foreground hover:text-foreground`
- Contenedor: `flex border-b border-border`
- Usado en: filtros de Patients, tabs de PatientProfile, subtabs de Evaluaciones

**Comentarios:**
- Usar `// ── Título ──` para separar secciones dentro de archivos grandes
- No agregar JSDoc salvo requerimiento explícito

### Development Workflow Rules

- Rama principal: `main`
- `npm run dev` — puerto 8080 | `npm run build` — producción | `npm run lint` — ESLint
- Variables de entorno frontend (prefijo `VITE_` obligatorio para Vite):
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Variables de entorno Edge Functions (sin `VITE_`, configurar en Supabase dashboard):
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `APP_URL`
- Nunca hardcodear URLs o keys de Supabase en el código
- Migraciones en `supabase/migrations/` — naming: `YYYYMMDDHHMMSS_descripcion.sql`
- Al agregar columnas por migración, actualizar también `src/integrations/supabase/types.ts` manualmente (Row, Insert y Update)
- Deploy en Vercel — `vercel.json` con rewrites para SPA routing
- No hay pipeline CI/CD configurado actualmente

### Critical Don't-Miss Rules

**Schema de patients — columnas actuales:**
- `gender`, `email`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`, `team_id` — todas nullable
- `team_id` filtra pacientes por equipo en modo workspace team

**Multi-tenancy — dos capas:**
- RLS enforcea por `professional_id = auth.uid()` — pero filtrar también en el cliente
- En modo team: pacientes del equipo tienen `team_id` igual al workspace actual
- `professional_id` = `useAuth().user.id`

**Admin Panel:**
- Tabla `admin_users` controla acceso super-admin — NO es `profile.role`
- RPCs admin llevan `SECURITY DEFINER` y validan `is_super_admin()` internamente
- `useIsAdmin()` puede devolver `null` — AdminLayout y AppLayout muestran spinner mientras es `null`
- AdminLayout redirige a `/dashboard` si `isAdmin === false`; AppLayout redirige a `/admin` si `isAdmin === true`

**Invitaciones:**
- Terapistas: Edge Function `invite-therapist` → Supabase Auth invite → email → `/accept-invite`
- Equipo: Edge Function `send-team-invitation` → tabla `team_invitations` → email → `/registro`
- Cancelar: Edge Function `cancel-therapist-invitation`
- Terapistas con invitación pendiente (no aceptada) NO deben aparecer en listados de terapistas activos

**Tablas de equipos:**
- `teams` — datos del equipo (`id`, `name`, `member_limit`)
- `team_members` — membresía (`user_id`, `team_id`, `role`: `"admin"|"member"`, `joined_at`)
- `team_invitations` — invitaciones pendientes (`email`, `status`: `"pending"|"accepted"|"cancelled"`, `expires_at`)

**Dominio médico — datos críticos:**
- Edema tiene DOS formatos (legacy string y nuevo JSON con circometría):
  - Usar `isNewEdemaFormat()`, `buildEdemaPayload()`, `normalizeEdemaValue()` de `EdemaCircometryTable.tsx`
- Escalas funcionales: usar `calcBarthelTotal()`, `calcQuickDashScore()`, `calcFimTotal()` de `FunctionalScales.tsx` — nunca recalcular manualmente
- QuickDASH externo: score recalculado server-side en RPC `complete_quickdash_token` — ignorar score enviado por el cliente

**Planes de ejercicios:**
- Tablas: `exercise_plans` (cabecera) → `exercise_plan_items` (ejercicios) → `exercise_plan_tokens` (links públicos)
- RLS por `professional_id` en `exercise_plans`; items heredan acceso vía subquery
- Link público: `/plan/:token` — fuera de AppLayout, sin auth requerida

**Archivos clínicos (Storage):**
- Tipos permitidos: jpeg, png, webp, gif, pdf, mp4, quicktime — validar antes de subir
- Usar signed URLs, no URLs públicas directas (expiran)

**Anti-patrones — NUNCA hacer:**
- ❌ Crear nuevas instancias de Supabase client
- ❌ Usar `moment.js` — solo `date-fns` v3
- ❌ Usar `useToast` o `react-toastify` — solo `toast` de `sonner`
- ❌ Hardcodear colores Tailwind — usar tokens semánticos
- ❌ Instalar librerías UI adicionales — Shadcn/Radix es el estándar
- ❌ Crear dropdowns dentro de modales sin `createPortal` — se cortan por `overflow:hidden`
- ❌ Asumir `profile` no null sin verificar `loading` primero
- ❌ Deshabilitar RLS para simplificar queries
- ❌ Exponer `SUPABASE_SERVICE_ROLE_KEY` en cliente frontend
- ❌ Usar `.single()` donde el registro puede no existir → usar `.maybeSingle()`
- ❌ Bare imports npm en Edge Functions — siempre `jsr:` o `npm:` prefix
- ❌ Usar v5 patterns de React Router (`<Switch>`, `useHistory()`, `component={}`)
- ❌ Tratar `isAdmin === null` como `false` — esperar que resuelva antes de decidir
- ❌ Usar `export default` en componentes que `App.tsx` importa como named export — verificar antes de cambiar

---

## Usage Guidelines

**Para agentes de IA:**
- Leer este archivo antes de implementar cualquier código
- Seguir TODAS las reglas exactamente como están documentadas
- Ante la duda, preferir la opción más restrictiva
- Actualizar este archivo si emergen nuevos patrones

**Para humanos:**
- Mantener este archivo enfocado en necesidades del agente
- Actualizar cuando cambie el stack tecnológico o aparezcan nuevas tablas/features
- Revisar periódicamente para eliminar reglas obsoletas

Last Updated: 2026-05-28
