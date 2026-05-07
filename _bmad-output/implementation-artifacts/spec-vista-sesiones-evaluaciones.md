---
title: 'Vista dedicada de evaluaciones desde sesiones'
type: 'feature'
created: '2026-05-06'
status: 'done'
baseline_commit: '3550ebb3b1be8c7b4b8e002dbce6b653345ddcb3'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** El tab de Sesiones muestra datos clínicos narrativos mezclados con bloques de evaluación numéricos inline, generando saturación visual y dificultando la lectura rápida del historial clínico.

**Approach:** Reemplazar los bloques de evaluación inline dentro del card de sesión por botones "Ver evaluación analítica / funcional" (solo visibles cuando existe la FK `session_id`), que navegan a páginas dedicadas con los datos organizados en grillas por sección.

## Boundaries & Constraints

**Always:**
- Usar solo componentes de `@/components/ui/` (Shadcn/Radix) — no instalar librerías UI adicionales
- Tokens semánticos Tailwind (`bg-card`, `text-muted-foreground`, `border-border`) — no hardcodear colores
- Importar Supabase solo desde `@/integrations/supabase/client`
- Multi-tenancy: filtrar por `professional_id: user.id` en todas las queries
- Para edema en `AnalyticalEvaluationPage`: usar `isNewEdemaFormat()` y `normalizeEdemaValue()` importados de `@/components/evaluations/EdemaCircometryTable`
- Notificaciones con `toast` de `sonner` — no `useToast`
- Íconos solo de `lucide-react`
- `export default` para páginas en `src/pages/`

**Ask First:**
- Si `isNewEdemaFormat` / `normalizeEdemaValue` no son exportados desde `EdemaCircometryTable.tsx`, HALT y preguntar si extraer a `src/lib/edema-utils.ts`

**Never:**
- Editar evaluaciones desde las páginas de detalle (son read-only)
- Crear nuevas instancias de Supabase client
- Quitar el botón Editar / Eliminar sesión del header del card
- Romper el comportamiento de expand/collapse existente del card de sesión

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sesión con eval analítica | `analEvals.find(matchesSessionEval)` retorna objeto | Botón "Ver evaluación analítica" visible en footer del card | — |
| Sesión sin eval analítica | `linkedEval` es undefined | Botón "Ver evaluación analítica" no renderizado | — |
| Sesión con ambas evals | Ambos linked* existen | Ambos botones visibles en footer | — |
| Página eval carga OK | evalId válido en DB | Secciones con datos renderizadas | — |
| evalId inválido | Supabase retorna null | Mensaje "Evaluación no encontrada" + link volver | No crash |

</frozen-after-approval>

## Code Map

- `src/pages/PatientProfile.tsx:1535` -- `SessionTimeline` component: recibe `analEvals`, `funcEvals`; usa `linkedEval`/`linkedFuncEval` por sesión (línea 1695–1696); actualmente renderiza `FunctionalEvalBlock` (1770) y `MeasurementsBlock` (1778) inline
- `src/pages/PatientProfile.tsx:1578` -- `FunctionalEvalBlock` component: display inline de eval funcional (a eliminar del expanded content)
- `src/pages/PatientProfile.tsx:1695` -- Lógica `matchesSessionEval`: determina si una eval corresponde a la sesión por `session_id` (primario) o `episode_id + fecha` (fallback)
- `src/pages/PatientProfile.tsx:1709` -- Badge "Con mediciones": reemplazar por botones en footer
- `src/components/evaluations/EdemaCircometryTable.tsx` -- helpers `isNewEdemaFormat()`, `normalizeEdemaValue()` para interpretar campo `edema` JSONB (dos formatos: legacy string y nuevo JSON)
- `src/App.tsx` -- definición de rutas React Router v6; agregar 2 rutas nuevas dentro de `AppLayout`
- `src/integrations/supabase/types.ts` -- tipos `analytical_evaluations` Row, `functional_evaluations` Row, `therapy_sessions` Row

## Tasks & Acceptance

**Execution:**
- [x] `src/pages/PatientProfile.tsx` -- En `SessionTimeline`: (1) eliminar secciones "Evaluación funcional" y "Evaluación analítica" del expanded content (líneas 1769–1783); (2) reemplazar badge "Con mediciones" (línea 1709) por un bloque footer con `Button variant="outline" size="sm"` para cada eval existente: "Ver evaluación analítica" y/o "Ver evaluación funcional", con `onClick={() => navigate(\`/patients/${patientId}/evaluations/analytical/${linkedEval.id}\`)}` -- Separar datos clínicos de datos de evaluación según UX spec
- [x] `src/pages/AnalyticalEvaluationPage.tsx` -- Crear página nueva: (1) `useParams<{patientId, evalId}>()` para obtener IDs; (2) query `analytical_evaluations` por `evalId` + `professional_id`; (3) query `therapy_sessions` por `session_id` del resultado para header context; (4) query `patients` por `patientId` para nombre en header; (5) layout: header con `Button variant="ghost"` "← Volver" + nombre paciente + fecha eval + "Sesión Nº X"; (6) secciones con `Card`: Dolor (pain_score), Goniometría (goniometry JSONB), Fuerza muscular (muscle_strength_daniels JSONB + nerve fields), Edema (edema usando isNewEdemaFormat/normalizeEdemaValue), Pruebas específicas (specific_tests JSONB), Escalas (vancouver_score, osas_score, godet_test); (7) datos en `grid grid-cols-2 lg:grid-cols-3 gap-3`; (8) campos vacíos: texto "No registrado" en `text-muted-foreground italic text-sm` -- Página dedicada para evaluación analítica
- [x] `src/pages/FunctionalEvaluationPage.tsx` -- Crear página nueva con misma estructura de header y layout que AnalyticalEvaluationPage; secciones: Scores (quickdash_score/100, fim_score/126, barthel_score/100), AVD (avd text), AIVD (aivd text); campos vacíos igual que anterior -- Página dedicada para evaluación funcional
- [x] `src/App.tsx` -- Agregar dentro del children de `AppLayout` dos rutas: `<Route path="/patients/:patientId/evaluations/analytical/:evalId" element={<AnalyticalEvaluationPage />} />` y `<Route path="/patients/:patientId/evaluations/functional/:evalId" element={<FunctionalEvaluationPage />} />` -- Habilitar navegación a páginas de evaluación

