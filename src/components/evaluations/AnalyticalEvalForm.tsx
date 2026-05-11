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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { EdemaCircometryTable, buildCircometriaPayload, normalizeCircometriaValue, isCircometriaFormat, isNewEdemaFormat, normalizeEdemaValue, EDEMA_POINTS, type CircometriaItem } from "@/components/clinical/EdemaCircometryTable";

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

const JOINT_TABS = [
  { key: "hombro", label: "Hombro" },
  { key: "codo", label: "Codo" },
  { key: "muneca", label: "Muñeca" },
  { key: "mano", label: "Mano" },
  { key: "pulgar", label: "Pulgar" },
];

const JOINT_GROUPS: Record<string, typeof GONIOMETRY_GROUPS> = {
  hombro: GONIOMETRY_GROUPS.filter(g => g.label === "Hombro"),
  codo: GONIOMETRY_GROUPS.filter(g => g.label === "Codo"),
  muneca: GONIOMETRY_GROUPS.filter(g => g.label === "Muñeca"),
  mano: GONIOMETRY_GROUPS.filter(g => g.label.startsWith("Mano")),
  pulgar: GONIOMETRY_GROUPS.filter(g => g.label.startsWith("Pulgar")),
};

const SPECIFIC_TESTS = [
  "Finkelstein", "Phalen", "Froment", "Wartenberg",
  "Garra cubital", "Jobe", "Pate", "Yocum", "Herber",
];

const testKey = (t: string) => t.toLowerCase().replace(/\s+/g, "_");

const GONIO_KEY_LABEL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  GONIOMETRY_GROUPS.forEach(g => {
    const prefix = g.label.toLowerCase().replace(/\s+/g, "_");
    g.fields.forEach(f => { map[`${prefix}_${f}`] = `${g.label} ${fieldLabel(f)}`; });
  });
  return map;
})();

type TestResult = "positive" | "negative" | "not_performed" | null;

// --- New Eval Dialog ---

