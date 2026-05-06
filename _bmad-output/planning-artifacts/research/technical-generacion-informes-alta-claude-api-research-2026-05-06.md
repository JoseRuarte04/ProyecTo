---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Generación automática de informes de alta con Claude API para Terapia Ocupacional'
research_goals: 'Determinar qué datos exactos leer de las tablas Supabase, cómo estructurar el prompt para generar texto clínico formal en español, qué modelo usar, cómo manejar costos con prompt caching, y cómo integrar en UI con botón en PatientProfile que genere informe editable antes de exportar PDF'
user_name: 'Jose'
date: '2026-05-06'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-05-06
**Author:** Jose
**Research Type:** technical

---

## Research Overview

Investigación técnica sobre generación automática de informes de alta de Terapia Ocupacional usando Claude API, integrada en RehabOT (React 18 + Supabase). Cubre selección de datos, diseño de prompt, modelo y costos, y patrón de integración UI.

---

## Technical Research Scope Confirmation

**Research Topic:** Generación automática de informes de alta con Claude API para Terapia Ocupacional
**Research Goals:** Determinar qué datos exactos leer de las tablas Supabase, cómo estructurar el prompt para generar texto clínico formal en español, qué modelo usar, cómo manejar costos con prompt caching, y cómo integrar en UI con botón en PatientProfile que genere informe editable antes de exportar PDF

**Technical Research Scope:**
- Architecture Analysis - diseño del sistema de generación de informes
- Implementation Approaches - prompt engineering, data mapping, integración React
- Technology Stack - Claude API, Supabase Edge Functions, @anthropic-ai/sdk
- Integration Patterns - flujo de datos Supabase → Claude → UI → PDF
- Performance Considerations - prompt caching, costos, tiempo de respuesta

**Scope Confirmed:** 2026-05-06

---

## Technology Stack Analysis

### Modelo Claude Recomendado

**`claude-sonnet-4-5`** es el modelo óptimo para este caso de uso.

| Modelo | Context Window | Perfil |
|---|---|---|
| `claude-opus-4-5` | 200K tokens | Máxima capacidad, lento y caro — innecesario para informes estructurados |
| **`claude-sonnet-4-5`** | **200K tokens** | **Equilibrio ideal: fuerte generación de texto, costo moderado** |
| `claude-haiku-3-5` | 200K tokens | Rápido y barato, pero calidad clínica inferior |

**Justificación:** Los informes de alta son documentos clínicos formales. Sonnet tiene la capacidad de escritura necesaria sin el costo de Opus. El contexto de 200K es más que suficiente para toda la historia clínica de un paciente.

_Fuente: https://docs.anthropic.com/en/docs/about-claude/models/overview_

### Prompt Caching

Mecanismo que permite reutilizar bloques de contexto repetidos entre requests sin re-procesarlos.

- **Threshold mínimo:** 1,024 tokens (Sonnet/Opus) — el system prompt y datos estáticos del paciente superan esto fácilmente
- **Cómo marcar:** `"cache_control": {"type": "ephemeral"}` en el content block
- **TTL:** 5 minutos — se resetea con cada hit
- **Costo cache read:** ~10% del precio de input normal (ahorro del 90%)
- **Costo cache write:** ~125% del precio de input (overhead one-time)
- **Aplica a system prompts:** ✅ sí — el caso de uso más recomendado

**Estrategia de caching para RehabOT:**
```
[CACHEABLE] System prompt + instrucciones clínicas + ejemplos few-shot
[CACHEABLE] Datos estáticos del paciente (perfil, episodio, anamnesis)
[NO CACHEABLE] Sesiones y evaluaciones (cambian con cada generación)
```

_Fuente: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching_

### Pricing Estimado por Informe

Basado en precios claude-sonnet-4-5 (~$3/M input, ~$15/M output, ~$0.30/M cache read):

| Componente | Tokens estimados | Costo estimado |
|---|---|---|
| System prompt (cache write, 1 vez) | ~800 tokens | ~$0.0024 |
| Datos paciente (cache read, subsecuentes) | ~1,500 tokens | ~$0.00045 |
| Sesiones + evaluaciones (input normal) | ~3,000 tokens | ~$0.009 |
| Output informe (~1,500 palabras) | ~2,000 tokens | ~$0.030 |
| **Total por informe** | **~7,300 tokens** | **~$0.04** |

