import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
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
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  BarChart2,
  ClipboardList,
  MessageSquare,
  X,
  Plus,
  Briefcase,
  Stethoscope,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  FimSection,
  BarthelSection,
  emptyFim,
  emptyBarthel,
  calcFimTotal,
  calcBarthelTotal,
} from "@/components/evaluations/FunctionalScales";
import { EdemaCircometryTable, buildCircometriaPayload, normalizeCircometriaValue, isCircometriaFormat, type CircometriaItem } from "@/components/clinical/EdemaCircometryTable";

// ── Wizard steps ──
type StepDef = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; sections: string[] };

const STEPS_ADMISSION: StepDef[] = [
  { id: "step-datos",       label: "Datos",                  icon: Calendar,      sections: ["sec-datos"] },
  { id: "step-ficha",       label: "Ficha clínica",          icon: Stethoscope,   sections: ["sec-ficha"] },
  { id: "step-ocupacional", label: "Perfil ocupacional",     icon: Briefcase,     sections: ["sec-ocupacional"] },
  { id: "step-funcional",   label: "Eval. funcional",        icon: ClipboardList, sections: ["sec-funcional"] },
  { id: "step-analitica",   label: "Eval. analítica",        icon: BarChart2,     sections: ["sec-analitica"] },
  { id: "step-cierre",      label: "Intervenciones y notas", icon: MessageSquare, sections: ["sec-intervenciones", "sec-notas"] },
];

const STEPS_SESSION: StepDef[] = [
  { id: "step-datos",       label: "Datos",                  icon: Calendar,      sections: ["sec-datos"] },
  { id: "step-funcional",   label: "Eval. funcional",        icon: ClipboardList, sections: ["sec-funcional"] },
  { id: "step-evolucion",   label: "Evolución",              icon: FileText,      sections: ["sec-evolucion"] },
  { id: "step-analitica",   label: "Eval. analítica",        icon: BarChart2,     sections: ["sec-analitica"] },
  { id: "step-cierre",      label: "Intervenciones y notas", icon: MessageSquare, sections: ["sec-intervenciones", "sec-notas"] },
];

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

// ── Pain entry (multi-dolor) ──
type PainTipo = "reposo" | "actividad" | "reposo_y_actividad" | "";
type PainEntry = {
  id: number;
  localizacion: string;
  eva: number;
  evaTouched: boolean;
  tipo: PainTipo;
  aparicion: string;
  irradia: "no" | "si" | "";
  irradia_hacia: string;
  caracteristicas: string;
  agravantes: string;
  observaciones: string;
};
const emptyPain = (id: number): PainEntry => ({
  id, localizacion: "", eva: 0, evaTouched: false, tipo: "",
  aparicion: "", irradia: "", irradia_hacia: "", caracteristicas: "", agravantes: "", observaciones: "",
});

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

const parseDyn = (v: any): [string, string, string] => {
  if (v == null) return ["", "", ""];
  if (typeof v === "object" && Array.isArray(v.values)) {
    const a = v.values;
    return [a[0] != null ? String(a[0]) : "", a[1] != null ? String(a[1]) : "", a[2] != null ? String(a[2]) : ""];
  }
  if (typeof v === "number") return [String(v), "", ""];
  return ["", "", ""];
};

// ── Validation helper — devuelve mensaje de error o null si el campo es válido ──
function numFieldErr(v: string, min: number, max: number, unit: string): string | null {
  if (!v.trim()) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return "Solo se admiten números";
  if (n < min || n > max) return `Debe estar entre ${min} y ${max}${unit ? " " + unit : ""}`;
  return null;
}