export function NewAnalEvalDialog({ open, onClose, patientId, userId, onSaved }: {
  open: boolean; onClose: () => void; patientId: string; userId: string; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [painScore, setPainScore] = useState([0]);
  const [showArom, setShowArom] = useState(true);
  const [gonioAromSide, setGonioAromSide] = useState<"MSD" | "MSI">("MSD");
  const [gonioAromPart, setGonioAromPart] = useState("hombro");
  const [gonioAromPre, setGonioAromPre] = useState<{ MSD: Record<string, string>; MSI: Record<string, string> }>({ MSD: {}, MSI: {} });
  const [gonioAromPost, setGonioAromPost] = useState<{ MSD: Record<string, string>; MSI: Record<string, string> }>({ MSD: {}, MSI: {} });
  const [showAromPost, setShowAromPost] = useState(false);
  const [gonioAromSidePost, setGonioAromSidePost] = useState<"MSD" | "MSI">("MSD");
  const [gonioAromPartPost, setGonioAromPartPost] = useState("hombro");
  const [showProm, setShowProm] = useState(false);
  const [gonioPromSide, setGonioPromSide] = useState<"MSD" | "MSI">("MSD");
  const [gonioPromPart, setGonioPromPart] = useState("hombro");
  const [gonioPromPre, setGonioPromPre] = useState<{ MSD: Record<string, string>; MSI: Record<string, string> }>({ MSD: {}, MSI: {} });
  const [gonioPromPost, setGonioPromPost] = useState<{ MSD: Record<string, string>; MSI: Record<string, string> }>({ MSD: {}, MSI: {} });
  const [showPromPost, setShowPromPost] = useState(false);
  const [gonioPromSidePost, setGonioPromSidePost] = useState<"MSD" | "MSI">("MSD");
  const [gonioPromPartPost, setGonioPromPartPost] = useState("hombro");
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  // Circometría
  const [edemaCircItems, setEdemaCircItems] = useState<CircometriaItem[]>([]);
  // Dinamometría 3 mediciones
  const [dynMsdVals, setDynMsdVals] = useState<[string, string, string]>(["", "", ""]);
  const [dynMsiVals, setDynMsiVals] = useState<[string, string, string]>(["", "", ""]);
  const [form, setForm] = useState({
    evaluation_date: new Date().toISOString().split("T")[0],
    pain_appearance: "", pain_location: "", pain_radiation: "",
    pain_characteristics: "", pain: "", pain_aggravating_factors: "",
    edema: "", godet_test: "",
    kapandji: "",
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
    const buildGonioHalf = (
      pre: { MSD: Record<string, string>; MSI: Record<string, string> },
      post: { MSD: Record<string, string>; MSI: Record<string, string> },
      includePost: boolean
    ) => {
      const result: any = {};
      (["MSD", "MSI"] as const).forEach(side => {
        const hasPre = Object.values(pre[side]).some(v => v !== "");
        const hasPost = includePost && Object.values(post[side]).some(v => v !== "");
        if (hasPre || hasPost) result[side] = { pre: hasPre ? pre[side] : null, post: hasPost ? post[side] : null };
      });
      return Object.keys(result).length > 0 ? result : null;
    };
    const aromData = showArom ? buildGonioHalf(gonioAromPre, gonioAromPost, showAromPost) : null;
    const promData = showProm ? buildGonioHalf(gonioPromPre, gonioPromPost, showPromPost) : null;
    const gonioHasValues = !!(aromData || promData);
    const testsHasValues = Object.values(tests).some(v => v !== null);

    const edemaCirc = buildCircometriaPayload(edemaCircItems);

    const insertData: any = {
      patient_id: patientId, professional_id: userId,
      evaluation_date: form.evaluation_date,
      pain_score: painScore[0],
      goniometry: gonioHasValues ? { arom: aromData, prom: promData } : null,
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
      "kapandji", "muscle_strength",
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
                  items={edemaCircItems}
                  onChange={setEdemaCircItems}
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
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Kapandji</Label>
                <Input value={form.kapandji} onChange={e => u("kapandji", e.target.value)} placeholder="Ej: 8/10, distancia al pliegue 2cm" />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-foreground">Goniometría</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* AROM */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch id="arom-toggle" checked={showArom} onCheckedChange={setShowArom} />
                  <Label htmlFor="arom-toggle" className="text-xs font-semibold cursor-pointer">AROM <span className="font-normal text-muted-foreground">— Movilidad activa</span></Label>
                </div>
                {showArom && (
                  <div className="space-y-4 rounded-md border border-border/50 p-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground">PRE sesión</p>
                      <Tabs value={gonioAromSide} onValueChange={(v) => setGonioAromSide(v as "MSD" | "MSI")}>
                        <TabsList className="grid w-full grid-cols-2 h-8">
                          <TabsTrigger value="MSD" className="text-xs">MSD</TabsTrigger>
                          <TabsTrigger value="MSI" className="text-xs">MSI</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Tabs value={gonioAromPart} onValueChange={setGonioAromPart}>
                        <TabsList className="grid w-full grid-cols-5 h-8">
                          {JOINT_TABS.map(t => (
                            <TabsTrigger key={t.key} value={t.key} className="text-xs">{t.label}</TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>
                      {(JOINT_GROUPS[gonioAromPart] || []).map(group => (
                        <div key={group.label} className="space-y-1">
                          {(JOINT_GROUPS[gonioAromPart] || []).length > 1 && <p className="text-[10px] text-muted-foreground/70">{group.label}</p>}
                          <div className="grid grid-cols-4 gap-2">
                            {group.fields.map(f => {
                              const key = `${group.label.toLowerCase().replace(/\s+/g, "_")}_${f}`;
                              return (
                                <div key={key} className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">{fieldLabel(f)}</Label>
                                  <Input type="number" className="h-7 text-xs" placeholder="°" value={gonioAromPre[gonioAromSide][key] || ""} onChange={e => setGonioAromPre(prev => ({ ...prev, [gonioAromSide]: { ...prev[gonioAromSide], [key]: e.target.value } }))} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border/40 pt-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={showAromPost} onCheckedChange={(v) => setShowAromPost(!!v)} id="arom-post-toggle" />
                        <Label htmlFor="arom-post-toggle" className="font-normal text-xs cursor-pointer">Registrar POST sesión</Label>
                      </div>
                      {showAromPost && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-foreground">POST sesión</p>
                          <Tabs value={gonioAromSidePost} onValueChange={(v) => setGonioAromSidePost(v as "MSD" | "MSI")}>
                            <TabsList className="grid w-full grid-cols-2 h-8">
                              <TabsTrigger value="MSD" className="text-xs">MSD</TabsTrigger>
                              <TabsTrigger value="MSI" className="text-xs">MSI</TabsTrigger>
                            </TabsList>
                          </Tabs>
                          <Tabs value={gonioAromPartPost} onValueChange={setGonioAromPartPost}>
                            <TabsList className="grid w-full grid-cols-5 h-8">
                              {JOINT_TABS.map(t => (
                                <TabsTrigger key={t.key} value={t.key} className="text-xs">{t.label}</TabsTrigger>
                              ))}
                            </TabsList>
                          </Tabs>
                          {(JOINT_GROUPS[gonioAromPartPost] || []).map(group => (
                            <div key={group.label} className="space-y-1">
                              {(JOINT_GROUPS[gonioAromPartPost] || []).length > 1 && <p className="text-[10px] text-muted-foreground/70">{group.label}</p>}
                              <div className="grid grid-cols-4 gap-2">
                                {group.fields.map(f => {
                                  const key = `${group.label.toLowerCase().replace(/\s+/g, "_")}_${f}`;
                                  return (
                                    <div key={key} className="space-y-0.5">
                                      <Label className="text-[10px] text-muted-foreground">{fieldLabel(f)}</Label>
                                      <Input type="number" className="h-7 text-xs" placeholder="°" value={gonioAromPost[gonioAromSidePost][key] || ""} onChange={e => setGonioAromPost(prev => ({ ...prev, [gonioAromSidePost]: { ...prev[gonioAromSidePost], [key]: e.target.value } }))} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* PROM */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch id="prom-toggle" checked={showProm} onCheckedChange={setShowProm} />
                  <Label htmlFor="prom-toggle" className="text-xs font-semibold cursor-pointer">PROM <span className="font-normal text-muted-foreground">— Movilidad pasiva</span></Label>
                </div>
                {showProm && (
                  <div className="space-y-4 rounded-md border border-border/50 p-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground">PRE sesión</p>
                      <Tabs value={gonioPromSide} onValueChange={(v) => setGonioPromSide(v as "MSD" | "MSI")}>
                        <TabsList className="grid w-full grid-cols-2 h-8">
                          <TabsTrigger value="MSD" className="text-xs">MSD</TabsTrigger>
                          <TabsTrigger value="MSI" className="text-xs">MSI</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Tabs value={gonioPromPart} onValueChange={setGonioPromPart}>
                        <TabsList className="grid w-full grid-cols-5 h-8">
                          {JOINT_TABS.map(t => (
                            <TabsTrigger key={t.key} value={t.key} className="text-xs">{t.label}</TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>
                      {(JOINT_GROUPS[gonioPromPart] || []).map(group => (
                        <div key={group.label} className="space-y-1">
                          {(JOINT_GROUPS[gonioPromPart] || []).length > 1 && <p className="text-[10px] text-muted-foreground/70">{group.label}</p>}
                          <div className="grid grid-cols-4 gap-2">
                            {group.fields.map(f => {
                              const key = `${group.label.toLowerCase().replace(/\s+/g, "_")}_${f}`;
                              return (
                                <div key={key} className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">{fieldLabel(f)}</Label>
                                  <Input type="number" className="h-7 text-xs" placeholder="°" value={gonioPromPre[gonioPromSide][key] || ""} onChange={e => setGonioPromPre(prev => ({ ...prev, [gonioPromSide]: { ...prev[gonioPromSide], [key]: e.target.value } }))} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border/40 pt-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={showPromPost} onCheckedChange={(v) => setShowPromPost(!!v)} id="prom-post-toggle" />
                        <Label htmlFor="prom-post-toggle" className="font-normal text-xs cursor-pointer">Registrar POST sesión</Label>
                      </div>
                      {showPromPost && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-foreground">POST sesión</p>
                          <Tabs value={gonioPromSidePost} onValueChange={(v) => setGonioPromSidePost(v as "MSD" | "MSI")}>
                            <TabsList className="grid w-full grid-cols-2 h-8">
                              <TabsTrigger value="MSD" className="text-xs">MSD</TabsTrigger>
                              <TabsTrigger value="MSI" className="text-xs">MSI</TabsTrigger>
                            </TabsList>
                          </Tabs>
                          <Tabs value={gonioPromPartPost} onValueChange={setGonioPromPartPost}>
                            <TabsList className="grid w-full grid-cols-5 h-8">
                              {JOINT_TABS.map(t => (
                                <TabsTrigger key={t.key} value={t.key} className="text-xs">{t.label}</TabsTrigger>
                              ))}
                            </TabsList>
                          </Tabs>
                          {(JOINT_GROUPS[gonioPromPartPost] || []).map(group => (
                            <div key={group.label} className="space-y-1">
                              {(JOINT_GROUPS[gonioPromPartPost] || []).length > 1 && <p className="text-[10px] text-muted-foreground/70">{group.label}</p>}
                              <div className="grid grid-cols-4 gap-2">
                                {group.fields.map(f => {
                                  const key = `${group.label.toLowerCase().replace(/\s+/g, "_")}_${f}`;
                                  return (
                                    <div key={key} className="space-y-0.5">
                                      <Label className="text-[10px] text-muted-foreground">{fieldLabel(f)}</Label>
                                      <Input type="number" className="h-7 text-xs" placeholder="°" value={gonioPromPost[gonioPromSidePost][key] || ""} onChange={e => setGonioPromPost(prev => ({ ...prev, [gonioPromSidePost]: { ...prev[gonioPromSidePost], [key]: e.target.value } }))} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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

// --- Detail Content (shared between dialog and inline view) ---

const testResultLabel: Record<string, string> = {
  positive: "Positivo (+)",
  negative: "Negativo (−)",
  not_performed: "No realizado",
};

function AnalEvalDetailContent({ evaluation }: { evaluation: any }) {
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
        <AccordionContent className="space-y-3 pt-2">
          <Row label="Observación" value={e.edema} />
          {(() => {
            const c: any = e.edema_circummetry;
            if (!c) return null;
            if (isCircometriaFormat(c)) {
              const items = normalizeCircometriaValue(c);
              if (items.length === 0) return null;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Reparo anatómico</th>
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">MSD</th>
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">MSI</th>
                        <th className="text-center py-1.5 px-2 font-medium text-muted-foreground">Dif.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => {
                        const d = parseFloat(item.msd), s = parseFloat(item.msi);
                        const dif = !isNaN(d) && !isNaN(s) ? `${(s - d) >= 0 ? "+" : ""}${(s - d).toFixed(1)}` : "—";
                        return (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1 px-2">{item.reparo || "—"}</td>
                            <td className="py-1 px-2">{item.msd ? `${item.msd} cm` : "—"}</td>
                            <td className="py-1 px-2">{item.msi ? `${item.msi} cm` : "—"}</td>
                            <td className="py-1 px-2 text-center">{dif}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }
            if (isNewEdemaFormat(c)) {
              const norm = normalizeEdemaValue(c);
              const sanoEntries = EDEMA_POINTS.filter(p => norm.sano[p.key] != null && norm.sano[p.key] !== "");
              const afEntries = EDEMA_POINTS.filter(p => norm.afectado[p.key] != null && norm.afectado[p.key] !== "");
              if (sanoEntries.length === 0 && afEntries.length === 0) return null;
              const showSano = sanoEntries.length > 0;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Punto</th>
                        {showSano && <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">MS Sano{norm.sano.fecha ? ` (${norm.sano.fecha})` : ""}</th>}
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">MS Afectado{norm.afectado.fecha ? ` (${norm.afectado.fecha})` : ""}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {EDEMA_POINTS.map(p => {
                        const s = norm.sano[p.key], a = norm.afectado[p.key];
                        if ((s == null || s === "") && (a == null || a === "")) return null;
                        return (
                          <tr key={p.key} className="border-b border-border/50">
                            <td className="py-1 px-2">{p.label}</td>
                            {showSano && <td className="py-1 px-2">{s != null && s !== "" ? `${s} cm` : "—"}</td>}
                            <td className="py-1 px-2">{a != null && a !== "" ? `${a} cm` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }
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
          <Row label="Kapandji" value={e.kapandji} />
          {(() => {
            if (!gonioData) return null;

            const renderMoment = (vals: Record<string, string>, label: string) => {
              const entries = Object.entries(vals).filter(([, v]) => v !== "" && v != null);
              if (entries.length === 0) return null;
              return (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {entries.map(([key, val]) => (
                      <div key={key} className="bg-muted/50 rounded px-2 py-1">
                        <p className="text-[10px] text-muted-foreground leading-tight">{GONIO_KEY_LABEL[key] || key}</p>
                        <p className="text-xs font-medium">{String(val)}°</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            };

            const renderBlock = (blockData: any, title: string) => {
              if (!blockData) return null;
              const sides = (["MSD", "MSI"] as const).filter(s => blockData[s]);
              if (sides.length === 0) return null;
              return (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">{title}</p>
                  {sides.map(side => (
                    <div key={side} className="space-y-2 rounded border border-border/40 p-2">
                      <p className="text-xs font-medium text-muted-foreground">{side}</p>
                      {blockData[side]?.pre && renderMoment(blockData[side].pre, "PRE sesión")}
                      {blockData[side]?.post && renderMoment(blockData[side].post, "POST sesión")}
                    </div>
                  ))}
                </div>
              );
            };

            if (gonioData.arom || gonioData.prom) {
              return (
                <div className="space-y-4">
                  {renderBlock(gonioData.arom, "AROM")}
                  {renderBlock(gonioData.prom, "PROM")}
                </div>
              );
            }

            // legacy flat format
            const entries = Object.entries(gonioData).filter(([, v]) => v !== "" && v != null && typeof v !== "object");
            if (entries.length > 0) {
              return (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Goniometría</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {entries.map(([key, val]) => (
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
  );
}

export function AnalEvalDetailDialog({ evaluation, onClose }: { evaluation: any; onClose: () => void }) {
  if (!evaluation) return null;
  return (
    <Dialog open={!!evaluation} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evaluación Analítica — {format(new Date(evaluation.evaluation_date), "dd/MM/yyyy")}</DialogTitle>
          <DialogDescription className="sr-only">Detalle de evaluación analítica</DialogDescription>
        </DialogHeader>
        <AnalEvalDetailContent evaluation={evaluation} />
      </DialogContent>
    </Dialog>
  );
}

// --- List with detail ---

export function AnalEvalList({ evaluations, patientId }: { evaluations: any[]; patientId: string }) {
  const navigate = useNavigate();

  if (evaluations.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">Sin evaluaciones analíticas.</p>;
  }

  return (
    <div className="space-y-3">
      {evaluations.map(e => (
        <div
          key={e.id}
          className="bg-card rounded-[10px] border border-border px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-accent/40 transition-colors"
          onClick={() => navigate(`/patients/${patientId}/evaluations/analytical/${e.id}`)}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-[13px]">{format(new Date(e.evaluation_date), "dd/MM/yyyy")}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <PainBadge score={e.pain_score} />
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      ))}
    </div>
  );
}
