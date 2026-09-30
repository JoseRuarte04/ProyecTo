# Ajustes de alta, perfil ocupacional y wizard de sesión

## Contexto

Seis cambios pedidos por Jose el 2026-09-30, sin relación entre sí más que tocar
formularios de paciente/sesión. Se agrupan acá porque se planearon juntos, pero
se implementan como PRs chicos independientes (regla de commits chicos del
proyecto), en el orden de abajo (de menor a mayor riesgo/alcance).

Mapeado contra el código real el 2026-09-30 (ver `TASKS.md` si alguno de estos
paths cambia por trabajo de Javito en paralelo — confirmar contra `main`
actualizado antes de arrancar cada ítem).

---

## 1. Dolor: "Intensidad EVA" → "END"

**Archivo:** `src/components/session/steps/AnaliticaStep.tsx:206` (label del
`Slider` dentro de cada `PainEntry`).

Cambio de label únicamente: `"Intensidad EVA (0-10)"` → `"END (0-10)"`
(Escala Numérica del Dolor). La variable interna (`eva` dentro del array
`pains`, columna `pains: Json`) **no se renombra** — mismo dato, mismo rango
0-10, solo cambia cómo se llama en la UI. Sin migración.

**Riesgo:** ninguno. Es el ítem más chico de todos.

---

## 2. Perfil ocupacional: reordenar los 5 campos

Orden actual → orden pedido:

| Actual | Nuevo |
|---|---|
| Dominancia | Nivel educativo |
| Estado civil | Trabajo |
| Nivel educativo | Estado civil |
| Red de apoyo | Red de apoyo |
| Trabajo | Dominancia |

**Archivos:**
- `src/components/session/steps/PerfilOcupacionalStep.tsx` (líneas 43-56) —
  único lugar donde esto se **edita** (confirmado: `FichaTab.tsx` es de solo
  lectura, no hay edición de perfil ocupacional desde la ficha pese a lo que
  decía `PROJECT_STATE.md`).
- `src/components/patients/tabs/FichaTab.tsx` (líneas 113-117) — vista de solo
  lectura, reordenar para que coincida con el nuevo orden.

Puro reorder de JSX, sin tocar el schema. Sin migración.

**Riesgo:** ninguno.

---

## 3. Preferencia de nombre en el alta

Campo nuevo, no existe nada parecido hoy.

**Migración:** `patients.preferred_name text NULL` (opcional — no todos los
pacientes tienen o necesitan uno).

**Archivos:**
- `src/components/patients/NewPatientForm.tsx`: agregar `<Input>` después de
  Nombre (línea 321, antes de Tipo de documento), sumar al state (líneas
  86-87) y al insert de `patients` (líneas ~187-193).
- `src/components/patients/dialogs/EditFichaDialog.tsx`: mismo campo en la
  sección "Datos personales" (líneas 142-168), para poder cargarlo/editarlo
  después del alta.

**Decisión pendiente chica:** dónde se usa después de cargado (¿reemplaza el
nombre de pila en textos generados tipo informes de alta, o es solo
informativo en la ficha?). Si no se especifica, se implementa como
informativo únicamente en esta primera vuelta — mostrar/usarlo en otros
lugares queda en `TASKS.md` como candidato.

**Riesgo:** bajo. Migración simple, campo opcional.

---

## 4. Evaluación funcional: título + escalas estandarizadas al final

**Archivo:** `src/components/session/steps/FuncionalStep.tsx`.

Orden actual de render: Barthel (línea 46) → FIM (47) → heading "1.
Ocupaciones" + checklist de 47 ítems (49-57) → `PerformanceContextSections`
(59).

Orden pedido: Ocupaciones + Contextos primero, y al final un bloque con
título **"Evaluaciones estandarizadas para índices"** conteniendo Barthel →
FIM → QuickDASH (ver ítem 6 — QuickDASH todavía no está en este step, se
integra ahí).

Cambio: mover el JSX de Barthel/FIM de las líneas 46-47 a después de
`PerformanceContextSections`, envueltos en un `SectionCard`/heading nuevo con
ese título. Sin migración — puro reorder + un `<h3>` nuevo.

**Riesgo:** bajo. Depende de que el ítem 6 (QuickDASH) esté listo para que el
bloque quede completo — se puede hacer este reorder primero con Barthel/FIM
solamente, y sumar QuickDASH al final cuando esté el ítem 6.

