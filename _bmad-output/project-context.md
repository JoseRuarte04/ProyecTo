---
project_name: 'RehabOT'
user_name: 'Jose'
date: '2026-05-05'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns', 'update_2026-05-06']
status: 'complete'
rule_count: 42
optimized_for_llm: true
---

# Project Context for AI Agents

_Reglas críticas y patrones que los agentes de IA deben seguir al implementar código en RehabOT. Enfocado en detalles no obvios que los agentes podrían omitir._

---

## Technology Stack & Versions

- **React** 18.3.1 — no React 19, no Server Components
- **TypeScript** 5.8.3 — alias `@/*` → `./src/*`, modo permisivo (ver reglas TS)
- **Vite** 5.4.19 + plugin `@vitejs/plugin-react-swc` (SWC, no Babel)
- **Supabase JS** 2.101.1 — cliente tipado con `Database` en `src/integrations/supabase/types.ts`
- **React Router DOM** 6.30.1 — BrowserRouter, no HashRouter
- **TanStack React Query** 5.83.0 — para fetching con caché
- **React Hook Form** 7.61.1 + **Zod** 3.25 — validación de formularios
- **Shadcn/ui** sobre Radix UI + **Tailwind CSS** 3.4.17
- **Sonner** 1.7.4 — notificaciones (única librería de toasts)
- **jsPDF** 4.2.1 + **html2canvas** 1.4.1 — exportación PDF
- **date-fns** 3.6.0 — manipulación de fechas
- **Vitest** 3.2.4 + Testing Library — tests unitarios
- **Playwright** 1.57.0 — tests E2E
- Puerto de dev: **8080**

---

## Critical Implementation Rules

### TypeScript Rules

- **Modo permisivo**: `strictNullChecks: false`, `noImplicitAny: false`, `noUnusedLocals: false` — NO activar strict mode
- **Alias obligatorio**: usar siempre `@/` para imports internos, nunca rutas relativas entre módulos distantes
- **`any` es aceptable** para estado local de componentes complejos — no reemplazar sin validar impacto
- **Tipos JSONB**: para campos JSONB de Supabase usar el tipo `Json` importado de `types.ts`, nunca `object` o `Record<string, any>`
- **Exports**: páginas con `export default`, componentes reutilizables con named exports

### Framework Rules (React + Supabase)

**Autenticación:**
- Usar `useAuth()` de `@/contexts/AuthContext` para acceder a `user`, `session`, `profile`
- `profile` incluye: `id`, `full_name`, `role`, `specialty`, `license_number`
- Toda escritura con ownership requiere `professional_id: user.id`
- Verificar `loading` antes de asumir que `profile` no es null

**Cliente Supabase:**
- Importar solo desde `@/integrations/supabase/client` — nunca crear nuevas instancias
- Usar tipos generados de `Database` — no castear manualmente las respuestas
- Supabase directo para CRUD simples; React Query para datos con caché/refetch
- **`.maybeSingle()` vs `.single()`**: usar `.maybeSingle()` cuando el registro puede no existir (ej: `patient_occupational_profiles`, `patient_clinical_records` en pacientes recién creados). `.single()` lanza error 406 si no hay fila — solo usarlo cuando la fila DEBE existir

