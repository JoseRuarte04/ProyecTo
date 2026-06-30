import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

// ── QuickDASH definition ──
const QD_SCALE_1 = ["Ninguna dificultad", "Dificultad leve", "Dificultad moderada", "Mucha dificultad", "Incapaz de realizarla"];
const QD_SCALE_7 = ["Absolutamente nada", "Un poco", "Moderadamente", "Bastante", "Muchísimo"];
const QD_SCALE_8 = ["Absolutamente nada", "Un poco", "Moderadamente", "Bastante limitado/a", "Incapaz de realizar"];
const QD_SCALE_PAIN = ["Ninguna", "Leve", "Moderada", "Intensa", "Muy intensa"];
const QD_SCALE_11 = ["Ninguna dificultad", "Dificultad leve", "Dificultad moderada", "Mucha dificultad", "Incapaz de realizar"];

export const QUICKDASH_QUESTIONS: Array<{ q: string; scale: string[] }> = [
  { q: "Abrir un frasco nuevo o con tapa muy apretada", scale: QD_SCALE_1 },
  { q: "Realizar tareas pesadas de la casa (ej. lavar el piso, paredes)", scale: QD_SCALE_1 },
  { q: "Llevar una bolsa del supermercado o un maletín", scale: QD_SCALE_1 },
  { q: "Lavarse la espalda", scale: QD_SCALE_1 },
  { q: "Usar un cuchillo para cortar la comida", scale: QD_SCALE_1 },
  { q: "Actividades recreativas que requieren esfuerzo o impacto para brazo, hombro o mano", scale: QD_SCALE_1 },
  { q: "¿En qué medida ha interferido su problema en sus actividades sociales normales?", scale: QD_SCALE_7 },
  { q: "¿Ha estado limitado/a para realizar su trabajo u otras actividades cotidianas?", scale: QD_SCALE_8 },
  { q: "Dolor en el brazo, hombro o mano", scale: QD_SCALE_PAIN },
  { q: "Sensación de hormigueo (pinchazos) en su brazo, hombro o mano", scale: QD_SCALE_PAIN },
  { q: "¿Cuánta dificultad ha tenido para dormir debido a dolor en brazo, hombro o mano?", scale: QD_SCALE_11 },
];

export function calcQuickDashScore(items: (number | null)[]): number | null {
  const answered = items.filter((v): v is number => v !== null && v !== undefined);
  if (answered.length < items.length) return null;
  const sum = answered.reduce((a, b) => a + b, 0);
  const score = ((sum / 11) - 1) * 25;
  return Math.round(score * 10) / 10;
}

export function calcQuickDashPartial(items: (number | null)[]): number | null {
  const answered = items.filter((v): v is number => v !== null && v !== undefined);
  if (answered.length === 0) return null;
  const sum = answered.reduce((a, b) => a + b, 0);
  const score = ((sum / answered.length) - 1) * 25;
  return Math.round(score * 10) / 10;
}

export function emptyQuickDash(): (number | null)[] {
  return Array(11).fill(null);
}