Para un consultorio con 100 informes/mes: ~$4/mes. Costo operativo negligible.

_Fuente: https://www.anthropic.com/pricing_

### SDK y Arquitectura del Servidor

**`@anthropic-ai/sdk`** (TypeScript) es el cliente oficial.

⛔ **NUNCA llamar Claude API desde el browser** — la API key quedaría expuesta en las DevTools de cualquier usuario. Viola los ToS de Anthropic y permite uso ilimitado billed a la cuenta.

**Arquitectura requerida:**
```
React (PatientProfile) → Supabase Edge Function → Claude API
```

**Supabase Edge Functions** es la solución ideal para RehabOT porque:
- Ya usan Supabase — no requiere backend adicional
- Las Edge Functions corren en Deno (soporte nativo para fetch y env vars)
- La API key vive en `ANTHROPIC_API_KEY` como secret de Supabase
- Se pueden llamar con el cliente Supabase existente: `supabase.functions.invoke()`
- Acceso a la DB directo desde la función con service role si se necesita

### Streaming

Claude API soporta streaming via SSE. En @anthropic-ai/sdk:

```ts
const stream = await client.messages.stream({
  model: "claude-sonnet-4-5",
  max_tokens: 2048,
  messages: [{ role: "user", content: prompt }]
});

for await (const chunk of stream) {
  if (chunk.type === "content_block_delta") {
    // enviar al frontend progresivamente
  }
}
```

Streaming mejora la UX significativamente para informes (~2,000 palabras de output).

_Fuente: https://docs.anthropic.com/en/docs/build-with-claude/streaming_

---

## Integration Patterns Analysis

### Flujo Completo de Datos

```
PatientProfile (React)
  │
  ├─ 1. Usuario hace clic en "Generar Informe de Alta"
  ├─ 2. React consulta Supabase (tablas: patients, treatment_episodes,
  │      patient_clinical_records, patient_occupational_profiles,
  │      therapy_sessions, analytical_evaluations, functional_evaluations)
  ├─ 3. React invoca Supabase Edge Function con los datos ya cargados
  │
  └─ Supabase Edge Function (generate-discharge-report)
       ├─ 4. Construye el prompt con datos del paciente
       ├─ 5. Llama a Claude API (claude-sonnet-4-5) con prompt caching
       ├─ 6. Hace streaming del response de vuelta al cliente
       │
       └─ React recibe stream
            ├─ 7. Muestra texto generándose progresivamente en textarea editable
            └─ 8. Usuario edita → exporta PDF con jsPDF existente
```

### Mapeo de Datos por Sección del Informe

#### Sección 1 — Header / Datos del Paciente
```sql
-- patients
first_name, last_name, dni, birth_date, gender,
phone, insurance, insurances (JSONB), admission_date

-- treatment_episodes
episode_number, admission_date, discharge_date, diagnosis, status

-- patient_clinical_records
diagnosis, treatment_type, injury_date, surgery_date,
injury_mechanism, weeks_post_injury, weeks_post_surgery,
immobilization_type, immobilization_weeks
```

#### Sección 2 — Perfil Ocupacional
```sql
-- patient_occupational_profiles
job, education, dominance, support_network,
avd, aivd, leisure, physical_activity, sleep_rest,
health_management, dash_score
```

#### Sección 3 — Evaluación y Tratamiento (todas las sesiones)
```sql
-- therapy_sessions (ORDER BY session_date ASC, is_deleted = false)
session_number, session_date, session_type, interventions,
evolution, general_observations, avd_followup, home_instructions_sent

-- analytical_evaluations (vinculadas a sesiones)
evaluation_date, pain_score, edema_circummetry (JSONB),
goniometry (JSONB), muscle_strength_daniels (JSONB),
specific_tests (JSONB), scar_evaluation (JSONB), godet_test,
vancouver_score, osas_score

-- functional_evaluations (vinculadas a sesiones)
evaluation_date, quickdash_score, fim_score, barthel_score,
avd, aivd, health_management
```

