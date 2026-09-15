// Taxonomía del apartado "Ocupaciones" de Evaluación funcional (marco AOTA/MOHO).
// Cada ítem se califica independiente / requiere asistencia / dependiente
// (ver IndependenceToggle.tsx) y se guarda en functional_evaluations.occupations_items
// como { "<categoryKey>.<itemKey>": IndependenceLevel }.

export type IndependenceLevel = "independent" | "assistance" | "dependent";

export interface OccupationItem {
  key: string;
  label: string;
}

export interface OccupationCategory {
  key: string;
  label: string;
  items: OccupationItem[];
}

export const OCCUPATIONS_TAXONOMY: OccupationCategory[] = [
  {
    key: "avd",
    label: "AVD — Actividades de la vida diaria",
    items: [
      { key: "banarse", label: "Bañarse/ducharse" },
      { key: "higiene_bano", label: "Higiene del baño y del aseo" },
      { key: "vestirse", label: "Vestirse" },
      { key: "comer_tragar", label: "Comer y tragar" },
      { key: "alimentacion", label: "Alimentación" },
      { key: "movilidad_funcional", label: "Movilidad funcional" },
      { key: "arreglo_personal", label: "Arreglo personal y aseo" },
      { key: "actividad_sexual", label: "Actividad sexual" },
    ],
  },
  {
    key: "aivd",
    label: "AIVD — Actividades instrumentales de la vida diaria",
    items: [
      { key: "cuidado_otros", label: "Cuidado de otros" },
      { key: "cuidado_mascotas", label: "Cuidado de mascotas" },
      { key: "crianza_ninos", label: "Crianza de los niños" },
      { key: "gestion_comunicacion", label: "Gestión de la comunicación" },
      { key: "conduccion_movilidad_comunidad", label: "Conducción y movilidad de la comunidad" },
      { key: "gestion_financiera", label: "Gestión financiera" },
      { key: "establecimiento_gestion_hogar", label: "Establecimiento y gestión del hogar" },
      { key: "preparacion_comida_limpieza", label: "Preparación de la comida y limpieza" },
      { key: "expresion_religiosa_espiritual", label: "Expresión religiosa y espiritual" },
      { key: "mantenimiento_seguridad", label: "Mantenimiento de seguridad" },
      { key: "compras", label: "Compras" },
    ],
  },
  {
    key: "gestion_salud",
    label: "Gestión de la salud",
    items: [
      { key: "promocion_salud_social_emocional", label: "Promoción y mantenimiento de la salud social y emocional" },
      { key: "manejo_sintomas_afecciones", label: "Manejo de síntomas y afecciones" },
      { key: "comunicacion_sistema_salud", label: "Comunicación con el sistema de salud" },
      { key: "manejo_medicacion", label: "Manejo de medicación" },
      { key: "actividad_fisica", label: "Actividad física" },
      { key: "manejo_nutricional", label: "Manejo nutricional" },
      { key: "manejo_dispositivos_cuidado_personal", label: "Manejo de dispositivos de cuidado personal" },
    ],
  },
  {
    key: "descanso_sueno",
    label: "Descanso y sueño",
    items: [
      { key: "descanso", label: "Descanso" },
      { key: "preparacion_sueno", label: "Preparación del sueño" },
      { key: "participacion_sueno", label: "Participación del sueño" },
    ],
  },
  {
    key: "educacion",
    label: "Educación",
    items: [
      { key: "participacion_educacion_formal", label: "Participación en la educación formal" },
      { key: "exploracion_necesidades_educativas_informales", label: "Exploración de necesidades/intereses educativos informales" },
      { key: "participacion_educacion_informal", label: "Participación de educación informal" },
    ],
  },
  {
    key: "trabajo",
    label: "Trabajo",
    items: [
      { key: "interes_persecucion_laboral", label: "Interés y persecución laboral" },
      { key: "busqueda_adquisicion_empleo", label: "Búsqueda y adquisición de empleo" },
      { key: "rendimiento_mantenimiento_trabajo", label: "Rendimiento en el trabajo y su mantenimiento" },
      { key: "preparacion_ajuste_jubilacion", label: "Preparación y ajuste de la jubilación" },
      { key: "exploracion_voluntariados", label: "Exploración de voluntariados" },
      { key: "participacion_voluntariados", label: "Participación en voluntariados" },
    ],
  },
  {
    key: "juego",
    label: "Juego",
    items: [
      { key: "exploracion_juego", label: "Exploración del juego" },
      { key: "participacion_juego", label: "Participación del juego" },
    ],
  },
  {
    key: "ocio",
    label: "Ocio",
    items: [
      { key: "exploracion_ocio", label: "Exploración del ocio" },
      { key: "participacion_ocio", label: "Participación del ocio" },
    ],
  },
  {
    key: "participacion_social",
    label: "Participación social",
    items: [
      { key: "participacion_comunitaria", label: "Participación comunitaria" },
      { key: "participacion_familiar", label: "Participación familiar" },
      { key: "amistades", label: "Amistades" },
      { key: "relaciones_intimas_pareja", label: "Relaciones íntimas de pareja" },
      { key: "participacion_grupo_pares", label: "Participación en grupo de pares" },
    ],
  },
];

export function itemPath(categoryKey: string, itemKey: string): string {
  return `${categoryKey}.${itemKey}`;
}

export const OCCUPATIONS_TOTAL_ITEMS = OCCUPATIONS_TAXONOMY.reduce((sum, c) => sum + c.items.length, 0);
