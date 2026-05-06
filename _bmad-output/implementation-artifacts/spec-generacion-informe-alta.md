---
title: 'Generación de Informe de Alta con Claude API'
type: 'feature'
created: '2026-05-06'
status: 'done'
baseline_commit: '6fe83ab88e5e6275bdf11a1c9845568ecc04391f'
context:
  - '_bmad-output/planning-artifacts/research/technical-generacion-informes-alta-claude-api-research-2026-05-06.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Las terapistas escriben manualmente el informe de alta (2+ horas de trabajo), resumiendo todo el historial clínico del episodio sin apoyo de la app.

**Approach:** Botón "Generar Informe de Alta" en el tab Administración de PatientProfile → Supabase Edge Function que consulta los datos del episodio y llama a Claude API (`claude-sonnet-4-5`, temperature 0, prompt en XML) → el texto se muestra en streaming dentro de un modal con textarea editable → el usuario revisa, edita y exporta como PDF.

## Boundaries & Constraints

**Always:**
- `ANTHROPIC_API_KEY` vive solo como Supabase secret — nunca en el cliente
- `temperature: 0` en todas las llamadas a Claude
- Datos del paciente enviados al prompt en XML tags (no JSON plano)
- El informe generado NO se guarda en DB — es un borrador efímero
- Usar `session.access_token` como Bearer token para autenticar la Edge Function
- Solo habilitar el botón si existe un episodio activo con al menos una sesión

**Ask First:**
- Si el paciente tiene múltiples episodios: preguntar cuál episodio usar antes de proceder

**Never:**
- Llamar a Claude API directamente desde el browser/React
- Crear nuevas tablas ni modificar el schema existente
- Guardar el texto generado en ninguna tabla de Supabase
- Usar `moment.js` o `react-toastify`
- Instalar librerías UI adicionales

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Generación exitosa | Episodio activo con sesiones y evaluaciones | Modal muestra texto streaméandose; al finalizar, textarea editable | — |
| Sin evaluaciones | Episodio con solo sesiones, sin analytical/functional evaluations | Se genera igual; secciones sin datos muestran "No registrado." | — |
| Error de red / Claude API down | fetch falla o stream interrumpido | Toast de error con `toast` de sonner; botón vuelve a estado idle | Mostrar mensaje "Error al generar el informe. Intentá de nuevo." |
| Múltiples episodios | Paciente con >1 episodio | HALT: preguntar cuál episodio antes de proceder | — |

</frozen-after-approval>

## Code Map

- `supabase/functions/generate-discharge-report/index.ts` — nueva Edge Function Deno: valida JWT, consulta datos, construye XML prompt, llama Claude con streaming
- `src/hooks/useDischargeReport.ts` — nuevo hook: maneja estados idle/generating/ready/exporting, lee stream, expone reportText y setReportText
- `src/components/patients/DischargeReportModal.tsx` — nuevo modal: muestra skeleton durante generación, textarea editable cuando ready, botones Regenerar/Exportar PDF/Cerrar
- `src/pages/PatientProfile.tsx` — agregar botón "Generar Informe de Alta" en el tab `admin`, importar y montar `DischargeReportModal`

## Tasks & Acceptance

