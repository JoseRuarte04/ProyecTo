import { useState } from "react";
import { BarChart2, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EdemaCircometryTable, type CircometriaItem } from "@/components/clinical/EdemaCircometryTable";
import { SectionCard, SubSection, inputClass, textareaClass, numFieldErr } from "../shared";
import { GonioGrid, GonioPartSelector } from "../GonioComponents";
import { SPECIFIC_TESTS, SCAR_OPTIONS, VSS_OPTIONS, SCAR_PLACEHOLDER, DANIELS_FULL_GRADES } from "../constants";
import type { PainEntry, PainTipo, GonioPartKey, GonioBySide, TestResult } from "../types";

interface AnaliticaStepProps {
  // Pain
  showPain: boolean; setShowPain: (v: boolean) => void;
  pains: PainEntry[];
  setPains: React.Dispatch<React.SetStateAction<PainEntry[]>>;
  painsNextId: React.MutableRefObject<number>;
  // Edema
  showEdema: boolean; setShowEdema: (v: boolean) => void;
  edema_obs: string; setEdemaObs: (v: string) => void;
  godet_test: string; setGodetTest: (v: string) => void;
  edema_circ_items: CircometriaItem[];
  setEdemaCircItems: React.Dispatch<React.SetStateAction<CircometriaItem[]>>;
  // Mobility
  showMobility: boolean; setShowMobility: (v: boolean) => void;
  all_pre_gonio: GonioBySide;
  setAllPreGonio: React.Dispatch<React.SetStateAction<GonioBySide>>;
  show_arom: boolean; setShowArom: (v: boolean) => void;
  show_arom_post: boolean; setShowAromPost: (v: boolean) => void;
  all_arom_post_gonio: GonioBySide;
  setAllAromPostGonio: React.Dispatch<React.SetStateAction<GonioBySide>>;
  show_prom: boolean; setShowProm: (v: boolean) => void;
  all_prom_pre_gonio: GonioBySide;
  setAllPromPreGonio: React.Dispatch<React.SetStateAction<GonioBySide>>;
  show_prom_post: boolean; setShowPromPost: (v: boolean) => void;
  all_post_gonio: GonioBySide;
  setAllPostGonio: React.Dispatch<React.SetStateAction<GonioBySide>>;
  mobility_observations: string; setMobilityObservations: (v: string) => void;
  kapandji_val: string; setKapandjiVal: (v: string) => void;
  kapandji_pain: boolean; setKapandjiPain: (v: boolean) => void;
  fist_closure: string; setFistClosure: (v: string) => void;
  // Strength
  showStrength: boolean; setShowStrength: (v: boolean) => void;
  isAdmission: boolean;
  affected_side: "MSD" | "MSI" | "both" | null;
  setAffectedSide: (v: "MSD" | "MSI" | "both" | null) => void;
  dyn_msd_vals: [string, string, string]; setDynMsdVals: (v: [string, string, string]) => void;
  dyn_msi_vals: [string, string, string]; setDynMsiVals: (v: [string, string, string]) => void;
  dppd_pulgar: string; setDppdPulgar: (v: string) => void;
  dppd_indice: string; setDppdIndice: (v: string) => void;
  dppd_medio: string; setDppdMedio: (v: string) => void;
  dppd_anular: string; setDppdAnular: (v: string) => void;
  dppd_menique: string; setDppdMenique: (v: string) => void;
  danielsRows: { id: number; muscle: string; grade: string }[];
  setDanielsRows: React.Dispatch<React.SetStateAction<{ id: number; muscle: string; grade: string }[]>>;
  danielsNextId: React.MutableRefObject<number>;
  // Sensitivity
  showSensitivity: boolean; setShowSensitivity: (v: boolean) => void;
  sensitivity: string; setSensitivity: (v: string) => void;
  sensitivity_tacto_ligero: string; setSensitivityTactoLigero: (v: string) => void;
  sensitivity_dos_puntos: string; setSensitivityDosPuntos: (v: string) => void;
  sensitivity_picking_up: string; setSensitivityPickingUp: (v: string) => void;
  sensitivity_semmes_weinstein: string; setSensitivitySemmesWeinstein: (v: string) => void;
  sensitivity_toco_pincho: string; setSensitivityTocoPincho: (v: string) => void;
  sensitivity_temperatura: string; setSensitivityTemperatura: (v: string) => void;
  // Cicatriz
  showCicatriz: boolean; setShowCicatriz: (v: boolean) => void;
  scar_localizacion: string; setScarLocalizacion: (v: string) => void;
  scar_longitud: string; setScarLongitud: (v: string) => void;
  scar_sensibilidad: string; setScarSensibilidad: (v: string) => void;
  scar_temperatura: string; setScarTemperatura: (v: string) => void;
  scar_observaciones: string; setScarObservaciones: (v: string) => void;
  vss_pigmentacion: string; setVssPigmentacion: (v: string) => void;
  vss_vascularizacion: string; setVssVascularizacion: (v: string) => void;
  vss_flexibilidad: string; setVssFlexibilidad: (v: string) => void;
  vss_altura: string; setVssAltura: (v: string) => void;
  // Specific tests
  showSpecificTests: boolean; setShowSpecificTests: (v: boolean) => void;
  specificTests: Record<string, TestResult>;
  setSpecificTests: React.Dispatch<React.SetStateAction<Record<string, TestResult>>>;
  // Otros
  showOtros: boolean; setShowOtros: (v: boolean) => void;
  trophic_state: string; setTrophicState: (v: string) => void;
  posture: string; setPosture: (v: string) => void;
  emotional_state: string; setEmotionalState: (v: string) => void;
}

