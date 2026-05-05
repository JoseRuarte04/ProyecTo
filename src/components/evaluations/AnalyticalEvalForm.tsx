import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Eye } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { EdemaCircometryTable, buildEdemaPayload, normalizeEdemaValue, isNewEdemaFormat, EDEMA_POINTS, type EdemaSide } from "@/components/clinical/EdemaCircometryTable";

// --- Constants ---

const GONIOMETRY_GROUPS = [
  { label: "Hombro", fields: ["flexion", "extension", "abduccion", "aduccion", "rot_ext", "rot_int"] },
  { label: "Codo", fields: ["flexion", "extension", "pronacion", "supinacion"] },
  { label: "Muñeca", fields: ["flexion", "extension", "desv_radial", "desv_cubital"] },
  { label: "Mano MCF", fields: ["mcf_flex", "mcf_ext", "mcf2_flex", "mcf2_ext", "mcf3_flex", "mcf3_ext", "mcf4_flex", "mcf4_ext"] },
  { label: "Mano IFP", fields: ["ifp_flex", "ifp_ext"] },
  { label: "Mano IFD", fields: ["ifd_flex", "ifd_ext"] },
  { label: "Pulgar MCF", fields: ["pulgar_mcf_flex", "pulgar_mcf_ext"] },
  { label: "Pulgar IF", fields: ["pulgar_if_flex", "pulgar_if_ext"] },
];

const fieldLabel = (f: string) => {
  const map: Record<string, string> = {
    flexion: "Flex°", extension: "Ext°", abduccion: "Abd°", aduccion: "Add°",
    rot_ext: "RE°", rot_int: "RI°", pronacion: "Pron°", supinacion: "Sup°",
    desv_radial: "DR°", desv_cubital: "DC°",
    mcf_flex: "MCF1 Flex°", mcf_ext: "MCF1 Ext°",
    mcf2_flex: "MCF2 Flex°", mcf2_ext: "MCF2 Ext°",
    mcf3_flex: "MCF3 Flex°", mcf3_ext: "MCF3 Ext°",
    mcf4_flex: "MCF4 Flex°", mcf4_ext: "MCF4 Ext°",
    ifp_flex: "IFP Flex°", ifp_ext: "IFP Ext°",
    ifd_flex: "IFD Flex°", ifd_ext: "IFD Ext°",
    pulgar_mcf_flex: "Flex°", pulgar_mcf_ext: "Ext°",
    pulgar_if_flex: "Flex°", pulgar_if_ext: "Ext°",
  };
  return map[f] || f;
};

const SPECIFIC_TESTS = [
  "Finkelstein", "Phalen", "Froment", "Wartenberg",
  "Garra cubital", "Jobe", "Pate", "Yocum", "Herber",
];

const testKey = (t: string) => t.toLowerCase().replace(/\s+/g, "_");

type TestResult = "positive" | "negative" | "not_performed" | null;

// --- New Eval Dialog ---