**Execution:**
- [x] `supabase/functions/generate-discharge-report/index.ts` — crear Edge Function: validar Bearer JWT con `createClient` y `getUser()`; recibir `{ patientId, episodeId }` en el body; consultar `patients`, `treatment_episodes`, `patient_clinical_records`, `patient_occupational_profiles`, `therapy_sessions` (is_deleted=false, order by session_date), `analytical_evaluations` (primera y última por evaluation_date), `functional_evaluations` (primera y última por evaluation_date); construir XML prompt; llamar `claude-sonnet-4-5` con `temperature:0`, `max_tokens:3000`, `cache_control:{type:"ephemeral"}` en el system prompt block; retornar stream como `text/plain` chunked
- [x] `src/hooks/useDischargeReport.ts` — crear hook `useDischargeReport(patientId, episodeId, session)`: estado `ReportState = "idle"|"generating"|"ready"|"exporting"`; función `generate()` que hace fetch al endpoint de la Edge Function con Bearer token y lee el ReadableStream progresivamente con `getReader()`; exponer `{ state, reportText, setReportText, generate, reset }`
- [x] `src/components/patients/DischargeReportModal.tsx` — crear modal usando `Dialog` de `@/components/ui/dialog`: estado generating → skeleton animado + textarea readonly con texto acumulado; estado ready → `Textarea` editable (min-h-[500px], font-mono text-sm); botones: "Regenerar" (confirma con Alert antes de resetear), "Exportar PDF" (usa jsPDF directamente con `splitTextToSize` como patrón de ExercisePdfExport), "Cerrar"; nota "Revisá el informe antes de exportar" en footer
- [x] `src/pages/PatientProfile.tsx` — en el TabsContent value="admin", agregar sección "Informe de Alta" con botón "Generar Informe de Alta" (disabled si no hay episodio activo o no hay sesiones); importar y montar `DischargeReportModal` con open/setOpen state; si el paciente tiene múltiples episodios con status="active", mostrar Select para elegir episodio antes de abrir el modal

**Acceptance Criteria:**
- Given un paciente con episodio activo y al menos una sesión, when el usuario hace click en "Generar Informe de Alta" en el tab Administración, then el modal se abre y el texto del informe aparece progresivamente en el textarea
- Given el informe generado visible en el modal, when el usuario hace click en "Exportar PDF", then se descarga un PDF con el contenido del textarea
- Given el modal en estado ready, when el usuario edita el textarea, then los cambios se preservan y el PDF exportado refleja la versión editada
- Given un error en la llamada a la Edge Function, when falla el fetch o el stream, then aparece un toast de error con sonner y el modal vuelve al estado idle
- Given el botón "Generar Informe de Alta", when el episodio no tiene ninguna sesión cargada, then el botón está disabled

## Design Notes

**System prompt (hardcoded en la Edge Function):**
```
Eres un redactor médico clínico especializado en Terapia Ocupacional. Redactas informes de alta en español formal de nivel hospitalario. REGLAS: 1) Usa EXCLUSIVAMENTE los datos en <datos_paciente>. 2) Si un campo no tiene datos, escribe "No registrado." 3) No establezcas relaciones causales no presentes en los datos. 4) Responde solo en español formal médico.
Estructura: ## INFORME DE ALTA — TERAPIA OCUPACIONAL / ### 1. DATOS DEL PACIENTE / ### 2. PERFIL OCUPACIONAL / ### 3. EVALUACIÓN Y TRATAMIENTO / ### 4. EVOLUCIÓN Y EVALUACIÓN FINAL / ### RECOMENDACIONES DE ALTA
```

**PDF export:** Usar `jsPDF` directamente (patrón de `ExercisePdfExport.tsx`): `doc.splitTextToSize(reportText, 170)` con paginación automática. Sin html2canvas (el textarea es texto plano).

**JSONB nullables:** Los campos `goniometry`, `edema_circummetry`, `muscle_strength_daniels` pueden ser null — verificar antes de serializar a XML; si null, omitir el tag o escribir "No registrado."

## Verification

**Commands:**
- `npm run lint` -- expected: 0 errors
- `npm run build` -- expected: build exitoso sin errores de TypeScript

**Manual checks:**
- Abrir PatientProfile de un paciente con episodio activo y sesiones → tab Administración → botón visible y habilitado
- Click en botón → modal se abre → texto aparece progresivamente
- Editar el texto en el textarea → click Exportar PDF → PDF descargado con ediciones incluidas
- Abrir PatientProfile de un paciente sin sesiones → botón disabled

## Spec Change Log