#### Sección 4 — Evolución y Evaluación Final
```sql
-- PRIMERA analytical_evaluation (ORDER BY evaluation_date ASC LIMIT 1)
-- ÚLTIMA analytical_evaluation (ORDER BY evaluation_date DESC LIMIT 1)
-- Comparar: pain_score, goniometry, muscle_strength_daniels,
--           edema_circummetry, specific_tests

-- PRIMERA functional_evaluation (ORDER BY evaluation_date ASC LIMIT 1)
-- ÚLTIMA functional_evaluation (ORDER BY evaluation_date DESC LIMIT 1)
-- Comparar: quickdash_score, fim_score, barthel_score
```

### Supabase Edge Function — Estructura

```ts
// supabase/functions/generate-discharge-report/index.ts
import Anthropic from "npm:@anthropic-ai/sdk";

Deno.serve(async (req) => {
  const { patientData, episodeData, sessions, evaluations } = await req.json();

  const client = new Anthropic({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
  });

  // Construir prompt con XML tags (ver sección Prompt Design)
  const userPrompt = buildClinicalPrompt(patientData, episodeData, sessions, evaluations);

  // Streaming response
  const stream = client.messages.stream({
    model: "claude-sonnet-4-5",
    max_tokens: 3000,
    temperature: 0,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }, // cachear system prompt
      }
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  // Devolver como SSE stream al cliente React
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
});
```

### Invocación desde React

```ts
// En PatientProfile.tsx — botón "Generar Informe de Alta"
const handleGenerateReport = async () => {
  setGenerating(true);
  setReportText("");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-discharge-report`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ patientData, episodeData, sessions, evaluations }),
    }
  );

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    setReportText((prev) => prev + decoder.decode(value));
  }

  setGenerating(false);
};
```

### Seguridad

- `ANTHROPIC_API_KEY` → Supabase secret (nunca en el cliente)
- La Edge Function valida el JWT de Supabase (`Authorization: Bearer <token>`) antes de llamar a Claude
- RLS del usuario ya garantiza que solo accede a sus propios pacientes en el paso de fetching
- Rate limiting: Supabase Edge Functions tienen límites por defecto; agregar control en la función para max 1 request/paciente simultáneo

_Fuentes: https://supabase.com/docs/guides/functions, https://docs.anthropic.com/en/api-reference/security-and-privacy_

---

## Architectural Patterns and Design

### Diseño del System Prompt Clínico

El system prompt es el componente de mayor impacto. Se cachea con `cache_control: ephemeral` para ahorrar costos en cada llamada posterior.

```
SYSTEM_PROMPT = """
Eres un redactor médico clínico especializado en Terapia Ocupacional.
Redactas informes de alta en español formal de nivel hospitalario, usando
terminología de Terapia Ocupacional precisa. Nunca usas lenguaje coloquial.

REGLAS ABSOLUTAS:
1. Usa EXCLUSIVAMENTE los datos proporcionados dentro de <datos_paciente>.
   Está terminantemente prohibido inferir, estimar o agregar información
   clínica que no esté presente en los datos.
2. Si un campo no tiene datos disponibles, escribe: "No registrado."
3. No establezcas relaciones causales entre hallazgos a menos que estén
   explícitamente indicadas en los datos.
4. No generes diagnósticos diferenciales ni interpretaciones no solicitadas.
5. Todas tus respuestas deben estar en español formal médico.
   No respondas en inglés bajo ninguna circunstancia.
6. Usa construcciones impersonales y voz pasiva donde sea apropiado
   (se observó, se evidencia, se constata).
7. Refiérete al paciente en tercera persona (el paciente / la paciente).

ESTRUCTURA DEL INFORME:
Genera el informe siguiendo EXACTAMENTE esta estructura:

## INFORME DE ALTA — TERAPIA OCUPACIONAL

### 1. DATOS DEL PACIENTE
[datos de identificación y diagnóstico]

### 2. PERFIL OCUPACIONAL
[historia ocupacional, roles, actividades de la vida diaria]

### 3. EVALUACIÓN Y TRATAMIENTO
[resumen cronológico del proceso terapéutico]

### 4. EVOLUCIÓN Y EVALUACIÓN FINAL
[comparación primera vs última evaluación, resultados de escalas]

### RECOMENDACIONES DE ALTA
[indicaciones para continuar en domicilio — solo si hay datos]
"""
```

### Estructura del User Prompt con XML Tags

XML tags > JSON para datos clínicos. Claude mapea la jerarquía XML a secciones del informe de forma natural y permite instrucciones de boundary precisas.

```xml
<datos_paciente>
  <identificacion>
    <nombre>María García</nombre>
    <dni>28.456.789</dni>
    <fecha_nacimiento>1978-03-15</fecha_nacimiento>
    <genero>Femenino</genero>
    <obra_social>OSDE</obra_social>
  </identificacion>

  <episodio>
    <numero>1</numero>
    <fecha_admision>2026-02-10</fecha_admision>
    <fecha_alta>2026-05-06</fecha_alta>
    <diagnostico>Fractura de radio distal derecho post-quirúrgico</diagnostico>
    <tipo_tratamiento>Quirúrgico</tipo_tratamiento>
    <fecha_cirugia>2026-02-05</fecha_cirugia>
    <semanas_post_cirugia>13</semanas_post_cirugia>
  </episodio>

  <perfil_ocupacional>
    <trabajo>Docente primaria — activa</trabajo>
    <dominancia>Derecha</dominancia>
    <avd>Independiente con dificultades en tareas bimanuales</avd>
    <aivd>Cocina y tareas del hogar con adaptaciones</aivd>
    <red_apoyo>Pareja e hijos en domicilio</red_apoyo>
    <actividad_fisica>Caminatas diarias previo a la lesión</actividad_fisica>
  </perfil_ocupacional>

  <sesiones>
    <sesion numero="1" fecha="2026-02-12" tipo="admision">
      <intervenciones>Evaluación inicial, movilización activo-asistida de muñeca</intervenciones>
      <evolucion>Limitación severa de movilidad. Edema moderado en dorso de mano.</evolucion>
    </sesion>
    <sesion numero="2" fecha="2026-02-19" tipo="seguimiento">
      <intervenciones>Ejercicios de deslizamiento de tendones, desensibilización cicatriz</intervenciones>
      <evolucion>Leve mejoría en flexión de dedos. Dolor EVA 6/10.</evolucion>
    </sesion>
    <!-- ... resto de sesiones ... -->
  </sesiones>

  <evaluaciones>
    <evaluacion_analitica tipo="inicial" fecha="2026-02-12">
      <dolor_eva>8</dolor_eva>
      <goniometria>
        <muneca_flexion_activa>20</muneca_flexion_activa>
        <muneca_extension_activa>15</muneca_extension_activa>
        <prension_kg>3.2</prension_kg>
      </goniometria>
    </evaluacion_analitica>
    <evaluacion_analitica tipo="final" fecha="2026-05-01">
      <dolor_eva>2</dolor_eva>
      <goniometria>
        <muneca_flexion_activa>62</muneca_flexion_activa>
        <muneca_extension_activa>55</muneca_extension_activa>
        <prension_kg>14.8</prension_kg>
      </goniometria>
    </evaluacion_analitica>
    <evaluacion_funcional tipo="inicial" fecha="2026-02-12">
      <quickdash>72.7</quickdash>
      <barthel>85</barthel>
    </evaluacion_funcional>
    <evaluacion_funcional tipo="final" fecha="2026-05-01">
      <quickdash>18.2</quickdash>
      <barthel>100</barthel>
    </evaluacion_funcional>
  </evaluaciones>
