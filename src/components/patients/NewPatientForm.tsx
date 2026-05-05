import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ChevronDown, User, FileText, Briefcase, Activity, BarChart2, ClipboardList, X, Plus } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { useRef } from "react";
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

// ── Section card wrapper ──
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
  toggle?: { checked: boolean; onChange: (v: boolean) => void };
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
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{toggle.checked ? "Incluido" : "Incluir"}</span>
              <Switch checked={toggle.checked} onCheckedChange={toggle.onChange} />
            </div>
          )}
        </div>
      </div>
      {!isOff && <CardContent className="p-5">{children}</CardContent>}
    </Card>
  );
}

// ── Sub-section with header + toggle (used inside Evaluación analítica) ──
function SubSection({
  title,
  checked,
  onChange,
  children,
  withDivider = true,
}: {
  title: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  withDivider?: boolean;
}) {
  return (
    <div className={`space-y-3 ${withDivider ? "pt-5 mt-5 border-t border-border" : ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="field-label">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{checked ? "Incluido" : "Incluir"}</span>
          <Switch checked={checked} onCheckedChange={onChange} />
        </div>
      </div>
      {checked && <div className="space-y-3">{children}</div>}
    </div>
  );
}

// ── Reusable label with optional required asterisk ──
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs mb-1.5 block">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );
}

const inputClass = "rounded-md h-10 text-sm";
const textareaClass = "rounded-lg";
const subDivider = "pt-5 mt-5 border-t border-border";
const subLabel = "text-xs mb-3 block";

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
      const { data } = await supabase.rpc('search_cie10', {
        search_input: term,
        max_results: 10
      });
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
    const onScrollResize = () => updateRect();
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
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
      {loading && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
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

// ── Obras Sociales autocomplete (inline) ──
function ObrasSocialesAutocomplete({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Array<{ name: string; type: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastSelectedRef = useRef<string>("");
  const visibleTypes = Array.from(new Set(results.map((r) => r.type).filter(Boolean)));
  const showTypeGroups = visibleTypes.length > 1;
  const typeLabel = (type: string | null) => {
    if (!type) return "OTRAS";
    const normalized = type.toLowerCase();
    if (normalized === "prepaga") return "PREPAGAS";
    if (normalized === "sindical") return "SINDICALES";
    return type.toUpperCase();
  };

  const updateRect = () => {
    if (wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  };

  useEffect(() => {
    const term = value.trim();
    if (term.length < 1) { setResults([]); setOpen(false); return; }
    if (term === lastSelectedRef.current) { setOpen(false); return; }
    const searchTerm = term.toLowerCase();
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("obras_sociales")
        .select("name, type")
        .eq("is_active", true)
        .ilike("name_search", `%${searchTerm}%`)
        .limit(10);
      if (cancelled) return;
      setResults((data as Array<{ name: string; type: string | null }>) || []);
      updateRect();
      setOpen(true);
      setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); setLoading(false); };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    updateRect();
    const onScrollResize = () => updateRect();
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
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
        onChange={(e) => { lastSelectedRef.current = ""; onChange(e.target.value); }}
        onFocus={() => { if (results.length > 0) { updateRect(); setOpen(true); } }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: rect.top + rect.height + 4, left: rect.left, width: rect.width, zIndex: 60 }}
          className="max-h-64 overflow-auto rounded-md border bg-popover shadow-md"
        >
          {results.map((r, index) => {
            const previous = results[index - 1];
            const showLabel = showTypeGroups && (!previous || previous.type !== r.type);
            return (
              <div key={`${r.name}-${r.type || "sin-tipo"}`}>
                {showLabel && (
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {typeLabel(r.type)}
                  </div>
                )}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { lastSelectedRef.current = r.name; onChange(r.name); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  {r.name}
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

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
const DANIELS_FULL_GRADES = ["0","1","1+","2-","2","2+","3-","3","3+","4-","4","4+","5"];

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

// ── Vancouver VSS: opciones por dimensión ──
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
    { v: "1", label: "1 — Suave, flexible con mínima resistencia" },
    { v: "2", label: "2 — Cedente, cede a la presión" },
    { v: "3", label: "3 — Firme, inflexible, resistente a la presión manual" },
    { v: "4", label: "4 — Cordón: tejido tipo soga que se blanquea al extender" },
    { v: "5", label: "5 — Contractura: acortamiento permanente que produce deformidad" },
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

export function NewPatientForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [evaTouched, setEvaTouched] = useState(false);

  // Section toggles
  const [showOccupational, setShowOccupational] = useState(true);
  const [showFunctional, setShowFunctional] = useState(true);
  const [showAnalytical, setShowAnalytical] = useState(true);

  // Analytical sub-section toggles
  const [showDolor, setShowDolor] = useState(true);
  const [showEdema, setShowEdema] = useState(false);
  const [showMovilidad, setShowMovilidad] = useState(false);
  const [showFuerza, setShowFuerza] = useState(false);
  const [showSensibilidad, setShowSensibilidad] = useState(false);
  const [showCicatriz, setShowCicatriz] = useState(false);
  const [showPruebas, setShowPruebas] = useState(false);
  const [showOtros, setShowOtros] = useState(false);

  // Card 1 — Patient data
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [dni, setDni] = useState("");
  const [nationality, setNationality] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [insurance, setInsurance] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split("T")[0]);

  // Card 2 — Clinical data
  const [diagnosis, setDiagnosis] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [injuryDate, setInjuryDate] = useState("");
  const [surgeryDate, setSurgeryDate] = useState("");
  const [injuryMechanism, setInjuryMechanism] = useState("");
  const [treatmentType, setTreatmentType] = useState("");
  const [weeksPostInjury, setWeeksPostInjury] = useState("");
  const [daysPostInjury, setDaysPostInjury] = useState("");
  const [weeksPostSurgery, setWeeksPostSurgery] = useState("");
  const [daysPostSurgery, setDaysPostSurgery] = useState("");
  const [immobilizationWeeks, setImmobilizationWeeks] = useState("");
  const [immobilizationDays, setImmobilizationDays] = useState("");
  const [immobilizationType, setImmobilizationType] = useState("");
  const [nextOyt, setNextOyt] = useState("");
  const [studies, setStudies] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [pharma, setPharma] = useState("");

  // Auto-calcular semanas/días desde fechas (si los campos están vacíos)
  useEffect(() => {
    if (!injuryDate) return;
    const diff = Math.floor((Date.now() - new Date(injuryDate + "T12:00:00").getTime()) / 86400000);
    if (diff < 0) return;
    if (!weeksPostInjury && !daysPostInjury) {
      setWeeksPostInjury(String(Math.floor(diff / 7)));
      setDaysPostInjury(String(diff % 7));
    }
  }, [injuryDate]);
  useEffect(() => {
    if (!surgeryDate) return;
    const diff = Math.floor((Date.now() - new Date(surgeryDate + "T12:00:00").getTime()) / 86400000);
    if (diff < 0) return;
    if (!weeksPostSurgery && !daysPostSurgery) {
      setWeeksPostSurgery(String(Math.floor(diff / 7)));
      setDaysPostSurgery(String(diff % 7));
    }
  }, [surgeryDate]);

  // Card 3 — Occupational profile
  const [dominance, setDominance] = useState("");
  const [supportNetwork, setSupportNetwork] = useState("");
  const [education, setEducation] = useState("");
  const [job, setJob] = useState("");
  const [leisure, setLeisure] = useState("");
  const [physicalActivity, setPhysicalActivity] = useState("");
  const [sleepRest, setSleepRest] = useState("");
  const [healthManagement, setHealthManagement] = useState("");

  // Card 4 — Functional evaluation
  const [avd, setAvd] = useState("");
  const [aivd, setAivd] = useState("");
  const [qdItems, setQdItems] = useState<(number | null)[]>(emptyQuickDash());
  const [fimItems, setFimItems] = useState<Record<string, number | null>>(emptyFim());
  const [barthelItems, setBarthelItems] = useState<Record<string, number | null>>(emptyBarthel());

  // Card 5 — Analytical evaluation
  const [painScore, setPainScore] = useState<number>(0);
  const [painAppearance, setPainAppearance] = useState("");
  const [painLocation, setPainLocation] = useState("");
  const [painRadiation, setPainRadiation] = useState("");
  const [painRadiationChoice, setPainRadiationChoice] = useState<"" | "no" | "si">("");
  const [painCharacteristics, setPainCharacteristics] = useState("");
  const [painAggravating, setPainAggravating] = useState("");
  const [painFree, setPainFree] = useState("");
  const [edema, setEdema] = useState("");
  const [godetTest, setGodetTest] = useState("");
  const [kapandjiVal, setKapandjiVal] = useState("");
  const [kapandjiPain, setKapandjiPain] = useState(false);
  const [fistClosure, setFistClosure] = useState("");
  const [dynMsdVals, setDynMsdVals] = useState<[string, string, string]>(["", "", ""]);
  const [dynMsiVals, setDynMsiVals] = useState<[string, string, string]>(["", "", ""]);
  const [danielsRows, setDanielsRows] = useState<{ id: number; muscle: string; grade: string }[]>([
    { id: 1, muscle: "", grade: "" },
  ]);
  const danielsNextId = useRef(2);
  const [sensitivityTactoLigero, setSensitivityTactoLigero] = useState("");
  const [sensitivityDosPuntos, setSensitivityDosPuntos] = useState("");
  const [sensitivityPickingUp, setSensitivityPickingUp] = useState("");
  const [sensitivitySemmesWeinstein, setSensitivitySemmesWeinstein] = useState("");
  const [sensitivityTocoPincho, setSensitivityTocoPincho] = useState("");
  const [sensitivityTemperatura, setSensitivityTemperatura] = useState("");
  const [sensitivity, setSensitivity] = useState("");
  // DPPD 5 fingers
  const [dppdPulgar, setDppdPulgar] = useState("");
  const [dppdIndice, setDppdIndice] = useState("");
  const [dppdMedio, setDppdMedio] = useState("");
  const [dppdAnular, setDppdAnular] = useState("");
  const [dppdMenique, setDppdMenique] = useState("");
  const [trophicState, setTrophicState] = useState("");
  // Cicatriz — Planilla
  const [scarLocalizacion, setScarLocalizacion] = useState("");
  const [scarLongitud, setScarLongitud] = useState("");
  const [scarVascularizacion, setScarVascularizacion] = useState("");
  const [scarPigmentacion, setScarPigmentacion] = useState("");
  const [scarFlexibilidad, setScarFlexibilidad] = useState("");
  const [scarSensibilidad, setScarSensibilidad] = useState("");
  const [scarRelieve, setScarRelieve] = useState("");
  const [scarTemperatura, setScarTemperatura] = useState("");
  const [scarObservaciones, setScarObservaciones] = useState("");
  // Cicatriz — Vancouver VSS
  const [vssPigmentacion, setVssPigmentacion] = useState("");
  const [vssVascularizacion, setVssVascularizacion] = useState("");
  const [vssFlexibilidad, setVssFlexibilidad] = useState("");
  const [vssAltura, setVssAltura] = useState("");
  const [posture, setPosture] = useState("");
  const [emotionalState, setEmotionalState] = useState("");
  const [analNotes, setAnalNotes] = useState("");

  // Structured goniometry — por lado MSD/MSI, nested by body part
  type GonioBySide = Record<"MSD" | "MSI", Record<GonioPartKey, Record<string, string>>>;
  const emptySide = () => ({ shoulder: {}, elbow: {}, wrist: {}, hand: {}, thumb: {} } as Record<GonioPartKey, Record<string, string>>);
  const emptyGonio = (): GonioBySide => ({ MSD: emptySide(), MSI: emptySide() });
  const [gonioSide, setGonioSide] = useState<"MSD" | "MSI">("MSD");
  const [gonioPart, setGonioPart] = useState<GonioPartKey>("wrist");
  const [allPreGonio, setAllPreGonio] = useState<GonioBySide>(emptyGonio);
  const [showPostGonio, setShowPostGonio] = useState(false);
  const [gonioSidePost, setGonioSidePost] = useState<"MSD" | "MSI">("MSD");
  const [gonioPartPost, setGonioPartPost] = useState<GonioPartKey>("wrist");
  const [allPostGonio, setAllPostGonio] = useState<GonioBySide>(emptyGonio);

  // Circometría (JSONB)
  const [circReference, setCircReference] = useState("");
  const [circSide, setCircSide] = useState<"D" | "I">("D");
  const [circValueCm, setCircValueCm] = useState("");
  const [circManoGlobal, setCircManoGlobal] = useState(false);

  // Specific tests
  const [specificTests, setSpecificTests] = useState<Record<string, TestResult>>(
    Object.fromEntries(SPECIFIC_TESTS.map(t => [t.key, null]))
  );

  // Daniels
  const [danielsMedian, setDanielsMedian] = useState<Record<string, string>>({});
  const [danielsCubital, setDanielsCubital] = useState<Record<string, string>>({});
  const [danielsRadial, setDanielsRadial] = useState<Record<string, string>>({});
  const [showDaniels, setShowDaniels] = useState(false);

  // Card 6 — Admission session
  const [interventions, setInterventions] = useState("");
  const [homeInstructions, setHomeInstructions] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");

  // ── Auto week calculation ──
  useEffect(() => {
    if (injuryDate && admissionDate) {
      const days = differenceInCalendarDays(new Date(admissionDate), new Date(injuryDate));
      if (days >= 0) {
        setWeeksPostInjury(String(Math.floor(days / 7)));
        setDaysPostInjury(String(days % 7));
      }
    } else if (!injuryDate) {
      setWeeksPostInjury("");
      setDaysPostInjury("");
    }
  }, [injuryDate, admissionDate]);

  useEffect(() => {
    if (surgeryDate && admissionDate) {
      const days = differenceInCalendarDays(new Date(admissionDate), new Date(surgeryDate));
      if (days >= 0) {
        setWeeksPostSurgery(String(Math.floor(days / 7)));
        setDaysPostSurgery(String(days % 7));
      }
    } else if (!surgeryDate) {
      setWeeksPostSurgery("");
      setDaysPostSurgery("");
    }
  }, [surgeryDate, admissionDate]);

  const or = (v: string) => v.trim() || null;
  const orNum = (v: string) => (v.trim() ? parseInt(v) : null);
  const orFloat = (v: string) => (v.trim() ? parseFloat(v) : null);

  const fieldClass = (key: string) =>
    errors[key] ? "border-destructive ring-1 ring-destructive" : "";

  const validate = (): boolean => {
    const errs: Record<string, boolean> = {};
    if (!lastName.trim()) errs.lastName = true;
    if (!firstName.trim()) errs.firstName = true;
    if (!dni.trim()) errs.dni = true;
    if (!admissionDate) errs.admissionDate = true;
    if (!diagnosis.trim()) errs.diagnosis = true;
    if (showOccupational && !dominance) errs.dominance = true;
    if (showFunctional && !avd.trim()) errs.avd = true;
    if (showAnalytical && showDolor && !evaTouched) errs.painScore = true;
    if (!interventions.trim()) errs.interventions = true;
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = document.querySelector("[data-field-error]");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return Object.keys(errs).length === 0;
  };

  // ── Gonio helpers (nested per-part) ──
  const buildAllGonioText = (allVals: Record<GonioPartKey, Record<string, string>>) => {
    const parts: string[] = [];
    for (const pk of Object.keys(GONIO_PARTS) as GonioPartKey[]) {
      const vals = allVals[pk];
      const fields = GONIO_PARTS[pk].fields;
      const entries = fields.map(f => vals[f.key] ? `${f.label}:${vals[f.key]}°` : "").filter(Boolean);
      if (entries.length > 0) parts.push(`[${GONIO_PARTS[pk].label}] ${entries.join(" ")}`);
    }
    return parts.length > 0 ? parts.join(" ") : null;
  };

  const buildAllGonioJsonArray = (allVals: Record<GonioPartKey, Record<string, string>>) => {
    const arr: { body_part: string; values: Record<string, number> }[] = [];
    for (const pk of Object.keys(GONIO_PARTS) as GonioPartKey[]) {
      const vals = allVals[pk];
      const filled = Object.fromEntries(
        GONIO_PARTS[pk].fields.map(f => [f.key, vals[f.key] ? Number(vals[f.key]) : null]).filter(([, v]) => v != null)
      );
      if (Object.keys(filled).length > 0) arr.push({ body_part: pk, values: filled as Record<string, number> });
    }
    return arr.length > 0 ? arr : null;
  };

  const cycleTest = (key: string) => {
    setSpecificTests(prev => {
      const cur = prev[key];
      const next: TestResult = cur === null ? "positive" : cur === "positive" ? "negative" : null;
      return { ...prev, [key]: next };
    });
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      // 1. Insert patient
      const { data: patient, error: patErr } = await supabase
        .from("patients")
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dni: dni.trim(),
          nationality: or(nationality),
          birth_date: or(birthDate),
          phone: or(phone),
          address: or(address),
          insurance: or(insurance),
          insurance_number: or(insuranceNumber),
          admission_date: admissionDate,
          professional_id: user!.id,
        })
        .select("id")
        .single();

      if (patErr) throw patErr;
      const pid = patient.id;

      // 1b. Insert treatment episode
      const { data: episode, error: epErr } = await supabase
        .from("treatment_episodes")
        .insert({
          patient_id: pid,
          professional_id: user!.id,
          episode_number: 1,
          admission_date: admissionDate,
          status: "active",
          diagnosis: or(diagnosis),
        })
        .select("id")
        .single();

      if (epErr) throw epErr;
      const episodeId = episode.id;

      // 2. Clinical records
      await supabase.from("patient_clinical_records").insert({
        patient_id: pid,
        episode_id: episodeId,
        diagnosis: or(diagnosis),
        doctor_name: or(doctorName),
        injury_date: or(injuryDate),
        surgery_date: or(surgeryDate),
        injury_mechanism: or(injuryMechanism),
        treatment_type: or(treatmentType),
        weeks_post_injury: orNum(weeksPostInjury),
        days_post_injury: orNum(daysPostInjury),
        weeks_post_surgery: orNum(weeksPostSurgery),
        days_post_surgery: orNum(daysPostSurgery),
        immobilization_weeks: orNum(immobilizationWeeks),
        immobilization_days: orNum(immobilizationDays),
        immobilization_type: or(immobilizationType),
        next_oyt_appointment: or(nextOyt),
        studies: or(studies),
        medical_history: or(medicalHistory),
        pharmacological_treatment: or(pharma),
      });

      // 3. Occupational profile
      await supabase.from("patient_occupational_profiles").insert({
        patient_id: pid,
        dominance: showOccupational ? or(dominance) : null,
        support_network: showOccupational ? or(supportNetwork) : null,
        education: showOccupational ? or(education) : null,
        job: showOccupational ? or(job) : null,
        leisure: showOccupational ? or(leisure) : null,
        physical_activity: showOccupational ? or(physicalActivity) : null,
        sleep_rest: showOccupational ? or(sleepRest) : null,
        health_management: showOccupational ? or(healthManagement) : null,
      });

      // 4. Functional evaluation
      const qdAnswered = qdItems.some((v) => v !== null);
      const fimAnswered = Object.values(fimItems).some((v) => v !== null);
      const barthelAnswered = Object.values(barthelItems).some((v) => v !== null);
      const qdScore = calcQuickDashScore(qdItems);
      const fimTotal = calcFimTotal(fimItems);
      const barthelTotal = calcBarthelTotal(barthelItems);
      const hasFunc = !!(avd.trim() || aivd.trim() || qdAnswered || fimAnswered || barthelAnswered);
      if (showFunctional && hasFunc) {
        await supabase.from("functional_evaluations").insert({
          patient_id: pid,
          professional_id: user!.id,
          episode_id: episodeId,
          evaluation_date: admissionDate,
          dominance: showOccupational ? (or(dominance) as any) : null,
          avd: or(avd),
          aivd: or(aivd),
          quickdash_items: qdAnswered ? (qdItems as any) : null,
          quickdash_score: qdScore as any,
          fim_items: fimAnswered ? (fimItems as any) : null,
          fim_score: fimTotal,
          barthel_items: barthelAnswered ? (barthelItems as any) : null,
          barthel_score: barthelTotal,
        } as any);
      }

      // 5. Admission session
      const { data: admissionSession, error: sessionErr } = await supabase.from("therapy_sessions").insert({
        patient_id: pid,
        professional_id: user!.id,
        episode_id: episodeId,
        session_date: admissionDate,
        session_type: "admission",
        session_number: 1,
        interventions: or(interventions),
        home_instructions_sent: or(homeInstructions),
        notes: or(sessionNotes),
        is_deleted: false,
      }).select("id").single();

      if (sessionErr) throw sessionErr;
      const sessionId = admissionSession.id;

      // 6. Analytical evaluation — build structured fields (gated by sub-section toggles)
      const buildSideText = (allVals: GonioBySide) => {
        const parts: string[] = [];
        (["MSD", "MSI"] as const).forEach((side) => {
          const t = buildAllGonioText(allVals[side]);
          if (t) parts.push(`[${side}] ${t}`);
        });
        return parts.length > 0 ? parts.join(" ") : null;
      };
      const aromVal = showMovilidad ? buildSideText(allPreGonio) : null;
      const promVal = showMovilidad && showPostGonio ? buildSideText(allPostGonio) : null;
      const buildGonioBySideJson = (allVals: GonioBySide) => {
        const out: Record<string, any> = {};
        (["MSD", "MSI"] as const).forEach((side) => {
          const arr = buildAllGonioJsonArray(allVals[side]);
          if (arr) out[side] = arr;
        });
        return Object.keys(out).length > 0 ? out : null;
      };
      const preBySide = showMovilidad ? buildGonioBySideJson(allPreGonio) : null;
      const postBySide = showMovilidad && showPostGonio ? buildGonioBySideJson(allPostGonio) : null;
      let gonioJsonb: any = null;
      if (preBySide || postBySide) {
        gonioJsonb = {};
        (["MSD", "MSI"] as const).forEach((side) => {
          const pre = preBySide?.[side] || null;
          const post = postBySide?.[side] || null;
          if (pre || post) gonioJsonb[side] = { pre, post };
        });
      }

      const edemaCirc = showEdema && (circReference.trim() || circValueCm.trim())
        ? { reference: circReference.trim(), side: circSide, value_cm: circValueCm.trim() ? Number(circValueCm) : null, mano_global: circManoGlobal }
        : null;

      const hasTests = showPruebas && Object.values(specificTests).some(v => v !== null);
      const specificTestsJson = hasTests ? Object.fromEntries(Object.entries(specificTests).map(([k, v]) => [k, v])) : null;

      const buildDyn = (vals: [string, string, string]) => {
        const nums = vals.map(v => v.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));
        if (nums.length === 0) return null;
        const avg = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
        return { values: vals.map(v => (v.trim() ? Number(v) : null)), average: avg };
      };
      const dynMsdJson = showFuerza ? buildDyn(dynMsdVals) : null;
      const dynMsiJson = showFuerza ? buildDyn(dynMsiVals) : null;

      const msParts: string[] = [];
      if (showFuerza && fistClosure.trim()) msParts.push(`Cierre de puño: ${fistClosure}`);
      const msVal = msParts.length > 0 ? msParts.join(" — ") : null;

      // Daniels rows → JSON array
      const danielsFiltered = showFuerza
        ? danielsRows.filter(r => r.muscle.trim() && r.grade.trim()).map(r => ({ muscle: r.muscle.trim(), grade: r.grade }))
        : [];
      const danielsJson = danielsFiltered.length > 0 ? danielsFiltered : null;

      const kapandjiFinal = showMovilidad && kapandjiVal ? `${kapandjiVal}/10${kapandjiPain ? " con dolor" : ""}` : "";

      // Build scar_evaluation JSONB (only if Cicatriz on)
      const scarPlanillaEntries: [string, string][] = showCicatriz ? ([
        ["localizacion", scarLocalizacion],
        ["longitud_cm", scarLongitud],
        ["sensibilidad", scarSensibilidad],
        ["temperatura", scarTemperatura],
      ].filter(([, v]) => v && String(v).trim()) as [string, string][]) : [];

      const vssObj: Record<string, number> = {};
      if (showCicatriz && vssPigmentacion !== "") vssObj.pigmentacion = parseInt(vssPigmentacion);
      if (showCicatriz && vssVascularizacion !== "") vssObj.vascularizacion = parseInt(vssVascularizacion);
      if (showCicatriz && vssFlexibilidad !== "") vssObj.flexibilidad = parseInt(vssFlexibilidad);
      if (showCicatriz && vssAltura !== "") vssObj.altura = parseInt(vssAltura);
      const vssTotal = Object.values(vssObj).reduce((a, b) => a + b, 0);
      const hasVss = Object.keys(vssObj).length > 0;
      const scarEvalJson =
        scarPlanillaEntries.length > 0 || hasVss
          ? {
              ...Object.fromEntries(scarPlanillaEntries),
              ...(hasVss ? { vss: vssObj } : {}),
            }
          : null;

      const analFields = showAnalytical ? [
        showDolor && evaTouched ? String(painScore) : "",
        showDolor ? painAppearance : "", showDolor ? painLocation : "", showDolor ? painRadiation : "",
        showDolor ? painCharacteristics : "", showDolor ? painAggravating : "", showDolor ? painFree : "",
        showEdema ? edema : "", showEdema ? godetTest : "",
        kapandjiFinal, showMovilidad ? fistClosure : "",
        showFuerza && dynMsdJson ? String(dynMsdJson.average) : "", showFuerza && dynMsiJson ? String(dynMsiJson.average) : "",
        showFuerza && danielsFiltered.length > 0 ? danielsFiltered.map(r => `${r.muscle}: ${r.grade}`).join("; ") : "",
        showSensibilidad ? sensitivityTactoLigero : "", showSensibilidad ? sensitivityDosPuntos : "",
        showSensibilidad ? sensitivityPickingUp : "", showSensibilidad ? sensitivitySemmesWeinstein : "",
        showSensibilidad ? sensitivityTocoPincho : "", showSensibilidad ? sensitivityTemperatura : "",
        showSensibilidad ? sensitivity : "",
        showOtros ? trophicState : "",
        showCicatriz ? scarObservaciones : "",
        showOtros ? posture : "", showOtros ? emotionalState : "", showOtros ? analNotes : "",
        showFuerza ? dppdPulgar : "", showFuerza ? dppdIndice : "", showFuerza ? dppdMedio : "",
        showFuerza ? dppdAnular : "", showFuerza ? dppdMenique : "",
        showCicatriz ? scarLocalizacion : "", showCicatriz ? scarLongitud : "",
        showCicatriz ? scarVascularizacion : "", showCicatriz ? scarPigmentacion : "",
        showCicatriz ? scarFlexibilidad : "", showCicatriz ? scarSensibilidad : "",
        showCicatriz ? scarRelieve : "", showCicatriz ? scarTemperatura : "",
        showCicatriz ? vssPigmentacion : "", showCicatriz ? vssVascularizacion : "",
        showCicatriz ? vssFlexibilidad : "", showCicatriz ? vssAltura : "",
      ] : [];

      // DPPD fingers JSONB (Fuerza)
      const dppdEntries: [string, string][] = showFuerza ? ([
        ["pulgar", dppdPulgar], ["indice", dppdIndice], ["medio", dppdMedio],
        ["anular", dppdAnular], ["menique", dppdMenique],
      ].filter(([, v]) => v && v.trim()) as [string, string][]) : [];
      const dppdFingersJson = dppdEntries.length > 0
        ? Object.fromEntries(dppdEntries.map(([k, v]) => [k, parseFloat(v)]))
        : null;

      const hasStructured = aromVal || promVal || gonioJsonb || edemaCirc || specificTestsJson || dynMsdJson || dynMsiJson || dppdFingersJson;
      if (showAnalytical && (analFields.some((f) => f.trim()) || hasStructured || scarEvalJson !== null)) {
        await supabase.from("analytical_evaluations").insert({
          patient_id: pid,
          professional_id: user!.id,
          episode_id: episodeId,
          session_id: sessionId,
          evaluation_date: admissionDate,
          pain_score: showDolor && evaTouched ? painScore : null,
          pain_appearance: showDolor ? or(painAppearance) : null,
          pain_location: showDolor ? (() => {
            const base = painLocation || "";
            const extra = painRadiationChoice === "si" && painRadiation ? `Irradia a: ${painRadiation}` : "";
            const joined = [base, extra].filter(Boolean).join(" — ");
            return joined || null;
          })() : null,
          pain_radiation: showDolor ? (painRadiationChoice === "si"
            ? (painRadiation || null)
            : painRadiationChoice === "no"
              ? "No irradia"
              : null) : null,
          pain_characteristics: showDolor ? or(painCharacteristics) : null,
          pain_aggravating_factors: showDolor ? or(painAggravating) : null,
          pain: showDolor ? or(painFree) : null,
          edema: showEdema ? or(edema) : null,
          edema_circummetry: edemaCirc,
          godet_test: showEdema ? or(godetTest) : null,
          arom: aromVal,
          prom: promVal,
          goniometry: gonioJsonb,
          kapandji: showMovilidad ? or(kapandjiFinal) : null,
          dynamometer_msd: dynMsdJson as any,
          dynamometer_msi: dynMsiJson as any,
          muscle_strength: msVal,
          muscle_strength_median: null,
          muscle_strength_cubital: null,
          muscle_strength_radial: null,
          muscle_strength_daniels: danielsJson as any,
          specific_tests: specificTestsJson,
          dppd_fingers: dppdFingersJson,
          sensitivity: showSensibilidad ? or(sensitivity) : null,
          sensitivity_functional: null,
          sensitivity_protective: null,
          sensitivity_tacto_ligero: showSensibilidad ? or(sensitivityTactoLigero) : null,
          sensitivity_dos_puntos: showSensibilidad ? or(sensitivityDosPuntos) : null,
          sensitivity_picking_up: showSensibilidad ? or(sensitivityPickingUp) : null,
          sensitivity_semmes_weinstein: showSensibilidad ? or(sensitivitySemmesWeinstein) : null,
          sensitivity_toco_pincho: showSensibilidad ? or(sensitivityTocoPincho) : null,
          sensitivity_temperatura: showSensibilidad ? or(sensitivityTemperatura) : null,
          trophic_state: showOtros ? or(trophicState) : null,
          scar: showCicatriz ? or(scarObservaciones) : null,
          scar_evaluation: scarEvalJson,
          vancouver_score: hasVss ? vssTotal : null,
          osas_score: null,
          posture: showOtros ? or(posture) : null,
          emotional_state: showOtros ? or(emotionalState) : null,
          notes: showOtros ? or(analNotes) : null,
        });
      }

      toast.success("Paciente admitido correctamente");
      navigate(`/patients/${pid}`);
    } catch (err: any) {
      toast.error("Error al registrar la admisión", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const ErrMsg = ({ field }: { field: string }) =>
    errors[field] ? <p className="text-xs text-destructive" data-field-error>Campo obligatorio</p> : null;

  const GonioGrid = ({ partKey, values, setValues }: { partKey: GonioPartKey; values: Record<string, string>; setValues: (v: Record<string, string>) => void }) => {
    const fields = GONIO_PARTS[partKey].fields;
    return (
      <div className="grid grid-cols-3 gap-3">
        {fields.map(f => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label} °</Label>
            <Input
              type="number"
              placeholder={f.norm}
              value={values[f.key] || ""}
              onChange={e => setValues({ ...values, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
    );
  };

  const GonioPartSelector = ({ value, onChange }: { value: GonioPartKey; onChange: (v: GonioPartKey) => void }) => (
    <div className="flex flex-wrap gap-2 mb-3">
      {(Object.keys(GONIO_PARTS) as GonioPartKey[]).map(k => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            value === k
              ? "bg-primary text-primary-foreground border border-primary"
              : "border border-border text-muted-foreground bg-white hover:bg-muted/40"
          }`}
        >
          {GONIO_PARTS[k].label}
        </button>
      ))}
    </div>
  );

  const patientDisplay = `${firstName} ${lastName}`.trim() || "Nueva admisión";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-50 bg-card border-b border-border h-14">
        <div className="max-w-2xl mx-auto h-full px-6 flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/patients")} className="text-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-center text-sm font-semibold text-foreground truncate">
            {patientDisplay}
          </h1>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/85  rounded-lg">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar admisión
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {/* Card 1 — Datos del paciente */}
        <SectionCard icon={User} title="Datos del paciente">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Apellido</FieldLabel>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className={`${inputClass} ${fieldClass("lastName")}`} />
              <ErrMsg field="lastName" />
            </div>
            <div>
              <FieldLabel required>Nombre</FieldLabel>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={`${inputClass} ${fieldClass("firstName")}`} />
              <ErrMsg field="firstName" />
            </div>
            <div>
              <FieldLabel required>DNI</FieldLabel>
              <Input value={dni} onChange={(e) => setDni(e.target.value)} className={`${inputClass} ${fieldClass("dni")}`} />
              <ErrMsg field="dni" />
            </div>
            <div>
              <FieldLabel>Nacionalidad</FieldLabel>
              <Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Argentina, Uruguaya..." className={inputClass} />
            </div>
            <div>
              <FieldLabel>Fecha de nacimiento</FieldLabel>
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Teléfono</FieldLabel>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Domicilio</FieldLabel>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Obra social</FieldLabel>
              <ObrasSocialesAutocomplete value={insurance} onChange={setInsurance} placeholder="OSDE, Swiss Medical, PAMI..." className={inputClass} />
            </div>
            <div>
              <FieldLabel>Nº de afiliado</FieldLabel>
              <Input value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} placeholder="Número de afiliado" className={inputClass} />
            </div>
            <div>
              <FieldLabel required>Fecha de admisión</FieldLabel>
              <Input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={`${inputClass} ${fieldClass("admissionDate")}`} />
              <ErrMsg field="admissionDate" />
            </div>
          </div>
        </SectionCard>

        {/* Card 2 — Datos clínicos */}
        <SectionCard icon={FileText} title="Datos clínicos">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldLabel required>Diagnóstico</FieldLabel>
              <Cie10Autocomplete value={diagnosis} onChange={setDiagnosis} placeholder="Buscar por código o descripción CIE-10…" className={`${inputClass} ${fieldClass("diagnosis")}`} />
              <ErrMsg field="diagnosis" />
            </div>
            <div>
              <FieldLabel>Médico derivante</FieldLabel>
              <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Fecha de lesión</FieldLabel>
              <Input type="date" value={injuryDate} onChange={(e) => setInjuryDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Fecha de cirugía</FieldLabel>
              <Input type="date" value={surgeryDate} onChange={(e) => setSurgeryDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Tratamiento</FieldLabel>
              <Select value={treatmentType} onValueChange={setTreatmentType}>
                <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="conservative">Conservador</SelectItem>
                  <SelectItem value="surgery">Quirúrgico</SelectItem>
                  <SelectItem value="mixed">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Mecanismo de lesión</FieldLabel>
              <Textarea value={injuryMechanism} onChange={(e) => setInjuryMechanism(e.target.value)} rows={2} placeholder="Caída, accidente laboral..." className={textareaClass} />
            </div>
            <div>
              <FieldLabel>Semanas post lesión + Días</FieldLabel>
              <div className="flex gap-2">
                <Input type="number" min={0} value={weeksPostInjury} onChange={(e) => setWeeksPostInjury(e.target.value)} placeholder="Sem." className={`${inputClass} flex-1`} />
                <Input type="number" min={0} max={6} value={daysPostInjury} onChange={(e) => setDaysPostInjury(e.target.value)} placeholder="Días" className={`${inputClass} w-20`} />
              </div>
            </div>
            <div>
              <FieldLabel>Semanas post cirugía + Días</FieldLabel>
              <div className="flex gap-2">
                <Input type="number" min={0} value={weeksPostSurgery} onChange={(e) => setWeeksPostSurgery(e.target.value)} placeholder="Sem." className={`${inputClass} flex-1`} />
                <Input type="number" min={0} max={6} value={daysPostSurgery} onChange={(e) => setDaysPostSurgery(e.target.value)} placeholder="Días" className={`${inputClass} w-20`} />
              </div>
            </div>
            <div>
              <FieldLabel>Inmovilización + Días</FieldLabel>
              <div className="flex gap-2">
                <Input type="number" min={0} value={immobilizationWeeks} onChange={(e) => setImmobilizationWeeks(e.target.value)} placeholder="Sem." className={`${inputClass} flex-1`} />
                <Input type="number" min={0} max={6} value={immobilizationDays} onChange={(e) => setImmobilizationDays(e.target.value)} placeholder="Días" className={`${inputClass} w-20`} />
              </div>
            </div>
            <div>
              <FieldLabel>Tipo de inmovilización</FieldLabel>
              <Input value={immobilizationType} onChange={(e) => setImmobilizationType(e.target.value)} placeholder="Yeso, férula, vendaje..." className={inputClass} />
            </div>
            <div>
              <FieldLabel>Próx. turno OyT</FieldLabel>
              <Input type="date" value={nextOyt} onChange={(e) => setNextOyt(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Estudios</FieldLabel>
              <Textarea value={studies} onChange={(e) => setStudies(e.target.value)} rows={2} placeholder="Rx, RMN..." className={textareaClass} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Antecedentes personales</FieldLabel>
              <Textarea value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} rows={2} className={textareaClass} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Tto farmacológico</FieldLabel>
              <Textarea value={pharma} onChange={(e) => setPharma(e.target.value)} rows={2} className={textareaClass} />
            </div>
          </div>
        </SectionCard>

        {/* Card 3 — Perfil ocupacional */}
        <SectionCard icon={Briefcase} title="Perfil ocupacional" toggle={{ checked: showOccupational, onChange: setShowOccupational }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Lateralidad</FieldLabel>
              <Select value={dominance} onValueChange={setDominance}>
                <SelectTrigger className={`${inputClass} ${fieldClass("dominance")}`}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="right">Diestro/a</SelectItem>
                  <SelectItem value="left">Zurdo/a</SelectItem>
                  <SelectItem value="ambidextrous">Ambidiestro/a</SelectItem>
                </SelectContent>
              </Select>
              <ErrMsg field="dominance" />
            </div>
            <div>
              <FieldLabel>Red de apoyo</FieldLabel>
              <Input value={supportNetwork} onChange={(e) => setSupportNetwork(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Educación</FieldLabel>
              <Select value={education} onValueChange={setEducation}>
                <SelectTrigger className={inputClass}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="primario_incompleto">Primario incompleto</SelectItem>
                  <SelectItem value="primario_completo">Primario completo</SelectItem>
                  <SelectItem value="secundario_incompleto">Secundario incompleto</SelectItem>
                  <SelectItem value="secundario_completo">Secundario completo</SelectItem>
                  <SelectItem value="terciario_universitario">Terciario/Universitario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Trabajo</FieldLabel>
              <Input value={job} onChange={(e) => setJob(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Ocio</FieldLabel>
              <Input value={leisure} onChange={(e) => setLeisure(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Actividad física</FieldLabel>
              <Input value={physicalActivity} onChange={(e) => setPhysicalActivity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Sueño y descanso</FieldLabel>
              <Input value={sleepRest} onChange={(e) => setSleepRest(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel>Gestión de la salud</FieldLabel>
              <Input value={healthManagement} onChange={(e) => setHealthManagement(e.target.value)} className={inputClass} />
            </div>
          </div>
        </SectionCard>

        {/* Card 4 — Evaluación funcional */}
        <SectionCard icon={Activity} title="Evaluación funcional" toggle={{ checked: showFunctional, onChange: setShowFunctional }}>
          <div className="space-y-5">
            <QuickDashSection items={qdItems} onChange={setQdItems} />
            <FimSection items={fimItems} onChange={setFimItems} />
            <BarthelSection items={barthelItems} onChange={setBarthelItems} />
            <div>
              <FieldLabel required>AVD — Actividades de la vida diaria</FieldLabel>
              <Textarea value={avd} onChange={(e) => setAvd(e.target.value)} rows={3} placeholder="Dificultad para vestido, higiene personal..." className={`${textareaClass} ${fieldClass("avd")}`} />
              <ErrMsg field="avd" />
            </div>
            <div>
              <FieldLabel>AIVD — Actividades instrumentales</FieldLabel>
              <Textarea value={aivd} onChange={(e) => setAivd(e.target.value)} rows={3} placeholder="Dificultad para cocinar, escurrir trapos..." className={textareaClass} />
            </div>
          </div>
        </SectionCard>

        {/* Card 5 — Evaluación analítica */}
        <SectionCard
          icon={BarChart2}
          title="Evaluación analítica"
          action={(() => {
            const total =
              (vssPigmentacion ? parseInt(vssPigmentacion) : 0) +
              (vssVascularizacion ? parseInt(vssVascularizacion) : 0) +
              (vssFlexibilidad ? parseInt(vssFlexibilidad) : 0) +
              (vssAltura ? parseInt(vssAltura) : 0);
            return total > 0 ? (
              <Badge className="bg-primary/5 text-primary border border-primary/30 hover:bg-primary/5">
                VSS: {total}/15
              </Badge>
            ) : null;
          })()}
          toggle={{ checked: showAnalytical, onChange: setShowAnalytical }}
        >
          <div className="space-y-0">
            {/* Dolor */}
            <SubSection title="Dolor" checked={showDolor} onChange={setShowDolor} withDivider={false}>
              <div className="space-y-2">
                <Label>Aparición</Label>
                <Input value={painAppearance} onChange={(e) => setPainAppearance(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Localización</Label>
                <Input value={painLocation} onChange={(e) => setPainLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Irradiación</Label>
                <RadioGroup
                  value={painRadiationChoice}
                  onValueChange={(v) => {
                    const val = v as "no" | "si";
                    setPainRadiationChoice(val);
                    if (val === "no") setPainRadiation("");
                  }}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="pain-rad-no-np" />
                    <Label htmlFor="pain-rad-no-np" className="font-normal cursor-pointer">No irradia</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="si" id="pain-rad-si-np" />
                    <Label htmlFor="pain-rad-si-np" className="font-normal cursor-pointer">Sí irradia</Label>
                  </div>
                </RadioGroup>
                {painRadiationChoice === "si" && (
                  <div className="space-y-1 mt-2">
                    <Label className="font-normal">¿Hacia dónde?</Label>
                    <Input value={painRadiation} onChange={(e) => setPainRadiation(e.target.value)} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Características</Label>
                <Input value={painCharacteristics} onChange={(e) => setPainCharacteristics(e.target.value)} placeholder="punzante, urente, opresivo..." />
              </div>
              <div className="space-y-2">
                <FieldLabel required>Intensidad EVA (0-10)</FieldLabel>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 py-2">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 pointer-events-none" />
                    <Slider
                      min={0} max={10} step={1}
                      value={[painScore]}
                      onValueChange={(v) => { setPainScore(v[0]); setEvaTouched(true); }}
                      className={`relative [&_[data-orientation=horizontal]]:bg-transparent [&_[role=slider]]:border-primary [&_[role=slider]]:bg-white [&>span:first-child>span]:bg-transparent ${fieldClass("painScore")}`}
                    />
                  </div>
                  <span className={`text-sm font-bold rounded-md min-w-[2.5rem] text-center px-2 py-1 ${
                    painScore <= 3 ? "bg-green-100 text-green-700" :
                    painScore <= 6 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>{painScore}</span>
                </div>
                <ErrMsg field="painScore" />
              </div>
              <div className="space-y-2">
                <Label>Agravantes / Atenuantes</Label>
                <Textarea value={painAggravating} onChange={(e) => setPainAggravating(e.target.value)} rows={2} />
              </div>
            </SubSection>

            {/* Edema */}
            <SubSection title="Edema" checked={showEdema} onChange={setShowEdema}>
              <div className="space-y-2">
                <Label>Observación de edema</Label>
                <Textarea value={edema} onChange={(e) => setEdema(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Test de Godet</Label>
                <Select value={godetTest} onValueChange={setGodetTest}>
                  <SelectTrigger><SelectValue placeholder="No evaluado" /></SelectTrigger>
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
              <h4 className="text-xs font-medium text-muted-foreground mt-2">Circometría</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Reparo anatómico de referencia</Label>
                  <Input value={circReference} onChange={e => setCircReference(e.target.value)} placeholder="ej: articulación MCF, tercio distal antebrazo" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Lado</Label>
                    <RadioGroup value={circSide} onValueChange={(v) => setCircSide(v as "D" | "I")} className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="D" id="circ-d-np" /> Derecho</label>
                      <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="I" id="circ-i-np" /> Izquierdo</label>
                    </RadioGroup>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor (cm)</Label>
                    <Input type="number" step="0.1" value={circValueCm} onChange={e => setCircValueCm(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={circManoGlobal} onCheckedChange={setCircManoGlobal} />
                  <Label className="font-normal text-sm">Mano global</Label>
                </div>
              </div>
            </SubSection>

            {/* Movilidad */}
            <SubSection title="Movilidad" checked={showMovilidad} onChange={setShowMovilidad}>
              <Tabs value={gonioSide} onValueChange={(v) => { setGonioSide(v as "MSD" | "MSI"); setGonioSidePost(v as "MSD" | "MSI"); }} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="MSD">MSD</TabsTrigger>
                  <TabsTrigger value="MSI">MSI</TabsTrigger>
                </TabsList>
              </Tabs>
              <h4 className="text-xs font-medium text-muted-foreground">Goniometría PRE — {gonioSide}</h4>
              <GonioPartSelector value={gonioPart} onChange={setGonioPart} />
              <GonioGrid
                partKey={gonioPart}
                values={allPreGonio[gonioSide][gonioPart]}
                setValues={(v) => setAllPreGonio((prev) => ({ ...prev, [gonioSide]: { ...prev[gonioSide], [gonioPart]: v } }))}
              />

              <div className="flex items-center gap-2 mt-3">
                <Checkbox checked={showPostGonio} onCheckedChange={v => setShowPostGonio(!!v)} />
                <Label className="font-normal text-sm">Registrar goniometría POST</Label>
              </div>
              {showPostGonio && (
                <>
                  <h4 className="text-xs font-medium text-muted-foreground">Goniometría POST — {gonioSide}</h4>
                  <GonioPartSelector value={gonioPartPost} onChange={setGonioPartPost} />
                  <GonioGrid
                    partKey={gonioPartPost}
                    values={allPostGonio[gonioSide][gonioPartPost]}
                    setValues={(v) => setAllPostGonio((prev) => ({ ...prev, [gonioSide]: { ...prev[gonioSide], [gonioPartPost]: v } }))}
                  />
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div className="space-y-2">
                  <Label>Kapandji (0-10)</Label>
                  <div className="flex items-end gap-3">
                    <Input className="flex-1" type="number" min={0} max={10} value={kapandjiVal} onChange={(e) => setKapandjiVal(e.target.value)} />
                    <div className="flex items-center gap-2 pb-2">
                      <Checkbox checked={kapandjiPain} onCheckedChange={(v) => setKapandjiPain(!!v)} />
                      <Label className="font-normal text-sm">Con dolor</Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cierre de puño</Label>
                  <Input value={fistClosure} onChange={(e) => setFistClosure(e.target.value)} placeholder="Completo / Incompleto con tirantez" />
                </div>
              </div>
            </SubSection>

            {/* Fuerza */}
            <SubSection title="Fuerza muscular" checked={showFuerza} onChange={setShowFuerza}>
              {(["MSD", "MSI"] as const).map((side) => {
                const vals = side === "MSD" ? dynMsdVals : dynMsiVals;
                const setVals = side === "MSD" ? setDynMsdVals : setDynMsiVals;
                const nums = vals.map(v => v.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));
                const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "";
                return (
                  <div key={side} className="space-y-2">
                    <Label>Dinamómetro {side} (kgf)</Label>
                    <div className="grid grid-cols-4 gap-2">
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
              <div className="space-y-2">
                <Label>DPPD (cm) — distancia pulpejo-pliegue distal</Label>
                <div className="grid grid-cols-5 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Pulgar</Label><Input type="number" step="0.1" value={dppdPulgar} onChange={e => setDppdPulgar(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Índice</Label><Input type="number" step="0.1" value={dppdIndice} onChange={e => setDppdIndice(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Medio</Label><Input type="number" step="0.1" value={dppdMedio} onChange={e => setDppdMedio(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Anular</Label><Input type="number" step="0.1" value={dppdAnular} onChange={e => setDppdAnular(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Meñique</Label><Input type="number" step="0.1" value={dppdMenique} onChange={e => setDppdMenique(e.target.value)} /></div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fuerza muscular (Daniels) — Músculos evaluados</Label>
                <div className="space-y-2">
                  {danielsRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <Input
                        value={row.muscle}
                        onChange={(ev) =>
                          setDanielsRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, muscle: ev.target.value } : r)))
                        }
                        placeholder="Ej: Flexores de hombro"
                        className="flex-1"
                      />
                      <select
                        value={row.grade}
                        onChange={(ev) =>
                          setDanielsRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, grade: ev.target.value } : r)))
                        }
                        className="w-24 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <SubSection title="Sensibilidad" checked={showSensibilidad} onChange={setShowSensibilidad}>
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Epicrítica (funcional)</p>
                <div className="space-y-2"><Label className="text-xs">Tacto ligero</Label><Textarea rows={2} value={sensitivityTactoLigero} onChange={(e) => setSensitivityTactoLigero(e.target.value)} /></div>
                <div className="space-y-2"><Label className="text-xs">Discriminación 2 puntos</Label><Textarea rows={2} value={sensitivityDosPuntos} onChange={(e) => setSensitivityDosPuntos(e.target.value)} /></div>
                <div className="space-y-2"><Label className="text-xs">Picking up test</Label><Textarea rows={2} value={sensitivityPickingUp} onChange={(e) => setSensitivityPickingUp(e.target.value)} /></div>
                <div className="space-y-2"><Label className="text-xs">Semmes-Weinstein</Label><Textarea rows={2} value={sensitivitySemmesWeinstein} onChange={(e) => setSensitivitySemmesWeinstein(e.target.value)} /></div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Protopática (protectora)</p>
                <div className="space-y-2"><Label className="text-xs">Toco-pincho</Label><Textarea rows={2} value={sensitivityTocoPincho} onChange={(e) => setSensitivityTocoPincho(e.target.value)} /></div>
                <div className="space-y-2"><Label className="text-xs">Temperatura frío-calor</Label><Textarea rows={2} value={sensitivityTemperatura} onChange={(e) => setSensitivityTemperatura(e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label>Observaciones de sensibilidad</Label>
                <Textarea value={sensitivity} onChange={(e) => setSensitivity(e.target.value)} rows={2} />
              </div>

            </SubSection>

            {/* Cicatriz */}
            <SubSection title="Cicatriz" checked={showCicatriz} onChange={setShowCicatriz}>
              <div className="space-y-4 rounded-md border border-border p-3">
                {/* Sub-sección A — Planilla */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Localización</Label>
                      <Input value={scarLocalizacion} onChange={(e) => setScarLocalizacion(e.target.value)} placeholder={SCAR_PLACEHOLDER} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Longitud (cm)</Label>
                      <Input type="number" step="0.1" min={0} value={scarLongitud} onChange={(e) => setScarLongitud(e.target.value)} placeholder={SCAR_PLACEHOLDER} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sensibilidad</Label>
                      <Select value={scarSensibilidad} onValueChange={setScarSensibilidad}>
                        <SelectTrigger><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                        <SelectContent position="popper">
                          {SCAR_OPTIONS.sensibilidad.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Temperatura</Label>
                      <Select value={scarTemperatura} onValueChange={setScarTemperatura}>
                        <SelectTrigger><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                        <SelectContent position="popper">
                          {SCAR_OPTIONS.temperatura.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observaciones / Impresión estética</Label>
                    <Textarea rows={2} value={scarObservaciones} onChange={(e) => setScarObservaciones(e.target.value)} />
                  </div>
                </div>

                {/* Sub-sección B — Vancouver VSS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Escala Vancouver VSS</p>
                    <Badge variant="secondary">
                      Total VSS: {
                        (vssPigmentacion ? parseInt(vssPigmentacion) : 0) +
                        (vssVascularizacion ? parseInt(vssVascularizacion) : 0) +
                        (vssFlexibilidad ? parseInt(vssFlexibilidad) : 0) +
                        (vssAltura ? parseInt(vssAltura) : 0)
                      }/15
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Pigmentación</Label>
                      <Select value={vssPigmentacion} onValueChange={setVssPigmentacion}>
                        <SelectTrigger><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                        <SelectContent position="popper">
                          {VSS_OPTIONS.pigmentacion.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vascularización</Label>
                      <Select value={vssVascularizacion} onValueChange={setVssVascularizacion}>
                        <SelectTrigger><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                        <SelectContent position="popper">
                          {VSS_OPTIONS.vascularizacion.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Flexibilidad</Label>
                      <Select value={vssFlexibilidad} onValueChange={setVssFlexibilidad}>
                        <SelectTrigger><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                        <SelectContent position="popper">
                          {VSS_OPTIONS.flexibilidad.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Altura</Label>
                      <Select value={vssAltura} onValueChange={setVssAltura}>
                        <SelectTrigger><SelectValue placeholder={SCAR_PLACEHOLDER} /></SelectTrigger>
                        <SelectContent position="popper">
                          {VSS_OPTIONS.altura.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </SubSection>

            {/* Pruebas específicas */}
            <SubSection title="Pruebas específicas" checked={showPruebas} onChange={setShowPruebas}>
              <div className="flex flex-wrap gap-2">
                {SPECIFIC_TESTS.map(t => {
                  const val = specificTests[t.key];
                  const base = "h-9 px-3 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5";
                  const cls = val === "positive"
                    ? "bg-red-50 border-red-400 text-red-700 hover:bg-red-100"
                    : val === "negative"
                      ? "bg-green-50 border-green-400 text-green-700 hover:bg-green-100"
                      : "border-border text-muted-foreground bg-white hover:bg-muted/40";
                  return (
                    <button key={t.key} type="button" className={`${base} ${cls}`} onClick={() => cycleTest(t.key)}>
                      {t.label}
                      {val === "positive" && <span className="font-bold">+</span>}
                      {val === "negative" && <span className="font-bold">−</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Clic para alternar: sin evaluar → positivo (+) → negativo (−)</p>
            </SubSection>

            {/* Otros */}
            <SubSection title="Otros" checked={showOtros} onChange={setShowOtros}>
              <div className="space-y-2">
                <Label>Estado trófico</Label>
                <Textarea value={trophicState} onChange={(e) => setTrophicState(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Postura</Label>
                <Textarea value={posture} onChange={(e) => setPosture(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Emotividad</Label>
                <Textarea value={emotionalState} onChange={(e) => setEmotionalState(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={analNotes} onChange={(e) => setAnalNotes(e.target.value)} rows={2} />
              </div>
            </SubSection>
          </div>
        </SectionCard>

        {/* Card 6 — Intervenciones de admisión */}
        <SectionCard icon={ClipboardList} title="Intervenciones de admisión">
          <div className="space-y-4">
            <div>
              <FieldLabel required>Intervenciones</FieldLabel>
              <Textarea value={interventions} onChange={(e) => setInterventions(e.target.value)} rows={5} placeholder="Se brindan estrategias no farmacológicas para el dolor..." className={`${textareaClass} ${fieldClass("interventions")}`} />
              <ErrMsg field="interventions" />
            </div>
            <div>
              <FieldLabel>Indicaciones enviadas al paciente</FieldLabel>
              <Textarea value={homeInstructions} onChange={(e) => setHomeInstructions(e.target.value)} rows={3} className={textareaClass} />
            </div>
            <div>
              <FieldLabel>Notas internas</FieldLabel>
              <Textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={2} className={textareaClass} />
              <p className="text-xs text-muted-foreground mt-1">Campo interno — no se muestra en el resumen clínico</p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate("/patients")} className="text-muted-foreground hover:bg-muted">
            Descartar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/85  rounded-lg px-6">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar admisión
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NewPatientForm;
