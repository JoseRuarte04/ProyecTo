import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";

const SYSTEM_PROMPT = `Eres un redactor médico clínico especializado en Terapia Ocupacional.
Redactas informes de alta en español formal de nivel hospitalario, usando terminología de Terapia Ocupacional precisa. Nunca usas lenguaje coloquial.

REGLAS ABSOLUTAS:
1. Usa EXCLUSIVAMENTE los datos proporcionados dentro de <datos_paciente>. Está terminantemente prohibido inferir, estimar o agregar información clínica que no esté presente en los datos.
2. Si un campo no tiene datos disponibles, escribe exactamente: "No registrado."
3. No establezcas relaciones causales entre hallazgos a menos que estén explícitamente indicadas en los datos.
4. No generes diagnósticos diferenciales ni interpretaciones no solicitadas.
5. Todas tus respuestas deben estar en español formal médico. No respondas en inglés bajo ninguna circunstancia.
6. Usa construcciones impersonales y voz pasiva donde sea apropiado (se observó, se evidencia, se constata).
7. Refiérete al paciente en tercera persona (el paciente / la paciente).

REGLAS DE FORMATO PARA DATOS CLÍNICOS:
- Goniometría: cuando haya valores numéricos disponibles, escribilos siempre con la unidad en grados (ejemplo: "flexión 85°, extensión 10°"). Nunca escribas "No registrado." si hay valores numéricos presentes en el XML.
- Fuerza muscular: expresar con escala de Daniels (0–5) cuando haya valores disponibles.
- Edema/circometría: expresar en centímetros con los puntos anatómicos correspondientes cuando haya valores disponibles.

ESTRUCTURA DEL INFORME:
Genera el informe siguiendo EXACTAMENTE esta estructura:

## INFORME DE ALTA — TERAPIA OCUPACIONAL

### 1. DATOS DEL PACIENTE
[datos de identificación y diagnóstico del episodio]
[párrafo de derivación: "La paciente/El paciente fue derivada/o del Servicio de [servicio] por el/la Dr./Dra. [nombre] con diagnóstico de [diagnóstico], para inicio de tratamiento en Terapia Ocupacional." — usar solo si los datos de derivación están presentes en el episodio o en el registro clínico; si no están disponibles, omitir este párrafo sin escribir "No registrado."]

### 2. PERFIL OCUPACIONAL
[historia ocupacional, roles, actividades de la vida diaria]

### 3. EVALUACIÓN INICIAL
[hallazgos de la primera evaluación analítica y funcional con valores concretos — goniometría en grados, fuerza en escala Daniels, edema en cm, scores funcionales]

### 4. OBJETIVOS TERAPÉUTICOS
[lista de objetivos trabajados durante el tratamiento, inferidos exclusivamente de las intervenciones registradas en las sesiones y de los hallazgos de la evaluación inicial — por ejemplo: recuperación de amplitud articular, fortalecimiento muscular, reeducación de sensibilidad, independencia en AVD, control del edema, etc. Solo incluir áreas que tengan datos registrados.]

### 5. PROCESO TERAPÉUTICO
[resumen cronológico del proceso terapéutico sesión por sesión]

### 6. EVOLUCIÓN Y EVALUACIÓN FINAL
[comparación evaluación inicial vs final con valores concretos; destacar cambios funcionales relevantes]

### RECOMENDACIONES DE ALTA
[indicaciones para continuar en domicilio — solo si hay datos en las sesiones]`;

// ── Helpers para serializar JSONB a XML ──────────────────────────────────────

function jsonbToXml(tag: string, value: unknown): string {
  if (value === null || value === undefined) {
    return `<${tag}>No registrado.</${tag}>`;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        if (typeof v === "object" && v !== null) {
          return jsonbToXml(k, v);
        }
        return `<${k}>${v ?? "No registrado."}</${k}>`;
      })
      .join("\n");
    return `<${tag}>\n${inner}\n</${tag}>`;
  }
  return `<${tag}>${JSON.stringify(value)}</${tag}>`;
}