</datos_paciente>

Redacta el informe de alta completo siguiendo la estructura indicada en el
system prompt. Usa ÚNICAMENTE los datos dentro de <datos_paciente>.
```

### Estrategia Anti-Alucinación (capas)

| Capa | Técnica | Implementación |
|---|---|---|
| **Nivel prompt** | Data-boundary instruction | `"Usa EXCLUSIVAMENTE los datos en <datos_paciente>"` |
| **Nivel prompt** | Fallback explícito | `"Si un campo no tiene datos, escribe: No registrado."` |
| **Nivel prompt** | Prohibición de inferencia | `"No establezcas relaciones causales no presentes en los datos"` |
| **Nivel API** | Temperature cero | `temperature: 0` en el API call |
| **Nivel prompt** | Formato de output fijo | Secciones numeradas estrictas en system prompt |
| **Nivel UX** | Edición humana obligatoria | El informe siempre pasa por revisión antes de PDF |

**Confianza:** Con temperature: 0 + XML boundary + fallback "No registrado", la tasa de alucinación en Claude es mínima para tareas de transcripción estructurada. El paso de edición humana es la red de seguridad final.

_Fuente: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/reduce-hallucinations_

### UI Architecture — Componente DischargeReportModal

```
PatientProfile (tab: Administración o nuevo tab Informes)
  └─ <Button> "Generar Informe de Alta"
       │
       └─ <DischargeReportModal>
            ├─ Estado: idle → generating → ready → exported
            ├─ [generating] Skeleton + texto streaméandose en textarea readonly
            ├─ [ready] <Textarea> editable con el informe generado
            │   ├─ Altura: auto-expand (min 400px)
            │   └─ Estilo: font-mono para distinguir del resto de la UI
            ├─ Botones:
            │   ├─ "Regenerar" (vuelve a idle, confirma antes)
            │   ├─ "Exportar PDF" → usa patrón html2canvas+jsPDF existente
            │   └─ "Cerrar"
            └─ Nota: "Revisá el informe antes de exportar"