**Acceptance Criteria:**
- Dado un paciente con sesiones que tienen evaluaciones vinculadas, cuando se abre el tab Sesiones, entonces los cards muestran botones "Ver evaluación analítica/funcional" solo para sesiones con FK existente — y no muestran datos de evaluación inline
- Dado una sesión sin evaluación analítica, cuando se renderiza el card, entonces el botón "Ver evaluación analítica" no está presente
- Dado click en "Ver evaluación analítica", cuando la ruta carga, entonces la página muestra los datos organizados en secciones con grid 2-3 col y campos vacíos marcados como "No registrado"
- Dado click en "← Volver" desde cualquier página de evaluación, cuando se navega, entonces se regresa a la vista anterior (PatientProfile tab Sesiones)
- Dado un evalId inválido en la URL, cuando la página carga, entonces se muestra un mensaje de error con opción de volver

## Design Notes

**Botones en footer del card:** Los botones deben estar FUERA del bloque `isOpen && (...)` — siempre visibles cuando la eval existe, sin necesidad de expandir el card. Agregar un `div` con `border-t border-border/50 px-5 py-3 flex flex-wrap gap-2` debajo del bloque expanded, renderizado condicionalmente si `linkedEval || linkedFuncEval`.

**Edema dual-format:** El campo `edema` en `analytical_evaluations` puede ser un string legacy o un JSON con circometría. Siempre usar `isNewEdemaFormat(eval.edema)` para detectar el formato antes de renderizar. Si no es exportado de `EdemaCircometryTable.tsx`, HALT según Boundaries.

**navigate(-1) vs ruta hardcodeada:** Usar `navigate(-1)` para el botón Volver — más simple y preserva la posición del scroll. Si el usuario llega directamente a la URL de evaluación (sin historial), navigate(-1) irá al home — aceptable para este scope.

## Verification

**Commands:**
- `npm run build` -- expected: sin errores TypeScript ni de compilación
- `npm run lint` -- expected: sin errores ESLint

**Manual checks (if no CLI):**
- En PatientProfile tab Sesiones: sesión con eval analítica muestra botón "Ver evaluación analítica" sin necesidad de expandir el card
- Click en botón navega a `/patients/:id/evaluations/analytical/:evalId` con datos correctos
- Botón "← Volver" regresa al perfil del paciente
- Sesión sin evaluaciones no muestra ningún botón de evaluación
- Campos sin datos muestran "No registrado" en gris itálico

## Suggested Review Order

**Entrada principal — SessionTimeline**

- Botones de evaluación en footer: siempre visibles si FK existe, fuera del bloque expand
  [`PatientProfile.tsx:1791`](../../src/pages/PatientProfile.tsx#L1791)

- Eliminación de bloques inline de evaluación del expanded content
  [`PatientProfile.tsx:1761`](../../src/pages/PatientProfile.tsx#L1761)

**Página de evaluación analítica**

- Carga paralela de eval + sesión + paciente; guard professional_id en todas las queries
  [`AnalyticalEvaluationPage.tsx:57`](../../src/pages/AnalyticalEvaluationPage.tsx#L57)

- Renderizado de goniometría JSONB y edema dual-format con fallback legacy
  [`AnalyticalEvaluationPage.tsx:87`](../../src/pages/AnalyticalEvaluationPage.tsx#L87)

- Layout de secciones y grid de datos con DataCell / NA
  [`AnalyticalEvaluationPage.tsx:198`](../../src/pages/AnalyticalEvaluationPage.tsx#L198)

**Página de evaluación funcional**

- Misma estructura de carga; professional_id en query de sesión
  [`FunctionalEvaluationPage.tsx:53`](../../src/pages/FunctionalEvaluationPage.tsx#L53)

- Empty-state check completo (incluye health_management, physical_activity, sleep_rest)
  [`FunctionalEvaluationPage.tsx:185`](../../src/pages/FunctionalEvaluationPage.tsx#L185)

**Rutas**

- Dos rutas nuevas registradas dentro de AppLayout
  [`App.tsx:38`](../../src/App.tsx#L38)

## Spec Change Log