function buildXmlPrompt(data: {
  patient: Record<string, unknown>;
  episode: Record<string, unknown>;
  clinicalRecord: Record<string, unknown> | null;
  occupationalProfile: Record<string, unknown> | null;
  sessions: Record<string, unknown>[];
  firstAnalytical: Record<string, unknown> | null;
  lastAnalytical: Record<string, unknown> | null;
  firstFunctional: Record<string, unknown> | null;
  lastFunctional: Record<string, unknown> | null;
}): string {
  const p = data.patient;
  const ep = data.episode;
  const cr = data.clinicalRecord ?? {};
  const op = data.occupationalProfile ?? {};

  const sessionsXml = data.sessions
    .map(
      (s) => `
  <sesion numero="${s.session_number ?? "?"}" fecha="${s.session_date}" tipo="${s.session_type ?? "seguimiento"}">
    <intervenciones>${s.interventions ?? "No registrado."}</intervenciones>
    <evolucion>${s.evolution ?? "No registrado."}</evolucion>
    <observaciones_generales>${s.general_observations ?? "No registrado."}</observaciones_generales>
    <avd_seguimiento>${s.avd_followup ?? "No registrado."}</avd_seguimiento>
    <indicaciones_domicilio>${s.home_instructions_sent ?? "No registrado."}</indicaciones_domicilio>
  </sesion>`
    )
    .join("\n");

  const analyticalXml = (a: Record<string, unknown> | null, tipo: string) => {
    if (!a) return `<evaluacion_analitica tipo="${tipo}">No registrado.</evaluacion_analitica>`;
    return `
  <evaluacion_analitica tipo="${tipo}" fecha="${a.evaluation_date}">
    <dolor_eva>${a.pain_score ?? "No registrado."}</dolor_eva>
    ${jsonbToXml("goniometria", a.goniometry)}
    ${jsonbToXml("circometria_edema", a.edema_circummetry)}
    ${jsonbToXml("fuerza_muscular_daniels", a.muscle_strength_daniels)}
    ${jsonbToXml("pruebas_especificas", a.specific_tests)}
    <test_godet>${a.godet_test ?? "No registrado."}</test_godet>
    <escala_vancouver>${a.vancouver_score ?? "No registrado."}</escala_vancouver>
    <escala_osas>${a.osas_score ?? "No registrado."}</escala_osas>
  </evaluacion_analitica>`;
  };

  const functionalXml = (f: Record<string, unknown> | null, tipo: string) => {
    if (!f) return `<evaluacion_funcional tipo="${tipo}">No registrado.</evaluacion_funcional>`;
    return `
  <evaluacion_funcional tipo="${tipo}" fecha="${f.evaluation_date}">
    <quickdash>${f.quickdash_score ?? "No registrado."}</quickdash>
    <fim>${f.fim_score ?? "No registrado."}</fim>
    <barthel>${f.barthel_score ?? "No registrado."}</barthel>
    <avd>${f.avd ?? "No registrado."}</avd>
    <aivd>${f.aivd ?? "No registrado."}</aivd>
  </evaluacion_funcional>`;
  };

  return `<datos_paciente>
  <identificacion>
    <nombre>${p.first_name} ${p.last_name}</nombre>
    <dni>${p.dni ?? "No registrado."}</dni>
    <fecha_nacimiento>${p.birth_date ?? "No registrado."}</fecha_nacimiento>
    <genero>${p.gender ?? "No registrado."}</genero>
    <telefono>${p.phone ?? "No registrado."}</telefono>
    <obra_social>${p.insurance ?? "No registrado."}</obra_social>
  </identificacion>

  <episodio>
    <numero>${ep.episode_number}</numero>
    <fecha_admision>${ep.admission_date}</fecha_admision>
    <fecha_alta>${ep.discharge_date ?? "En curso"}</fecha_alta>
    <diagnostico>${ep.diagnosis ?? cr.diagnosis ?? "No registrado."}</diagnostico>
    <tipo_tratamiento>${cr.treatment_type ?? "No registrado."}</tipo_tratamiento>
    <fecha_lesion>${cr.injury_date ?? "No registrado."}</fecha_lesion>
    <fecha_cirugia>${cr.surgery_date ?? "No registrado."}</fecha_cirugia>
    <mecanismo_lesion>${cr.injury_mechanism ?? "No registrado."}</mecanismo_lesion>
    <semanas_post_lesion>${cr.weeks_post_injury ?? "No registrado."}</semanas_post_lesion>
    <semanas_post_cirugia>${cr.weeks_post_surgery ?? "No registrado."}</semanas_post_cirugia>
    <tipo_inmovilizacion>${cr.immobilization_type ?? "No registrado."}</tipo_inmovilizacion>
  </episodio>

  <perfil_ocupacional>
    <trabajo>${op.job ?? "No registrado."}</trabajo>
    <educacion>${op.education ?? "No registrado."}</educacion>
    <dominancia>${op.dominance ?? "No registrado."}</dominancia>
    <avd>${op.avd ?? "No registrado."}</avd>
    <aivd>${op.aivd ?? "No registrado."}</aivd>
    <actividad_fisica>${op.physical_activity ?? "No registrado."}</actividad_fisica>
    <suenio_descanso>${op.sleep_rest ?? "No registrado."}</suenio_descanso>
    <red_apoyo>${op.support_network ?? "No registrado."}</red_apoyo>
    <ocio>${op.leisure ?? "No registrado."}</ocio>
  </perfil_ocupacional>

  <sesiones>
    ${sessionsXml}
  </sesiones>

  <evaluaciones>
    ${analyticalXml(data.firstAnalytical, "inicial")}
    ${analyticalXml(data.lastAnalytical, "final")}
    ${functionalXml(data.firstFunctional, "inicial")}
    ${functionalXml(data.lastFunctional, "final")}
  </evaluaciones>
</datos_paciente>

Redacta el informe de alta completo siguiendo la estructura indicada en el system prompt. Usa ÚNICAMENTE los datos dentro de <datos_paciente>.`;
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    // Validar JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { patientId, episodeId } = await req.json();
    if (!patientId || !episodeId) {
      return new Response(JSON.stringify({ error: "Missing patientId or episodeId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Consultar datos en paralelo
    const [
      patientRes,
      episodeRes,
      clinicalRes,
      occupationalRes,
      sessionsRes,
      analyticalRes,
      functionalRes,
    ] = await Promise.all([
      supabase.from("patients").select("*").eq("id", patientId).eq("professional_id", user.id).maybeSingle(),
      supabase.from("treatment_episodes").select("*").eq("id", episodeId).eq("professional_id", user.id).maybeSingle(),
      supabase.from("patient_clinical_records").select("*").eq("patient_id", patientId).maybeSingle(),
      supabase.from("patient_occupational_profiles").select("*").eq("patient_id", patientId).maybeSingle(),
      supabase.from("therapy_sessions").select("*").eq("patient_id", patientId).eq("episode_id", episodeId).eq("is_deleted", false).order("session_date", { ascending: true }),
      supabase.from("analytical_evaluations").select("*").eq("patient_id", patientId).eq("episode_id", episodeId).order("evaluation_date", { ascending: true }),
      supabase.from("functional_evaluations").select("*").eq("patient_id", patientId).eq("episode_id", episodeId).order("evaluation_date", { ascending: true }),
    ]);

    if (!patientRes.data || !episodeRes.data) {
      return new Response(JSON.stringify({ error: "Patient or episode not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const analyticalList = analyticalRes.data ?? [];
    const functionalList = functionalRes.data ?? [];

    const promptContent = buildXmlPrompt({
      patient: patientRes.data,
      episode: episodeRes.data,
      clinicalRecord: clinicalRes.data,
      occupationalProfile: occupationalRes.data,
      sessions: sessionsRes.data ?? [],
      firstAnalytical: analyticalList[0] ?? null,
      lastAnalytical: analyticalList.length > 1 ? analyticalList[analyticalList.length - 1] : null,
      firstFunctional: functionalList[0] ?? null,
      lastFunctional: functionalList.length > 1 ? functionalList[functionalList.length - 1] : null,
    });

    // Llamar a Claude API con streaming
    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
    });

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      temperature: 0,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        } as Anthropic.TextBlockParam & { cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: promptContent }],
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("generate-discharge-report error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