**Schema de patients — columnas agregadas mayo 2026:**
- `gender`, `email`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation` — todas nullable text
- Al agregar columnas por migración directa, actualizar también `src/integrations/supabase/types.ts` manualmente (Row, Insert y Update)

**Routing:**
- Rutas protegidas dentro de `<AppLayout />` (verifica auth automáticamente)
- `useParams<{ id: string }>()` con tipado explícito
- Navegación programática con `useNavigate()`

**UI:**
- Usar SIEMPRE componentes de `@/components/ui/` (Shadcn/Radix) — no instalar otras UI libs
- Notificaciones: `import { toast } from "sonner"` — no `useToast`
- Iconos: solo `lucide-react`

**Dropdowns sobre overlays:**
- Usar `createPortal` de `react-dom` para autocomplete dentro de modales/drawers
- Calcular posición con `getBoundingClientRect()` + listeners de `scroll`/`resize`
- Ver `ObrasSocialesAutocomplete` en `NewPatientForm.tsx` como referencia

**PDF Export:**
- Patrón: `html2canvas` sobre elemento DOM → `jsPDF`
- Referencias: `PlanPdfExport.tsx`, `ExercisePdfExport.tsx`

**Tipografía:**
- `font-sans` → Inter (UI general)
- `font-serif` → Playfair Display (títulos de sección, encabezados de cards)

### Testing Rules

- Tests unitarios en `src/test/` con extensión `.test.ts` / `.test.tsx`
- Setup global en `src/test/setup.ts` — no duplicar configuración
- Mockear `@/integrations/supabase/client` en unit tests — no llamadas reales a DB
- Tests E2E (Playwright) separados de unitarios — no mezclar carpetas
- Priorizar tests para lógica de escalas funcionales: `calcBarthelTotal()`, `calcQuickDashScore()`, `calcFimTotal()`
- No hay cobertura mínima configurada — el proyecto tiene tests básicos actualmente

### Code Quality & Style Rules

**ESLint:**
- `@typescript-eslint/no-unused-vars`: OFF — no eliminar vars "no usadas"
- `react-hooks/rules-of-hooks` y `exhaustive-deps`: activos — respetar reglas de hooks

**Naming:**
- Componentes y archivos de componentes: PascalCase (`.tsx`)
- Hooks custom: camelCase con prefijo `use` (ej: `use-toast.ts`)
- Páginas: PascalCase en `src/pages/`
- Utilidades: camelCase en `src/lib/`

**Estructura de carpetas:**
- `src/pages/` — una página por ruta
- `src/components/` — por dominio: `evaluations/`, `clinical/`, `patients/`, `plans/`, `exercises/`, `ui/`
- `src/contexts/` — React contexts globales
- `src/hooks/` — hooks custom reutilizables
- `src/integrations/supabase/` — solo cliente y tipos generados
- `src/lib/` — utilidades puras

**Tailwind:**
- Usar tokens semánticos (`bg-card`, `text-muted-foreground`, `border-border`) — no hardcodear colores
- `cn()` de `@/lib/utils` para clases condicionales — **importar siempre explícitamente**, fácil de omitir en componentes definidos dentro de archivos grandes
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
- Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (prefijo `VITE_` obligatorio para Vite)
- Nunca hardcodear URLs o keys de Supabase en el código
- `npm run dev` — puerto 8080 | `npm run build` — producción | `npm run lint` — ESLint
- No hay pipeline CI/CD configurado actualmente
- Proyecto originado en Lovable (ver `.lovable/plan.md`)

### Critical Don't-Miss Rules

**Dominio médico — datos críticos:**
- Campos JSONB con estructura interna específica — SIEMPRE usar helpers existentes:
  - `buildEdemaPayload()`, `normalizeEdemaValue()`, `isNewEdemaFormat()` de `EdemaCircometryTable.tsx`
  - El edema tiene DOS formatos (legacy string y nuevo JSON con circometría) — siempre detectar con `isNewEdemaFormat()`
- Escalas funcionales: usar `calcBarthelTotal()`, `calcQuickDashScore()`, `calcFimTotal()` de `FunctionalScales.tsx` — nunca recalcular manualmente

**Multi-tenancy:**
- RLS en Supabase enforcea por `professional_id` — pero filtrar también en el cliente: `.eq("professional_id", user.id)`
- `professional_id` = `useAuth().user.id`

**Archivos clínicos (Storage):**
- Tipos permitidos: jpeg, png, webp, gif, pdf, mp4, quicktime — validar antes de subir
- Usar signed URLs, no URLs públicas directas (expiran)

**Anti-patrones — NUNCA hacer:**
- ❌ Crear nuevas instancias de Supabase client
- ❌ Usar `moment.js` — solo `date-fns` v3
- ❌ Usar `react-toastify` o `useToast` para notificaciones nuevas — solo `toast` de `sonner`
- ❌ Hardcodear colores Tailwind — usar tokens semánticos
- ❌ Instalar librerías UI adicionales — el sistema Shadcn/Radix es el estándar
- ❌ Crear dropdowns dentro de modales sin `createPortal` — se cortan por `overflow:hidden`
- ❌ Asumir `profile` no null sin verificar `loading` primero
- ❌ Deshabilitar RLS para "simplificar" queries
- ❌ Exponer `SUPABASE_SERVICE_ROLE_KEY` en el cliente
- ❌ Usar `.single()` sobre tablas donde el registro puede no existir → usar `.maybeSingle()`
- ❌ Exportar componentes de página como named export si `App.tsx` los importa como default — verificar el import antes de definir el export

---

## Usage Guidelines

**Para agentes de IA:**
- Leer este archivo antes de implementar cualquier código
- Seguir TODAS las reglas exactamente como están documentadas
- Ante la duda, preferir la opción más restrictiva
- Actualizar este archivo si emergen nuevos patrones

**Para humanos:**
- Mantener este archivo enfocado en necesidades del agente
- Actualizar cuando cambie el stack tecnológico
- Revisar periódicamente para eliminar reglas obsoletas

Last Updated: 2026-05-11

---

## Update 2026-05-11 — Feature QuickDASH Externo (completada)

### Nueva tabla en Supabase: `quickdash_tokens`

Migración aplicada: `supabase/migrations/20260511123816_quickdash_tokens.sql`

Columnas: `id`, `token` (uuid único, secreto en URL), `patient_id`, `session_id`, `created_by`, `created_at`, `expires_at`, `completed_at`, `completed_by` ('patient'|'therapist'), `result` (jsonb: `{items: number[], score: number}`)

RLS: terapeutas autenticados tienen SELECT/INSERT/UPDATE sobre sus propios tokens (`created_by = auth.uid()`). Acceso anónimo solo vía RPCs con SECURITY DEFINER.

### RPCs creadas (en `src/integrations/supabase/types.ts` → sección Functions)

- `get_quickdash_token(p_token)` — GRANT TO anon. Devuelve `{status, expires_at}`. No expone PII.
- `complete_quickdash_token(p_token, p_items, p_score)` — GRANT TO anon. Valida token activo, valida 11 ítems 1-5, recalcula score server-side (ignora p_score del cliente).
- `create_quickdash_token(p_session_id, p_patient_id, p_expires_at)` — GRANT TO authenticated. Invalida tokens previos activos de la misma sesión antes de crear uno nuevo.

### Archivos creados

**`src/pages/QuickDashPublicPage.tsx`**
- Ruta: `/q/:token` — fuera de `<AppLayout>`, sin auth, sin sidebar
- Estados: `loading → valid/expired/not_found/completed → submitting → success`
- Renderiza preguntas inline (sin collapsible) para mejor UX mobile
- Score con interpretación colorida en pantalla de éxito (leve/moderado/severo/muy severo)
- Importa `QUICKDASH_QUESTIONS`, `calcQuickDashScore`, `emptyQuickDash` de `FunctionalScales`

**`src/components/evaluations/QuickDashTokenManager.tsx`**
- Modos: `loading | idle | generating | pending | patient_completed | manual`
- En `idle`: botones "Generar link" / "Cargar manualmente"
- En `generating`: selector de vencimiento (24hs / 48hs / 72hs / 7 días / fecha custom)
- En `pending`: URL copiable + tiempo restante + polling cada 15s para detectar respuesta del paciente
- En `patient_completed`: score + botón "Aplicar a evaluación funcional" (llama `onChange`)
- En `manual`: renderiza `<QuickDashSection>` existente de FunctionalScales
- Invalidación automática de tokens previos al generar uno nuevo (vía RPC)
- Usa `maybeSingle()` para fetch inicial (patrón del proyecto)

### Archivos modificados

**`src/App.tsx`** — Ruta `/q/:token` registrada fuera de `<AppLayout>` (antes del catch-all `*`)

**`src/pages/SessionForm.tsx`** (l.51 import + l.1605-1608 render)
- En modo edición (`isEditMode = !!sessionId`): renderiza `<QuickDashTokenManager>`
- En nueva sesión: renderiza `<QuickDashSection>` directamente (no hay sessionId para anclar token)
- El flujo de guardado no cambió — sigue usando `qd_items` del estado local

**`src/integrations/supabase/types.ts`**
- Tabla `quickdash_tokens` agregada en `Tables` con Row/Insert/Update/Relationships
- Las 3 RPCs nuevas + `soft_delete_session` agregadas en `Functions`
- `completed_by` tipado como union literal `"patient" | "therapist" | null`

### Decisiones de diseño a recordar

- **Score recalculado server-side**: `complete_quickdash_token` ignora el `p_score` recibido y lo recalcula desde `p_items` para evitar manipulación.
- **"Apply" explícito, no trigger**: el resultado del paciente en `quickdash_tokens.result` no se escribe automáticamente en `functional_evaluations`. El terapeuta lo aplica con un botón, lo que dispara `onChange(items)` en el padre. Se guarda en `functional_evaluations` al guardar la sesión normalmente.
- **Polling, no Realtime**: el panel del terapeuta en modo `pending` hace polling cada 15s sobre el row específico por `id`. Evita configurar `supabase_realtime` publication.
- **PII mínima en ruta pública**: `get_quickdash_token` no devuelve `patient_id`, `session_id` ni `created_by` al caller anon.

### Estado actual del proyecto

- Feature QuickDASH externo: **completada y en producción** (commit `82575a3`)
- Próximo paso planificado: **dashboard del paciente** (vista de historial/progreso desde el lado del paciente)