export function QuickDashSection({
  items,
  onChange,
}: {
  items: (number | null)[];
  onChange: (items: (number | null)[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const score = calcQuickDashPartial(items);
  const allAnswered = items.every((v) => v !== null);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-gray-200 bg-white">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">QuickDASH</span>
          {score !== null && (
            <Badge className={`${allAnswered ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-gray-100 text-gray-600 border-gray-200"} hover:bg-transparent border`}>
              QuickDASH: {score}/100{!allAnswered && " (parcial)"}
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-4">
        <p className="text-xs text-muted-foreground">Responda cada ítem según su capacidad en la última semana.</p>
        {QUICKDASH_QUESTIONS.map((item, idx) => {
          const value = items[idx];
          return (
            <div key={idx} className="rounded-md border border-gray-100 p-3 bg-gray-50/50">
              <p className="text-sm font-medium text-gray-700 mb-2">
                <span className="text-teal-600 mr-1">{idx + 1}.</span>{item.q}
              </p>
              <RadioGroup
                value={value !== null && value !== undefined ? String(value) : ""}
                onValueChange={(v) => {
                  const next = [...items];
                  next[idx] = parseInt(v);
                  onChange(next);
                }}
                className="grid grid-cols-1 sm:grid-cols-5 gap-2"
              >
                {item.scale.map((label, i) => {
                  const val = i + 1;
                  const id = `qd-${idx}-${val}`;
                  return (
                    <Label
                      key={val}
                      htmlFor={id}
                      className={`flex items-start gap-2 cursor-pointer rounded-md border px-2 py-1.5 text-xs leading-tight transition-colors ${
                        value === val
                          ? "border-teal-500 bg-teal-50 text-teal-800"
                          : "border-gray-200 bg-white hover:border-teal-200"
                      }`}
                    >
                      <RadioGroupItem value={String(val)} id={id} className="mt-0.5" />
                      <span><span className="font-semibold">{val}.</span> {label}</span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── FIM definition (grouped with subtotals) ──
const FIM_LABELS: Record<number, string> = {
  1: "Dependiente total (aporta <25%)",
  2: "Asistencia máxima (aporta 25% o más)",
  3: "Asistencia moderada (aporta 50% o más)",
  4: "Asistencia mínima (aporta 75% o más)",
  5: "Solo supervisión",
  6: "Independiente con adaptaciones",
  7: "Independencia total",
};

export const FIM_GROUPS = [
  {
    name: "AUTOCUIDADO",
    max: 42,
    items: [
      { key: "alimentacion", label: "Alimentación" },
      { key: "aseo_personal", label: "Aseo personal" },
      { key: "bano", label: "Baño" },
      { key: "vestido_tren_superior", label: "Vestido tren superior" },
      { key: "vestido_tren_inferior", label: "Vestido tren inferior" },
      { key: "uso_del_bano", label: "Uso del baño" },
    ],
  },
  {
    name: "CONTROL DE ESFÍNTERES",
    max: 14,
    items: [
      { key: "control_de_intestino", label: "Control de intestino" },
      { key: "control_de_vejiga", label: "Control de vejiga" },
    ],
  },
  {
    name: "TRANSFERENCIAS",
    max: 21,
    items: [
      { key: "transferencia_cama_silla", label: "Transferencia cama-silla" },
      { key: "transferencia_al_bano", label: "Transferencia al baño" },
      { key: "transferencia_ducha_banera", label: "Transferencia ducha-bañera" },
    ],
  },
  {
    name: "LOCOMOCIÓN",
    max: 14,
    items: [
      { key: "marcha_o_silla_de_ruedas", label: "Marcha o silla de ruedas" },
      { key: "escaleras", label: "Escaleras" },
    ],
  },
];

export const FIM_COGNITIVE_GROUPS = [
  {
    name: "COMUNICACIÓN",
    max: 14,
    items: [
      { key: "comprension", label: "Comprensión" },
      { key: "expresion", label: "Expresión" },
    ],
  },
  {
    name: "CONEXIÓN",
    max: 21,
    items: [
      { key: "interaccion_social", label: "Interacción social" },
      { key: "resolucion_de_problemas", label: "Resolución de problemas" },
      { key: "memoria", label: "Memoria" },
    ],
  },
];

export const FIM_MOTOR: Array<{ key: string; label: string }> = FIM_GROUPS.flatMap(g => g.items);
export const FIM_COGNITIVE: Array<{ key: string; label: string }> = FIM_COGNITIVE_GROUPS.flatMap(g => g.items);
export const FIM_ALL = [...FIM_MOTOR, ...FIM_COGNITIVE];

export function emptyFim(): Record<string, number | null> {
  return Object.fromEntries(FIM_ALL.map((i) => [i.key, null]));
}

export function calcFimTotal(items: Record<string, number | null>): number | null {
  const vals = FIM_ALL.map((i) => items[i.key]).filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}

function calcGroupSubtotal(items: Record<string, number | null>, group: { items: Array<{ key: string }> }): number | null {
  const vals = group.items.map(i => items[i.key]).filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}

const selectClass = "h-8 w-full text-xs rounded-md border border-gray-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";

function FimGroupSection({
  group,
  items,
  onChange,
}: {
  group: { name: string; max: number; items: Array<{ key: string; label: string }> };
  items: Record<string, number | null>;
  onChange: (items: Record<string, number | null>) => void;
}) {
  const subtotal = calcGroupSubtotal(items, group);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wide">{group.name}</p>
        {subtotal !== null && (
          <span className="text-[11px] font-semibold text-teal-600">{subtotal}/{group.max}</span>
        )}
      </div>
      {group.items.map((item) => (
        <div key={item.key} className="flex flex-col gap-1 py-1.5 border-b border-gray-100 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="text-xs text-gray-700 sm:flex-1 sm:min-w-0 sm:pr-2" title={item.label}>{item.label}</span>
          <select
            value={items[item.key] != null ? String(items[item.key]) : ""}
            onChange={(e) => onChange({ ...items, [item.key]: e.target.value ? parseInt(e.target.value) : null })}
            className={`${selectClass} w-full sm:w-56 sm:flex-shrink-0`}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={String(n)}>{n} — {FIM_LABELS[n]}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export function FimSection({
  items,
  onChange,
}: {
  items: Record<string, number | null>;
  onChange: (items: Record<string, number | null>) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = calcFimTotal(items);
  const motorSubtotal = FIM_GROUPS.reduce((sum, g) => {
    const s = calcGroupSubtotal(items, g);
    return s != null ? sum + s : sum;
  }, 0);
  const cogSubtotal = FIM_COGNITIVE_GROUPS.reduce((sum, g) => {
    const s = calcGroupSubtotal(items, g);
    return s != null ? sum + s : sum;
  }, 0);
  const hasMotor = FIM_MOTOR.some(i => items[i.key] != null);
  const hasCog = FIM_COGNITIVE.some(i => items[i.key] != null);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-gray-200 bg-white">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">FIM — Medida de Independencia Funcional</span>
          {total !== null && (
            <Badge className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50">
              FIM: {total}/126
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Escala 1–7: 1 = Dependiente total · 4 = Asistencia mínima · 6 = Independiente con adaptaciones · 7 = Independencia total
        </p>
        <div className="space-y-4">
          {FIM_GROUPS.map((group) => (
            <FimGroupSection key={group.name} group={group} items={items} onChange={onChange} />
          ))}
          {hasMotor && (
            <div className="flex justify-end border-t border-teal-200 pt-2">
              <Badge className="bg-teal-100 text-teal-800 border border-teal-300 hover:bg-teal-100">
                Subtotal Motor: {motorSubtotal}/91
              </Badge>
            </div>
          )}
          {FIM_COGNITIVE_GROUPS.map((group) => (
            <FimGroupSection key={group.name} group={group} items={items} onChange={onChange} />
          ))}
          {hasCog && (
            <div className="flex justify-end border-t border-teal-200 pt-2">
              <Badge className="bg-teal-100 text-teal-800 border border-teal-300 hover:bg-teal-100">
                Subtotal Cognitivo: {cogSubtotal}/35
              </Badge>
            </div>
          )}
        </div>
        {total !== null && (
          <div className="flex justify-end border-t border-teal-300 pt-3">
            <Badge className="bg-teal-600 text-white border-0 hover:bg-teal-600 text-sm px-3 py-1">
              Total FIM: {total}/126
            </Badge>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Índice de Barthel ──
export const BARTHEL_ITEMS = [
  { key: "comer", label: "Comer", options: [{ v: 0, l: "Dependiente" }, { v: 5, l: "Necesita ayuda" }, { v: 10, l: "Independiente" }] },
  { key: "trasladarse", label: "Trasladarse cama-silla", options: [{ v: 0, l: "Dependiente" }, { v: 5, l: "Necesita ayuda importante" }, { v: 10, l: "Necesita algo de ayuda" }, { v: 15, l: "Independiente" }] },
  { key: "aseo_personal", label: "Aseo personal", options: [{ v: 0, l: "Necesita ayuda" }, { v: 5, l: "Independiente" }] },
  { key: "uso_inodoro", label: "Uso de inodoro", options: [{ v: 0, l: "Dependiente" }, { v: 5, l: "Necesita ayuda" }, { v: 10, l: "Independiente" }] },
  { key: "banarse", label: "Bañarse/ducharse", options: [{ v: 0, l: "Dependiente" }, { v: 5, l: "Independiente" }] },
  { key: "desplazarse", label: "Desplazarse", options: [{ v: 0, l: "Dependiente" }, { v: 5, l: "Independiente en silla de ruedas" }, { v: 10, l: "Con pequeña ayuda" }, { v: 15, l: "Independiente" }] },
  { key: "escaleras", label: "Subir y bajar escaleras", options: [{ v: 0, l: "Dependiente" }, { v: 5, l: "Necesita ayuda" }, { v: 10, l: "Independiente" }] },
  { key: "vestirse", label: "Vestirse/desvestirse", options: [{ v: 0, l: "Dependiente" }, { v: 5, l: "Necesita ayuda" }, { v: 10, l: "Independiente" }] },
  { key: "deposicion", label: "Deposición", options: [{ v: 0, l: "Incontinente" }, { v: 5, l: "Accidente excepcional" }, { v: 10, l: "Continente" }] },
  { key: "miccion", label: "Micción", options: [{ v: 0, l: "Incontinente" }, { v: 5, l: "Accidente ocasional" }, { v: 10, l: "Continente" }] },
];

export function emptyBarthel(): Record<string, number | null> {
  return Object.fromEntries(BARTHEL_ITEMS.map(i => [i.key, null]));
}

export function calcBarthelTotal(items: Record<string, number | null>): number | null {
  const vals = BARTHEL_ITEMS.map(i => items[i.key]).filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}

function barthelInterpretation(score: number): string {
  if (score <= 20) return "Dependencia total";
  if (score <= 60) return "Dependencia severa";
  if (score <= 90) return "Dependencia moderada";
  if (score <= 99) return "Dependencia escasa";
  return "Independiente";
}

export function BarthelSection({
  items,
  onChange,
}: {
  items: Record<string, number | null>;
  onChange: (items: Record<string, number | null>) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = calcBarthelTotal(items);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-gray-200 bg-white">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">Índice de Barthel</span>
          {total !== null && (
            <Badge className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50">
              Barthel: {total}/100
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-3">
        <p className="text-xs text-muted-foreground">Seleccione el nivel de independencia para cada actividad.</p>
        {BARTHEL_ITEMS.map((item) => (
          <div key={item.key} className="flex flex-col gap-1 py-1.5 border-b border-gray-100 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="text-xs text-gray-700 font-medium sm:flex-1 sm:min-w-0 sm:pr-2" title={item.label}>{item.label}</span>
            <select
              value={items[item.key] != null ? String(items[item.key]) : ""}
              onChange={(e) => onChange({ ...items, [item.key]: e.target.value !== "" ? parseInt(e.target.value) : null })}
              className={`${selectClass} w-full sm:w-64 sm:flex-shrink-0`}
            >
              <option value="">—</option>
              {item.options.map((opt) => (
                <option key={opt.v} value={String(opt.v)}>{opt.v} — {opt.l}</option>
              ))}
            </select>
          </div>
        ))}
        {total !== null && (
          <div className="border-t border-teal-200 pt-3 space-y-2">
            <div className="flex justify-end">
              <Badge className="bg-teal-600 text-white border-0 hover:bg-teal-600 text-sm px-3 py-1">
                Barthel: {total}/100
              </Badge>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Interpretación: <span className="font-semibold text-gray-700">{barthelInterpretation(total)}</span>
            </p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
