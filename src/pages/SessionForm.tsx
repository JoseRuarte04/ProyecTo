import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { differenceInYears, differenceInCalendarDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft,
  Loader2,
  ChevronDown,
  Calendar,
  FileText,
  BarChart2,
  ClipboardList,
  MessageSquare,
  X,
  Plus,
  Briefcase,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  QuickDashSection,
  FimSection,
  BarthelSection,
  emptyQuickDash,
  emptyFim,
  emptyBarthel,
  calcQuickDashScore,
  calcFimTotal,
  calcBarthelTotal,
} from "@/components/evaluations/FunctionalScales";

// ── Goniometry config by body part ──
const GONIO_PARTS = {
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

type GonioPartKey = keyof typeof GONIO_PARTS;

// ── Specific tests ──
const SPECIFIC_TESTS = [
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

type TestResult = "positive" | "negative" | null;

// ── Daniels grades ──
const DANIELS_FULL_GRADES = ["0", "1", "1+", "2-", "2", "2+", "3-", "3", "3+", "4-", "4", "4+", "5"];

// ── Cicatriz: opciones planilla ──
const SCAR_OPTIONS: Record<string, string[]> = {
  localizacion: ["Zona", "Atraviesa articulación"],
  vascularizacion: ["Normal", "Rosa", "Roja", "Púrpura"],
  pigmentacion: ["Normal", "Hipopigmentada", "Pigmentación mixta", "Hiperpigmentada"],
  flexibilidad: ["Flexible", "Semiflexible", "Rígida", "Adherida", "Retráctil", "Brida cicatrizal"],
  sensibilidad: ["Normal", "Hipersensibilidad", "Hiposensibilidad", "Parestesias", "Prurito"],
  relieve: ["Plana", "Levemente elevada", "Invaginada", "Hipertrófica", "Queloide"],
  temperatura: ["Normal", "Alta"],
};

const VSS_OPTIONS = {
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

const SCAR_PLACEHOLDER = "No evaluado";

// ── Reusable wrappers ──
function SectionCard({
  icon: Icon,
  title,
  action,
  children,
  toggle,
}: {
  icon: any;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  toggle?: { checked: boolean; onChange: (v: boolean) => void; label?: string };
}) {
  const isOff = toggle && !toggle.checked;
  return (
    <Card className="rounded-xl border-border bg-card mb-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-serif text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {action}
          {toggle && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{toggle.label || (toggle.checked ? "Incluido" : "Incluir")}</span>
              <Switch checked={toggle.checked} onCheckedChange={toggle.onChange} />
            </div>
          )}
        </div>
      </div>
      {!isOff && <CardContent className="p-5">{children}</CardContent>}
    </Card>
  );
}

function SubSection({
  title,
  checked,
  onChange,
  children,
  withDivider = true,
  badge,
}: {
  title: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  withDivider?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className={`space-y-3 ${withDivider ? "pt-5 mt-5 border-t border-border" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="field-label">{title}</h3>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{checked ? "Incluido" : "Incluir"}</span>
          <Switch checked={checked} onCheckedChange={onChange} />
        </div>
      </div>
      {checked && <div className="space-y-3">{children}</div>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs mb-1.5 block">
      {children}
    </Label>
  );
}

const inputClass = "rounded-md h-10 text-sm";
const textareaClass = "rounded-lg";


// ── Cie10 autocomplete (inline) ──
function Cie10Autocomplete({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Array<{ code: string; description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updateRect = () => {
    if (wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  };

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) { setResults([]); setOpen(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_cie10', { search_input: term, max_results: 10 });
      if (cancelled) return;
      setResults(data || []);
      updateRect();
      setOpen(true);
      setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); setLoading(false); };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    updateRect();
    const onResize = () => updateRect();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
  }, [open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (results.length > 0) { updateRect(); setOpen(true); } }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      {open && results.length > 0 && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: rect.top + rect.height + 4, left: rect.left, width: rect.width, zIndex: 60 }}
          className="max-h-64 overflow-auto rounded-md border bg-popover shadow-md"
        >
          {results.map((r) => (
            <button
              key={r.code}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(`${r.code} — ${r.description}`); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="font-medium">{r.code}</span> — {r.description}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}


export default function SessionForm() {
  const { patientId, sessionId } = useParams<{ patientId: string; sessionId?: string }>();
  const [searchParams] = useSearchParams();
  const episodeIdParam = searchParams.get("episode");
  const typeParam = searchParams.get("type");
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditMode = !!sessionId;

  const [patient, setPatient] = useState<any>(null);
  const [clinical, setClinical] = useState<any>(null);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(episodeIdParam);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingFuncEval, setEditingFuncEval] = useState<any>(null);
  const [editingAnalEval, setEditingAnalEval] = useState<any>(null);

  // Form state
  const [session_date, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [session_type, setSessionType] = useState(typeParam === "admission" ? "admission" : "follow_up");
  const [session_number, setSessionNumber] = useState("");
  const [week_at_session, setWeekAtSession] = useState("");
  const [general_observations, setGeneralObservations] = useState("");
  const [symptom_changes, setSymptomChanges] = useState("");
  const [clinical_changes, setClinicalChanges] = useState("");
  const [discharge_summary, setDischargeSummary] = useState("");
  const [avd_followup, setAvdFollowup] = useState("");

  // Functional eval (admission only)
  const [func_dominance, setFuncDominance] = useState("");
  const [func_avd, setFuncAvd] = useState("");
  const [func_aivd, setFuncAivd] = useState("");
  const [func_sleep, setFuncSleep] = useState("");
  const [func_health, setFuncHealth] = useState("");
  const [qd_items, setQdItems] = useState<(number | null)[]>(emptyQuickDash());
  const [fim_items, setFimItems] = useState<Record<string, number | null>>(emptyFim());
  const [barthel_items, setBarthelItems] = useState<Record<string, number | null>>(emptyBarthel());

  // Functional eval toggle (default on for admission, off for follow_up/discharge)
  const [showFunctional, setShowFunctional] = useState(typeParam === "admission");

  // Analytical evaluation (master toggle)
  const [show_measurements, setShowMeasurements] = useState(false);

  // Per-subsection toggles
  const [showPain, setShowPain] = useState(true);
  const [showEdema, setShowEdema] = useState(false);
  const [showMobility, setShowMobility] = useState(false);
  const [showStrength, setShowStrength] = useState(false);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showCicatriz, setShowCicatriz] = useState(false);
  const [showSpecificTests, setShowSpecificTests] = useState(false);
  const [showOtros, setShowOtros] = useState(false);

  // Pain
  const [pain_touched, setPainTouched] = useState(false);
  const [pain_score, setPainScore] = useState(0);
  const [pain_location, setPainLocation] = useState("");
  const [pain_characteristics, setPainCharacteristics] = useState("");
  const [pain_aggravating_factors, setPainAggravatingFactors] = useState("");
  const [pain_radiates_choice, setPainRadiatesChoice] = useState<"" | "no" | "si">("");
  const [pain_radiation, setPainRadiation] = useState("");
  const [pain_appearance, setPainAppearance] = useState("");
  const [pain_free, setPainFree] = useState("");

  // Edema
  const [edema_obs, setEdemaObs] = useState("");
  const [godet_test, setGodetTest] = useState("");

  // Circometría (nuevo formato JSONB)
  const [circ_reference, setCircReference] = useState("");
  const [circ_side, setCircSide] = useState<"D" | "I">("D");
  const [circ_value_cm, setCircValueCm] = useState("");
  const [circ_mano_global, setCircManoGlobal] = useState(false);

  // Goniometry PRE/POST — por lado MSD/MSI, nested by part
  type GonioBySide = Record<"MSD" | "MSI", Record<GonioPartKey, Record<string, string>>>;
  const emptySide = () => ({ shoulder: {}, elbow: {}, wrist: {}, hand: {}, thumb: {} } as Record<GonioPartKey, Record<string, string>>);
  const emptyGonio = (): GonioBySide => ({ MSD: emptySide(), MSI: emptySide() });
  const [gonio_side, setGonioSide] = useState<"MSD" | "MSI">("MSD");
  const [gonio_part, setGonioPart] = useState<GonioPartKey>("wrist");
  const [all_pre_gonio, setAllPreGonio] = useState<GonioBySide>(emptyGonio);
  const [show_post_gonio, setShowPostGonio] = useState(false);
  const [gonio_side_post, setGonioSidePost] = useState<"MSD" | "MSI">("MSD");
  const [gonio_part_post, setGonioPartPost] = useState<GonioPartKey>("wrist");
  const [all_post_gonio, setAllPostGonio] = useState<GonioBySide>(emptyGonio);

  // Fist closure
  const [fist_closure, setFistClosure] = useState("");

  // Strength — dinamometría con 3 mediciones por lado
  const [dyn_msd_vals, setDynMsdVals] = useState<[string, string, string]>(["", "", ""]);
  const [dyn_msi_vals, setDynMsiVals] = useState<[string, string, string]>(["", "", ""]);
  const [kapandji_val, setKapandjiVal] = useState("");
  const [kapandji_pain, setKapandjiPain] = useState(false);
  const [dppd_pulgar, setDppdPulgar] = useState("");
  const [dppd_indice, setDppdIndice] = useState("");
  const [dppd_medio, setDppdMedio] = useState("");
  const [dppd_anular, setDppdAnular] = useState("");
  const [dppd_menique, setDppdMenique] = useState("");
  const [danielsRows, setDanielsRows] = useState<{ id: number; muscle: string; grade: string }[]>([
    { id: 1, muscle: "", grade: "" },
  ]);
  const danielsNextId = useRef(2);


  // Specific tests
  const [specificTests, setSpecificTests] = useState<Record<string, TestResult>>(
    Object.fromEntries(SPECIFIC_TESTS.map((t) => [t.key, null]))
  );

  // Sensitivity
  const [sensitivity, setSensitivity] = useState("");
  const [sensitivity_tacto_ligero, setSensitivityTactoLigero] = useState("");
  const [sensitivity_dos_puntos, setSensitivityDosPuntos] = useState("");
  const [sensitivity_picking_up, setSensitivityPickingUp] = useState("");
  const [sensitivity_semmes_weinstein, setSensitivitySemmesWeinstein] = useState("");
  const [sensitivity_toco_pincho, setSensitivityTocoPincho] = useState("");
  const [sensitivity_temperatura, setSensitivityTemperatura] = useState("");

  // Trophic & others
  const [trophic_state, setTrophicState] = useState("");
  // Cicatriz — Planilla
  const [scar_localizacion, setScarLocalizacion] = useState("");
  const [scar_longitud, setScarLongitud] = useState("");
  const [scar_vascularizacion, setScarVascularizacion] = useState("");
  const [scar_pigmentacion, setScarPigmentacion] = useState("");
  const [scar_flexibilidad, setScarFlexibilidad] = useState("");
  const [scar_sensibilidad, setScarSensibilidad] = useState("");
  const [scar_relieve, setScarRelieve] = useState("");
  const [scar_temperatura, setScarTemperatura] = useState("");
  const [scar_observaciones, setScarObservaciones] = useState("");
  // Cicatriz — Vancouver VSS
  const [vss_pigmentacion, setVssPigmentacion] = useState("");
  const [vss_vascularizacion, setVssVascularizacion] = useState("");
  const [vss_flexibilidad, setVssFlexibilidad] = useState("");
  const [vss_altura, setVssAltura] = useState("");
  const [posture, setPosture] = useState("");
  const [emotional_state, setEmotionalState] = useState("");

  // Interventions & notes
  const [interventions, setInterventions] = useState("");
  const [home_instructions_sent, setHomeInstructionsSent] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!patientId) return;
    const load = async () => {
      const [p, c, sc] = await Promise.all([
        supabase.from("patients").select("*").eq("id", patientId).single(),
        supabase.from("patient_clinical_records").select("*").eq("patient_id", patientId).single(),
        supabase
          .from("therapy_sessions")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patientId)
          .eq("is_deleted", false),
      ]);
      setPatient(p.data);
      setClinical(c.data);
      if (!isEditMode && sc.count != null) setSessionNumber(String(sc.count + 1));

      if (sessionId) {
        const [sessionRes, funcRes, analRes] = await Promise.all([
          supabase.from("therapy_sessions").select("*").eq("id", sessionId).eq("patient_id", patientId).eq("is_deleted", false).single(),
          supabase.from("functional_evaluations").select("*").eq("session_id", sessionId).maybeSingle(),
          supabase.from("analytical_evaluations").select("*").eq("session_id", sessionId).maybeSingle(),
        ]);
        if (!sessionRes.data) {
          setLoading(false);
          return;
        }
        const s = sessionRes.data;
        setEditingFuncEval(funcRes.data);
        setEditingAnalEval(analRes.data);
        setActiveEpisodeId(s.episode_id || episodeIdParam || null);
        setSessionDate(s.session_date || new Date().toISOString().split("T")[0]);
        setSessionType(s.session_type || "follow_up");
        setSessionNumber(s.session_number != null ? String(s.session_number) : "");
        setWeekAtSession(s.week_at_session != null ? String(s.week_at_session) : "");
        setGeneralObservations(s.general_observations || "");
        setSymptomChanges(s.symptom_changes || "");
        setClinicalChanges(s.clinical_changes || "");
        setAvdFollowup(s.avd_followup || "");
        setInterventions(s.interventions || "");
        setHomeInstructionsSent(s.home_instructions_sent || "");
        setNotes(s.notes || "");

        const fe = funcRes.data;
        if (fe) {
          setShowFunctional(true);
          setFuncDominance(fe.dominance || "");
          setFuncAvd(fe.avd || "");
          setFuncAivd(fe.aivd || "");
          setFuncSleep(fe.sleep_rest || "");
          setFuncHealth(fe.health_management || "");
          if (Array.isArray(fe.quickdash_items)) setQdItems(fe.quickdash_items as any);
          if (fe.fim_items && typeof fe.fim_items === "object") setFimItems(fe.fim_items as any);
          if (fe.barthel_items && typeof fe.barthel_items === "object") setBarthelItems(fe.barthel_items as any);
        }

        const ae = analRes.data;
        if (ae) {
          setShowMeasurements(true);
          setPainTouched(ae.pain_score != null);
          setPainScore(ae.pain_score || 0);
          setPainAppearance(ae.pain_appearance || "");
          setPainLocation((ae.pain_location || "").replace(/ — Irradia a:.*/, ""));
          setPainCharacteristics(ae.pain_characteristics || "");
          setPainAggravatingFactors(ae.pain_aggravating_factors || "");
          setPainFree(ae.pain || "");
          if (ae.pain_radiation === "No irradia") setPainRadiatesChoice("no");
          else if (ae.pain_radiation) { setPainRadiatesChoice("si"); setPainRadiation(ae.pain_radiation); }
          setEdemaObs(ae.edema || "");
          setGodetTest(ae.godet_test || "");
          setShowEdema(!!(ae.edema || ae.godet_test || ae.edema_circummetry));
          const circ: any = ae.edema_circummetry;
          if (circ && typeof circ === "object" && !Array.isArray(circ)) {
            setCircReference(circ.reference || "");
            setCircSide(circ.side === "I" ? "I" : "D");
            setCircValueCm(circ.value_cm != null ? String(circ.value_cm) : "");
            setCircManoGlobal(!!circ.mano_global);
          }
          setShowMobility(!!(ae.goniometry || ae.arom || ae.prom || ae.kapandji));
          if (ae.goniometry && typeof ae.goniometry === "object") {
            const toGonio = (arr: any) => {
              const base = emptySide();
              if (Array.isArray(arr)) arr.forEach((g: any) => { if (g?.body_part && base[g.body_part as GonioPartKey]) base[g.body_part as GonioPartKey] = Object.fromEntries(Object.entries(g.values || {}).map(([k,v]) => [k, String(v)])); });
              return base;
            };
            const g: any = ae.goniometry;
            const hasNew = g.MSD || g.MSI;
            if (hasNew) {
              setAllPreGonio({ MSD: toGonio(g.MSD?.pre), MSI: toGonio(g.MSI?.pre) });
              setAllPostGonio({ MSD: toGonio(g.MSD?.post), MSI: toGonio(g.MSI?.post) });
              const hasPost = (Array.isArray(g.MSD?.post) && g.MSD.post.length) || (Array.isArray(g.MSI?.post) && g.MSI.post.length);
              setShowPostGonio(!!hasPost);
            } else {
              // Legacy { pre, post } → bajo MSD
              setAllPreGonio({ MSD: toGonio(g.pre), MSI: emptySide() });
              setAllPostGonio({ MSD: toGonio(g.post), MSI: emptySide() });
              setShowPostGonio(Array.isArray(g.post) && g.post.length > 0);
            }
          }
          const kap = ae.kapandji || "";
          setKapandjiVal(kap.match(/^(\d+)/)?.[1] || "");
          setKapandjiPain(kap.includes("dolor"));
          const parseDyn = (v: any): [string, string, string] => {
            if (v == null) return ["", "", ""];
            if (typeof v === "object" && Array.isArray(v.values)) {
              const a = v.values; return [a[0]!=null?String(a[0]):"", a[1]!=null?String(a[1]):"", a[2]!=null?String(a[2]):""];
            }
            if (typeof v === "number") return [String(v), "", ""];
            return ["", "", ""];
          };
          setDynMsdVals(parseDyn(ae.dynamometer_msd));
          setDynMsiVals(parseDyn(ae.dynamometer_msi));
          setShowStrength(!!(ae.dynamometer_msd || ae.dynamometer_msi || ae.muscle_strength || ae.muscle_strength_daniels || ae.dppd_fingers));
          const fist = (ae.muscle_strength || "").match(/Cierre de puño: ([^—]+)/)?.[1]?.trim() || "";
          setFistClosure(fist);
          if (Array.isArray(ae.muscle_strength_daniels) && ae.muscle_strength_daniels.length) {
            const rows = ae.muscle_strength_daniels.map((r: any, i: number) => ({ id: i + 1, muscle: r.muscle || "", grade: r.grade || "" }));
            setDanielsRows(rows);
            danielsNextId.current = rows.length + 1;
          }
          const dppd = (ae.dppd_fingers && typeof ae.dppd_fingers === "object" && !Array.isArray(ae.dppd_fingers) ? ae.dppd_fingers : {}) as Record<string, any>;
          setDppdPulgar(dppd.pulgar != null ? String(dppd.pulgar) : "");
          setDppdIndice(dppd.indice != null ? String(dppd.indice) : "");
          setDppdMedio(dppd.medio != null ? String(dppd.medio) : "");
          setDppdAnular(dppd.anular != null ? String(dppd.anular) : "");
          setDppdMenique(dppd.menique != null ? String(dppd.menique) : "");
          setShowSensitivity(!!(ae.sensitivity || ae.sensitivity_tacto_ligero || ae.sensitivity_dos_puntos || ae.sensitivity_picking_up || ae.sensitivity_semmes_weinstein || ae.sensitivity_toco_pincho || ae.sensitivity_temperatura));
          setSensitivity(ae.sensitivity || "");
          setSensitivityTactoLigero(ae.sensitivity_tacto_ligero || "");
          setSensitivityDosPuntos(ae.sensitivity_dos_puntos || "");
          setSensitivityPickingUp(ae.sensitivity_picking_up || "");
          setSensitivitySemmesWeinstein(ae.sensitivity_semmes_weinstein || "");
          setSensitivityTocoPincho(ae.sensitivity_toco_pincho || "");
          setSensitivityTemperatura(ae.sensitivity_temperatura || "");
          if (ae.specific_tests && typeof ae.specific_tests === "object") { setSpecificTests(ae.specific_tests as any); setShowSpecificTests(true); }
          const scar = (ae.scar_evaluation && typeof ae.scar_evaluation === "object" && !Array.isArray(ae.scar_evaluation) ? ae.scar_evaluation : {}) as Record<string, any>;
          setShowCicatriz(!!(ae.scar || ae.scar_evaluation || ae.vancouver_score));
          setScarLocalizacion(scar.localizacion || "");
          setScarLongitud(scar.longitud_cm != null ? String(scar.longitud_cm) : "");
          setScarVascularizacion(scar.vascularizacion || "");
          setScarPigmentacion(scar.pigmentacion || "");
          setScarFlexibilidad(scar.flexibilidad || "");
          setScarSensibilidad(scar.sensibilidad || "");
          setScarRelieve(scar.relieve || "");
          setScarTemperatura(scar.temperatura || "");
          setScarObservaciones(ae.scar || "");
          setVssPigmentacion(scar.vss?.pigmentacion != null ? String(scar.vss.pigmentacion) : "");
          setVssVascularizacion(scar.vss?.vascularizacion != null ? String(scar.vss.vascularizacion) : "");
          setVssFlexibilidad(scar.vss?.flexibilidad != null ? String(scar.vss.flexibilidad) : "");
          setVssAltura(scar.vss?.altura != null ? String(scar.vss.altura) : "");
          setShowOtros(!!(ae.trophic_state || ae.posture || ae.emotional_state));
          setTrophicState(ae.trophic_state || "");
          setPosture(ae.posture || "");
          setEmotionalState(ae.emotional_state || "");
        }
        setLoading(false);
        return;
      }

      if (!episodeIdParam) {
        const { data: ep } = await supabase
          .from("treatment_episodes")
          .select("id")
          .eq("patient_id", patientId)
          .eq("status", "active")
          .eq("is_deleted", false)
          .order("episode_number", { ascending: false })
          .limit(1)
          .single();
        if (ep) setActiveEpisodeId(ep.id);
      }
      setLoading(false);
    };
    load();
  }, [patientId, sessionId]);

  // Auto-calculate weeks at session from injury date (or symptom start as fallback)
  const weekCalcSource: "injury" | "symptom" | null = clinical?.injury_date
    ? "injury"
    : clinical?.symptom_start_date
    ? "symptom"
    : null;

  useEffect(() => {
    if (!session_date || !clinical) return;
    const refDateStr = clinical.injury_date || clinical.symptom_start_date;
    if (!refDateStr) return;
    const ref = new Date(refDateStr + "T12:00:00");
    const sess = new Date(session_date + "T12:00:00");
    const days = differenceInCalendarDays(sess, ref);
    if (days < 0) return;
    const weeks = Math.floor(days / 7);
    setWeekAtSession(String(weeks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_date, clinical]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!patient)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-center text-muted-foreground py-12">Paciente no encontrado.</p>
      </div>
    );

  // ── Gonio helpers ──
  const buildAllGonioText = (allVals: Record<GonioPartKey, Record<string, string>>) => {
    const parts: string[] = [];
    for (const pk of Object.keys(GONIO_PARTS) as GonioPartKey[]) {
      const vals = allVals[pk];
      const fields = GONIO_PARTS[pk].fields;
      const entries = fields.map((f) => (vals[f.key] ? `${f.label}:${vals[f.key]}°` : "")).filter(Boolean);
      if (entries.length > 0) parts.push(`[${GONIO_PARTS[pk].label}] ${entries.join(" ")}`);
    }
    return parts.length > 0 ? parts.join(" ") : null;
  };

  const buildAllGonioJsonArray = (allVals: Record<GonioPartKey, Record<string, string>>) => {
    const arr: { body_part: string; values: Record<string, number> }[] = [];
    for (const pk of Object.keys(GONIO_PARTS) as GonioPartKey[]) {
      const vals = allVals[pk];
      const filled = Object.fromEntries(
        GONIO_PARTS[pk].fields
          .map((f) => [f.key, vals[f.key] ? Number(vals[f.key]) : null])
          .filter(([, v]) => v != null)
      );
      if (Object.keys(filled).length > 0) arr.push({ body_part: pk, values: filled as Record<string, number> });
    }
    return arr.length > 0 ? arr : null;
  };

  const cycleTest = (key: string) => {
    setSpecificTests((prev) => {
      const cur = prev[key];
      const next: TestResult = cur === null ? "positive" : cur === "positive" ? "negative" : null;
      return { ...prev, [key]: next };
    });
  };

  // VSS total (live)
  const vssTotalLive =
    (vss_pigmentacion ? parseInt(vss_pigmentacion) : 0) +
    (vss_vascularizacion ? parseInt(vss_vascularizacion) : 0) +
    (vss_flexibilidad ? parseInt(vss_flexibilidad) : 0) +
    (vss_altura ? parseInt(vss_altura) : 0);

  const handleSave = async () => {
    if (!session_date || !user) return;
    setSaving(true);

    // ── Pain (gated) ──
    const painLocFinal = showPain
      ? [pain_location, pain_radiates_choice === "si" && pain_radiation ? `Irradia a: ${pain_radiation}` : ""]
          .filter(Boolean)
          .join(" — ") || null
      : null;
    const painRadiationFinal = showPain
      ? pain_radiates_choice === "si"
        ? pain_radiation || null
        : pain_radiates_choice === "no"
        ? "No irradia"
        : null
      : null;

    // ── Edema circometría (gated) — JSONB ──
    const edemaCirc = showEdema && (circ_reference.trim() || circ_value_cm.trim())
      ? {
          reference: circ_reference.trim(),
          side: circ_side,
          value_cm: circ_value_cm.trim() ? Number(circ_value_cm) : null,
          mano_global: circ_mano_global,
        }
      : null;

    // ── Mobility (gated) — por lado MSD/MSI ──
    const buildSideJsonb = (allVals: GonioBySide) => {
      const out: any = {};
      (["MSD", "MSI"] as const).forEach((side) => {
        const pre = showMobility ? buildAllGonioJsonArray(allVals[side]) : null;
        const post = showMobility && show_post_gonio ? buildAllGonioJsonArray(all_post_gonio[side]) : null;
        if (pre || post) out[side] = { pre, post };
      });
      return Object.keys(out).length > 0 ? out : null;
    };
    const buildSideText = (allVals: GonioBySide) => {
      const parts: string[] = [];
      (["MSD", "MSI"] as const).forEach((side) => {
        const t = buildAllGonioText(allVals[side]);
        if (t) parts.push(`[${side}] ${t}`);
      });
      return parts.length > 0 ? parts.join(" ") : null;
    };
    const aromVal = showMobility ? buildSideText(all_pre_gonio) : null;
    const promVal = showMobility && show_post_gonio ? buildSideText(all_post_gonio) : null;
    const gonioJsonb = showMobility ? buildSideJsonb(all_pre_gonio) : null;
    const kapandjiFinal = showMobility && kapandji_val ? `${kapandji_val}/10${kapandji_pain ? " con dolor" : ""}` : null;

    // ── Dinamometría: 3 mediciones + promedio ──
    const buildDyn = (vals: [string, string, string]) => {
      const nums = vals.map((v) => v.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n));
      if (nums.length === 0) return null;
      const avg = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
      return { values: vals.map((v) => (v.trim() ? Number(v) : null)), average: avg };
    };
    const dynMsdJson = showStrength ? buildDyn(dyn_msd_vals) : null;
    const dynMsiJson = showStrength ? buildDyn(dyn_msi_vals) : null;

    // ── Strength notes ──
    const msParts: string[] = [];
    if (showMobility && fist_closure) msParts.push(`Cierre de puño: ${fist_closure}`);
    const msVal = msParts.length > 0 ? msParts.join(" — ") : null;

    // ── Daniels rows (gated by strength) ──
    const danielsFiltered = showStrength
      ? danielsRows.filter(r => r.muscle.trim() && r.grade.trim()).map(r => ({ muscle: r.muscle.trim(), grade: r.grade }))
      : [];
    const danielsJson = danielsFiltered.length > 0 ? danielsFiltered : null;

    const dppdEntries: [string, string][] = showStrength
      ? ([
          ["pulgar", dppd_pulgar],
          ["indice", dppd_indice],
          ["medio", dppd_medio],
          ["anular", dppd_anular],
          ["menique", dppd_menique],
        ].filter(([, v]) => v && v.trim()) as [string, string][])
      : [];
    const dppdFingersJson =
      dppdEntries.length > 0 ? Object.fromEntries(dppdEntries.map(([k, v]) => [k, parseFloat(v)])) : null;

    const generalObsFinal =
      session_type === "admission"
        ? discharge_summary || general_observations || null
        : [discharge_summary, general_observations].filter(Boolean).join("\n\n") || null;

    // ── Specific tests (gated) ──
    const hasTests = showSpecificTests && Object.values(specificTests).some((v) => v !== null);
    const specificTestsJson = hasTests
      ? Object.fromEntries(Object.entries(specificTests).map(([k, v]) => [k, v]))
      : null;


    const sessionPayload = {
      patient_id: patientId!,
      professional_id: user.id,
      is_deleted: false,
      episode_id: activeEpisodeId,
      session_date,
      session_type: session_type || null,
      session_number: session_number ? parseInt(session_number) : null,
      week_at_session: week_at_session ? parseInt(week_at_session) : null,
      general_observations: generalObsFinal,
      symptom_changes: symptom_changes || null,
      clinical_changes: clinical_changes || null,
      avd_followup: avd_followup || null,
      interventions: interventions || null,
      home_instructions_sent: home_instructions_sent || null,
      notes: notes || null,
    } as any;

    const { data: session, error } = isEditMode && sessionId
      ? await supabase.from("therapy_sessions").update(sessionPayload).eq("id", sessionId).eq("patient_id", patientId!).select().single()
      : await supabase.from("therapy_sessions").insert(sessionPayload).select().single();

    if (error || !session) {
      setSaving(false);
      toast.error(isEditMode ? "Error al actualizar la sesión" : "Error al guardar la sesión");
      return;
    }

    // Functional eval for admission
    const qd_answered = qd_items.some((v) => v !== null);
    const fim_answered = Object.values(fim_items).some((v) => v !== null);
    const barthel_answered = Object.values(barthel_items).some((v) => v !== null);
    const hasFunctionalData =
      showFunctional &&
      ([func_dominance, func_avd, func_aivd, func_sleep, func_health].some((v) => v) || qd_answered || fim_answered || barthel_answered);

    const functionalPayload = {
      patient_id: patientId!,
      professional_id: user.id,
      episode_id: activeEpisodeId,
      session_id: session.id,
      evaluation_date: session_date,
      dominance: (func_dominance || null) as any,
      avd: func_avd || null,
      aivd: func_aivd || null,
      sleep_rest: func_sleep || null,
      health_management: func_health || null,
      quickdash_items: qd_answered ? (qd_items as any) : null,
      quickdash_score: qd_answered ? (calcQuickDashScore(qd_items) as any) : null,
      fim_items: fim_answered ? (fim_items as any) : null,
      fim_score: fim_answered ? calcFimTotal(fim_items) : null,
      barthel_items: barthel_answered ? (barthel_items as any) : null,
      barthel_score: barthel_answered ? calcBarthelTotal(barthel_items) : null,
    } as any;

    if (editingFuncEval) {
      const { error: feErr } = await supabase.from("functional_evaluations").update(functionalPayload).eq("id", editingFuncEval.id);
      if (feErr) console.error("Error updating func eval:", feErr);
    } else if (hasFunctionalData) {
      const { error: feErr } = await supabase.from("functional_evaluations").insert(functionalPayload);
      if (feErr) console.error("Error inserting func eval:", feErr);
    }

    // ── Cicatriz (gated) ──
    const scarPlanillaEntries: [string, string][] = showCicatriz
      ? ([
          ["localizacion", scar_localizacion],
          ["longitud_cm", scar_longitud],
          ["vascularizacion", scar_vascularizacion],
          ["pigmentacion", scar_pigmentacion],
          ["flexibilidad", scar_flexibilidad],
          ["sensibilidad", scar_sensibilidad],
          ["relieve", scar_relieve],
          ["temperatura", scar_temperatura],
        ].filter(([, v]) => v && String(v).trim()) as [string, string][])
      : [];

    const vssObj: Record<string, number> = {};
    if (showCicatriz) {
      if (vss_pigmentacion !== "") vssObj.pigmentacion = parseInt(vss_pigmentacion);
      if (vss_vascularizacion !== "") vssObj.vascularizacion = parseInt(vss_vascularizacion);
      if (vss_flexibilidad !== "") vssObj.flexibilidad = parseInt(vss_flexibilidad);
      if (vss_altura !== "") vssObj.altura = parseInt(vss_altura);
    }
    const vssTotal = Object.values(vssObj).reduce((a, b) => a + b, 0);
    const hasVss = Object.keys(vssObj).length > 0;

    const scarEvalJson =
      scarPlanillaEntries.length > 0 || hasVss
        ? {
            ...Object.fromEntries(scarPlanillaEntries),
            ...(hasVss ? { vss: vssObj } : {}),
          }
        : null;

    // Build a hasMeasurements check based on what's actually present after gating
    const hasMeasurements =
      show_measurements &&
      [
        showPain && pain_touched && pain_score > 0,
        painLocFinal,
        showPain && pain_characteristics,
        showPain && pain_aggravating_factors,
        showPain && pain_appearance,
        showPain && pain_free,
        showEdema && edema_obs,
        showEdema && godet_test,
        edemaCirc,
        aromVal,
        promVal,
        showMobility && fist_closure,
        dynMsdJson,
        dynMsiJson,
        kapandjiFinal,
        msVal,
        danielsJson,
        showSensitivity && sensitivity,
        showSensitivity && sensitivity_tacto_ligero,
        showSensitivity && sensitivity_dos_puntos,
        showSensitivity && sensitivity_picking_up,
        showSensitivity && sensitivity_semmes_weinstein,
        showSensitivity && sensitivity_toco_pincho,
        showSensitivity && sensitivity_temperatura,
        showOtros && trophic_state,
        showOtros && posture,
        showOtros && emotional_state,
        specificTestsJson,
        gonioJsonb,
        dppdFingersJson,
        scarEvalJson,
      ].some((v) => v !== "" && v !== null && v !== undefined && v !== false);

    const analyticalPayload = {
      patient_id: patientId!,
      professional_id: user.id,
      episode_id: activeEpisodeId,
      session_id: session.id,
      evaluation_date: session_date,
      pain_score: showPain && pain_touched ? pain_score : null,
      pain_appearance: showPain ? pain_appearance || null : null,
      pain_location: painLocFinal,
      pain_radiation: painRadiationFinal,
      pain_characteristics: showPain ? pain_characteristics || null : null,
      pain_aggravating_factors: showPain ? pain_aggravating_factors || null : null,
      pain: showPain ? pain_free || null : null,
      edema: showEdema ? edema_obs || null : null,
      godet_test: showEdema ? godet_test || null : null,
      edema_circummetry: edemaCirc,
      arom: aromVal,
      prom: promVal,
      goniometry: gonioJsonb,
      dynamometer_msd: dynMsdJson as any,
      dynamometer_msi: dynMsiJson as any,
      kapandji: kapandjiFinal,
      muscle_strength: msVal,
      muscle_strength_median: null,
      muscle_strength_cubital: null,
      muscle_strength_radial: null,
      muscle_strength_daniels: danielsJson as any,
      specific_tests: specificTestsJson,
      dppd_fingers: dppdFingersJson,
      sensitivity: showSensitivity ? sensitivity || null : null,
      sensitivity_functional: null,
      sensitivity_protective: null,
      sensitivity_tacto_ligero: showSensitivity ? sensitivity_tacto_ligero || null : null,
      sensitivity_dos_puntos: showSensitivity ? sensitivity_dos_puntos || null : null,
      sensitivity_picking_up: showSensitivity ? sensitivity_picking_up || null : null,
      sensitivity_semmes_weinstein: showSensitivity ? sensitivity_semmes_weinstein || null : null,
      sensitivity_toco_pincho: showSensitivity ? sensitivity_toco_pincho || null : null,
      sensitivity_temperatura: showSensitivity ? sensitivity_temperatura || null : null,
      trophic_state: showOtros ? trophic_state || null : null,
      scar: showCicatriz ? scar_observaciones || null : null,
      scar_evaluation: scarEvalJson,
      vancouver_score: showCicatriz && hasVss ? vssTotal : null,
      osas_score: null,
      posture: showOtros ? posture || null : null,
      emotional_state: showOtros ? emotional_state || null : null,
    } as any;

    if (editingAnalEval) {
      const { error: aeErr } = await supabase.from("analytical_evaluations").update(analyticalPayload).eq("id", editingAnalEval.id);
      if (aeErr) {
        setSaving(false);
        toast.error("Error al actualizar la evaluación de la sesión");
        return;
      }
    } else if (hasMeasurements) {
      const { error: aeErr } = await supabase.from("analytical_evaluations").insert(analyticalPayload);
      if (aeErr) {
        setSaving(false);
        toast.error("Error al guardar la sesión");
        return;
      }
    }

    // Sincronizar estado del paciente y episodio según tipo de sesión
    if (session_type === "discharge") {
      await supabase.from("patients").update({ status: "discharged" }).eq("id", patientId!);
      if (activeEpisodeId) {
        await supabase
          .from("treatment_episodes")
          .update({ status: "discharged", discharge_date: session_date })
          .eq("id", activeEpisodeId);
      }
    } else if (isEditMode) {
      // Si se editó una sesión que ya no es de alta, revertir si no quedan otras sesiones de alta en el episodio
      const { data: remainingDischarges } = await supabase
        .from("therapy_sessions")
        .select("id")
        .eq("patient_id", patientId!)
        .eq("session_type", "discharge")
        .eq("is_deleted", false)
        .limit(1);
      if (!remainingDischarges || remainingDischarges.length === 0) {
        await supabase.from("patients").update({ status: "active" }).eq("id", patientId!);
        if (activeEpisodeId) {
          await supabase
            .from("treatment_episodes")
            .update({ status: "active", discharge_date: null })
            .eq("id", activeEpisodeId);
        }
      }
    }

    setSaving(false);
    toast.success(isEditMode ? "Sesión actualizada correctamente" : "Sesión registrada correctamente");
    navigate(`/patients/${patientId}`);
  };

  const GonioGrid = ({
    partKey,
    values,
    setValues,
  }: {
    partKey: GonioPartKey;
    values: Record<string, string>;
    setValues: (v: Record<string, string>) => void;
  }) => {
    const fields = GONIO_PARTS[partKey].fields;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {fields.map((f) => (
          <div key={f.key}>
            <FieldLabel>{f.label} °</FieldLabel>
            <Input
              type="number"
              placeholder={f.norm}
              value={values[f.key] || ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className={inputClass}
            />
          </div>
        ))}
      </div>
    );
  };

  const GonioPartSelector = ({
    value,
    onChange,
  }: {
    value: GonioPartKey;
    onChange: (v: GonioPartKey) => void;
  }) => (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {(Object.keys(GONIO_PARTS) as GonioPartKey[]).map((k) => (
        <Button
          key={k}
          type="button"
          size="sm"
          variant={value === k ? "default" : "outline"}
          className={
            value === k
              ? "bg-primary hover:bg-primary/85  h-8 text-xs rounded-full"
              : "h-8 text-xs rounded-full border-border"
          }
          onClick={() => onChange(k)}
        >
          {GONIO_PARTS[k].label}
        </Button>
      ))}
    </div>
  );

  const sessionTitle = `${patient.last_name} — Sesión Nº ${session_number || "—"}`;
  const age = patient.birth_date ? differenceInYears(new Date(), new Date(patient.birth_date)) : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-50 bg-card border-b border-border h-14 flex items-center px-4">
        <div className="max-w-2xl w-full mx-auto flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/patients/${patientId}`)}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">{sessionTitle}</h1>
            {clinical?.diagnosis && (
              <p className="text-xs text-muted-foreground truncate">{clinical.diagnosis}</p>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !session_date}
            size="sm"
            className="bg-primary hover:bg-primary/85 "
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            {isEditMode ? "Actualizar" : "Guardar"}
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Card 1: Datos de la sesión */}
        <SectionCard icon={Calendar} title="Datos de la sesión">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Fecha *</FieldLabel>
              <Input
                type="date"
                value={session_date}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel>Tipo de sesión</FieldLabel>
              <Select value={session_type} onValueChange={setSessionType} disabled={typeParam === "admission"}>
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {typeParam === "admission" && <SelectItem value="admission">Admisión</SelectItem>}
                  <SelectItem value="follow_up">Seguimiento</SelectItem>
                  <SelectItem value="discharge">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Nº de sesión</FieldLabel>
              <Input
                type="number"
                min={1}
                value={session_number}
                onChange={(e) => setSessionNumber(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel>Semanas POP/PL</FieldLabel>
              <Input
                type="number"
                min={0}
                placeholder="ej: 6"
                value={week_at_session}
                onChange={(e) => setWeekAtSession(e.target.value)}
                className={inputClass}
              />
              {weekCalcSource && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Calculado desde {weekCalcSource === "injury" ? "fecha de lesión" : "inicio de síntomas"} (editable)
                </p>
              )}
            </div>
          </div>
          {session_type === "discharge" && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <FieldLabel>Resumen de alta / objetivos cumplidos</FieldLabel>
              <Textarea
                rows={3}
                value={discharge_summary}
                onChange={(e) => setDischargeSummary(e.target.value)}
                placeholder="Motivo del alta, objetivos cumplidos..."
                className={textareaClass}
              />
            </div>
          )}
        </SectionCard>

        {/* Functional eval */}
        <SectionCard
          icon={ClipboardList}
          title="Evaluación funcional"
          toggle={{ checked: showFunctional, onChange: setShowFunctional }}
        >
          <div className="space-y-5">
            <div>
              <Label>Lateralidad</Label>
              <Select value={func_dominance} onValueChange={setFuncDominance}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="right">Diestro/a</SelectItem>
                  <SelectItem value="left">Zurdo/a</SelectItem>
                  <SelectItem value="ambidextrous">Ambidiestro/a</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <QuickDashSection items={qd_items} onChange={setQdItems} />
            <FimSection items={fim_items} onChange={setFimItems} />
            <BarthelSection items={barthel_items} onChange={setBarthelItems} />
            <div className="space-y-2">
              <Label>AVD — Actividades de la vida diaria</Label>
              <Textarea rows={3} value={func_avd} onChange={(e) => setFuncAvd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>AIVD — Actividades instrumentales</Label>
              <Textarea rows={3} value={func_aivd} onChange={(e) => setFuncAivd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sueño y descanso</Label>
              <Textarea rows={2} value={func_sleep} onChange={(e) => setFuncSleep(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Gestión de la salud</Label>
              <Textarea rows={2} value={func_health} onChange={(e) => setFuncHealth(e.target.value)} />
            </div>
          </div>
        </SectionCard>

        {/* Card 2: Evolución */}
        <SectionCard icon={FileText} title="Evolución">
          <div className="space-y-4">
            <div>
              <FieldLabel>Nota general de la sesión</FieldLabel>
              <Textarea
                rows={4}
                placeholder={`Paciente asiste a ${session_number ? session_number + "ra" : "X"} sesión, cursando su ${week_at_session || "X"}ma semana POP/PL...`}
                value={general_observations}
                onChange={(e) => setGeneralObservations(e.target.value)}
                className={textareaClass}
              />
            </div>
            <div>
              <FieldLabel>Cambios en síntomas</FieldLabel>
              <Textarea rows={2} value={symptom_changes} onChange={(e) => setSymptomChanges(e.target.value)} className={textareaClass} />
            </div>
            <div>
              <FieldLabel>Cambios clínicos</FieldLabel>
              <Textarea rows={2} value={clinical_changes} onChange={(e) => setClinicalChanges(e.target.value)} className={textareaClass} />
            </div>
            <div>
              <FieldLabel>AVD — seguimiento</FieldLabel>
              <Textarea
                rows={2}
                placeholder="Baño, vestido, alimentación, traslados..."
                value={avd_followup}
                onChange={(e) => setAvdFollowup(e.target.value)}
                className={textareaClass}
              />
            </div>
          </div>
        </SectionCard>

        {/* Card 3: Evaluación analítica */}
        <SectionCard
          icon={BarChart2}
          title="Evaluación analítica"
          toggle={{ checked: show_measurements, onChange: setShowMeasurements, label: "Incluir evaluación analítica" }}
        >
          {/* Dolor */}
          <SubSection title="Dolor" checked={showPain} onChange={setShowPain} withDivider={false}>
            <div>
              <Label>Aparición</Label>
              <Input value={pain_appearance} onChange={(e) => setPainAppearance(e.target.value)} className={inputClass} />
            </div>
            <div>
              <Label>Localización</Label>
              <Input value={pain_location} onChange={(e) => setPainLocation(e.target.value)} className={inputClass} />
            </div>
            <div>
              <Label>Irradiación</Label>
              <RadioGroup
                value={pain_radiates_choice}
                onValueChange={(v) => {
                  const val = v as "no" | "si";
                  setPainRadiatesChoice(val);
                  if (val === "no") setPainRadiation("");
                }}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="pain-rad-no-sf" />
                  <Label htmlFor="pain-rad-no-sf" className="font-normal cursor-pointer text-sm">
                    No irradia
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="si" id="pain-rad-si-sf" />
                  <Label htmlFor="pain-rad-si-sf" className="font-normal cursor-pointer text-sm">
                    Sí irradia
                  </Label>
                </div>
              </RadioGroup>
              {pain_radiates_choice === "si" && (
                <div className="mt-2">
                  <Label>¿Hacia dónde?</Label>
                  <Input value={pain_radiation} onChange={(e) => setPainRadiation(e.target.value)} className={inputClass} />
                </div>
              )}
            </div>
            <div>
              <Label>Características</Label>
              <Input
                value={pain_characteristics}
                onChange={(e) => setPainCharacteristics(e.target.value)}
                placeholder="urente, punzante, etc."
                className={inputClass}
              />
            </div>
            <div>
              <Label>Intensidad EVA (0-10)</Label>
              <div className="flex items-center gap-3">
                <Slider
                  min={0}
                  max={10}
                  step={1}
                  value={[pain_score]}
                  onValueChange={([v]) => {
                    setPainScore(v);
                    setPainTouched(true);
                  }}
                  className="flex-1"
                />
                <Badge
                  className={`text-sm font-semibold w-10 justify-center ${
                    pain_score === 0
                      ? "bg-muted text-foreground hover:bg-muted"
                      : pain_score <= 3
                      ? "bg-green-100 text-green-700 hover:bg-green-100"
                      : pain_score <= 6
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                      : "bg-red-100 text-red-700 hover:bg-red-100"
                  }`}
                >
                  {pain_score}
                </Badge>
              </div>
            </div>
            <div>
              <Label>Agravantes / Atenuantes</Label>
              <Textarea
                rows={2}
                value={pain_aggravating_factors}
                onChange={(e) => setPainAggravatingFactors(e.target.value)}
                className={textareaClass}
              />
            </div>
          </SubSection>

          {/* Edema */}
          <SubSection title="Edema" checked={showEdema} onChange={setShowEdema}>
            <div>
              <Label>Observación</Label>
              <Textarea rows={2} value={edema_obs} onChange={(e) => setEdemaObs(e.target.value)} className={textareaClass} />
            </div>
            <div>
              <Label>Test de Godet</Label>
              <Select value={godet_test} onValueChange={setGodetTest}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="No evaluado" />
                </SelectTrigger>
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
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Circometría</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>Reparo anatómico de referencia</Label>
                  <Input
                    value={circ_reference}
                    onChange={(e) => setCircReference(e.target.value)}
                    placeholder="ej: articulación MCF, tercio distal antebrazo"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label>Lado</Label>
                  <RadioGroup value={circ_side} onValueChange={(v) => setCircSide(v as "D" | "I")} className="flex gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="D" id="circ-d-sf" />
                      <Label htmlFor="circ-d-sf" className="font-normal cursor-pointer text-sm">Derecho</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="I" id="circ-i-sf" />
                      <Label htmlFor="circ-i-sf" className="font-normal cursor-pointer text-sm">Izquierdo</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div>
                  <Label>Valor (cm)</Label>
                  <Input type="number" step="0.1" value={circ_value_cm} onChange={(e) => setCircValueCm(e.target.value)} className={inputClass} />
                </div>
                <div className="sm:col-span-2 flex items-center gap-3">
                  <Switch checked={circ_mano_global} onCheckedChange={setCircManoGlobal} id="circ-global-sf" />
                  <Label htmlFor="circ-global-sf" className="font-normal cursor-pointer text-sm">Mano global</Label>
                </div>
              </div>
            </div>
          </SubSection>

          {/* Movilidad */}
          <SubSection title="Movilidad" checked={showMobility} onChange={setShowMobility}>
            <Tabs value={gonio_side} onValueChange={(v) => { setGonioSide(v as "MSD" | "MSI"); setGonioSidePost(v as "MSD" | "MSI"); }} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="MSD">MSD</TabsTrigger>
                <TabsTrigger value="MSI">MSI</TabsTrigger>
              </TabsList>
            </Tabs>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Goniometría PRE — {gonio_side}</h4>
              <GonioPartSelector value={gonio_part} onChange={setGonioPart} />
              <GonioGrid
                partKey={gonio_part}
                values={all_pre_gonio[gonio_side][gonio_part]}
                setValues={(v) => setAllPreGonio((prev) => ({ ...prev, [gonio_side]: { ...prev[gonio_side], [gonio_part]: v } }))}
              />
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox checked={show_post_gonio} onCheckedChange={(v) => setShowPostGonio(!!v)} id="post-gonio-sf" />
                <Label htmlFor="post-gonio-sf" className="font-normal text-sm cursor-pointer">
                  Registrar goniometría POST
                </Label>
              </div>
              {show_post_gonio && (
                <>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Goniometría POST — {gonio_side}</h4>
                  <GonioPartSelector value={gonio_part_post} onChange={setGonioPartPost} />
                  <GonioGrid
                    partKey={gonio_part_post}
                    values={all_post_gonio[gonio_side][gonio_part_post]}
                    setValues={(v) => setAllPostGonio((prev) => ({ ...prev, [gonio_side]: { ...prev[gonio_side], [gonio_part_post]: v } }))}
                  />
                </>
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
                    className={inputClass}
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <Checkbox checked={kapandji_pain} onCheckedChange={(v) => setKapandjiPain(!!v)} id="kap-pain-sf" />
                    <Label htmlFor="kap-pain-sf" className="font-normal text-sm cursor-pointer">
                      Con dolor
                    </Label>
                  </div>
                </div>
              </div>
              <div>
                <Label>Cierre de puño</Label>
                <Input
                  value={fist_closure}
                  onChange={(e) => setFistClosure(e.target.value)}
                  placeholder="Completo / Incompleto..."
                  className={inputClass}
                />
              </div>
            </div>
          </SubSection>

          {/* Fuerza */}
          <SubSection title="Fuerza muscular" checked={showStrength} onChange={setShowStrength}>
            {(["MSD", "MSI"] as const).map((side) => {
              const vals = side === "MSD" ? dyn_msd_vals : dyn_msi_vals;
              const setVals = side === "MSD" ? setDynMsdVals : setDynMsiVals;
              const nums = vals.map((v) => v.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n));
              const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "";
              return (
                <div key={side}>
                  <Label>Dinamómetro {side} (kgf)</Label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {[0, 1, 2].map((i) => (
                      <Input
                        key={i}
                        type="number"
                        step="0.1"
                        placeholder={`Med. ${i + 1}`}
                        value={vals[i]}
                        onChange={(e) => {
                          const next = [...vals] as [string, string, string];
                          next[i] = e.target.value;
                          setVals(next);
                        }}
                        className={inputClass}
                      />
                    ))}
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
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <Label className="text-xs">Pulgar</Label>
                  <Input type="number" step="0.1" value={dppd_pulgar} onChange={(e) => setDppdPulgar(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <Label className="text-xs">Índice</Label>
                  <Input type="number" step="0.1" value={dppd_indice} onChange={(e) => setDppdIndice(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <Label className="text-xs">Medio</Label>
                  <Input type="number" step="0.1" value={dppd_medio} onChange={(e) => setDppdMedio(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <Label className="text-xs">Anular</Label>
                  <Input type="number" step="0.1" value={dppd_anular} onChange={(e) => setDppdAnular(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <Label className="text-xs">Meñique</Label>
                  <Input type="number" step="0.1" value={dppd_menique} onChange={(e) => setDppdMenique(e.target.value)} className={inputClass} />
                </div>
              </div>
            </div>
            <div>
              <Label>Daniels — Músculos evaluados</Label>
              <div className="space-y-2">
                {danielsRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <Input
                      value={row.muscle}
                      onChange={(ev) =>
                        setDanielsRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, muscle: ev.target.value } : r)))
                      }
                      placeholder="Ej: Flexores de hombro"
                      className={`${inputClass} flex-1`}
                    />
                    <select
                      value={row.grade}
                      onChange={(ev) =>
                        setDanielsRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, grade: ev.target.value } : r)))
                      }
                      className={`${inputClass} w-24 px-3 py-2 text-sm bg-background`}
                    >
                      <option value="">Grado</option>
                      {DANIELS_FULL_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
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
                <div>
                  <Label>Tacto ligero</Label>
                  <Textarea rows={2} value={sensitivity_tacto_ligero} onChange={(e) => setSensitivityTactoLigero(e.target.value)} className={textareaClass} />
                </div>
                <div>
                  <Label>Discriminación 2 puntos</Label>
                  <Textarea rows={2} value={sensitivity_dos_puntos} onChange={(e) => setSensitivityDosPuntos(e.target.value)} className={textareaClass} />
                </div>
                <div>
                  <Label>Picking up test</Label>
                  <Textarea rows={2} value={sensitivity_picking_up} onChange={(e) => setSensitivityPickingUp(e.target.value)} className={textareaClass} />
                </div>
                <div>
                  <Label>Semmes-Weinstein</Label>
                  <Textarea rows={2} value={sensitivity_semmes_weinstein} onChange={(e) => setSensitivitySemmesWeinstein(e.target.value)} className={textareaClass} />
                </div>
              </div>
            </div>
            <div className="pt-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Protopática (protectora)</h4>
              <div className="space-y-3">
                <div>
                  <Label>Toco-pincho</Label>
                  <Textarea rows={2} value={sensitivity_toco_pincho} onChange={(e) => setSensitivityTocoPincho(e.target.value)} className={textareaClass} />
                </div>
                <div>
                  <Label>Temperatura frío-calor</Label>
                  <Textarea rows={2} value={sensitivity_temperatura} onChange={(e) => setSensitivityTemperatura(e.target.value)} className={textareaClass} />
                </div>
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
            badge={
              vssTotalLive > 0 ? (
                <Badge variant="secondary" className="text-[10px]">VSS {vssTotalLive}/15</Badge>
              ) : null
            }
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
              <div className="mt-3">
                <Label>Observaciones</Label>
                <Textarea rows={2} value={scar_observaciones} onChange={(e) => setScarObservaciones(e.target.value)} className={textareaClass} />
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
            <div>
              <Label>Estado trófico</Label>
              <Textarea rows={2} value={trophic_state} onChange={(e) => setTrophicState(e.target.value)} className={textareaClass} />
            </div>
            <div>
              <Label>Postura</Label>
              <Textarea rows={2} value={posture} onChange={(e) => setPosture(e.target.value)} className={textareaClass} />
            </div>
            <div>
              <Label>Emotividad</Label>
              <Textarea rows={2} value={emotional_state} onChange={(e) => setEmotionalState(e.target.value)} className={textareaClass} />
            </div>
          </SubSection>
        </SectionCard>

        {/* Card 4: Intervenciones */}
        <SectionCard icon={ClipboardList} title="Intervenciones">
          <FieldLabel>En el día de hoy se abordó</FieldLabel>
          <Textarea rows={5} value={interventions} onChange={(e) => setInterventions(e.target.value)} className={textareaClass} />
        </SectionCard>

        {/* Card 5: Indicaciones y notas */}
        <SectionCard icon={MessageSquare} title="Indicaciones y notas">
          <div className="space-y-4">
            <div>
              <FieldLabel>Indicaciones enviadas al paciente</FieldLabel>
              <Textarea rows={3} value={home_instructions_sent} onChange={(e) => setHomeInstructionsSent(e.target.value)} className={textareaClass} />
            </div>
            <div>
              <FieldLabel>Notas internas</FieldLabel>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass} />
              <p className="text-xs text-muted-foreground mt-1">Campo interno, no visible en el resumen clínico</p>
            </div>
          </div>
        </SectionCard>
      </main>

      {/* Sticky bottom bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border p-4">
        <div className="max-w-2xl mx-auto flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !session_date}
            className="bg-primary hover:bg-primary/85 "
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditMode ? "Actualizar sesión" : "Guardar sesión"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