```

**Estados del componente:**

```ts
type ReportState = "idle" | "generating" | "ready" | "exporting";

// Hook sugerido
function useDischargeReport(patientId: string, episodeId: string) {
  const [state, setState] = useState<ReportState>("idle");
  const [reportText, setReportText] = useState("");

  const generate = async () => {
    setState("generating");
    setReportText("");
    // fetch + stream...
    setState("ready");
  };

  return { state, reportText, setReportText, generate };
}
```

**Integración con PDF existente:**
El proyecto ya tiene `PlanPdfExport.tsx` y `ExercisePdfExport.tsx` con el patrón `html2canvas → jsPDF`. El informe de alta sigue el mismo patrón: renderizar el textarea en un div estilizado → capturar con html2canvas → generar PDF.

### Checklist de Implementación

**Fase 1 — Backend (Edge Function):**
- [ ] Crear `supabase/functions/generate-discharge-report/index.ts`
- [ ] Configurar secret `ANTHROPIC_API_KEY` en Supabase Dashboard
- [ ] Instalar `@anthropic-ai/sdk` como dependencia npm en la función
- [ ] Implementar validación JWT del request
- [ ] Implementar `buildClinicalPrompt()` con XML tags
- [ ] Deploy y test con `supabase functions serve`

**Fase 2 — Frontend (React):**
- [ ] Crear hook `useDischargeReport()`
- [ ] Crear componente `DischargeReportModal.tsx`
- [ ] Agregar botón en PatientProfile (tab Administración o nuevo tab)
- [ ] Implementar lectura de stream progresivo
- [ ] Implementar textarea editable
- [ ] Integrar exportación PDF con patrón existente

**Fase 3 — Datos:**
- [ ] Query Supabase para obtener todos los datos del episodio
- [ ] Formatear JSONB (goniometry, edema_circummetry, muscle_strength_daniels) a XML legible
- [ ] Seleccionar primera y última evaluación para sección de evolución

---

## Implementation Approaches and Technology Adoption

### Estrategia de Adopción

**Enfoque gradual recomendado** — no requiere cambios al stack existente:

1. La Edge Function es completamente independiente del frontend actual
2. La única dependencia nueva es `@anthropic-ai/sdk` (dentro de la función Deno, no en el bundle de React)
3. El botón en PatientProfile se puede agregar detrás de un feature flag o simplemente disponible solo cuando existe un episodio activo con sesiones
4. El patrón de exportación PDF ya existe — reutilizar sin modificar

**No requiere:**
- Cambios en `package.json` del frontend
- Nuevas tablas en Supabase
- Cambios en el schema existente
- Configuración de CI/CD adicional

### Testing Strategy

**Testing de la Edge Function (local):**
```bash
supabase functions serve generate-discharge-report --env-file .env.local
# Luego POST con datos de prueba ficticios
curl -X POST http://localhost:54321/functions/v1/generate-discharge-report \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"patientData": {...}, "sessions": [...]}'
```

**Testing del prompt (iterativo):**
- Usar Anthropic Console (console.anthropic.com) para iterar el prompt antes de hardcodearlo en la función
- Probar con datos reales anonimizados de pacientes de prueba
- Validar que "No registrado" aparece correctamente cuando faltan datos
- Validar que no hay alucinaciones comparando output con datos de entrada

**Testing de UI:**
- Estado `generating`: verificar que el texto aparece progresivamente
- Estado `ready`: verificar que el textarea es editable
- Estado `exporting`: verificar que el PDF generado tiene el formato correcto

### Cost Optimization

**Prompt caching efectivo:**
```ts
// El system prompt se cachea automáticamente si supera 1,024 tokens
// Con cache_control: ephemeral en el system prompt block
// La primera llamada escribe al caché (~$0.0024)
// Llamadas siguientes dentro de 5 min leen del caché (~$0.00014)
```

**Optimización del input:**
- Solo incluir sesiones del episodio activo (no historial de episodios anteriores)
- Para pacientes con muchas sesiones (>20), incluir solo intervenciones y evolución — omitir campos redundantes
- Limitar `general_observations` a 200 caracteres si es muy extenso

**Límite de tokens:**
- `max_tokens: 3000` es suficiente para un informe completo (~2,000 palabras)
- El contexto de 200K de Sonnet es más que suficiente incluso para pacientes con historiales extensos

### Risk Assessment

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Alucinación clínica | Baja (con temperature:0 + XML) | Alto | Edición humana obligatoria antes de PDF |
| Exposición API key | Nula (Edge Function) | Crítico | API key solo en secrets de Supabase |
| Latencia >30s | Media (pacientes con muchas sesiones) | Medio | Streaming visible + indicador de progreso |
| Costo inesperado | Baja (~$0.04/informe) | Bajo | Monitorear uso en Anthropic Console |
| Edge Function cold start | Baja | Bajo | Supabase Functions tienen cold starts de ~500ms — aceptable |
| JSONB mal formateado | Media | Medio | Validar JSONB antes de construir XML; fallback a "No registrado" |

### Manejo de JSONB Clínico

Los campos JSONB de `analytical_evaluations` requieren deserialización antes de incluirlos en el XML:

```ts
// Ejemplo: goniometry JSONB → XML legible
function gonioToXml(goniometry: Record<string, any>): string {
  if (!goniometry) return "<goniometria>No registrado.</goniometria>";
  
  const entries = Object.entries(goniometry)
    .map(([joint, values]) => {
      const vals = Object.entries(values as Record<string, any>)
        .map(([movement, degrees]) => `<${movement}>${degrees}°</${movement}>`)
        .join("\n");
      return `<${joint}>\n${vals}\n</${joint}>`;
    })
    .join("\n");
  
  return `<goniometria>\n${entries}\n</goniometria>`;
}

