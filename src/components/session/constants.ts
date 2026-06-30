import { Calendar, FileText, BarChart2, ClipboardList, MessageSquare, Briefcase, Stethoscope } from "lucide-react";
import type { PainEntry } from "./types";

export type StepDef = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; sections: string[] };

export const STEPS_ADMISSION: StepDef[] = [
  { id: "step-datos",       label: "Datos",                  icon: Calendar,      sections: ["sec-datos"] },
  { id: "step-ficha",       label: "Ficha clínica",          icon: Stethoscope,   sections: ["sec-ficha"] },
  { id: "step-ocupacional", label: "Perfil ocupacional",     icon: Briefcase,     sections: ["sec-ocupacional"] },
  { id: "step-funcional",   label: "Eval. funcional",        icon: ClipboardList, sections: ["sec-funcional"] },
  { id: "step-analitica",   label: "Eval. analítica",        icon: BarChart2,     sections: ["sec-analitica"] },
  { id: "step-cierre",      label: "Intervenciones y notas", icon: MessageSquare, sections: ["sec-intervenciones", "sec-notas"] },
];

export const STEPS_SESSION: StepDef[] = [
  { id: "step-datos",       label: "Datos",                  icon: Calendar,      sections: ["sec-datos"] },
  { id: "step-funcional",   label: "Eval. funcional",        icon: ClipboardList, sections: ["sec-funcional"] },
  { id: "step-evolucion",   label: "Evolución",              icon: FileText,      sections: ["sec-evolucion"] },
  { id: "step-analitica",   label: "Eval. analítica",        icon: BarChart2,     sections: ["sec-analitica"] },
  { id: "step-cierre",      label: "Intervenciones y notas", icon: MessageSquare, sections: ["sec-intervenciones", "sec-notas"] },
];

export const GONIO_PARTS = {
  shoulder: {
    label: "Hombro",
    fields: [
      { key: "flex", label: "Flexión", norm: "180" },
      { key: "ext", label: "Extensión", norm: "60" },
      { key: "add", label: "Aducción", norm: "30" },
      { key: "abd", label: "Abducción", norm: "180" },
      { key: "rot_ext", label: "Rot. Externa", norm: "70" },
      { key: "rot_int", label: "Rot. Interna", norm: "90" },
    ],
  },
  elbow: {
    label: "Codo",
    fields: [
      { key: "flex", label: "Flexión", norm: "150" },
      { key: "ext", label: "Extensión", norm: "0" },
      { key: "prono", label: "Pronación", norm: "80" },
      { key: "supino", label: "Supinación", norm: "80" },
    ],
  },
  wrist: {
    label: "Muñeca",
    fields: [
      { key: "flex", label: "Flexión", norm: "80" },
      { key: "ext", label: "Extensión", norm: "70" },
      { key: "dr", label: "Desv. Radial", norm: "20" },
      { key: "dc", label: "Desv. Cubital", norm: "30" },
      { key: "prono", label: "Pronación", norm: "80" },
      { key: "supino", label: "Supinación", norm: "80" },
    ],
  },
  hand: {
    label: "Mano",
    fields: [
      { key: "mcf_flex", label: "MCF Flexión", norm: "90" },
      { key: "mcf_ext", label: "MCF Extensión", norm: "0-5" },
      { key: "ifp_flex", label: "IFP Flexión", norm: "100" },
      { key: "ifp_ext", label: "IFP Extensión", norm: "0" },
      { key: "ifd_flex", label: "IFD Flexión", norm: "90" },
      { key: "ifd_ext", label: "IFD Extensión", norm: "0" },
    ],
  },
  thumb: {
    label: "Pulgar",
    fields: [
      { key: "mcf_flex", label: "MCF Flexión", norm: "50" },
      { key: "mcf_ext", label: "MCF Extensión", norm: "0" },
      { key: "if_flex", label: "IF Flexión", norm: "80" },
      { key: "if_ext", label: "IF Extensión", norm: "20" },
    ],
  },
} as const;

export const SPECIFIC_TESTS = [
  { key: "finkelstein", label: "Finkelstein" },
  { key: "phalen", label: "Phalen" },
  { key: "froment", label: "Froment" },
  { key: "wartenberg", label: "Wartenberg" },
  { key: "garra_cubital", label: "Garra cubital" },
  { key: "jobe", label: "Jobe" },
  { key: "pate", label: "Pate" },
  { key: "yocum", label: "Yocum" },
  { key: "herber", label: "Herber" },
] as const;

export const DANIELS_FULL_GRADES = ["0", "1", "1+", "2-", "2", "2+", "3-", "3", "3+", "4-", "4", "4+", "5"];

export const SCAR_OPTIONS: Record<string, string[]> = {
  localizacion: ["Zona", "Atraviesa articulación"],
  vascularizacion: ["Normal", "Rosa", "Roja", "Púrpura"],
  pigmentacion: ["Normal", "Hipopigmentada", "Pigmentación mixta", "Hiperpigmentada"],
  flexibilidad: ["Flexible", "Semiflexible", "Rígida", "Adherida", "Retráctil", "Brida cicatrizal"],
  sensibilidad: ["Normal", "Hipersensibilidad", "Hiposensibilidad", "Parestesias", "Prurito"],
  relieve: ["Plana", "Levemente elevada", "Invaginada", "Hipertrófica", "Queloide"],
  temperatura: ["Normal", "Alta"],
};

export const VSS_OPTIONS = {
  pigmentacion: [
    { v: "0", label: "0 — Normal" },
    { v: "1", label: "1 — Hipopigmentación" },
    { v: "2", label: "2 — Pigmentación mixta" },
    { v: "3", label: "3 — Hiperpigmentación" },
  ],
  vascularizacion: [
    { v: "0", label: "0 — Normal" },
    { v: "1", label: "1 — Rosa" },
    { v: "2", label: "2 — Rojo" },
    { v: "3", label: "3 — Púrpura" },
  ],
  flexibilidad: [
    { v: "0", label: "0 — Normal" },
    { v: "1", label: "1 — Suave, flexible" },
    { v: "2", label: "2 — Cedente" },
    { v: "3", label: "3 — Firme" },
    { v: "4", label: "4 — Cordón" },
    { v: "5", label: "5 — Contractura" },
  ],
  altura: [
    { v: "0", label: "0 — Normal" },
    { v: "1", label: "1 — ≤1mm" },
    { v: "2", label: "2 — >1 a ≤2mm" },
    { v: "3", label: "3 — >2 a ≤4mm" },
    { v: "4", label: "4 — >4mm" },
  ],
};

export const SCAR_PLACEHOLDER = "No evaluado";

export const emptyPain = (id: number): PainEntry => ({
  id, localizacion: "", eva: 0, evaTouched: false, tipo: "",
  aparicion: "", irradia: "", irradia_hacia: "", caracteristicas: "", agravantes: "", observaciones: "",
});

export const parseDyn = (v: any): [string, string, string] => {
  if (v == null) return ["", "", ""];
  if (typeof v === "object" && Array.isArray(v.values)) {
    const a = v.values;
    return [a[0] != null ? String(a[0]) : "", a[1] != null ? String(a[1]) : "", a[2] != null ? String(a[2]) : ""];
  }
  if (typeof v === "number") return [String(v), "", ""];
  return ["", "", ""];
};