export function NewAnalEvalDialog({ open, onClose, patientId, userId, onSaved }: {
  open: boolean; onClose: () => void; patientId: string; userId: string; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [painScore, setPainScore] = useState([0]);
  const [gonioSide, setGonioSide] = useState<"MSD" | "MSI">("MSD");
  const [gonio, setGonio] = useState<{ MSD: Record<string, string>; MSI: Record<string, string> }>({ MSD: {}, MSI: {} });
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  // Circometría
  const [edemaSano, setEdemaSano] = useState<EdemaSide>({});
  const [edemaAfectado, setEdemaAfectado] = useState<EdemaSide>({});
  // Dinamometría 3 mediciones
  const [dynMsdVals, setDynMsdVals] = useState<[string, string, string]>(["", "", ""]);
  const [dynMsiVals, setDynMsiVals] = useState<[string, string, string]>(["", "", ""]);
  const [form, setForm] = useState({
    evaluation_date: new Date().toISOString().split("T")[0],
    pain_appearance: "", pain_location: "", pain_radiation: "",
    pain_characteristics: "", pain: "", pain_aggravating_factors: "",
    edema: "", godet_test: "",
    arom: "", prom: "", kapandji: "",
    muscle_strength: "",
    sensitivity_functional: "", sensitivity_protective: "", sensitivity: "",
    trophic_state: "", scar: "", vancouver_score: "", osas_score: "",
    posture: "", emotional_state: "", notes: "",
  });

  const u = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));
  const painColor = painScore[0] <= 3 ? "text-emerald-600" : painScore[0] <= 6 ? "text-amber-500" : "text-red-600";

  const buildDyn = (vals: [string, string, string]) => {
    const nums = vals.map(v => v.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    const avg = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
    return { values: vals.map(v => (v.trim() ? Number(v) : null)), average: avg };
  };
  const dynAvg = (vals: [string, string, string]) => {
    const nums = vals.map(v => v.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));
    return nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : null;
  };

  const handleSave = async () => {
    setSaving(true);
    const gonioHasValues = Object.values(gonio.MSD).some(v => v !== "") || Object.values(gonio.MSI).some(v => v !== "");
    const testsHasValues = Object.values(tests).some(v => v !== null);

    const edemaCirc = buildEdemaPayload(edemaSano, edemaAfectado);

    const insertData: any = {
      patient_id: patientId, professional_id: userId,
      evaluation_date: form.evaluation_date,
      pain_score: painScore[0],
      goniometry: gonioHasValues ? { MSD: { pre: gonio.MSD, post: null }, MSI: { pre: gonio.MSI, post: null } } : null,
      specific_tests: testsHasValues ? tests : null,
      edema_circummetry: edemaCirc,
      dynamometer_msd: buildDyn(dynMsdVals),
      dynamometer_msi: buildDyn(dynMsiVals),
      muscle_strength_median: null,
      muscle_strength_cubital: null,
      muscle_strength_radial: null,
    };

    const textFields = [
      "pain_appearance", "pain_location", "pain_radiation", "pain_characteristics",
      "pain", "pain_aggravating_factors", "edema", "godet_test",
      "arom", "prom", "kapandji", "muscle_strength",
      "sensitivity_functional", "sensitivity_protective", "sensitivity",
      "trophic_state", "scar", "posture", "emotional_state", "notes",
    ];
    textFields.forEach(f => { insertData[f] = (form as any)[f] || null; });

    insertData.vancouver_score = form.vancouver_score ? parseInt(form.vancouver_score) : null;
    insertData.osas_score = form.osas_score ? parseInt(form.osas_score) : null;

    const { error } = await supabase.from("analytical_evaluations").insert(insertData);
    setSaving(false);
    if (error) { toast.error("Error al guardar la evaluación analítica"); return; }
    toast.success("Evaluación analítica registrada correctamente");
    onSaved(); onClose();
  };

  const allSections = ["dolor", "edema", "movilidad", "fuerza", "sensibilidad", "pruebas", "trofico", "postura"];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Evaluación Analítica</DialogTitle>
          <DialogDescription className="sr-only">Formulario completo de evaluación analítica</DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={allSections} className="w-full">
          {/* SECTION 1: Dolor */}
          <AccordionItem value="dolor">
            <AccordionTrigger className="text-sm font-semibold">Dolor — Método ALICIA</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Fecha de evaluación *</Label>
                <Input type="date" value={form.evaluation_date} onChange={e => u("evaluation_date", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Intensidad EVA: <span className={`font-bold ${painColor}`}>{painScore[0]}/10</span></Label>
                <Slider value={painScore} onValueChange={setPainScore} min={0} max={10} step={1} />
              </div>
              <div className="space-y-1"><Label className="text-xs">Aparición</Label><Textarea value={form.pain_appearance} onChange={e => u("pain_appearance", e.target.value)} rows={2} /></div>
              <div className="space-y-1"><Label className="text-xs">Localización</Label><Input value={form.pain_location} onChange={e => u("pain_location", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Irradiación</Label><Input value={form.pain_radiation} onChange={e => u("pain_radiation", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Características</Label><Input value={form.pain_characteristics} onChange={e => u("pain_characteristics", e.target.value)} placeholder="punzante, urente, opresivo..." /></div>
              <div className="space-y-1"><Label className="text-xs">Descripción general del dolor</Label><Textarea value={form.pain} onChange={e => u("pain", e.target.value)} rows={2} /></div>
              <div className="space-y-1"><Label className="text-xs">Agravantes / Atenuantes</Label><Textarea value={form.pain_aggravating_factors} onChange={e => u("pain_aggravating_factors", e.target.value)} rows={2} /></div>
            </AccordionContent>
          </AccordionItem>

          {/* SECTION 2: Edema */}
          <AccordionItem value="edema">
            <AccordionTrigger className="text-sm font-semibold">Edema</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="space-y-1"><Label className="text-xs">Observación</Label><Textarea value={form.edema} onChange={e => u("edema", e.target.value)} rows={2} /></div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Circometría</Label>
                <EdemaCircometryTable
                  mode="admission"
                  sano={edemaSano}
                  afectado={edemaAfectado}
                  onChange={({ sano, afectado }) => { setEdemaSano(sano); setEdemaAfectado(afectado); }}
                />
              </div>
              <div className="space-y-1"><Label className="text-xs">Test de Godet</Label>
                <Select value={form.godet_test} onValueChange={v => u("godet_test", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="negative">Negativo</SelectItem>
                    <SelectItem value="1+">1+</SelectItem>
                    <SelectItem value="2+">2+</SelectItem>
                    <SelectItem value="3+">3+</SelectItem>
                    <SelectItem value="4+">4+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SECTION 3: Movilidad */}
          <AccordionItem value="movilidad">
            <AccordionTrigger className="text-sm font-semibold">Movilidad</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="space-y-1"><Label className="text-xs">AROM (texto libre)</Label><Textarea value={form.arom} onChange={e => u("arom", e.target.value)} rows={2} placeholder="Rangos activos por articulación..." /></div>
              <div className="space-y-1"><Label className="text-xs">PROM (texto libre)</Label><Textarea value={form.prom} onChange={e => u("prom", e.target.value)} rows={2} placeholder="Rangos pasivos por articulación..." /></div>
              <div className="space-y-1"><Label className="text-xs">Kapandji</Label><Input value={form.kapandji} onChange={e => u("kapandji", e.target.value)} placeholder="Ej: 8/10, distancia al pliegue 2cm" /></div>

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold">Goniometría estructurada</Label>
                <Tabs value={gonioSide} onValueChange={(v) => setGonioSide(v as "MSD" | "MSI")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="MSD">MSD</TabsTrigger>
                    <TabsTrigger value="MSI">MSI</TabsTrigger>
                  </TabsList>
                </Tabs>
                {GONIOMETRY_GROUPS.map(group => (
                  <div key={group.label} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {group.fields.map(f => {
                        const key = `${group.label.toLowerCase().replace(/\s+/g, "_")}_${f}`;
                        return (
                          <div key={key} className="space-y-0.5">
                            <Label className="text-[10px] text-muted-foreground">{fieldLabel(f)}</Label>
                            <Input
                              type="number"
                              className="h-7 text-xs"
                              placeholder="°"
                              value={gonio[gonioSide][key] || ""}
                              onChange={e => setGonio(prev => ({ ...prev, [gonioSide]: { ...prev[gonioSide], [key]: e.target.value } }))}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SECTION 4: Fuerza Muscular */}
          <AccordionItem value="fuerza">
            <AccordionTrigger className="text-sm font-semibold">Fuerza Muscular</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {(["MSD", "MSI"] as const).map(side => {
                const vals = side === "MSD" ? dynMsdVals : dynMsiVals;
                const setVals = side === "MSD" ? setDynMsdVals : setDynMsiVals;
                const avg = dynAvg(vals);
                return (
                  <div key={side} className="space-y-1">
                    <Label className="text-xs">Dinamómetro {side} (kgf)</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2].map(i => (
                        <Input
                          key={i}
                          type="number"
                          step="0.1"
                          placeholder={`Med. ${i + 1}`}
                          value={vals[i]}
                          onChange={e => {
                            const next = [...vals] as [string, string, string];
                            next[i] = e.target.value;
                            setVals(next);
                          }}
                        />
                      ))}
                      <Input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        placeholder="Promedio"
                        value={avg ? `${avg} kgf` : ""}
                        className="bg-muted text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                  </div>
                );
              })}
              <div className="space-y-1"><Label className="text-xs">Fuerza general (texto libre)</Label><Textarea value={form.muscle_strength} onChange={e => u("muscle_strength", e.target.value)} rows={2} /></div>
            </AccordionContent>
          </AccordionItem>

          {/* SECTION 5: Sensibilidad */}
          <AccordionItem value="sensibilidad">
            <AccordionTrigger className="text-sm font-semibold">Sensibilidad</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="space-y-1"><Label className="text-xs">Sensibilidad epicrítica (funcional)</Label><Textarea value={form.sensitivity_functional} onChange={e => u("sensitivity_functional", e.target.value)} rows={2} placeholder="Tacto ligero, discriminación 2 puntos, picking up test..." /></div>
              <div className="space-y-1"><Label className="text-xs">Sensibilidad protopática (protectora)</Label><Textarea value={form.sensitivity_protective} onChange={e => u("sensitivity_protective", e.target.value)} rows={2} placeholder="Toco-pincho, temperatura frío-calor..." /></div>
              <div className="space-y-1"><Label className="text-xs">Sensibilidad general</Label><Textarea value={form.sensitivity} onChange={e => u("sensitivity", e.target.value)} rows={2} /></div>
            </AccordionContent>
          </AccordionItem>

          {/* SECTION 6: Estado Trófico y Cicatriz */}
          <AccordionItem value="trofico">
            <AccordionTrigger className="text-sm font-semibold">Estado Trófico y Cicatriz</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="space-y-1"><Label className="text-xs">Estado trófico</Label><Textarea value={form.trophic_state} onChange={e => u("trophic_state", e.target.value)} rows={2} /></div>
              <div className="space-y-1"><Label className="text-xs">Cicatriz (descripción general)</Label><Textarea value={form.scar} onChange={e => u("scar", e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Escala Vancouver VSS (0-15)</Label><Input type="number" min={0} max={15} value={form.vancouver_score} onChange={e => u("vancouver_score", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Escala OSAS observador (0-60)</Label><Input type="number" min={0} max={60} value={form.osas_score} onChange={e => u("osas_score", e.target.value)} /></div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SECTION 7: Pruebas Específicas */}
          <AccordionItem value="pruebas">
            <AccordionTrigger className="text-sm font-semibold">Pruebas Específicas</AccordionTrigger>
            <AccordionContent className="space-y-2 pt-2">
              {SPECIFIC_TESTS.map(test => {
                const key = testKey(test);
                const val = tests[key] || null;
                return (
                  <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm">{test}</span>
                    <div className="flex gap-1">
                      {([
                        { v: "positive" as TestResult, label: "+", cls: "bg-primary text-primary-foreground" },
                        { v: "negative" as TestResult, label: "−", cls: "bg-muted-foreground/20 text-foreground" },
                        { v: "not_performed" as TestResult, label: "N/R", cls: "bg-muted text-muted-foreground" },
                      ]).map(opt => (
                        <button
                          key={opt.v}
                          type="button"
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${val === opt.v ? opt.cls : "bg-muted/50 text-muted-foreground/60 hover:bg-muted"}`}
                          onClick={() => setTests(prev => ({ ...prev, [key]: val === opt.v ? null : opt.v }))}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </AccordionContent>
          </AccordionItem>

          {/* SECTION 8: Postura y Emotividad */}
          <AccordionItem value="postura">
            <AccordionTrigger className="text-sm font-semibold">Postura y Emotividad</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="space-y-1"><Label className="text-xs">Postura</Label><Textarea value={form.posture} onChange={e => u("posture", e.target.value)} rows={2} /></div>
              <div className="space-y-1"><Label className="text-xs">Emotividad / estado emocional</Label><Textarea value={form.emotional_state} onChange={e => u("emotional_state", e.target.value)} rows={2} /></div>
              <div className="space-y-1"><Label className="text-xs">Notas adicionales</Label><Textarea value={form.notes} onChange={e => u("notes", e.target.value)} rows={2} /></div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Pain Score Badge ---

function PainBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const color = score <= 3 ? "bg-emerald-100 text-emerald-700" : score <= 6 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>EVA {score}/10</span>;
}

// --- Detail Dialog ---

const testResultLabel: Record<string, string> = {
  positive: "Positivo (+)",
  negative: "Negativo (−)",
  not_performed: "No realizado",
};

export function AnalEvalDetailDialog({ evaluation, onClose }: { evaluation: any; onClose: () => void }) {
  if (!evaluation) return null;
  const e = evaluation;

  const gonioData: Record<string, string> | null = typeof e.goniometry === "string" ? JSON.parse(e.goniometry) : e.goniometry;
  const testsData: Record<string, string> | null = typeof e.specific_tests === "string" ? JSON.parse(e.specific_tests) : e.specific_tests;

  const Row = ({ label, value }: { label: string; value: any }) => {
    if (value === null || value === undefined || value === "") return null;
    return (
      <div>
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="text-foreground text-sm">{String(value)}</p>
      </div>
    );
  };

  const danielsArr: { muscle: string; grade: string }[] = (() => {
    const raw = e.muscle_strength_daniels;
    if (!raw) return [];
    let arr: any = raw;
    if (typeof raw === "string") { try { arr = JSON.parse(raw); } catch { return []; } }
    if (!Array.isArray(arr)) return [];
    return arr.filter((r: any) => r && typeof r === "object" && r.muscle && r.grade);
  })();

  return (
    <Dialog open={!!evaluation} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evaluación Analítica — {format(new Date(e.evaluation_date), "dd/MM/yyyy")}</DialogTitle>
          <DialogDescription className="sr-only">Detalle de evaluación analítica</DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={["dolor", "edema", "movilidad", "fuerza", "sensibilidad", "pruebas", "trofico", "postura"]} className="w-full">
          <AccordionItem value="dolor">
            <AccordionTrigger className="text-sm font-semibold">Dolor</AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div><p className="text-muted-foreground text-xs font-medium">Intensidad EVA</p><PainBadge score={e.pain_score} /></div>
              <Row label="Aparición" value={e.pain_appearance} />
              <Row label="Localización" value={e.pain_location} />
              <Row label="Irradiación" value={e.pain_radiation} />
              <Row label="Características" value={e.pain_characteristics} />
              <Row label="Descripción general" value={e.pain} />
              <Row label="Agravantes / Atenuantes" value={e.pain_aggravating_factors} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="edema">
            <AccordionTrigger className="text-sm font-semibold">Edema</AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Row label="Observación" value={e.edema} />
              {(() => {
                const c = e.edema_circummetry;
                if (!c) return null;
                if (typeof c === "object") {
                  if (!c.reference && c.value_cm == null) return null;
                  const txt = `${c.reference || ""}${c.side ? ` (${c.side})` : ""}${c.value_cm != null ? ` — ${c.value_cm} cm` : ""}${c.mano_global ? " · Mano global" : ""}`.trim();
                  return <Row label="Circometría" value={txt} />;
                }
                return <Row label="Circometría" value={c} />;
              })()}
              <Row label="Test de Godet" value={e.godet_test} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="movilidad">
            <AccordionTrigger className="text-sm font-semibold">Movilidad</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Row label="AROM" value={e.arom} />
                <Row label="PROM" value={e.prom} />
                <Row label="Kapandji" value={e.kapandji} />
              </div>
              {(() => {
                const partMap: Record<string, string> = {
                  shoulder: "Hombro", elbow: "Codo", wrist: "Muñeca", hand: "Mano", thumb: "Pulgar",
                };

                const renderPart = (data: any) => {
                  if (!data || !data.body_part) return null;
                  const partName = partMap[data.body_part] || data.body_part;
                  const values = data.values || {};
                  const entries = Object.entries(values).filter(([, v]) => v !== "" && v != null);
                  if (entries.length === 0) return null;
                  const valuesStr = entries.map(([k, v]) => `${k}: ${v}°`).join(" · ");
                  return <span key={data.body_part}>{partName}: {valuesStr}</span>;
                };

                const renderGroup = (group: any, label: string) => {
                  if (!group) return null;
                  // Array format (new)
                  if (Array.isArray(group)) {
                    const rendered = group.map(renderPart).filter(Boolean);
                    if (rendered.length === 0) return null;
                    return (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                        <div className="text-sm space-y-0.5">{rendered.map((r, i) => <p key={i}>{r}</p>)}</div>
                      </div>
                    );
                  }
                  // Single object format (old — has body_part)
                  if (group.body_part) {
                    const r = renderPart(group);
                    if (!r) return null;
                    return (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                        <p className="text-sm">{r}</p>
                      </div>
                    );
                  }
                  return null;
                };

                if (!gonioData) return null;

                const hasPre = gonioData && "pre" in gonioData && gonioData.pre;
                const hasPost = gonioData && "post" in gonioData && gonioData.post;

                if (hasPre || hasPost) {
                  return (
                    <div className="space-y-3">
                      {renderGroup((gonioData as any).pre, "Goniometría PRE")}
                      {renderGroup((gonioData as any).post, "Goniometría POST")}
                    </div>
                  );
                }

                // Fallback to flat key-value (very old format)
                if (Object.values(gonioData).some(v => v !== "" && v != null && typeof v !== "object")) {
                  return (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Goniometría</p>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                        {Object.entries(gonioData).filter(([, v]) => v !== "" && v != null && typeof v !== "object").map(([key, val]) => (
                          <div key={key} className="bg-muted/50 rounded px-2 py-1">
                            <p className="text-[10px] text-muted-foreground">{key}</p>
                            <p className="text-xs font-medium">{String(val)}°</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="fuerza">
            <AccordionTrigger className="text-sm font-semibold">Fuerza Muscular</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(() => {
                const fmtDyn = (raw: any) => {
                  if (raw == null) return null;
                  if (typeof raw === "object" && (Array.isArray(raw.values) || raw.average != null)) {
                    const vals = (raw.values || []).map((v: any) => (v != null && v !== "" ? v : "—")).join(" / ");
                    return `${vals} kgf → Promedio: ${raw.average ?? "—"} kgf`;
                  }
                  return `${raw} kgf`;
                };
                const msd = fmtDyn(e.dynamometer_msd);
                const msi = fmtDyn(e.dynamometer_msi);
                return (
                  <>
                    <Row label="Dinamómetro MSD" value={msd} />
                    <Row label="Dinamómetro MSI" value={msi} />
                    <Row label="Fuerza general" value={e.muscle_strength} />
                  </>
                );
              })()}
              </div>

              {danielsArr.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daniels — Músculos evaluados</p>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-1">
                    {danielsArr.map((r, i) => (
                      <p key={i} className="text-sm">
                        <span className="font-medium text-foreground">{r.muscle}:</span> Daniels {r.grade}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sensibilidad">
            <AccordionTrigger className="text-sm font-semibold">Sensibilidad</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {(e.sensitivity_tacto_ligero || e.sensitivity_dos_puntos || e.sensitivity_picking_up || e.sensitivity_semmes_weinstein) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Epicrítica</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Row label="Tacto ligero" value={e.sensitivity_tacto_ligero} />
                    <Row label="Discriminación 2 puntos" value={e.sensitivity_dos_puntos} />
                    <Row label="Picking up" value={e.sensitivity_picking_up} />
                    <Row label="Semmes-Weinstein" value={e.sensitivity_semmes_weinstein} />
                  </div>
                </div>
              )}
              {(e.sensitivity_toco_pincho || e.sensitivity_temperatura) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Protopática</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Row label="Toco-pincho" value={e.sensitivity_toco_pincho} />
                    <Row label="Temperatura" value={e.sensitivity_temperatura} />
                  </div>
                </div>
              )}
              {e.sensitivity && <Row label="General" value={e.sensitivity} />}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="trofico">
            <AccordionTrigger className="text-sm font-semibold">Estado Trófico y Cicatriz</AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Row label="Estado trófico" value={e.trophic_state} />
              <Row label="Cicatriz" value={e.scar} />
              <Row label="Vancouver VSS" value={e.vancouver_score != null ? `${e.vancouver_score}/15` : null} />
              <Row label="OSAS observador" value={e.osas_score != null ? `${e.osas_score}/60` : null} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="pruebas">
            <AccordionTrigger className="text-sm font-semibold">Pruebas Específicas</AccordionTrigger>
            <AccordionContent className="space-y-1 pt-2">
              {testsData ? (
                Object.entries(testsData).filter(([, v]) => v).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                    <span className="text-sm capitalize">{key.replace(/_/g, " ")}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${val === "positive" ? "bg-primary/10 text-primary" : val === "negative" ? "bg-muted text-muted-foreground" : "bg-muted/50 text-muted-foreground"}`}>
                      {testResultLabel[val as string] || val}
                    </span>
                  </div>
                ))
              ) : <p className="text-sm text-muted-foreground">No se registraron pruebas.</p>}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="postura">
            <AccordionTrigger className="text-sm font-semibold">Postura y Emotividad</AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Row label="Postura" value={e.posture} />
              <Row label="Estado emocional" value={e.emotional_state} />
              <Row label="Notas" value={e.notes} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}

// --- List with detail ---

export function AnalEvalList({ evaluations }: { evaluations: any[] }) {
  const [detail, setDetail] = useState<any>(null);

  if (evaluations.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">Sin evaluaciones analíticas.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {evaluations.map(e => (
          <Card key={e.id} className="border-border/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="font-medium text-sm">{format(new Date(e.evaluation_date), "dd/MM/yyyy")}</p>
                <PainBadge score={e.pain_score} />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetail(e)}>
                <Eye className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <AnalEvalDetailDialog evaluation={detail} onClose={() => setDetail(null)} />
    </>
  );
}