---

## 5. Intervenciones ↔ Evolución: renombrar, agregar Objetivo, eliminar el paso viejo

Dos cosas hoy se llaman distinto de lo que van a llamarse, y hay que tener
cuidado de no confundirlas con la tab "Evolución" de la ficha del paciente
(`PatientProfile.tsx`, dashboard de solo lectura con gráficos — **esa no se
toca**, es un componente completamente distinto).

**Estado actual (steps del wizard de sesión):**
- `CierreStep.tsx` (`id="sec-intervenciones"`, línea 18): un textarea
  "En el día de hoy se abordó" → columna `therapy_sessions.interventions`.
- `EvolucionStep.tsx`: 4 textareas — Nota general (`general_observations`),
  Cambios en síntomas (`symptom_changes`), Cambios clínicos
  (`clinical_changes`), AVD-seguimiento (`avd_followup`).

**Cambio pedido:**
1. Eliminar `EvolucionStep.tsx` del wizard (dejar de renderizarlo en
   `SessionForm.tsx`). Las 4 columnas de `therapy_sessions` que usaba quedan
   en la base sin borrar y sin UI — mismo patrón ya usado para "Plan de
   tratamiento" (cerrado 2026-09-15). Anotar en `TASKS.md` como deprecadas.
   **Confirmado con Jose: no se migran a ningún lado, se dejan de usar.**
2. Dentro de `CierreStep.tsx`: agregar heading **"Objetivos"** arriba del
   contenido, y un campo nuevo **Objetivo** (textarea libre, un campo por
   sesión — **confirmado con Jose**, no es una lista estructurada).
3. Renombrar la sección/step de "Intervenciones" a **"Evolución"** (label +
   título del `SectionCard`; el archivo puede seguir llamándose
   `CierreStep.tsx` internamente, o renombrarse — a decidir al implementar,
   no afecta a la UI).

**Migración:** columna nueva, ej. `therapy_sessions.session_goals text NULL`.

**Archivos:** `src/components/session/steps/CierreStep.tsx`,
`src/pages/SessionForm.tsx` (para sacar `EvolucionStep` de la lista de
steps), `src/integrations/supabase/types.ts` (regenerar tipos tras la
migración).

**Riesgo:** medio. Es un cambio de UX real (dos pasos se convierten en uno
renombrado) — conviene avisar al equipo (Javito) porque cambia el flujo que
ya conocen. Ojo con el nombre "Evolución" duplicado con la tab de solo
lectura de `PatientProfile.tsx` — no es un bug, pero puede generar confusión
en la UI si en algún momento aparecen ambas cerca (wizard vs ficha).

---

## 6. Integrar QuickDASH al wizard de sesión (el más grande)

**Estado actual:** QuickDASH es un flujo separado, auto-administrado por el
paciente vía link público (`/q/:token`, `QuickDashPublicPage.tsx`), con su
propia tabla `quickdash_tokens` (`quickdash_score`, `quickdash_items`). No
está integrado al wizard donde sí están Barthel y FIM.

**Decisión de Jose:** integrar el cuestionario completo para que el
terapeuta también pueda completarlo dentro de la sesión, no solo el
paciente por link.

**Hallazgo clave del mapeo (2026-09-30):** `functional_evaluations` — la
misma tabla donde ya viven `barthel_score`/`barthel_items` y
`fim_score`/`fim_items`, ya atada a `session_id` — **ya tiene las columnas
`quickdash_items`/`quickdash_score` sin usar** (`types.ts:1060-1061`). Nadie
las escribe hoy. Es el lugar natural para esto, no hace falta inventar
columnas nuevas para el caso del profesional.

`quickdash_tokens` (el link del paciente) hoy vive atado a **episodio**
(`episode_id`), no a sesión — un mismo resultado vale para todo el
tratamiento. Tiene además una columna `session_id` **huérfana**: existió al
principio (migración `20260511123816`), se dejó de usar al pasar a
`episode_id` (`20260512000001`), pero la FK nunca se borró.

**Decisiones confirmadas con Jose (2026-09-30):**
1. QuickDASH pasa a ser **por sesión**, igual que Barthel/FIM — no por
   episodio como hoy.
