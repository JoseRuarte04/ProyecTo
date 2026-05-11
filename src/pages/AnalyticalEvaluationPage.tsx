import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { EDEMA_POINTS, isNewEdemaFormat, normalizeEdemaValue, isCircometriaFormat, normalizeCircometriaValue } from "@/components/clinical/EdemaCircometryTable";

const NA = () => <span className="text-muted-foreground italic text-sm">No registrado</span>;

function DataCell({ label, value, unit }: { label: string; value: any; unit?: string }) {
  const hasValue = value != null && value !== "";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {hasValue ? (
        <span className="text-sm font-medium text-foreground">
          {value}{unit ? <span className="text-xs text-muted-foreground ml-0.5">{unit}</span> : null}
        </span>
      ) : (
        <NA />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}

export default function AnalyticalEvaluationPage() {
  const { patientId, evalId } = useParams<{ patientId: string; evalId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [evalData, setEvalData] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!evalId || !patientId || !user) return;
    const load = async () => {
      setLoading(true);
      const { data: ev } = await supabase
        .from("analytical_evaluations")
        .select("*")
        .eq("id", evalId)
        .eq("professional_id", user.id)
        .maybeSingle();

      if (!ev) { setNotFound(true); setLoading(false); return; }
      setEvalData(ev);

      const [sessionRes, patientRes] = await Promise.all([
        ev.session_id
          ? supabase.from("therapy_sessions").select("session_number, session_date, session_type").eq("id", ev.session_id).eq("professional_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("patients").select("first_name, last_name").eq("id", patientId).eq("professional_id", user.id).maybeSingle(),
      ]);

      setSession(sessionRes.data);
      setPatient(patientRes.data);
      setLoading(false);
    };
    load();
  }, [evalId, patientId, user]);

  const nn = (v: any) => v != null && v !== "";

  // ── Goniometría — tablas por articulación ──
  type MovRow = { mov: string; msdPre: number | null; msdPost: number | null; msiPre: number | null; msiPost: number | null };
  type JointTable = { joint: string; rows: MovRow[] };

  const JOINT_CONFIG_A = [
    { key: "shoulder", label: "Hombro", movements: [
      { key: "flex", label: "Flexión" }, { key: "ext", label: "Extensión" },
      { key: "add", label: "Aducción" }, { key: "abd", label: "Abducción" },
      { key: "rot_ext", label: "Rot. Externa" }, { key: "rot_int", label: "Rot. Interna" },
    ]},
    { key: "elbow", label: "Codo", movements: [
      { key: "flex", label: "Flexión" }, { key: "ext", label: "Extensión" },
      { key: "prono", label: "Pronación" }, { key: "supino", label: "Supinación" },
    ]},
    { key: "wrist", label: "Muñeca", movements: [
      { key: "flex", label: "Flexión" }, { key: "ext", label: "Extensión" },
      { key: "dr", label: "Desv. Radial" }, { key: "dc", label: "Desv. Cubital" },
      { key: "prono", label: "Pronación" }, { key: "supino", label: "Supinación" },
    ]},
    { key: "hand", label: "Mano", movements: [
      { key: "mcf_flex", label: "MCF Flex" }, { key: "mcf_ext", label: "MCF Ext" },
      { key: "ifp_flex", label: "IFP Flex" }, { key: "ifp_ext", label: "IFP Ext" },
      { key: "ifd_flex", label: "IFD Flex" }, { key: "ifd_ext", label: "IFD Ext" },
    ]},
    { key: "thumb", label: "Pulgar", movements: [
      { key: "mcf_flex", label: "MCF Flex" }, { key: "mcf_ext", label: "MCF Ext" },
      { key: "if_flex", label: "IF Flex" }, { key: "if_ext", label: "IF Ext" },
    ]},
  ];

  const GONIO_B_FIELD: Record<string, string> = {
    flexion: "Flexión", extension: "Extensión", abduccion: "Abducción", aduccion: "Aducción",
    rot_ext: "Rot. Externa", rot_int: "Rot. Interna", pronacion: "Pronación", supinacion: "Supinación",
    desv_radial: "Desv. Radial", desv_cubital: "Desv. Cubital",
    mcf_flex: "MCF1 Flex", mcf_ext: "MCF1 Ext", mcf2_flex: "MCF2 Flex", mcf2_ext: "MCF2 Ext",
    mcf3_flex: "MCF3 Flex", mcf3_ext: "MCF3 Ext", mcf4_flex: "MCF4 Flex", mcf4_ext: "MCF4 Ext",
    ifp_flex: "IFP Flex", ifp_ext: "IFP Ext", ifd_flex: "IFD Flex", ifd_ext: "IFD Ext",
    pulgar_mcf_flex: "MCF Flex", pulgar_mcf_ext: "MCF Ext", pulgar_if_flex: "IF Flex", pulgar_if_ext: "IF Ext",
  };

  const GONIO_B_PREFIXES = [
    { prefix: "hombro_", joint: "Hombro" }, { prefix: "codo_", joint: "Codo" },
    { prefix: "muñeca_", joint: "Muñeca" },
    { prefix: "mano_mcf_", joint: "Mano" }, { prefix: "mano_ifp_", joint: "Mano" }, { prefix: "mano_ifd_", joint: "Mano" },
    { prefix: "pulgar_mcf_", joint: "Pulgar" }, { prefix: "pulgar_if_", joint: "Pulgar" },
  ];

  const getPartVals = (arr: any[], bodyPart: string): Record<string, number> => {
    if (!Array.isArray(arr)) return {};
    const item = arr.find((a: any) => a?.body_part === bodyPart);
    return item?.values || {};
  };

  const flatToJointMap = (obj: any): Record<string, Record<string, number | null>> => {
    const r: Record<string, Record<string, number | null>> = {};
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return r;
    for (const [k, v] of Object.entries(obj)) {
      const match = GONIO_B_PREFIXES.find(p => k.startsWith(p.prefix));
      if (!match) continue;
      const field = k.slice(match.prefix.length);
      const label = GONIO_B_FIELD[field] || field;
      if (!r[match.joint]) r[match.joint] = {};
      r[match.joint][label] = v != null && v !== "" ? Number(v) : null;
    }
    return r;
  };

  const parseGonioHalf = (half: any): JointTable[] => {
    if (!half || typeof half !== "object") return [];
    const msd = half.MSD, msi = half.MSI;

    // Format A: MSD/MSI are arrays of { body_part, values } (SessionForm)
    if (Array.isArray(msd) || Array.isArray(msi)) {
      const tables: JointTable[] = [];
      for (const part of JOINT_CONFIG_A) {
        const pp = getPartVals(msd, part.key);
        const rp = getPartVals(msi, part.key);
        const rows: MovRow[] = [];
        for (const m of part.movements) {
          const a = pp[m.key] != null ? Number(pp[m.key]) : null;
          const c = rp[m.key] != null ? Number(rp[m.key]) : null;
          if (a != null || c != null)
            rows.push({ mov: m.label, msdPre: a, msdPost: null, msiPre: c, msiPost: null });
        }
        if (rows.length > 0) tables.push({ joint: part.label, rows });
      }
      return tables;
    }

    // New Format B with pre/post: { MSD: { pre: flat, post: flat }, MSI: { ... } } (AnalyticalEvalForm)
    const msdHasPrePost = msd && typeof msd === "object" && !Array.isArray(msd) && ("pre" in msd || "post" in msd);
    const msiHasPrePost = msi && typeof msi === "object" && !Array.isArray(msi) && ("pre" in msi || "post" in msi);
    if (msdHasPrePost || msiHasPrePost) {
      const JOINT_ORDER = ["Hombro", "Codo", "Muñeca", "Mano", "Pulgar"];
      const mpMap = flatToJointMap(msd?.pre), mqMap = flatToJointMap(msd?.post);
      const rpMap = flatToJointMap(msi?.pre), rqMap = flatToJointMap(msi?.post);
      const allJoints = new Set([...Object.keys(mpMap), ...Object.keys(mqMap), ...Object.keys(rpMap), ...Object.keys(rqMap)]);
      const tables: JointTable[] = [];
      for (const joint of JOINT_ORDER) {
        if (!allJoints.has(joint)) continue;
        const allLabels = new Set([
          ...Object.keys(mpMap[joint] || {}), ...Object.keys(mqMap[joint] || {}),
          ...Object.keys(rpMap[joint] || {}), ...Object.keys(rqMap[joint] || {}),
        ]);
        const rows: MovRow[] = [];
        for (const label of allLabels) {
          const a = (mpMap[joint] || {})[label] ?? null;
          const b = (mqMap[joint] || {})[label] ?? null;
          const c = (rpMap[joint] || {})[label] ?? null;
          const d = (rqMap[joint] || {})[label] ?? null;
          if (a != null || b != null || c != null || d != null)
            rows.push({ mov: label, msdPre: a, msdPost: b, msiPre: c, msiPost: d });
        }
        if (rows.length > 0) tables.push({ joint, rows });
      }
      return tables;
    }

    // Old Format B: { MSD: flat, MSI: flat } (AnalyticalEvalForm before redesign)
    if ((msd && typeof msd === "object") || (msi && typeof msi === "object")) {
      const JOINT_ORDER = ["Hombro", "Codo", "Muñeca", "Mano", "Pulgar"];
      const mpMap = flatToJointMap(msd), rpMap = flatToJointMap(msi);
      const allJoints = new Set([...Object.keys(mpMap), ...Object.keys(rpMap)]);
      const tables: JointTable[] = [];
      for (const joint of JOINT_ORDER) {
        if (!allJoints.has(joint)) continue;
        const allLabels = new Set([...Object.keys(mpMap[joint] || {}), ...Object.keys(rpMap[joint] || {})]);
        const rows: MovRow[] = [];
        for (const label of allLabels) {
          const a = (mpMap[joint] || {})[label] ?? null;
          const c = (rpMap[joint] || {})[label] ?? null;
          if (a != null || c != null)
            rows.push({ mov: label, msdPre: a, msdPost: null, msiPre: c, msiPost: null });
        }
        if (rows.length > 0) tables.push({ joint, rows });
      }
      return tables;
    }

    return [];
  };

  const parseGoniometry = (g: any): { arom: JointTable[], prom: JointTable[] } => {
    if (!g || typeof g !== "object") return { arom: [], prom: [] };

    if (g.arom !== undefined || g.prom !== undefined) {
      return { arom: parseGonioHalf(g.arom), prom: parseGonioHalf(g.prom) };
    }

    const msd = g.MSD || {};
    const msi = g.MSI || {};
    const msdPre = msd.pre, msdPost = msd.post, msiPre = msi.pre, msiPost = msi.post;

    // Format A: pre is array of { body_part, values }
    if (Array.isArray(msdPre) || Array.isArray(msiPre)) {
      const tables: JointTable[] = [];
      for (const part of JOINT_CONFIG_A) {
        const pp = getPartVals(msdPre, part.key);
        const pq = getPartVals(msdPost, part.key);
        const rp = getPartVals(msiPre, part.key);
        const rq = getPartVals(msiPost, part.key);
        const rows: MovRow[] = [];
        for (const m of part.movements) {
          const a = pp[m.key] != null ? Number(pp[m.key]) : null;
          const b = pq[m.key] != null ? Number(pq[m.key]) : null;
          const c = rp[m.key] != null ? Number(rp[m.key]) : null;
          const d = rq[m.key] != null ? Number(rq[m.key]) : null;
          if (a != null || b != null || c != null || d != null)
            rows.push({ mov: m.label, msdPre: a, msdPost: b, msiPre: c, msiPost: d });
        }
        if (rows.length > 0) tables.push({ joint: part.label, rows });
      }
      return { arom: tables, prom: [] };
    }

    // Format B: pre is flat object with prefixed keys
    if ((msdPre && typeof msdPre === "object") || (msiPre && typeof msiPre === "object")) {
      const JOINT_ORDER = ["Hombro", "Codo", "Muñeca", "Mano", "Pulgar"];
      const mpMap = flatToJointMap(msdPre), mqMap = flatToJointMap(msdPost);
      const rpMap = flatToJointMap(msiPre), rqMap = flatToJointMap(msiPost);
      const allJoints = new Set([...Object.keys(mpMap), ...Object.keys(mqMap), ...Object.keys(rpMap), ...Object.keys(rqMap)]);
      const tables: JointTable[] = [];
      for (const joint of JOINT_ORDER) {
        if (!allJoints.has(joint)) continue;
        const allLabels = new Set([
          ...Object.keys(mpMap[joint] || {}), ...Object.keys(mqMap[joint] || {}),
          ...Object.keys(rpMap[joint] || {}), ...Object.keys(rqMap[joint] || {}),
        ]);
        const rows: MovRow[] = [];
        for (const label of allLabels) {
          const a = (mpMap[joint] || {})[label] ?? null;
          const b = (mqMap[joint] || {})[label] ?? null;
          const c = (rpMap[joint] || {})[label] ?? null;
          const d = (rqMap[joint] || {})[label] ?? null;
          if (a != null || b != null || c != null || d != null)
            rows.push({ mov: label, msdPre: a, msdPost: b, msiPre: c, msiPost: d });
        }
        if (rows.length > 0) tables.push({ joint, rows });
      }
      return { arom: tables, prom: [] };
    }

    return { arom: [], prom: [] };
  };

  const renderGonioTables = (tables: JointTable[]) => {
    if (tables.length === 0) return null;
    const hasPost = tables.some(t => t.rows.some(r => r.msdPost != null || r.msiPost != null));
    return (
      <div className="space-y-5">
        {tables.map(({ joint, rows }) => (
          <div key={joint}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{joint}</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-muted-foreground font-medium pb-1.5 pr-3 min-w-[110px]">Movimiento</th>
                    <th className="text-center text-muted-foreground font-medium pb-1.5 px-2">{hasPost ? "MSD PRE" : "MSD"}</th>
                    {hasPost && <th className="text-center text-muted-foreground font-medium pb-1.5 px-2">MSD POST</th>}
                    <th className="text-center text-muted-foreground font-medium pb-1.5 px-2">{hasPost ? "MSI PRE" : "MSI"}</th>
                    {hasPost && <th className="text-center text-muted-foreground font-medium pb-1.5 px-2">MSI POST</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-border/30">
                      <td className="py-1 pr-3 text-foreground font-medium">{row.mov}</td>
                      <td className="py-1 px-2 text-center text-foreground">{row.msdPre != null ? `${row.msdPre}°` : "—"}</td>
                      {hasPost && <td className="py-1 px-2 text-center text-foreground">{row.msdPost != null ? `${row.msdPost}°` : "—"}</td>}
                      <td className="py-1 px-2 text-center text-foreground">{row.msiPre != null ? `${row.msiPre}°` : "—"}</td>
                      {hasPost && <td className="py-1 px-2 text-center text-foreground">{row.msiPost != null ? `${row.msiPost}°` : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Daniels ──
  const renderDaniels = (d: any) => {
    if (!d || typeof d !== "object") return null;
    let arr: { muscle: string; grade: any }[] = [];
    if (Array.isArray(d)) arr = d;
    else if (Array.isArray(d.muscles)) arr = d.muscles;
    if (arr.length === 0) return null;
    return (
      <div className="space-y-1.5">
        {arr.map((r, i) => (
          <p key={i} className="text-sm text-foreground">
            <span className="font-medium">{r.muscle}</span>
            <span className="text-muted-foreground"> · </span>
            <span>{r.grade != null ? `${r.grade}/5` : "—"}</span>
          </p>
        ))}
      </div>
    );
  };

  // ── Edema ──
  const renderEdema = (edema: any) => {
    if (isCircometriaFormat(edema)) {
      const items = normalizeCircometriaValue(edema);
      if (items.length === 0) return null;
      return (
        <div className="overflow-x-auto">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-muted-foreground font-medium pb-1 pr-4">Reparo anatómico</th>
                <th className="text-center text-muted-foreground font-medium pb-1 px-2">MSD (cm)</th>
                <th className="text-center text-muted-foreground font-medium pb-1 px-2">MSI (cm)</th>
                <th className="text-center text-muted-foreground font-medium pb-1 px-2">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const d = parseFloat(item.msd), s = parseFloat(item.msi);
                const dif = !isNaN(d) && !isNaN(s) ? `${(s - d) >= 0 ? "+" : ""}${(s - d).toFixed(1)}` : "—";
                return (
                  <tr key={i} className="border-t border-border/30">
                    <td className="py-1 pr-4 text-foreground">{item.reparo || "—"}</td>
                    <td className="py-1 px-2 text-center text-foreground">{item.msd ? `${item.msd}` : "—"}</td>
                    <td className="py-1 px-2 text-center text-foreground">{item.msi ? `${item.msi}` : "—"}</td>
                    <td className="py-1 px-2 text-center text-foreground">{dif}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }
    if (isNewEdemaFormat(edema)) {
      const { sano, afectado } = normalizeEdemaValue(edema);
      const hasAny = EDEMA_POINTS.some(({ key }) => sano[key] != null || afectado[key] != null);
      if (!hasAny) return null;
      return (
        <div className="overflow-x-auto">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-muted-foreground font-medium pb-1 pr-4">Punto</th>
                <th className="text-center text-muted-foreground font-medium pb-1 px-2">Sano (cm)</th>
                <th className="text-center text-muted-foreground font-medium pb-1 px-2">Afectado (cm)</th>
              </tr>
            </thead>
            <tbody>
              {EDEMA_POINTS.map(({ key, label }) => {
                const s = sano[key];
                const a = afectado[key];
                if (s == null && a == null) return null;
                return (
                  <tr key={key} className="border-t border-border/30">
                    <td className="py-1 pr-4 text-foreground">{label}</td>
                    <td className="py-1 px-2 text-center text-foreground">{s ?? "—"}</td>
                    <td className="py-1 px-2 text-center text-foreground">{a ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }
    if (edema && typeof edema === "string" && edema.trim()) {
      return <p className="text-sm text-foreground whitespace-pre-wrap">{edema}</p>;
    }
    return null;
  };

  // ── Pruebas específicas ──
  const renderSpecificTests = (tests: any) => {
    if (!tests || typeof tests !== "object") return null;
    const filled = Object.entries(tests).filter(([, v]) => nn(v));
    if (filled.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {filled.map(([name, result]) => (
          <span
            key={name}
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium border",
              result === "positive"
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-green-50 text-green-700 border-green-200"
            )}
          >
            {name} {result === "positive" ? "+" : "−"}
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (notFound || !evalData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">Evaluación no encontrada.</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
      </div>
    );
  }

  const e = evalData;
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "";
  const evalDate = e.evaluation_date ? format(new Date(e.evaluation_date), "dd 'de' MMMM yyyy", { locale: es }) : "";
  const sessionLabel = session?.session_number != null ? `Sesión Nº ${session.session_number}` : "";

  const displayLocation = e.pain_location
    ? e.pain_location.replace(/\s*[—\-–]\s*Irradia a:.*$/i, "").trim() || null
    : null;

  const gonioResult = parseGoniometry(e.goniometry);
  const isNewGonioFormat = e.goniometry && (e.goniometry.arom !== undefined || e.goniometry.prom !== undefined);
  const hasGonioTables = gonioResult.arom.length > 0 || gonioResult.prom.length > 0;
  const fistClosure = e.muscle_strength
    ? (e.muscle_strength.match(/Cierre de pu[ñn]o:\s*([^—\n]+)/i)?.[1]?.trim() || null)
    : null;
  const danielsNode = renderDaniels(e.muscle_strength_daniels);
  const edemaObservation = (typeof e.edema === "string" && e.edema?.trim() && !isNewEdemaFormat(e.edema)) ? e.edema : null;
  const edemaNode = renderEdema(e.edema_circummetry ?? (isNewEdemaFormat(e.edema) ? e.edema : null));
  const testsNode = renderSpecificTests(e.specific_tests);

  const hasDyn = !!(e.dynamometer_msd || e.dynamometer_msi);
  const hasDppd = !!(e.dppd_fingers && typeof e.dppd_fingers === "object"
    && Object.values(e.dppd_fingers as Record<string, any>).some((v: any) => v != null));
  const hasStrength = hasDyn || hasDppd || danielsNode
    || nn(e.muscle_strength_median) || nn(e.muscle_strength_cubital) || nn(e.muscle_strength_radial);
  const hasEdema = edemaObservation || nn(e.godet_test) || edemaNode;

  const hasEpicritica = nn(e.sensitivity_tacto_ligero) || nn(e.sensitivity_dos_puntos)
    || nn(e.sensitivity_picking_up) || nn(e.sensitivity_semmes_weinstein) || nn(e.sensitivity_functional);
  const hasProtopática = nn(e.sensitivity_toco_pincho) || nn(e.sensitivity_temperatura)
    || nn(e.sensitivity_protective) || nn(e.sensitivity);
  const hasSensitivity = hasEpicritica || hasProtopática;

  const scarEval = (e.scar_evaluation && typeof e.scar_evaluation === "object" && !Array.isArray(e.scar_evaluation))
    ? e.scar_evaluation as Record<string, any>
    : null;
  const vss = scarEval?.vss && typeof scarEval.vss === "object" ? scarEval.vss as Record<string, any> : null;
  const vssTotal = vss != null
    ? ((vss.pigmentacion ?? 0) + (vss.vascularizacion ?? 0) + (vss.flexibilidad ?? 0) + (vss.altura ?? 0))
    : (nn(e.vancouver_score) ? e.vancouver_score : null);
  const hasCicatriz = !!(scarEval || nn(e.scar) || nn(e.vancouver_score));

  const VSS_LABELS: Record<string, Record<number, string>> = {
    pigmentacion:   { 0: "0 — Normal", 1: "1 — Hipopigmentación", 2: "2 — Pigmentación mixta", 3: "3 — Hiperpigmentación" },
    vascularizacion:{ 0: "0 — Normal", 1: "1 — Rosa", 2: "2 — Rojo", 3: "3 — Púrpura" },
    flexibilidad:   { 0: "0 — Normal", 1: "1 — Suave, flexible", 2: "2 — Cedente", 3: "3 — Firme", 4: "4 — Cordón", 5: "5 — Contractura" },
    altura:         { 0: "0 — Normal", 1: "1 — ≤1mm", 2: "2 — >1 a ≤2mm", 3: "3 — >2 a ≤4mm", 4: "4 — >4mm" },
  };
  const vssLabel = (field: string, val: any) => VSS_LABELS[field]?.[Number(val)] ?? String(val);

  const hasOtros = nn(e.trophic_state) || nn(e.posture) || nn(e.emotional_state);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Evaluación Analítica</h1>
        {patientName && <p className="text-sm text-muted-foreground">{patientName}</p>}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {evalDate && <span>{evalDate}</span>}
          {sessionLabel && <span>· {sessionLabel}</span>}
        </div>
      </div>

      {/* Dolor */}
      <Section title="Dolor">
        {nn(e.pain_score) && (
          <div className="rounded-xl bg-muted/40 border border-border/60 p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Escala EVA</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground leading-none">{e.pain_score}</span>
                <span className="text-sm text-muted-foreground font-medium">/10</span>
              </div>
            </div>
            <div className="flex gap-1 h-4">
              {Array.from({ length: 10 }, (_, i) => {
                const active = (i + 1) <= e.pain_score;
                const activeC = i < 3 ? "bg-emerald-500" : i < 6 ? "bg-amber-400" : "bg-red-500";
                const inactiveC = i < 3 ? "bg-emerald-100" : i < 6 ? "bg-amber-100" : "bg-red-100";
                const radius = i === 0 ? "rounded-l-full" : i === 9 ? "rounded-r-full" : "rounded-sm";
                return <div key={i} className={`flex-1 ${radius} ${active ? activeC : inactiveC}`} />;
              })}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
              <span>Sin dolor</span>
              <span>Dolor máximo</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <DataCell label="Aparición" value={e.pain_appearance} />
          <DataCell label="Localización" value={displayLocation} />
          <div className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Irradiación</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${nn(e.pain_radiation) ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-muted text-muted-foreground border-border"}`}>
                {nn(e.pain_radiation) ? "Sí irradia" : "No irradia"}
              </span>
              {nn(e.pain_radiation) && (
                <>
                  <span className="text-muted-foreground text-sm leading-none">→</span>
                  <span className="text-sm font-medium text-foreground">{e.pain_radiation}</span>
                </>
              )}
            </div>
          </div>
          <DataCell label="Características" value={e.pain_characteristics} />
          <DataCell label="Agravantes / Atenuantes" value={e.pain_aggravating_factors} />
          {nn(e.pain) && <div className="col-span-2"><DataCell label="Descripción general" value={e.pain} /></div>}
        </div>
      </Section>

      {/* Movilidad */}
      <Section title="Movilidad">
        {hasGonioTables ? (
          isNewGonioFormat ? (
            <div className="space-y-5">
              {gonioResult.arom.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">AROM</p>
                  {renderGonioTables(gonioResult.arom)}
                </div>
              )}
              {gonioResult.prom.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">PROM</p>
                  {renderGonioTables(gonioResult.prom)}
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Goniometría</p>
              {renderGonioTables(gonioResult.arom)}
            </>
          )
        ) : (nn(e.arom) || nn(e.prom)) ? (
          <div className="space-y-3">
            {nn(e.arom) && <DataCell label="AROM" value={e.arom} />}
            {nn(e.prom) && <DataCell label="PROM" value={e.prom} />}
          </div>
        ) : null}
        {(nn(e.kapandji) || fistClosure) && (
          <div className={`grid grid-cols-2 gap-3${hasGonioTables || nn(e.arom) || nn(e.prom) ? " mt-4 pt-4 border-t border-border/30" : ""}`}>
            {nn(e.kapandji) && <DataCell label="Kapandji" value={e.kapandji} />}
            {fistClosure && <DataCell label="Cierre de puño" value={fistClosure} />}
          </div>
        )}
        {!hasGonioTables && !nn(e.arom) && !nn(e.prom) && !nn(e.kapandji) && !fistClosure && <NA />}
      </Section>

      {/* Fuerza muscular */}
      {hasStrength && (
        <Section title="Fuerza muscular">
          <div className="space-y-5">
            {/* Dinamómetro */}
            {hasDyn && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dinamómetro</p>
                <div className="grid grid-cols-2 gap-3">
                  {e.dynamometer_msd && <DataCell label="MSD" value={`${e.dynamometer_msd.average} kgf`} />}
                  {e.dynamometer_msi && <DataCell label="MSI" value={`${e.dynamometer_msi.average} kgf`} />}
                </div>
              </div>
            )}

            {/* DPPD */}
            {hasDppd && (() => {
              const d = e.dppd_fingers as Record<string, any>;
              const keys = ["pulgar", "indice", "medio", "anular", "menique"] as const;
              const labels = ["Pulgar", "Índice", "Medio", "Anular", "Meñique"];
              return (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">DPPD</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border/50">
                          {labels.map(l => (
                            <th key={l} className="text-center text-muted-foreground font-medium pb-1.5 px-2">{l}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {keys.map(k => (
                            <td key={k} className="py-1.5 px-2 text-center text-foreground">
                              {d[k] != null ? `${d[k]} cm` : "—"}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Daniels */}
            {danielsNode && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Daniels</p>
                {danielsNode}
              </div>
            )}

            {/* Nervios periféricos */}
            {(nn(e.muscle_strength_median) || nn(e.muscle_strength_cubital) || nn(e.muscle_strength_radial)) && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {nn(e.muscle_strength_median) && <DataCell label="Nervio Mediano" value={e.muscle_strength_median} />}
                {nn(e.muscle_strength_cubital) && <DataCell label="Nervio Cubital" value={e.muscle_strength_cubital} />}
                {nn(e.muscle_strength_radial) && <DataCell label="Nervio Radial" value={e.muscle_strength_radial} />}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Sensibilidad */}
      {hasSensitivity && (
        <Section title="Sensibilidad">
          <div className="space-y-5">
            {hasEpicritica && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Epicrítica (funcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  {nn(e.sensitivity_tacto_ligero) && <DataCell label="Tacto ligero" value={e.sensitivity_tacto_ligero} />}
                  {nn(e.sensitivity_dos_puntos) && <DataCell label="Discriminación 2 puntos" value={e.sensitivity_dos_puntos} />}
                  {nn(e.sensitivity_picking_up) && <DataCell label="Picking up test" value={e.sensitivity_picking_up} />}
                  {nn(e.sensitivity_semmes_weinstein) && <DataCell label="Semmes-Weinstein" value={e.sensitivity_semmes_weinstein} />}
                  {nn(e.sensitivity_functional) && <DataCell label="Observaciones" value={e.sensitivity_functional} />}
                </div>
              </div>
            )}
            {hasProtopática && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Protopática (protectora)</p>
                <div className="grid grid-cols-2 gap-3">
                  {nn(e.sensitivity_toco_pincho) && <DataCell label="Toco-pincho" value={e.sensitivity_toco_pincho} />}
                  {nn(e.sensitivity_temperatura) && <DataCell label="Temperatura frío-calor" value={e.sensitivity_temperatura} />}
                  {(nn(e.sensitivity_protective) || nn(e.sensitivity)) && (
                    <div className="col-span-2">
                      <DataCell label="Observaciones" value={e.sensitivity_protective || e.sensitivity} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Edema */}
      {hasEdema && (
        <Section title="Edema">
          <div className="space-y-3">
            {edemaObservation && <DataCell label="Observación" value={edemaObservation} />}
            {nn(e.godet_test) && <DataCell label="Test de Godet" value={e.godet_test} />}
          </div>
          {edemaNode && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Circometría</p>
              {edemaNode}
            </div>
          )}
        </Section>
      )}

      {/* Pruebas específicas */}
      {testsNode && (
        <Section title="Pruebas específicas">
          {testsNode}
        </Section>
      )}

      {/* Cicatriz */}
      {hasCicatriz && (
        <Section title="Cicatriz">
          <div className="space-y-5">
            {(scarEval || nn(e.scar)) && (
              <div className="grid grid-cols-2 gap-3">
                {nn(scarEval?.localizacion) && <DataCell label="Localización" value={scarEval!.localizacion} />}
                {nn(scarEval?.longitud_cm) && <DataCell label="Longitud" value={`${scarEval!.longitud_cm} cm`} />}
                {nn(scarEval?.sensibilidad) && <DataCell label="Sensibilidad" value={scarEval!.sensibilidad} />}
                {nn(scarEval?.temperatura) && <DataCell label="Temperatura" value={scarEval!.temperatura} />}
                {nn(e.scar) && <div className="col-span-2"><DataCell label="Observaciones" value={e.scar} /></div>}
              </div>
            )}
            {vssTotal != null && (
              <div className={scarEval || nn(e.scar) ? "pt-4 border-t border-border/30" : ""}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Escala Vancouver VSS — Total: {vssTotal}/15
                </p>
                {vss && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {vss.pigmentacion != null && <DataCell label="Pigmentación" value={vssLabel("pigmentacion", vss.pigmentacion)} />}
                    {vss.vascularizacion != null && <DataCell label="Vascularización" value={vssLabel("vascularizacion", vss.vascularizacion)} />}
                    {vss.flexibilidad != null && <DataCell label="Flexibilidad" value={vssLabel("flexibilidad", vss.flexibilidad)} />}
                    {vss.altura != null && <DataCell label="Altura" value={vssLabel("altura", vss.altura)} />}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Otros */}
      {hasOtros && (
        <Section title="Otros">
          <div className="grid grid-cols-2 gap-3">
            {nn(e.trophic_state) && <DataCell label="Estado trófico" value={e.trophic_state} />}
            {nn(e.posture) && <DataCell label="Postura" value={e.posture} />}
            {nn(e.emotional_state) && <DataCell label="Emotividad" value={e.emotional_state} />}
          </div>
        </Section>
      )}

      {/* Notas */}
      {nn(e.notes) && (
        <Section title="Notas">
          <p className="text-sm text-foreground whitespace-pre-wrap">{e.notes}</p>
        </Section>
      )}
    </div>
  );
}