// edema_circummetry JSONB → XML
function edemaToXml(edema: Record<string, any>): string {
  if (!edema) return "<edema>No registrado.</edema>";
  // Detectar formato legacy (string) vs nuevo (JSON con circometría)
  // Usar isNewEdemaFormat() existente en EdemaCircometryTable.tsx
}
```

---

## Technical Research Recommendations

### Recomendaciones Finales

**1. Modelo:** `claude-sonnet-4-5` — no usar Haiku (calidad insuficiente para texto clínico formal) ni Opus (costo innecesario)

**2. Arquitectura:** Supabase Edge Function obligatoria — nunca llamar Claude desde el browser

**3. Prompt:** XML tags + temperature:0 + 5 capas anti-alucinación — no simplificar

**4. UX:** Streaming visible + textarea editable + revisión humana obligatoria — el informe es un borrador asistido, no output final automático

**5. Costo:** ~$0.04/informe con prompt caching activo — negligible para un consultorio

### Implementation Roadmap

| Fase | Tarea | Esfuerzo estimado |
|---|---|---|
| 1 | Edge Function + ANTHROPIC_API_KEY secret | 2-3 horas |
| 2 | `buildClinicalPrompt()` con JSONB formatters | 3-4 horas |
| 3 | Hook `useDischargeReport()` + streaming | 2 horas |
| 4 | `DischargeReportModal.tsx` + UI | 3-4 horas |
| 5 | Integración PDF con patrón existente | 1-2 horas |
| 6 | Testing con datos reales + ajuste del prompt | 2-3 horas |
| **Total** | | **~13-18 horas** |

### Success Metrics

- Informe generado en < 45 segundos para pacientes con hasta 20 sesiones
- Cero alucinaciones detectadas en revisión clínica post-generación
- Terapista reduce tiempo de escritura de informe de alta de ~2 horas a ~15 minutos (revisión + edición)
- Costo mensual < $10 USD para volumen típico de consultorio individual

_Fuentes principales: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering, https://supabase.com/docs/guides/functions/quickstart, https://www.anthropic.com/pricing_