// ── Reusable wrappers ──
function SectionCard({
  id,
  icon: Icon,
  title,
  action,
  children,
  toggle,
}: {
  id?: string;
  icon: any;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  toggle?: { checked: boolean; onChange: (v: boolean) => void; label?: string };
}) {
  const isOff = toggle && !toggle.checked;
  return (
    <Card id={id} className="rounded-xl border-border bg-card mb-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-muted">
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
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Mostrar en evaluación</span>
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


// ── GonioGrid definido fuera del componente para evitar re-montaje en cada render ──
function GonioGrid({
  partKey,
  values,
  setValues,
}: {
  partKey: GonioPartKey;
  values: Record<string, string>;
  setValues: (v: Record<string, string>) => void;
}) {
  const fields = GONIO_PARTS[partKey].fields;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {fields.map((f) => {
        const raw = values[f.key] || "";
        const err = numFieldErr(raw, 0, 360, "°");
        return (
          <div key={f.key}>
            <FieldLabel>{f.label} °</FieldLabel>
            <Input
              type="number"
              min={0}
              max={360}
              placeholder={f.norm}
              value={raw}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className={cn(inputClass, err ? "border-destructive ring-1 ring-destructive" : "")}
            />
            {err && <p className="text-xs text-destructive mt-1">{err}</p>}
          </div>
        );
      })}
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
  const [currentStep, setCurrentStep] = useState(0);

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
  const [fim_items, setFimItems] = useState<Record<string, number | null>>(emptyFim());
  const [barthel_items, setBarthelItems] = useState<Record<string, number | null>>(emptyBarthel());

  const isAdmission = session_type === "admission";

  // Ficha clínica (admission)
  const [cli_diagnosis, setCliDiagnosis] = useState("");
  const [cli_doctor_name, setCliDoctorName] = useState("");
  const [cli_injury_date, setCliInjuryDate] = useState("");
  const [cli_surgery_date, setCliSurgeryDate] = useState("");
  const [cli_injury_mechanism, setCliInjuryMechanism] = useState("");
  const [cli_treatment_type, setCliTreatmentType] = useState("");
  const [cli_immob_weeks, setCliImmobWeeks] = useState("");
  const [cli_immob_days, setCliImmobDays] = useState("");
  const [cli_immob_type, setCliImmobType] = useState("");
  const [cli_medical_history, setCliMedicalHistory] = useState("");
  const [cli_pharma, setCliPharma] = useState("");
  const [cli_studies, setCliStudies] = useState("");
  
  const [editingClinicalId, setEditingClinicalId] = useState<string | null>(null);

  // Perfil ocupacional (admission)
  const [occ_dominance, setOccDominance] = useState("");
  const [occ_support_network, setOccSupportNetwork] = useState("");
  const [occ_education, setOccEducation] = useState("");
  const [occ_job, setOccJob] = useState("");
  const [occ_leisure, setOccLeisure] = useState("");
  const [occ_physical_activity, setOccPhysicalActivity] = useState("");
  const [occ_sleep_rest, setOccSleepRest] = useState("");
  const [occ_health_management, setOccHealthManagement] = useState("");
  const [editingOccId, setEditingOccId] = useState<string | null>(null);

  // Fecha de derivación (en treatment_episodes)
  const [referral_date, setReferralDate] = useState("");

  // Functional eval toggle (default on for admission, off for follow_up/discharge)
  const [showFunctional, setShowFunctional] = useState(true);

  // Analytical evaluation (master toggle)
  const [show_measurements, setShowMeasurements] = useState(true);

  // Per-subsection toggles — all ON by default for new evaluations
  const [showPain, setShowPain] = useState(true);
  const [showEdema, setShowEdema] = useState(true);
  const [showMobility, setShowMobility] = useState(true);
  const [showStrength, setShowStrength] = useState(true);
  const [affected_side, setAffectedSide] = useState<"MSD" | "MSI" | "both" | null>(null);
  const [showSensitivity, setShowSensitivity] = useState(true);
  const [showCicatriz, setShowCicatriz] = useState(true);
  const [showSpecificTests, setShowSpecificTests] = useState(true);
  const [showOtros, setShowOtros] = useState(true);

  // Pain — multi-dolor
  const [pains, setPains] = useState<PainEntry[]>([emptyPain(1)]);
  const painsNextId = useRef(2);

  // Edema
  const [edema_obs, setEdemaObs] = useState("");
  const [godet_test, setGodetTest] = useState("");

  // Movilidad — observaciones
  const [mobility_observations, setMobilityObservations] = useState("");

  // Circometría (reparos anatómicos con MSD / MSI)
  const [edema_circ_items, setEdemaCircItems] = useState<CircometriaItem[]>([]);

  // Goniometry PRE/POST — por lado MSD/MSI, nested by part
  type GonioBySide = Record<"MSD" | "MSI", Record<GonioPartKey, Record<string, string>>>;
  const emptySide = () => ({ shoulder: {}, elbow: {}, wrist: {}, hand: {}, thumb: {} } as Record<GonioPartKey, Record<string, string>>);
  const emptyGonio = (): GonioBySide => ({ MSD: emptySide(), MSI: emptySide() });
  const [gonio_side, setGonioSide] = useState<"MSD" | "MSI">("MSD");
  const [gonio_part, setGonioPart] = useState<GonioPartKey>("wrist");
  const [all_pre_gonio, setAllPreGonio] = useState<GonioBySide>(emptyGonio);
  const [show_arom, setShowArom] = useState(true);
  const [show_arom_post, setShowAromPost] = useState(false);
  const [gonio_side_arom_post, setGonioSideAromPost] = useState<"MSD" | "MSI">("MSD");
  const [gonio_part_arom_post, setGonioPartAromPost] = useState<GonioPartKey>("wrist");
  const [all_arom_post_gonio, setAllAromPostGonio] = useState<GonioBySide>(emptyGonio);
  const [show_prom, setShowProm] = useState(false);
  const [gonio_side_prom_pre, setGonioSidePromPre] = useState<"MSD" | "MSI">("MSD");
  const [gonio_part_prom_pre, setGonioPartPromPre] = useState<GonioPartKey>("wrist");
  const [all_prom_pre_gonio, setAllPromPreGonio] = useState<GonioBySide>(emptyGonio);
  const [show_prom_post, setShowPromPost] = useState(false);
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

  // ── Draft persistence ────────────────────────────────────────────────────────
  const draftKey = `sf-draft-${patientId}-${sessionId ?? "new"}`;
  const [draftRestored, setDraftRestored] = useState(false);
  const [secondaryLoaded, setSecondaryLoaded] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStateRef = useRef<Record<string, any>>({});
  latestStateRef.current = {
    session_date, session_type, session_number, week_at_session,
    general_observations, symptom_changes, clinical_changes, discharge_summary, avd_followup,
    func_dominance, func_avd, func_aivd, func_sleep, func_health, fim_items, barthel_items,
    cli_diagnosis, cli_doctor_name, cli_injury_date, cli_surgery_date, cli_injury_mechanism,
    cli_treatment_type, cli_immob_weeks, cli_immob_days, cli_immob_type, cli_medical_history, cli_pharma, cli_studies,
    occ_dominance, occ_support_network, occ_education, occ_job, occ_leisure, occ_physical_activity, occ_sleep_rest, occ_health_management,
    showFunctional, show_measurements,
    showPain, showEdema, showMobility, showStrength, affected_side, showSensitivity, showCicatriz, showSpecificTests, showOtros,
    pains,
    referral_date,
    edema_obs, godet_test, edema_circ_items,
    mobility_observations,
    all_pre_gonio, show_arom, show_arom_post, all_arom_post_gonio,
    show_prom, all_prom_pre_gonio, show_prom_post, all_post_gonio,
    fist_closure, dyn_msd_vals, dyn_msi_vals, kapandji_val, kapandji_pain,
    dppd_pulgar, dppd_indice, dppd_medio, dppd_anular, dppd_menique, danielsRows,
    specificTests,
    sensitivity, sensitivity_tacto_ligero, sensitivity_dos_puntos, sensitivity_picking_up,
    sensitivity_semmes_weinstein, sensitivity_toco_pincho, sensitivity_temperatura,
    trophic_state, scar_localizacion, scar_longitud, scar_vascularizacion, scar_pigmentacion,
    scar_flexibilidad, scar_sensibilidad, scar_relieve, scar_temperatura, scar_observaciones,
    vss_pigmentacion, vss_vascularizacion, vss_flexibilidad, vss_altura,
    posture, emotional_state,
    interventions, home_instructions_sent, notes,
    currentStep,
  };

  // Auto-save: debounced, sólo después de que el borrador fue procesado
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draftRestored) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      sessionStorage.setItem(draftKey, JSON.stringify(latestStateRef.current));
    }, 800);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }); // sin deps: se ejecuta en cada render, el debounce lo controla

  const clearDraft = () => sessionStorage.removeItem(draftKey);

  // Restore draft once both main and secondary loads are complete
  useEffect(() => {
    if (loading || !secondaryLoaded || draftRestored) return;
    const raw = sessionStorage.getItem(draftKey);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.session_date !== undefined) setSessionDate(d.session_date);
        if (d.session_type !== undefined) setSessionType(d.session_type);
        if (d.session_number !== undefined) setSessionNumber(d.session_number);
        if (d.week_at_session !== undefined) setWeekAtSession(d.week_at_session);
        if (d.general_observations !== undefined) setGeneralObservations(d.general_observations);
        if (d.symptom_changes !== undefined) setSymptomChanges(d.symptom_changes);
        if (d.clinical_changes !== undefined) setClinicalChanges(d.clinical_changes);
        if (d.discharge_summary !== undefined) setDischargeSummary(d.discharge_summary);
        if (d.avd_followup !== undefined) setAvdFollowup(d.avd_followup);
        if (d.func_dominance !== undefined) setFuncDominance(d.func_dominance);
        if (d.func_avd !== undefined) setFuncAvd(d.func_avd);
        if (d.func_aivd !== undefined) setFuncAivd(d.func_aivd);
        if (d.func_sleep !== undefined) setFuncSleep(d.func_sleep);
        if (d.func_health !== undefined) setFuncHealth(d.func_health);
        if (d.fim_items !== undefined) setFimItems(d.fim_items);
        if (d.barthel_items !== undefined) setBarthelItems(d.barthel_items);
        if (d.cli_diagnosis !== undefined) setCliDiagnosis(d.cli_diagnosis);
        if (d.cli_doctor_name !== undefined) setCliDoctorName(d.cli_doctor_name);
        if (d.cli_injury_date !== undefined) setCliInjuryDate(d.cli_injury_date);
        if (d.cli_surgery_date !== undefined) setCliSurgeryDate(d.cli_surgery_date);
        if (d.cli_injury_mechanism !== undefined) setCliInjuryMechanism(d.cli_injury_mechanism);
        if (d.cli_treatment_type !== undefined) setCliTreatmentType(d.cli_treatment_type);
        if (d.cli_immob_weeks !== undefined) setCliImmobWeeks(d.cli_immob_weeks);
        if (d.cli_immob_days !== undefined) setCliImmobDays(d.cli_immob_days);
        if (d.cli_immob_type !== undefined) setCliImmobType(d.cli_immob_type);
        if (d.cli_medical_history !== undefined) setCliMedicalHistory(d.cli_medical_history);
        if (d.cli_pharma !== undefined) setCliPharma(d.cli_pharma);
        if (d.cli_studies !== undefined) setCliStudies(d.cli_studies);
        if (d.occ_dominance !== undefined) setOccDominance(d.occ_dominance);
        if (d.occ_support_network !== undefined) setOccSupportNetwork(d.occ_support_network);
        if (d.occ_education !== undefined) setOccEducation(d.occ_education);
        if (d.occ_job !== undefined) setOccJob(d.occ_job);
        if (d.occ_leisure !== undefined) setOccLeisure(d.occ_leisure);
        if (d.occ_physical_activity !== undefined) setOccPhysicalActivity(d.occ_physical_activity);
        if (d.occ_sleep_rest !== undefined) setOccSleepRest(d.occ_sleep_rest);
        if (d.occ_health_management !== undefined) setOccHealthManagement(d.occ_health_management);
        if (d.showFunctional !== undefined) setShowFunctional(d.showFunctional);
        if (d.show_measurements !== undefined) setShowMeasurements(d.show_measurements);
        if (d.showPain !== undefined) setShowPain(d.showPain);
        if (d.showEdema !== undefined) setShowEdema(d.showEdema);
        if (d.showMobility !== undefined) setShowMobility(d.showMobility);
        if (d.showStrength !== undefined) setShowStrength(d.showStrength);
        if (d.affected_side !== undefined) setAffectedSide(d.affected_side);
        if (d.showSensitivity !== undefined) setShowSensitivity(d.showSensitivity);
        if (d.showCicatriz !== undefined) setShowCicatriz(d.showCicatriz);
        if (d.showSpecificTests !== undefined) setShowSpecificTests(d.showSpecificTests);
        if (d.showOtros !== undefined) setShowOtros(d.showOtros);
        if (d.pains !== undefined && Array.isArray(d.pains)) { setPains(d.pains); painsNextId.current = d.pains.reduce((m: number, p: PainEntry) => Math.max(m, p.id + 1), 2); }
        if (d.referral_date !== undefined) setReferralDate(d.referral_date);
        if (d.mobility_observations !== undefined) setMobilityObservations(d.mobility_observations);
        if (d.edema_obs !== undefined) setEdemaObs(d.edema_obs);
        if (d.godet_test !== undefined) setGodetTest(d.godet_test);
        if (d.edema_circ_items !== undefined) setEdemaCircItems(d.edema_circ_items);
        if (d.all_pre_gonio !== undefined) setAllPreGonio(d.all_pre_gonio);
        if (d.show_arom !== undefined) setShowArom(d.show_arom);
        if (d.show_arom_post !== undefined) setShowAromPost(d.show_arom_post);
        if (d.all_arom_post_gonio !== undefined) setAllAromPostGonio(d.all_arom_post_gonio);
        if (d.show_prom !== undefined) setShowProm(d.show_prom);
        if (d.all_prom_pre_gonio !== undefined) setAllPromPreGonio(d.all_prom_pre_gonio);
        if (d.show_prom_post !== undefined) setShowPromPost(d.show_prom_post);
        if (d.all_post_gonio !== undefined) setAllPostGonio(d.all_post_gonio);
        if (d.fist_closure !== undefined) setFistClosure(d.fist_closure);
        if (d.dyn_msd_vals !== undefined) setDynMsdVals(d.dyn_msd_vals);
        if (d.dyn_msi_vals !== undefined) setDynMsiVals(d.dyn_msi_vals);
        if (d.kapandji_val !== undefined) setKapandjiVal(d.kapandji_val);
        if (d.kapandji_pain !== undefined) setKapandjiPain(d.kapandji_pain);
        if (d.dppd_pulgar !== undefined) setDppdPulgar(d.dppd_pulgar);
        if (d.dppd_indice !== undefined) setDppdIndice(d.dppd_indice);
        if (d.dppd_medio !== undefined) setDppdMedio(d.dppd_medio);
        if (d.dppd_anular !== undefined) setDppdAnular(d.dppd_anular);
        if (d.dppd_menique !== undefined) setDppdMenique(d.dppd_menique);
        if (d.danielsRows !== undefined) setDanielsRows(d.danielsRows);
        if (d.specificTests !== undefined) setSpecificTests(d.specificTests);
        if (d.sensitivity !== undefined) setSensitivity(d.sensitivity);
        if (d.sensitivity_tacto_ligero !== undefined) setSensitivityTactoLigero(d.sensitivity_tacto_ligero);
        if (d.sensitivity_dos_puntos !== undefined) setSensitivityDosPuntos(d.sensitivity_dos_puntos);
        if (d.sensitivity_picking_up !== undefined) setSensitivityPickingUp(d.sensitivity_picking_up);
        if (d.sensitivity_semmes_weinstein !== undefined) setSensitivitySemmesWeinstein(d.sensitivity_semmes_weinstein);
        if (d.sensitivity_toco_pincho !== undefined) setSensitivityTocoPincho(d.sensitivity_toco_pincho);
        if (d.sensitivity_temperatura !== undefined) setSensitivityTemperatura(d.sensitivity_temperatura);
        if (d.trophic_state !== undefined) setTrophicState(d.trophic_state);
        if (d.scar_localizacion !== undefined) setScarLocalizacion(d.scar_localizacion);
        if (d.scar_longitud !== undefined) setScarLongitud(d.scar_longitud);
        if (d.scar_vascularizacion !== undefined) setScarVascularizacion(d.scar_vascularizacion);
        if (d.scar_pigmentacion !== undefined) setScarPigmentacion(d.scar_pigmentacion);
        if (d.scar_flexibilidad !== undefined) setScarFlexibilidad(d.scar_flexibilidad);
        if (d.scar_sensibilidad !== undefined) setScarSensibilidad(d.scar_sensibilidad);
        if (d.scar_relieve !== undefined) setScarRelieve(d.scar_relieve);
        if (d.scar_temperatura !== undefined) setScarTemperatura(d.scar_temperatura);
        if (d.scar_observaciones !== undefined) setScarObservaciones(d.scar_observaciones);
        if (d.vss_pigmentacion !== undefined) setVssPigmentacion(d.vss_pigmentacion);
        if (d.vss_vascularizacion !== undefined) setVssVascularizacion(d.vss_vascularizacion);
        if (d.vss_flexibilidad !== undefined) setVssFlexibilidad(d.vss_flexibilidad);
        if (d.vss_altura !== undefined) setVssAltura(d.vss_altura);
        if (d.posture !== undefined) setPosture(d.posture);
        if (d.emotional_state !== undefined) setEmotionalState(d.emotional_state);
        if (d.interventions !== undefined) setInterventions(d.interventions);
        if (d.home_instructions_sent !== undefined) setHomeInstructionsSent(d.home_instructions_sent);
        if (d.notes !== undefined) setNotes(d.notes);
        if (d.currentStep !== undefined) setCurrentStep(d.currentStep);
        toast.info("Se restauró un borrador guardado", { duration: 4000 });
      } catch { /* ignore corrupt draft */ }
    }
    setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, secondaryLoaded, draftRestored]);

  useEffect(() => {
    if (!patientId) return;
    const load = async () => {
      const [p, c, sc] = await Promise.all([
        supabase.from("patients").select("*").eq("id", patientId).single(),
        supabase.from("patient_clinical_records").select("*").eq("patient_id", patientId).maybeSingle(),
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
          if (fe.fim_items && typeof fe.fim_items === "object") setFimItems(fe.fim_items as any);
          if (fe.barthel_items && typeof fe.barthel_items === "object") setBarthelItems(fe.barthel_items as any);
        }

        const ae = analRes.data;
        if (ae) {
          setShowMeasurements(true);

          // ── sections_config: si existe usar; si no, inferir de presencia de datos ──
          const cfg = (ae as any).sections_config;
          const hasCfg = cfg && typeof cfg === "object";
          const hasPainsData = !!(ae.pain_score != null || ae.pain_appearance || ae.pain_location || ae.pain_characteristics || ae.pain_aggravating_factors || (ae as any).pain || ae.pain_radiation || (Array.isArray((ae as any).pains) && (ae as any).pains.length > 0));
          setShowPain(hasCfg ? !!cfg.pain : hasPainsData);
          setShowEdema(hasCfg ? !!cfg.edema : !!(ae.edema || ae.godet_test || ae.edema_circummetry));
          setShowMobility(hasCfg ? !!cfg.mobility : !!(ae.goniometry || ae.arom || ae.prom || ae.kapandji));
          setShowStrength(hasCfg ? !!cfg.strength : !!(ae.dynamometer_msd || ae.dynamometer_msi || ae.muscle_strength || ae.muscle_strength_daniels || ae.dppd_fingers));
          setShowSensitivity(hasCfg ? !!cfg.sensitivity : !!(ae.sensitivity || ae.sensitivity_tacto_ligero || ae.sensitivity_dos_puntos || ae.sensitivity_picking_up || ae.sensitivity_semmes_weinstein || ae.sensitivity_toco_pincho || ae.sensitivity_temperatura));
          setShowCicatriz(hasCfg ? !!cfg.cicatriz : !!(ae.scar || ae.scar_evaluation || ae.vancouver_score));
          setShowSpecificTests(hasCfg ? !!cfg.specific_tests : !!(ae.specific_tests && Object.values(ae.specific_tests as any).some((v: any) => v !== null)));
          setShowOtros(hasCfg ? !!cfg.otros : !!(ae.trophic_state || ae.posture || ae.emotional_state));

          // ── Pain: usar array pains si existe; sino construir desde campos legacy ──
          const rawPains = (ae as any).pains;
          if (Array.isArray(rawPains) && rawPains.length > 0) {
            const loaded = rawPains.map((p: any, i: number) => ({
              id: i + 1,
              localizacion: p.localizacion || "",
              eva: p.eva ?? 0,
              evaTouched: p.eva != null,
              tipo: p.tipo || "" as PainTipo,
              aparicion: p.aparicion || "",
              irradia: p.irradia || "" as "no" | "si" | "",
              irradia_hacia: p.irradia_hacia || "",
              caracteristicas: p.caracteristicas || "",
              agravantes: p.agravantes || "",
              observaciones: p.observaciones || "",
            }));
            setPains(loaded);
            painsNextId.current = loaded.length + 1;
          } else if (hasPainsData) {
            const legacyIrradia = ae.pain_radiation === "No irradia" ? "no" : ae.pain_radiation ? "si" : "" as "no" | "si" | "";
            setPains([{
              id: 1,
              localizacion: (ae.pain_location || "").replace(/ — Irradia a:.*/, ""),
              eva: ae.pain_score || 0,
              evaTouched: ae.pain_score != null,
              tipo: "" as PainTipo,
              aparicion: ae.pain_appearance || "",
              irradia: legacyIrradia,
              irradia_hacia: ae.pain_radiation && ae.pain_radiation !== "No irradia" ? ae.pain_radiation : "",
              caracteristicas: ae.pain_characteristics || "",
              agravantes: ae.pain_aggravating_factors || "",
              observaciones: "",
            }]);
            painsNextId.current = 2;
          }

          setMobilityObservations((ae as any).mobility_observations || "");
          setEdemaObs(ae.edema || "");
          setGodetTest(ae.godet_test || "");
          const circ: any = ae.edema_circummetry;
          if (isCircometriaFormat(circ)) {
            setEdemaCircItems(normalizeCircometriaValue(circ));
          }
          if (ae.goniometry && typeof ae.goniometry === "object") {
            const toGonio = (arr: any) => {
              const base = emptySide();
              if (Array.isArray(arr)) arr.forEach((g: any) => { if (g?.body_part && base[g.body_part as GonioPartKey]) base[g.body_part as GonioPartKey] = Object.fromEntries(Object.entries(g.values || {}).map(([k,v]) => [k, String(v)])); });
              return base;
            };
            const g: any = ae.goniometry;
            if (g.arom !== undefined || g.prom !== undefined) {
              const aromData = g.arom || {};
              const promData = g.prom || {};
              // AROM: detect new { pre, post } format vs old array-per-side
              if (aromData.MSD?.pre !== undefined || aromData.MSD?.post !== undefined || aromData.MSI?.pre !== undefined) {
                setAllPreGonio({ MSD: toGonio(aromData.MSD?.pre), MSI: toGonio(aromData.MSI?.pre) });
                setAllAromPostGonio({ MSD: toGonio(aromData.MSD?.post), MSI: toGonio(aromData.MSI?.post) });
                setShowAromPost(!!(aromData.MSD?.post || aromData.MSI?.post));
              } else {
                setAllPreGonio({ MSD: toGonio(aromData.MSD), MSI: toGonio(aromData.MSI) });
              }
              setShowArom(!!(aromData.MSD || aromData.MSI));
              // PROM: detect new { pre, post } format vs old array-per-side
              if (promData.MSD?.pre !== undefined || promData.MSD?.post !== undefined || promData.MSI?.pre !== undefined) {
                setAllPromPreGonio({ MSD: toGonio(promData.MSD?.pre), MSI: toGonio(promData.MSI?.pre) });
                setAllPostGonio({ MSD: toGonio(promData.MSD?.post), MSI: toGonio(promData.MSI?.post) });
                setShowPromPost(!!(promData.MSD?.post || promData.MSI?.post));
              } else {
                setAllPostGonio({ MSD: toGonio(promData.MSD), MSI: toGonio(promData.MSI) });
              }
              setShowProm(!!(promData.MSD || promData.MSI));
            } else {
              const hasNew = g.MSD || g.MSI;
              if (hasNew) {
                setAllPreGonio({ MSD: toGonio(g.MSD?.pre), MSI: toGonio(g.MSI?.pre) });
                setAllPostGonio({ MSD: toGonio(g.MSD?.post), MSI: toGonio(g.MSI?.post) });
                const hasPost = (Array.isArray(g.MSD?.post) && g.MSD.post.length) || (Array.isArray(g.MSI?.post) && g.MSI.post.length);
                setShowArom(true);
                setShowProm(!!hasPost);
              } else {
                // Legacy { pre, post } → bajo MSD
                setAllPreGonio({ MSD: toGonio(g.pre), MSI: emptySide() });
                setAllPostGonio({ MSD: toGonio(g.post), MSI: emptySide() });
                setShowArom(true);
                setShowProm(Array.isArray(g.post) && g.post.length > 0);
              }
            }
          }
          const kap = ae.kapandji || "";
          setKapandjiVal(kap.match(/^(\d+)/)?.[1] || "");
          setKapandjiPain(kap.includes("dolor"));
          setDynMsdVals(parseDyn(ae.dynamometer_msd));
          setDynMsiVals(parseDyn(ae.dynamometer_msi));
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
          setSensitivity(ae.sensitivity || "");
          setSensitivityTactoLigero(ae.sensitivity_tacto_ligero || "");
          setSensitivityDosPuntos(ae.sensitivity_dos_puntos || "");
          setSensitivityPickingUp(ae.sensitivity_picking_up || "");
          setSensitivitySemmesWeinstein(ae.sensitivity_semmes_weinstein || "");
          setSensitivityTocoPincho(ae.sensitivity_toco_pincho || "");
          setSensitivityTemperatura(ae.sensitivity_temperatura || "");
          if (ae.specific_tests && typeof ae.specific_tests === "object") { setSpecificTests(ae.specific_tests as any); }
          const scar = (ae.scar_evaluation && typeof ae.scar_evaluation === "object" && !Array.isArray(ae.scar_evaluation) ? ae.scar_evaluation : {}) as Record<string, any>;
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

  // Load existing clinical record + occupational profile for admission editing/upsert
  useEffect(() => {
    if (!patientId) return;
    setSecondaryLoaded(false);
    (async () => {
      const epId = activeEpisodeId;
      const cliQuery = supabase.from("patient_clinical_records").select("*").eq("patient_id", patientId);
      const { data: cliRow } = epId
        ? await cliQuery.eq("episode_id", epId).maybeSingle()
        : await cliQuery.maybeSingle();
      if (cliRow) {
        setEditingClinicalId(cliRow.id);
        setCliDiagnosis(cliRow.diagnosis || "");
        setCliDoctorName(cliRow.doctor_name || "");
        setCliInjuryDate(cliRow.injury_date || "");
        setCliSurgeryDate(cliRow.surgery_date || "");
        setCliInjuryMechanism(cliRow.injury_mechanism || "");
        setCliTreatmentType(cliRow.treatment_type || "");
        setCliImmobWeeks(cliRow.immobilization_weeks != null ? String(cliRow.immobilization_weeks) : "");
        setCliImmobDays(cliRow.immobilization_days != null ? String(cliRow.immobilization_days) : "");
        setCliImmobType(cliRow.immobilization_type || "");
        setCliMedicalHistory(cliRow.medical_history || "");
        setCliPharma(cliRow.pharmacological_treatment || "");
        setCliStudies(cliRow.studies || "");
      }
      const { data: occRow } = await supabase
        .from("patient_occupational_profiles").select("*").eq("patient_id", patientId).maybeSingle();
      if (occRow) {
        setEditingOccId(occRow.id);
        setOccDominance(occRow.dominance || "");
        setOccSupportNetwork(occRow.support_network || "");
        setOccEducation(occRow.education || "");
        setOccJob(occRow.job || "");
        setOccLeisure(occRow.leisure || "");
        setOccPhysicalActivity(occRow.physical_activity || "");
        setOccSleepRest(occRow.sleep_rest || "");
        setOccHealthManagement(occRow.health_management || "");
      }

      // Cargar affected_side del episodio
      if (activeEpisodeId) {
        const { data: epRow } = await supabase
          .from("treatment_episodes")
          .select("affected_side, referral_date")
          .eq("id", activeEpisodeId)
          .maybeSingle();
        const affSide = (epRow?.affected_side as "MSD" | "MSI" | "both" | null) ?? null;
        if (affSide) setAffectedSide(affSide);
        setReferralDate(epRow?.referral_date || "");

        // Pre-poblar lado NO afectado con valores de la sesión anterior (solo follow-up nuevo)
        if (!sessionId && !isAdmission && affSide && affSide !== "both") {
          const { data: lastSess } = await supabase
            .from("therapy_sessions")
            .select("id")
            .eq("episode_id", activeEpisodeId)
            .order("session_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastSess) {
            const { data: lastAe } = await supabase
              .from("analytical_evaluations")
              .select("dynamometer_msd, dynamometer_msi")
              .eq("session_id", lastSess.id)
              .maybeSingle();
            if (lastAe) {
              if (affSide === "MSI") setDynMsdVals(parseDyn(lastAe.dynamometer_msd));
              if (affSide === "MSD") setDynMsiVals(parseDyn(lastAe.dynamometer_msi));
            }
          }
        }
      }
      setSecondaryLoaded(true);
    })();
  }, [patientId, activeEpisodeId]);

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

  // ── Validación de campos numéricos clínicos ──
  const validateNumerics = (): boolean => {
    const kap   = numFieldErr(kapandji_val, 0, 10, "");
    const dyns  = [...dyn_msd_vals, ...dyn_msi_vals].map(v => numFieldErr(v, 0, 200, "kgf"));
    const dppds = [dppd_pulgar, dppd_indice, dppd_medio, dppd_anular, dppd_menique].map(v => numFieldErr(v, 0, 30, "cm"));

    const checkGonioSide = (allVals: GonioBySide) =>
      (["MSD", "MSI"] as const).some(side =>
        Object.values(allVals[side]).some((partVals) =>
          Object.values(partVals as Record<string, string>).some(v => v.trim() && !!numFieldErr(v, 0, 360, "°"))
        )
      );

    const hasErrors =
      !!kap ||
      dyns.some(Boolean) ||
      dppds.some(Boolean) ||
      checkGonioSide(all_pre_gonio) ||
      checkGonioSide(all_arom_post_gonio) ||
      checkGonioSide(all_prom_pre_gonio) ||
      checkGonioSide(all_post_gonio);

    return !hasErrors;
  };

  const handleSave = async () => {
    if (!session_date || !user) return;
    if (!validateNumerics()) {
      toast.error("Hay campos numéricos con valores inválidos. Revisá las secciones marcadas antes de guardar.");
      return;
    }
    setSaving(true);

    // ── Pain — build array de dolores ──
    const painsFiltered = pains.filter(p =>
      p.localizacion || p.evaTouched || p.tipo || p.aparicion || p.irradia || p.caracteristicas || p.agravantes || p.observaciones
    );
    const painsJson = painsFiltered.length > 0
      ? painsFiltered.map(({ id: _id, evaTouched, ...p }) => ({
          localizacion: p.localizacion || null,
          eva: evaTouched ? p.eva : null,
          tipo: p.tipo || null,
          aparicion: p.aparicion || null,
          irradia: p.irradia || null,
          irradia_hacia: p.irradia === "si" ? p.irradia_hacia || null : null,
          caracteristicas: p.caracteristicas || null,
          agravantes: p.agravantes || null,
          observaciones: p.observaciones || null,
        }))
      : null;
    const evaValues = painsFiltered.filter(p => p.evaTouched).map(p => p.eva);
    const painScoreFinal = evaValues.length > 0 ? Math.max(...evaValues) : null;

    // ── Edema circometría — JSONB tabla ──
    const edemaCirc = buildCircometriaPayload(edema_circ_items);

    // ── Mobility (gated) — por lado MSD/MSI ──
    const buildSideJsonb = () => {
      const arom: any = {};
      const prom: any = {};
      (["MSD", "MSI"] as const).forEach((side) => {
        if (show_arom) {
          const pre = buildAllGonioJsonArray(all_pre_gonio[side]);
          const post = show_arom_post ? buildAllGonioJsonArray(all_arom_post_gonio[side]) : null;
          if (pre || post) arom[side] = { pre: pre ?? null, post: post ?? null };
        }
        if (show_prom) {
          const pre = buildAllGonioJsonArray(all_prom_pre_gonio[side]);
          const post = show_prom_post ? buildAllGonioJsonArray(all_post_gonio[side]) : null;
          if (pre || post) prom[side] = { pre: pre ?? null, post: post ?? null };
        }
      });
      const hasArom = Object.keys(arom).length > 0;
      const hasProm = Object.keys(prom).length > 0;
      if (!hasArom && !hasProm) return null;
      return { arom: hasArom ? arom : null, prom: hasProm ? prom : null };
    };
    const buildSideText = (allVals: GonioBySide) => {
      const parts: string[] = [];
      (["MSD", "MSI"] as const).forEach((side) => {
        const t = buildAllGonioText(allVals[side]);
        if (t) parts.push(`[${side}] ${t}`);
      });
      return parts.length > 0 ? parts.join(" ") : null;
    };
    const aromVal = show_arom ? buildSideText(all_pre_gonio) : null;
    const promVal = show_prom ? buildSideText(all_prom_pre_gonio) : null;
    const gonioJsonb = buildSideJsonb();
    const kapandjiFinal = kapandji_val ? `${kapandji_val}/10${kapandji_pain ? " con dolor" : ""}` : null;

    // ── Dinamometría: 3 mediciones + promedio ──
    const buildDyn = (vals: [string, string, string]) => {
      const nums = vals.map((v) => v.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n));
      if (nums.length === 0) return null;
      const avg = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
      return { values: vals.map((v) => (v.trim() ? Number(v) : null)), average: avg };
    };
    const dynMsdJson = buildDyn(dyn_msd_vals);
    const dynMsiJson = buildDyn(dyn_msi_vals);

    // ── Strength notes ──
    const msParts: string[] = [];
    if (fist_closure) msParts.push(`Cierre de puño: ${fist_closure}`);
    const msVal = msParts.length > 0 ? msParts.join(" — ") : null;

    // ── Daniels rows (gated by strength) ──
    const danielsFiltered = danielsRows.filter(r => r.muscle.trim() && r.grade.trim()).map(r => ({ muscle: r.muscle.trim(), grade: r.grade }));
    const danielsJson = danielsFiltered.length > 0 ? danielsFiltered : null;

    const dppdEntries: [string, string][] = ([
      ["pulgar", dppd_pulgar],
      ["indice", dppd_indice],
      ["medio", dppd_medio],
      ["anular", dppd_anular],
      ["menique", dppd_menique],
    ].filter(([, v]) => v && v.trim()) as [string, string][]);
    const dppdFingersJson =
      dppdEntries.length > 0 ? Object.fromEntries(dppdEntries.map(([k, v]) => [k, parseFloat(v)])) : null;

    const generalObsFinal =
      session_type === "admission"
        ? discharge_summary || general_observations || null
        : [discharge_summary, general_observations].filter(Boolean).join("\n\n") || null;

    // ── Specific tests (gated) ──
    const hasTests = Object.values(specificTests).some((v) => v !== null);
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

    // ── Ficha clínica + perfil ocupacional (solo admisión) ──
    if (isAdmission) {
      const cliPayload: any = {
        patient_id: patientId!,
        episode_id: activeEpisodeId,
        diagnosis: cli_diagnosis.trim() || null,
        doctor_name: cli_doctor_name.trim() || null,
        injury_date: cli_injury_date || null,
        surgery_date: cli_surgery_date || null,
        injury_mechanism: cli_injury_mechanism.trim() || null,
        treatment_type: cli_treatment_type || null,
        immobilization_weeks: cli_immob_weeks ? parseInt(cli_immob_weeks) : null,
        immobilization_days: cli_immob_days ? parseInt(cli_immob_days) : null,
        immobilization_type: cli_immob_type.trim() || null,
        medical_history: cli_medical_history.trim() || null,
        pharmacological_treatment: cli_pharma.trim() || null,
        studies: cli_studies.trim() || null,
      };
      if (activeEpisodeId) {
        await supabase.from("treatment_episodes").update({
          affected_side: affected_side ?? null,
          referral_date: referral_date || null,
        }).eq("id", activeEpisodeId);
      }
      if (editingClinicalId) {
        const { error: cliErr } = await supabase.from("patient_clinical_records").update(cliPayload).eq("id", editingClinicalId);
        if (cliErr) { setSaving(false); toast.error("Error al guardar ficha clínica: " + cliErr.message); return; }
      } else {
        const { data: newCli, error: cliErr } = await supabase.from("patient_clinical_records").insert(cliPayload).select("id").single();
        if (cliErr) { setSaving(false); toast.error("Error al guardar ficha clínica: " + cliErr.message); return; }
        if (newCli) setEditingClinicalId(newCli.id);
      }

      const occPayload: any = {
        patient_id: patientId!,
        dominance: occ_dominance || null,
        support_network: occ_support_network.trim() || null,
        education: occ_education.trim() || null,
        job: occ_job.trim() || null,
        leisure: occ_leisure.trim() || null,
        physical_activity: occ_physical_activity.trim() || null,
        sleep_rest: occ_sleep_rest.trim() || null,
        health_management: occ_health_management.trim() || null,
        avd: func_avd || null,
        aivd: func_aivd || null,
      };
      if (editingOccId) {
        const { error: occErr } = await supabase.from("patient_occupational_profiles").update(occPayload).eq("id", editingOccId);
        if (occErr) { setSaving(false); toast.error("Error al guardar perfil ocupacional: " + occErr.message); return; }
      } else {
        const { data: newOcc, error: occErr } = await supabase.from("patient_occupational_profiles").insert(occPayload).select("id").single();
        if (occErr) { setSaving(false); toast.error("Error al guardar perfil ocupacional: " + occErr.message); return; }
        if (newOcc) setEditingOccId(newOcc.id);
      }
    }

    const fim_answered = Object.values(fim_items).some((v) => v !== null);
    const barthel_answered = Object.values(barthel_items).some((v) => v !== null);
    const hasFunctionalData =
      showFunctional &&
      ([func_dominance, func_avd, func_aivd, func_sleep, func_health].some((v) => v) || fim_answered || barthel_answered);

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
    const scarPlanillaEntries: [string, string][] = ([
      ["localizacion", scar_localizacion],
      ["longitud_cm", scar_longitud],
      ["vascularizacion", scar_vascularizacion],
      ["pigmentacion", scar_pigmentacion],
      ["flexibilidad", scar_flexibilidad],
      ["sensibilidad", scar_sensibilidad],
      ["relieve", scar_relieve],
      ["temperatura", scar_temperatura],
    ].filter(([, v]) => v && String(v).trim()) as [string, string][]);

    const vssObj: Record<string, number> = {};
    if (vss_pigmentacion !== "") vssObj.pigmentacion = parseInt(vss_pigmentacion);
    if (vss_vascularizacion !== "") vssObj.vascularizacion = parseInt(vss_vascularizacion);
    if (vss_flexibilidad !== "") vssObj.flexibilidad = parseInt(vss_flexibilidad);
    if (vss_altura !== "") vssObj.altura = parseInt(vss_altura);
    const vssTotal = Object.values(vssObj).reduce((a, b) => a + b, 0);
    const hasVss = Object.keys(vssObj).length > 0;

    const scarEvalJson =
      scarPlanillaEntries.length > 0 || hasVss
        ? {
            ...Object.fromEntries(scarPlanillaEntries),
            ...(hasVss ? { vss: vssObj } : {}),
          }
        : null;

    const hasMeasurements =
      show_measurements &&
      [
        painsJson,
        edema_obs,
        godet_test,
        edemaCirc,
        aromVal,
        promVal,
        fist_closure,
        dynMsdJson,
        dynMsiJson,
        kapandjiFinal,
        msVal,
        danielsJson,
        sensitivity,
        sensitivity_tacto_ligero,
        sensitivity_dos_puntos,
        sensitivity_picking_up,
        sensitivity_semmes_weinstein,
        sensitivity_toco_pincho,
        sensitivity_temperatura,
        trophic_state,
        posture,
        emotional_state,
        specificTestsJson,
        gonioJsonb,
        dppdFingersJson,
        scarEvalJson,
        mobility_observations,
      ].some((v) => v !== "" && v !== null && v !== undefined && v !== false);

    const sectionsConfig = {
      pain: showPain, edema: showEdema, mobility: showMobility, strength: showStrength,
      sensitivity: showSensitivity, cicatriz: showCicatriz, specific_tests: showSpecificTests, otros: showOtros,
    };

    const analyticalPayload = {
      patient_id: patientId!,
      professional_id: user.id,
      episode_id: activeEpisodeId,
      session_id: session.id,
      evaluation_date: session_date,
      pains: painsJson as any,
      pain_score: painScoreFinal,
      pain_appearance: null,
      pain_location: null,
      pain_radiation: null,
      pain_characteristics: null,
      pain_aggravating_factors: null,
      pain: null,
      sections_config: sectionsConfig as any,
      edema: edema_obs || null,
      godet_test: godet_test || null,
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
      mobility_observations: mobility_observations || null,
      specific_tests: specificTestsJson,
      dppd_fingers: dppdFingersJson,
      sensitivity: sensitivity || null,
      sensitivity_functional: null,
      sensitivity_protective: null,
      sensitivity_tacto_ligero: sensitivity_tacto_ligero || null,
      sensitivity_dos_puntos: sensitivity_dos_puntos || null,
      sensitivity_picking_up: sensitivity_picking_up || null,
      sensitivity_semmes_weinstein: sensitivity_semmes_weinstein || null,
      sensitivity_toco_pincho: sensitivity_toco_pincho || null,
      sensitivity_temperatura: sensitivity_temperatura || null,
      trophic_state: trophic_state || null,
      scar: scar_observaciones || null,
      scar_evaluation: scarEvalJson,
      vancouver_score: hasVss ? vssTotal : null,
      osas_score: null,
      posture: posture || null,
      emotional_state: emotional_state || null,
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
    clearDraft();
    toast.success(isEditMode ? "Sesión actualizada correctamente" : "Sesión registrada correctamente");
    navigate(`/patients/${patientId}`);
  };

  // GonioGrid definido a nivel de módulo (ver abajo del archivo)

  const GonioPartSelector = ({
    value,
    onChange,
    allValues,
  }: {
    value: GonioPartKey;
    onChange: (v: GonioPartKey) => void;
    allValues?: Record<GonioPartKey, Record<string, string>>;
  }) => (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {(Object.keys(GONIO_PARTS) as GonioPartKey[]).map((k) => {
        const fields = GONIO_PARTS[k].fields;
        const filled = allValues ? fields.filter(f => !!allValues[k]?.[f.key]).length : 0;
        const total = fields.length;
        const hasSome = filled > 0;
        const isActive = value === k;
        return (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={isActive ? "default" : "outline"}
            className={cn(
              "h-8 text-xs rounded-full gap-1.5",
              isActive ? "bg-primary hover:bg-primary/85" : "border-border"
            )}
            onClick={() => onChange(k)}
          >
            {GONIO_PARTS[k].label}
            {allValues && hasSome && (
              <span className={cn(
                "text-[10px] font-semibold leading-none px-1 py-0.5 rounded-full",
                isActive ? "bg-white/25 text-white" : "bg-primary/15 text-primary"
              )}>
                {filled}/{total}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );

  const sessionTitle = `${patient.last_name} — Sesión Nº ${session_number || "—"}`;
  const age = patient.birth_date ? differenceInYears(new Date(), new Date(patient.birth_date)) : null;

  // Section completion indicators
  const sectionDone: Record<string, boolean> = {
    "sec-datos": !!session_date,
    "sec-ficha": !!cli_diagnosis,
    "sec-ocupacional": !!(occ_job || occ_dominance),
    "sec-funcional": showFunctional && (Object.values(fim_items).some(v => v !== null) || Object.values(barthel_items).some(v => v !== null)),
    "sec-evolucion": !!general_observations,
    "sec-analitica": show_measurements && (showPain || showEdema || showMobility || showStrength),
    "sec-intervenciones": !!interventions,
    "sec-notas": !!(notes || home_instructions_sent),
  };

  const steps = isAdmission ? STEPS_ADMISSION : STEPS_SESSION;
  const goToStep = (idx: number) => setCurrentStep(Math.max(0, Math.min(steps.length - 1, idx)));
  const prevStep = () => goToStep(currentStep - 1);
  const nextStep = () => goToStep(currentStep + 1);
  const isLastStep = currentStep === steps.length - 1;
  const currentSections = steps[currentStep].sections;
  const stepDone = (step: StepDef) => step.sections.every(sid => sectionDone[sid] ?? false);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-50 bg-card border-b border-border h-14 flex items-center px-4 shrink-0">
        <div className="w-full flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/patients/${patientId}`)}
            className="text-muted-foreground hover:text-foreground -ml-2 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">{sessionTitle}</h1>
            {clinical?.diagnosis && (
              <p className="text-xs text-muted-foreground truncate">{clinical.diagnosis}</p>
            )}
          </div>
        </div>
      </header>

      {/* 2-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Index lateral sticky */}
        <aside className="w-44 shrink-0 border-r border-border hidden lg:flex flex-col overflow-y-auto bg-background">
          <nav className="p-3 pt-4 space-y-0.5">
            {steps.map((s, idx) => {
              const done = stepDone(s);
              const isActive = currentStep === idx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToStep(idx)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <s.icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </span>
                  {done
                    ? <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><Check className="h-2 w-2 text-emerald-600 stroke-[2.5]" /></span>
                    : <span className="w-3.5 h-3.5 rounded-full border border-border/60 shrink-0" />
                  }
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Scrollable form content */}
        <main className="flex-1 overflow-y-auto">
          {/* Mobile step indicator */}
          <div className="lg:hidden flex items-center justify-between px-4 pt-4 pb-2 border-b border-border">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              {currentStep > 0 ? steps[currentStep - 1].label : ""}
            </button>
            <span className="text-xs font-medium">{steps[currentStep].label} · {currentStep + 1}/{steps.length}</span>
            <button
              type="button"
              onClick={nextStep}
              disabled={isLastStep}
              className="flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-40"
            >
              {!isLastStep ? steps[currentStep + 1].label : ""}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Card 1: Datos de la sesión */}
        {currentSections.includes("sec-datos") && <SectionCard id="sec-datos" icon={Calendar} title="Datos de la sesión">
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
              <Select value={session_type} onValueChange={setSessionType} disabled={isAdmission}>
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {isAdmission && <SelectItem value="admission">Admisión</SelectItem>}
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
        </SectionCard>}

        {/* Ficha clínica (admission only) */}
        {isAdmission && currentSections.includes("sec-ficha") && (
          <SectionCard id="sec-ficha" icon={Stethoscope} title="Ficha clínica">
            <div className="space-y-4">
              <div>
                <FieldLabel>Diagnóstico (CIE-10)</FieldLabel>
                <Cie10Autocomplete value={cli_diagnosis} onChange={setCliDiagnosis} placeholder="Buscar por código o descripción…" className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><FieldLabel>Médico derivante</FieldLabel><Input value={cli_doctor_name} onChange={(e) => setCliDoctorName(e.target.value)} className={inputClass} /></div>
                <div><FieldLabel>Fecha de derivación</FieldLabel><Input type="date" value={referral_date} onChange={(e) => setReferralDate(e.target.value)} className={inputClass} /></div>
                <div>
                  <FieldLabel>Tipo de tratamiento</FieldLabel>
                  <Select value={cli_treatment_type} onValueChange={setCliTreatmentType}>
                    <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="conservative">Conservador</SelectItem>
                      <SelectItem value="surgery">Quirúrgico</SelectItem>
                      <SelectItem value="mixed">Mixto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><FieldLabel>Fecha de lesión</FieldLabel><Input type="date" value={cli_injury_date} onChange={(e) => setCliInjuryDate(e.target.value)} className={inputClass} /></div>
                <div><FieldLabel>Fecha de cirugía</FieldLabel><Input type="date" value={cli_surgery_date} onChange={(e) => setCliSurgeryDate(e.target.value)} className={inputClass} /></div>
              </div>
              <div>
                <FieldLabel>Mecanismo de lesión</FieldLabel>
                <Textarea rows={2} value={cli_injury_mechanism} onChange={(e) => setCliInjuryMechanism(e.target.value)} className={textareaClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><FieldLabel>Sem. inmovilización</FieldLabel><Input type="number" min={0} value={cli_immob_weeks} onChange={(e) => setCliImmobWeeks(e.target.value)} className={inputClass} /></div>
                <div><FieldLabel>Días inmovilización</FieldLabel><Input type="number" min={0} value={cli_immob_days} onChange={(e) => setCliImmobDays(e.target.value)} className={inputClass} /></div>
                <div><FieldLabel>Tipo de inmovilización</FieldLabel><Input value={cli_immob_type} onChange={(e) => setCliImmobType(e.target.value)} className={inputClass} /></div>
              </div>
              <div><FieldLabel>Antecedentes médicos</FieldLabel><Textarea rows={2} value={cli_medical_history} onChange={(e) => setCliMedicalHistory(e.target.value)} className={textareaClass} /></div>
              <div><FieldLabel>Tratamiento farmacológico</FieldLabel><Textarea rows={2} value={cli_pharma} onChange={(e) => setCliPharma(e.target.value)} className={textareaClass} /></div>
              <div><FieldLabel>Estudios realizados</FieldLabel><Textarea rows={2} value={cli_studies} onChange={(e) => setCliStudies(e.target.value)} className={textareaClass} /></div>
            </div>
          </SectionCard>
        )}

        {/* Perfil ocupacional (admission only, sin AVD/AIVD) */}
        {isAdmission && currentSections.includes("sec-ocupacional") && (
          <SectionCard id="sec-ocupacional" icon={Briefcase} title="Perfil ocupacional">
            <div className="space-y-4">
              <div>
                <FieldLabel>Dominancia</FieldLabel>
                <Select value={occ_dominance} onValueChange={setOccDominance}>
                  <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="right">Diestro/a</SelectItem>
                    <SelectItem value="left">Zurdo/a</SelectItem>
                    <SelectItem value="ambidextrous">Ambidiestro/a</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><FieldLabel>Red de apoyo</FieldLabel><Textarea rows={2} value={occ_support_network} onChange={(e) => setOccSupportNetwork(e.target.value)} className={textareaClass} /></div>
              <div><FieldLabel>Educación</FieldLabel><Textarea rows={2} value={occ_education} onChange={(e) => setOccEducation(e.target.value)} className={textareaClass} /></div>
              <div><FieldLabel>Trabajo / ocupación</FieldLabel><Textarea rows={2} value={occ_job} onChange={(e) => setOccJob(e.target.value)} className={textareaClass} /></div>
              <div><FieldLabel>Ocio y tiempo libre</FieldLabel><Textarea rows={2} value={occ_leisure} onChange={(e) => setOccLeisure(e.target.value)} className={textareaClass} /></div>
              <div><FieldLabel>Actividad física</FieldLabel><Textarea rows={2} value={occ_physical_activity} onChange={(e) => setOccPhysicalActivity(e.target.value)} className={textareaClass} /></div>
              <div><FieldLabel>Sueño y descanso</FieldLabel><Textarea rows={2} value={occ_sleep_rest} onChange={(e) => setOccSleepRest(e.target.value)} className={textareaClass} /></div>
              <div><FieldLabel>Gestión de la salud</FieldLabel><Textarea rows={2} value={occ_health_management} onChange={(e) => setOccHealthManagement(e.target.value)} className={textareaClass} /></div>
            </div>
          </SectionCard>
        )}

        {/* Functional eval */}
        {currentSections.includes("sec-funcional") && <SectionCard
          id="sec-funcional"
          icon={ClipboardList}
          title="Evaluación funcional"
          action={
            <div className="flex gap-1">
              {(() => { const s = calcFimTotal(fim_items); return s !== null ? <Badge variant="secondary" className="text-[10px]">FIM {s}/126</Badge> : null; })()}
              {(() => { const s = calcBarthelTotal(barthel_items); return s !== null ? <Badge variant="secondary" className="text-[10px]">Barthel {s}/100</Badge> : null; })()}
            </div>
          }
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>AVD — Actividades de la vida diaria</Label>
              <Textarea rows={3} value={func_avd} onChange={(e) => setFuncAvd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>AIVD — Actividades instrumentales</Label>
              <Textarea rows={3} value={func_aivd} onChange={(e) => setFuncAivd(e.target.value)} />
            </div>
            <BarthelSection items={barthel_items} onChange={setBarthelItems} />
            <FimSection items={fim_items} onChange={setFimItems} />
          </div>
        </SectionCard>}

        {/* Card 2: Evolución (no en admisión) */}
        {!isAdmission && currentSections.includes("sec-evolucion") && (
        <SectionCard id="sec-evolucion" icon={FileText} title="Evolución">
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
        )}

        {/* Card 3: Evaluación analítica */}
        {currentSections.includes("sec-analitica") && <SectionCard
          id="sec-analitica"
          icon={BarChart2}
          title="Evaluación analítica"
        >
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
                onClick={() => { const id = painsNextId.current++; setPains(prev => [...prev, emptyPain(id)]); }}
              >
                <Plus className="h-4 w-4 mr-1" /> Agregar dolor
              </Button>
            </div>
          </SubSection>

          {/* Edema */}
          <SubSection title="Edema" checked={showEdema} onChange={setShowEdema}>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Circometría</h4>
              <EdemaCircometryTable
                items={edema_circ_items}
                onChange={setEdemaCircItems}
              />
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
                    <Label htmlFor="kap-pain-sf" className="font-normal text-sm cursor-pointer">
                      Con dolor
                    </Label>
                  </div>
                </div>
                {numFieldErr(kapandji_val, 0, 10, "") && (
                  <p className="text-xs text-destructive mt-1">{numFieldErr(kapandji_val, 0, 10, "")}</p>
                )}
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
        </SectionCard>}

        {/* Card 4: Intervenciones */}
        {currentSections.includes("sec-intervenciones") && <SectionCard id="sec-intervenciones" icon={ClipboardList} title="Intervenciones">
          <FieldLabel>En el día de hoy se abordó</FieldLabel>
          <Textarea rows={5} value={interventions} onChange={(e) => setInterventions(e.target.value)} className={textareaClass} />
        </SectionCard>}

        {/* Card 5: Indicaciones y notas */}
        {currentSections.includes("sec-notas") && <SectionCard id="sec-notas" icon={MessageSquare} title="Indicaciones y notas">
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
        </SectionCard>}

        {/* Step navigation */}
        <div className="flex justify-between items-center pt-2 pb-8 px-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentStep === 0}
            onClick={prevStep}
            className="text-muted-foreground gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {currentStep > 0 ? steps[currentStep - 1].label : ""}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isLastStep}
            onClick={nextStep}
            className="text-muted-foreground gap-1"
          >
            {!isLastStep ? steps[currentStep + 1].label : ""}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
          </div>
        </main>
      </div>

      {/* Floating save button — bottom right */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleSave}
          disabled={saving || !session_date}
          className="bg-primary hover:bg-primary/85 shadow-lg gap-2 px-5"
          size="default"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Guardando..." : isEditMode ? "Actualizar sesión" : "Guardar sesión"}
        </Button>
      </div>
    </div>
  );
}