2. Es uno o el otro (paciente vía link, o profesional en el wizard) — **si el
   profesional completa el suyo después de que el paciente ya completó el
   link para esa misma sesión, el del profesional pisa/reemplaza** al del
   paciente como valor vigente de esa sesión.

**Diseño resultante:**
- Dentro de `FuncionalStep.tsx`, en el bloque del ítem 4 (después de Barthel
  y FIM): reusar `QuickDashSection` (`FunctionalScales.tsx:8-116`, hoy sin
  uso en el wizard) para que el profesional lo complete ahí mismo. Al
  guardar la sesión, escribe `quickdash_items`/`quickdash_score` en la fila
  de `functional_evaluations` de **esa sesión puntual** (mismo patrón que
  Barthel/FIM).
- Botón alternativo "enviar QuickDASH al paciente" dentro del mismo bloque:
  genera un token para que lo complete por link, igual que hoy — pero hay
  que **migrar `create_quickdash_token` de `episode_id` a `session_id`**
  (revivir la columna huérfana) para que el token quede atado a esta sesión
  y no al episodio completo. Los 2 callers actuales
  (`QuickDashEpisodeSection.tsx`, `EvaluacionesTab.tsx`) usan el flujo viejo
  por episodio — ver más abajo.
- `complete_quickdash_token` (la RPC que el paciente dispara desde
  `/q/:token`) necesita un paso más: además de guardar en
  `quickdash_tokens.result` (como hoy), escribir también
  `quickdash_items`/`quickdash_score` en la fila de `functional_evaluations`
  de la sesión asociada al token (`session_id`, ahora poblado). Así, sea cual
  sea el orden en que se completen (paciente primero y después el
  profesional, o al revés), el último guardado en `functional_evaluations`
  es el vigente — resuelve el "pisa al otro" sin lógica extra de prioridad.

**Dos cosas a resolver al implementar este ítem (no bloquean el plan, pero
hay que decidirlas ahí):**
- `QuickDashEpisodeSection.tsx`/`EvaluacionesTab.tsx` (el flujo actual por
  episodio, en la tab "Evaluaciones" de la ficha, fuera del wizard) queda
  redundante si QuickDASH pasa a vivir por sesión en el wizard — evaluar si
  se deprecia ese flujo o convive con un significado distinto ("QuickDASH de
  referencia del episodio" vs "QuickDASH de esta sesión"). Recomendación:
  deprecarlo, para no tener dos lugares que hacen lo mismo con alcances
  distintos.
- `usePatientDashboard.ts` arma la serie temporal de QuickDASH para los
  gráficos de evolución leyendo `quickdash_tokens` por episodio
  (`PatientProfile.tsx:125`). Si pasa a ser por sesión, esa serie debería
  pasar a leer `functional_evaluations.quickdash_score` (consistente con
  cómo se gráfica todo lo demás que es por sesión), no `quickdash_tokens`.

**Migración:** ninguna columna nueva en `functional_evaluations` (ya
existen). Sí: `ALTER` para volver a poblar `quickdash_tokens.session_id`
como el vínculo activo (dejar `episode_id` nullable/deprecado en vez de
borrarlo, mismo patrón de deprecar-sin-borrar del resto del proyecto), y
actualizar las funciones `create_quickdash_token`/`complete_quickdash_token`.

**Riesgo:** alto — es el ítem más grande, cambia el modelo de datos de un
flujo que ya está en producción y funcionando (por episodio) a uno nuevo
(por sesión), y toca 2 pantallas que hoy no tienen nada que ver con el
wizard. Dejar para el final. El ítem 4 se puede mergear primero solo con
Barthel/FIM reordenados, y sumar QuickDASH al layout cuando este ítem esté
listo.

---

## Orden de implementación sugerido

1. Dolor EVA → END
2. Reordenar Perfil ocupacional
3. Preferencia de nombre en el alta
4. Evaluación funcional: título + Barthel/FIM al final (sin QuickDASH todavía)
5. Intervenciones → Evolución (eliminar paso viejo, agregar Objetivo, renombrar)
6. Integrar QuickDASH al wizard (el más grande, con la decisión de diseño a
   reconfirmar antes de arrancar)

Cada ítem = 1 rama + 1 PR, regla de WIP=1 del proyecto: no arrancar el
siguiente hasta cerrar (mergear o pausar con motivo) el anterior en
`PROJECT_STATE.md`.