export function AnaliticaStep(props: AnaliticaStepProps) {
  const {
    showPain, setShowPain, pains, setPains, painsNextId,
    showEdema, setShowEdema, edema_obs, setEdemaObs, godet_test, setGodetTest, edema_circ_items, setEdemaCircItems,
    showMobility, setShowMobility,
    all_pre_gonio, setAllPreGonio, show_arom, setShowArom, show_arom_post, setShowAromPost, all_arom_post_gonio, setAllAromPostGonio,
    show_prom, setShowProm, all_prom_pre_gonio, setAllPromPreGonio, show_prom_post, setShowPromPost, all_post_gonio, setAllPostGonio,
    mobility_observations, setMobilityObservations, kapandji_val, setKapandjiVal, kapandji_pain, setKapandjiPain, fist_closure, setFistClosure,
    showStrength, setShowStrength, isAdmission, affected_side, setAffectedSide,
    dyn_msd_vals, setDynMsdVals, dyn_msi_vals, setDynMsiVals,
    dppd_pulgar, setDppdPulgar, dppd_indice, setDppdIndice, dppd_medio, setDppdMedio, dppd_anular, setDppdAnular, dppd_menique, setDppdMenique,
    danielsRows, setDanielsRows, danielsNextId,
    showSensitivity, setShowSensitivity,
    sensitivity, setSensitivity, sensitivity_tacto_ligero, setSensitivityTactoLigero,
    sensitivity_dos_puntos, setSensitivityDosPuntos, sensitivity_picking_up, setSensitivityPickingUp,
    sensitivity_semmes_weinstein, setSensitivitySemmesWeinstein, sensitivity_toco_pincho, setSensitivityTocoPincho, sensitivity_temperatura, setSensitivityTemperatura,
    showCicatriz, setShowCicatriz,
    scar_localizacion, setScarLocalizacion, scar_longitud, setScarLongitud,
    scar_sensibilidad, setScarSensibilidad, scar_temperatura, setScarTemperatura,
    scar_observaciones, setScarObservaciones,
    vss_pigmentacion, setVssPigmentacion, vss_vascularizacion, setVssVascularizacion, vss_flexibilidad, setVssFlexibilidad, vss_altura, setVssAltura,
    showSpecificTests, setShowSpecificTests, specificTests, setSpecificTests,
    showOtros, setShowOtros, trophic_state, setTrophicState, posture, setPosture, emotional_state, setEmotionalState,
  } = props;

  // Gonio UI navigation state (local to this step)
  const [gonio_side, setGonioSide] = useState<"MSD" | "MSI">("MSD");
  const [gonio_part, setGonioPart] = useState<GonioPartKey>("wrist");
  const [gonio_side_arom_post, setGonioSideAromPost] = useState<"MSD" | "MSI">("MSD");
  const [gonio_part_arom_post, setGonioPartAromPost] = useState<GonioPartKey>("wrist");
  const [gonio_side_prom_pre, setGonioSidePromPre] = useState<"MSD" | "MSI">("MSD");
  const [gonio_part_prom_pre, setGonioPartPromPre] = useState<GonioPartKey>("wrist");
  const [gonio_side_post, setGonioSidePost] = useState<"MSD" | "MSI">("MSD");
  const [gonio_part_post, setGonioPartPost] = useState<GonioPartKey>("wrist");

  const vssTotalLive =
    (vss_pigmentacion ? parseInt(vss_pigmentacion) : 0) +
    (vss_vascularizacion ? parseInt(vss_vascularizacion) : 0) +
    (vss_flexibilidad ? parseInt(vss_flexibilidad) : 0) +
    (vss_altura ? parseInt(vss_altura) : 0);

  const cycleTest = (key: string) => {
    setSpecificTests((prev) => {
      const cur = prev[key];
      const next: TestResult = cur === null ? "positive" : cur === "positive" ? "negative" : null;
      return { ...prev, [key]: next };
    });
  };

  return (
    <SectionCard id="sec-analitica" icon={BarChart2} title="Evaluación analítica">
      {/* Dolor — múltiple */}
      <SubSection title="Dolor" checked={showPain} onChange={setShowPain} withDivider={false}>
        <div className="space-y-3">
          {pains.map((pain, idx) => (
            <div key={pain.id} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dolor {idx + 1}</span>
                {pains.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setPains(prev => prev.filter(p => p.id !== pain.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Aparición</Label>
                  <Input value={pain.aparicion} onChange={e => setPains(prev => prev.map(p => p.id === pain.id ? { ...p, aparicion: e.target.value } : p))} className={inputClass} />
                </div>
                <div>
                  <Label>Localización</Label>
                  <Input value={pain.localizacion} onChange={e => setPains(prev => prev.map(p => p.id === pain.id ? { ...p, localizacion: e.target.value } : p))} className={inputClass} />
                </div>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={pain.tipo} onValueChange={v => setPains(prev => prev.map(p => p.id === pain.id ? { ...p, tipo: v as PainTipo } : p))}>
                  <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="reposo">Reposo</SelectItem>
                    <SelectItem value="actividad">Actividad</SelectItem>
                    <SelectItem value="reposo_y_actividad">Reposo y actividad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Irradiación</Label>
                <RadioGroup
                  value={pain.irradia}
                  onValueChange={v => setPains(prev => prev.map(p => p.id === pain.id ? { ...p, irradia: v as "no" | "si", irradia_hacia: v === "no" ? "" : p.irradia_hacia } : p))}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id={`pain-rad-no-${pain.id}`} />
                    <Label htmlFor={`pain-rad-no-${pain.id}`} className="font-normal cursor-pointer text-sm">No irradia</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="si" id={`pain-rad-si-${pain.id}`} />
                    <Label htmlFor={`pain-rad-si-${pain.id}`} className="font-normal cursor-pointer text-sm">Sí irradia</Label>
                  </div>
                </RadioGroup>
                {pain.irradia === "si" && (
                  <div className="mt-2">
                    <Label>¿Hacia dónde?</Label>
                    <Input value={pain.irradia_hacia} onChange={e => setPains(prev => prev.map(p => p.id === pain.id ? { ...p, irradia_hacia: e.target.value } : p))} className={inputClass} />
                  </div>
                )}
              </div>
              <div>
                <Label>Características</Label>
                <Input value={pain.caracteristicas} onChange={e => setPains(prev => prev.map(p => p.id === pain.id ? { ...p, caracteristicas: e.target.value } : p))} placeholder="urente, punzante, etc." className={inputClass} />
              </div>
              <div>
                <Label>Intensidad EVA (0-10)</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={0} max={10} step={1}
                    value={[pain.eva]}
                    onValueChange={([v]) => setPains(prev => prev.map(p => p.id === pain.id ? { ...p, eva: v, evaTouched: true } : p))}
                    className="flex-1"
                  />
                  <Badge className={`text-sm font-semibold w-10 justify-center ${!pain.evaTouched ? "bg-muted text-foreground hover:bg-muted" : pain.eva <= 3 ? "bg-green-100 text-green-700 hover:bg-green-100" : pain.eva <= 6 ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : "bg-red-100 text-red-700 hover:bg-red-100"}`}>
                    {pain.eva}
                  </Badge>
                </div>
              </div>
              <div>
                <Label>Agravantes / Atenuantes</Label>
                <Textarea rows={2} value={pain.agravantes} onChange={e => setPains(prev => prev.map(p => p.id === pain.id ? { ...p, agravantes: e.target.value } : p))} className={textareaClass} />
              </div>
              <div>
                <Label>Observaciones</Label>
                <Textarea rows={2} value={pain.observaciones} onChange={e => setPains(prev => prev.map(p => p.id === pain.id ? { ...p, observaciones: e.target.value } : p))} className={textareaClass} />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary"
            onClick={() => {
              const id = painsNextId.current++;
              setPains(prev => [...prev, { id, localizacion: "", eva: 0, evaTouched: false, tipo: "" as PainTipo, aparicion: "", irradia: "", irradia_hacia: "", caracteristicas: "", agravantes: "", observaciones: "" }]);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Agregar dolor
          </Button>
        </div>
      </SubSection>

      {/* Edema */}
      <SubSection title="Edema" checked={showEdema} onChange={setShowEdema}>
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Circometría</h4>
          <EdemaCircometryTable items={edema_circ_items} onChange={setEdemaCircItems} />
        </div>
        <div>
          <Label>Test de Godet</Label>
          <Select value={godet_test} onValueChange={setGodetTest}>
            <SelectTrigger className={inputClass}><SelectValue placeholder="No evaluado" /></SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="not_evaluated">No evaluado</SelectItem>
              <SelectItem value="negative">Negativo</SelectItem>
              <SelectItem value="1+">1+</SelectItem>
              <SelectItem value="2+">2+</SelectItem>
              <SelectItem value="3+">3+</SelectItem>
              <SelectItem value="4+">4+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Observación</Label>
          <Textarea rows={2} value={edema_obs} onChange={(e) => setEdemaObs(e.target.value)} className={textareaClass} />
        </div>
      </SubSection>

      {/* Movilidad */}
      <SubSection title="Movilidad" checked={showMobility} onChange={setShowMobility}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-foreground">Goniometría</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* AROM */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2">
            <Switch checked={show_arom} onCheckedChange={setShowArom} id="arom-sf" />
            <Label htmlFor="arom-sf" className="font-normal text-sm cursor-pointer">AROM <span className="font-normal text-muted-foreground text-xs">— Movilidad activa</span></Label>
          </div>
          {show_arom && (
            <div className="space-y-4 rounded-md border border-border/50 p-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold">PRE sesión</p>
                <Tabs value={gonio_side} onValueChange={(v) => setGonioSide(v as "MSD" | "MSI")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="MSD">MSD</TabsTrigger>
                    <TabsTrigger value="MSI">MSI</TabsTrigger>
                  </TabsList>
                </Tabs>
                <GonioPartSelector value={gonio_part} onChange={setGonioPart} allValues={all_pre_gonio[gonio_side]} />
                <GonioGrid
                  partKey={gonio_part}
                  values={all_pre_gonio[gonio_side][gonio_part]}
                  setValues={(v) => setAllPreGonio((prev) => ({ ...prev, [gonio_side]: { ...prev[gonio_side], [gonio_part]: v } }))}
                />
              </div>
              <div className="border-t border-border/40 pt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={show_arom_post} onCheckedChange={(v) => setShowAromPost(!!v)} id="arom-post-sf" />
                  <Label htmlFor="arom-post-sf" className="font-normal text-sm cursor-pointer">Registrar POST sesión</Label>
                </div>
                {show_arom_post && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold">POST sesión</p>
                    <Tabs value={gonio_side_arom_post} onValueChange={(v) => setGonioSideAromPost(v as "MSD" | "MSI")} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="MSD">MSD</TabsTrigger>
                        <TabsTrigger value="MSI">MSI</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <GonioPartSelector value={gonio_part_arom_post} onChange={setGonioPartAromPost} allValues={all_arom_post_gonio[gonio_side_arom_post]} />
                    <GonioGrid
                      partKey={gonio_part_arom_post}
                      values={all_arom_post_gonio[gonio_side_arom_post][gonio_part_arom_post]}
                      setValues={(v) => setAllAromPostGonio((prev) => ({ ...prev, [gonio_side_arom_post]: { ...prev[gonio_side_arom_post], [gonio_part_arom_post]: v } }))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PROM */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2">
            <Switch checked={show_prom} onCheckedChange={setShowProm} id="prom-sf" />
            <Label htmlFor="prom-sf" className="font-normal text-sm cursor-pointer">PROM <span className="font-normal text-muted-foreground text-xs">— Movilidad pasiva</span></Label>
          </div>
          {show_prom && (
            <div className="space-y-4 rounded-md border border-border/50 p-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold">PRE sesión</p>
                <Tabs value={gonio_side_prom_pre} onValueChange={(v) => setGonioSidePromPre(v as "MSD" | "MSI")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="MSD">MSD</TabsTrigger>
                    <TabsTrigger value="MSI">MSI</TabsTrigger>
                  </TabsList>
                </Tabs>
                <GonioPartSelector value={gonio_part_prom_pre} onChange={setGonioPartPromPre} allValues={all_prom_pre_gonio[gonio_side_prom_pre]} />
                <GonioGrid
                  partKey={gonio_part_prom_pre}
                  values={all_prom_pre_gonio[gonio_side_prom_pre][gonio_part_prom_pre]}
                  setValues={(v) => setAllPromPreGonio((prev) => ({ ...prev, [gonio_side_prom_pre]: { ...prev[gonio_side_prom_pre], [gonio_part_prom_pre]: v } }))}
                />
              </div>
              <div className="border-t border-border/40 pt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={show_prom_post} onCheckedChange={(v) => setShowPromPost(!!v)} id="prom-post-sf" />
                  <Label htmlFor="prom-post-sf" className="font-normal text-sm cursor-pointer">Registrar POST sesión</Label>
                </div>
                {show_prom_post && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold">POST sesión</p>
                    <Tabs value={gonio_side_post} onValueChange={(v) => setGonioSidePost(v as "MSD" | "MSI")} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="MSD">MSD</TabsTrigger>
                        <TabsTrigger value="MSI">MSI</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <GonioPartSelector value={gonio_part_post} onChange={setGonioPartPost} allValues={all_post_gonio[gonio_side_post]} />
                    <GonioGrid
                      partKey={gonio_part_post}
                      values={all_post_gonio[gonio_side_post][gonio_part_post]}
                      setValues={(v) => setAllPostGonio((prev) => ({ ...prev, [gonio_side_post]: { ...prev[gonio_side_post], [gonio_part_post]: v } }))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Kapandji (0-10)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={10}
                value={kapandji_val}
                onChange={(e) => setKapandjiVal(e.target.value)}
                className={cn(inputClass, numFieldErr(kapandji_val, 0, 10, "") ? "border-destructive ring-1 ring-destructive" : "")}
              />
              <div className="flex items-center gap-2 shrink-0">
                <Checkbox checked={kapandji_pain} onCheckedChange={(v) => setKapandjiPain(!!v)} id="kap-pain-sf" />
                <Label htmlFor="kap-pain-sf" className="font-normal text-sm cursor-pointer">Con dolor</Label>
              </div>
            </div>
            {numFieldErr(kapandji_val, 0, 10, "") && (
              <p className="text-xs text-destructive mt-1">{numFieldErr(kapandji_val, 0, 10, "")}</p>
            )}
          </div>
          <div>
            <Label>Cierre de puño</Label>
            <Input value={fist_closure} onChange={(e) => setFistClosure(e.target.value)} placeholder="Completo / Incompleto..." className={inputClass} />
          </div>
        </div>
        <div>
          <Label>Observaciones</Label>
          <Textarea rows={2} value={mobility_observations} onChange={(e) => setMobilityObservations(e.target.value)} className={textareaClass} />
        </div>
      </SubSection>

      {/* Fuerza */}
      <SubSection title="Fuerza muscular" checked={showStrength} onChange={setShowStrength}>
        {isAdmission ? (
          <div className="mb-3">
            <Label className="text-sm">Lado(s) afectado(s)</Label>
            <div className="flex gap-4 mt-1.5">
              {(["MSD", "MSI"] as const).map((s) => {
                const checked = affected_side === s || affected_side === "both";
                return (
                  <div key={s} className="flex items-center gap-2">
                    <Checkbox
                      id={`aff-${s}`}
                      checked={checked}
                      onCheckedChange={(v) => {
                        const other = s === "MSD" ? "MSI" : "MSD";
                        const otherChecked = affected_side === other || affected_side === "both";
                        if (v) setAffectedSide(otherChecked ? "both" : s);
                        else setAffectedSide(otherChecked ? other : null);
                      }}
                    />
                    <Label htmlFor={`aff-${s}`} className="font-normal cursor-pointer">{s}</Label>
                  </div>
                );
              })}
            </div>
          </div>
        ) : affected_side ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Lado afectado:</span>
            <Badge variant="outline" className="text-xs font-medium">
              {affected_side === "both" ? "MSD + MSI" : affected_side}
            </Badge>
          </div>
        ) : null}
        {(["MSD", "MSI"] as const).map((side) => {
          const vals = side === "MSD" ? dyn_msd_vals : dyn_msi_vals;
          const setVals = side === "MSD" ? setDynMsdVals : setDynMsiVals;
          const nums = vals.map((v) => v.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n));
          const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "";
          const isAffected = affected_side === side || affected_side === "both";
          return (
            <div key={side}>
              <div className="flex items-center gap-2 mb-1">
                <Label>Dinamómetro {side} (kgf)</Label>
                {isAffected && <Badge variant="destructive" className="text-[10px] py-0">Afectado</Badge>}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-1 items-start">
                {[0, 1, 2].map((i) => {
                  const err = numFieldErr(vals[i], 0, 200, "kgf");
                  return (
                    <div key={i}>
                      <Input
                        type="number"
                        step="0.1"
                        min={0}
                        placeholder={`Med. ${i + 1}`}
                        value={vals[i]}
                        onChange={(e) => {
                          const next = [...vals] as [string, string, string];
                          next[i] = e.target.value;
                          setVals(next);
                        }}
                        className={cn(inputClass, err ? "border-destructive ring-1 ring-destructive" : "")}
                      />
                      {err && <p className="text-[11px] text-destructive mt-0.5 leading-tight">{err}</p>}
                    </div>
                  );
                })}
                <Input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  placeholder="Promedio"
                  value={avg ? `${avg} kgf` : ""}
                  className={`${inputClass} bg-muted text-muted-foreground cursor-not-allowed`}
                />
              </div>
            </div>
          );
        })}
        <div>
          <Label>DPPD (cm) — distancia pulpejo-pliegue distal</Label>
          <div className="grid grid-cols-5 gap-2 items-start">
            {([
              { label: "Pulgar",  value: dppd_pulgar,  set: setDppdPulgar  },
              { label: "Índice",  value: dppd_indice,  set: setDppdIndice  },
              { label: "Medio",   value: dppd_medio,   set: setDppdMedio   },
              { label: "Anular",  value: dppd_anular,  set: setDppdAnular  },
              { label: "Meñique", value: dppd_menique, set: setDppdMenique },
            ] as const).map(({ label, value, set }) => {
              const err = numFieldErr(value, 0, 30, "cm");
              return (
                <div key={label}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={30}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className={cn(inputClass, err ? "border-destructive ring-1 ring-destructive" : "")}
                  />
                  {err && <p className="text-[11px] text-destructive mt-0.5 leading-tight">{err}</p>}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Daniels — Músculos evaluados</Label>
          <div className="space-y-2">
            {danielsRows.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <Input
                  value={row.muscle}
                  onChange={(ev) => setDanielsRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, muscle: ev.target.value } : r)))}
                  placeholder="Ej: Flexores de hombro"
                  className={`${inputClass} flex-1`}
                />
                <select
                  value={row.grade}
                  onChange={(ev) => setDanielsRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, grade: ev.target.value } : r)))}
                  className={`${inputClass} w-24 px-3 py-2 text-sm bg-background`}
                >
                  <option value="">Grado</option>
                  {DANIELS_FULL_GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                {danielsRows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDanielsRows((prev) => prev.filter((r) => r.id !== row.id))}
                    aria-label="Eliminar fila"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary"
              onClick={() => {
                const id = danielsNextId.current++;
                setDanielsRows((prev) => [...prev, { id, muscle: "", grade: "" }]);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar grupo muscular
            </Button>
          </div>
        </div>
      </SubSection>

      {/* Sensibilidad */}
      <SubSection title="Sensibilidad" checked={showSensitivity} onChange={setShowSensitivity}>
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Epicrítica (funcional)</h4>
          <div className="space-y-3">
            <div><Label>Tacto ligero</Label><Textarea rows={2} value={sensitivity_tacto_ligero} onChange={(e) => setSensitivityTactoLigero(e.target.value)} className={textareaClass} /></div>
            <div><Label>Discriminación 2 puntos</Label><Textarea rows={2} value={sensitivity_dos_puntos} onChange={(e) => setSensitivityDosPuntos(e.target.value)} className={textareaClass} /></div>
            <div><Label>Picking up test</Label><Textarea rows={2} value={sensitivity_picking_up} onChange={(e) => setSensitivityPickingUp(e.target.value)} className={textareaClass} /></div>
            <div><Label>Semmes-Weinstein</Label><Textarea rows={2} value={sensitivity_semmes_weinstein} onChange={(e) => setSensitivitySemmesWeinstein(e.target.value)} className={textareaClass} /></div>
          </div>
        </div>
        <div className="pt-3">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Protopática (protectora)</h4>
          <div className="space-y-3">
            <div><Label>Toco-pincho</Label><Textarea rows={2} value={sensitivity_toco_pincho} onChange={(e) => setSensitivityTocoPincho(e.target.value)} className={textareaClass} /></div>
            <div><Label>Temperatura frío-calor</Label><Textarea rows={2} value={sensitivity_temperatura} onChange={(e) => setSensitivityTemperatura(e.target.value)} className={textareaClass} /></div>
          </div>
        </div>
        <div>
          <Label>Observaciones</Label>
          <Textarea rows={2} value={sensitivity} onChange={(e) => setSensitivity(e.target.value)} className={textareaClass} />
        </div>
      </SubSection>

      {/* Cicatriz */}
      <SubSection
        title="Cicatriz"
        checked={showCicatriz}
        onChange={setShowCicatriz}
        badge={vssTotalLive > 0 ? <Badge variant="secondary" className="text-[10px]">VSS {vssTotalLive}/15</Badge> : null}
      >
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Localización</Label>
              <Input value={scar_localizacion} onChange={(e) => setScarLocalizacion(e.target.value)} placeholder={SCAR_PLACEHOLDER} className={inputClass} />
            </div>
            <div>
              <Label>Longitud (cm)</Label>
              <Input type="number" step="0.1" min={0} value={scar_longitud} onChange={(e) => setScarLongitud(e.target.value)} placeholder={SCAR_PLACEHOLDER} className={inputClass} />
            </div>
            <div>
              <Label>Sensibilidad</Label>
              <Select value={scar_sensibilidad} onValueChange={setScarSensibilidad}>
                <SelectTrigger className={inputClass}><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                <SelectContent position="popper">
                  {SCAR_OPTIONS.sensibilidad.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Temperatura</Label>
              <Select value={scar_temperatura} onValueChange={setScarTemperatura}>
                <SelectTrigger className={inputClass}><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                <SelectContent position="popper">
                  {SCAR_OPTIONS.temperatura.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-foreground">Escala Vancouver VSS</h4>
            <Badge variant="secondary">Total: {vssTotalLive}/15</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Pigmentación</Label>
              <Select value={vss_pigmentacion} onValueChange={setVssPigmentacion}>
                <SelectTrigger className={inputClass}><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                <SelectContent position="popper">
                  {VSS_OPTIONS.pigmentacion.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vascularización</Label>
              <Select value={vss_vascularizacion} onValueChange={setVssVascularizacion}>
                <SelectTrigger className={inputClass}><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                <SelectContent position="popper">
                  {VSS_OPTIONS.vascularizacion.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Flexibilidad</Label>
              <Select value={vss_flexibilidad} onValueChange={setVssFlexibilidad}>
                <SelectTrigger className={inputClass}><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                <SelectContent position="popper">
                  {VSS_OPTIONS.flexibilidad.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Altura</Label>
              <Select value={vss_altura} onValueChange={setVssAltura}>
                <SelectTrigger className={inputClass}><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                <SelectContent position="popper">
                  {VSS_OPTIONS.altura.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div>
          <Label>Observaciones</Label>
          <Textarea rows={2} value={scar_observaciones} onChange={(e) => setScarObservaciones(e.target.value)} className={textareaClass} />
        </div>
      </SubSection>

      {/* Pruebas específicas */}
      <SubSection title="Pruebas específicas" checked={showSpecificTests} onChange={setShowSpecificTests}>
        <div className="flex flex-wrap gap-2">
          {SPECIFIC_TESTS.map((t) => {
            const val = specificTests[t.key];
            return (
              <Button
                key={t.key}
                type="button"
                variant="outline"
                size="sm"
                className={`h-9 text-xs gap-1.5 rounded-full border-border ${
                  val === "positive"
                    ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    : val === "negative"
                    ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                    : ""
                }`}
                onClick={() => cycleTest(t.key)}
              >
                {t.label}
                {val === "positive" && <span className="font-bold text-red-600">+</span>}
                {val === "negative" && <span className="font-bold text-green-600">−</span>}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Clic para alternar: sin evaluar → positivo (+) → negativo (−)</p>
      </SubSection>

      {/* Otros */}
      <SubSection title="Otros" checked={showOtros} onChange={setShowOtros}>
        <div><Label>Estado trófico</Label><Textarea rows={2} value={trophic_state} onChange={(e) => setTrophicState(e.target.value)} className={textareaClass} /></div>
        <div><Label>Postura</Label><Textarea rows={2} value={posture} onChange={(e) => setPosture(e.target.value)} className={textareaClass} /></div>
        <div><Label>Emotividad</Label><Textarea rows={2} value={emotional_state} onChange={(e) => setEmotionalState(e.target.value)} className={textareaClass} /></div>
      </SubSection>
    </SectionCard>
  );
}
