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
import { EDEMA_POINTS, isNewEdemaFormat, normalizeEdemaValue } from "@/components/clinical/EdemaCircometryTable";

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

  // ── Goniometría ──
  const renderGonioJsonb = (g: any) => {
    if (!g || typeof g !== "object") return null;
    const partNames: Record<string, string> = { shoulder: "Hombro", elbow: "Codo", wrist: "Muñeca", hand: "Mano", thumb: "Pulgar" };
    const renderPart = (label: string, data: any) => {
      if (!data || !data.values || typeof data.values !== "object") return null;
      const vals = Object.entries(data.values).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}°`);
      if (vals.length === 0) return null;
      const partLabel = data.body_part ? (partNames[data.body_part] || data.body_part) : "";
      return (
        <div key={label} className="text-sm text-foreground">
          <span className="font-medium">{label}{partLabel ? ` (${partLabel})` : ""}:</span>{" "}
          {vals.join(" · ")}
        </div>
      );
    };
    const pre = renderPart("PRE", g.pre);
    const post = renderPart("POST", g.post);
    if (!pre && !post) return null;
    return <div className="space-y-1">{pre}{post}</div>;
  };

  // ── Daniels ──
  const renderDaniels = (d: any) => {
    if (!d || typeof d !== "object") return null;
    let arr: { muscle: string; grade: any }[] = [];
    if (Array.isArray(d)) arr = d;
    else if (Array.isArray(d.muscles)) arr = d.muscles;
    if (arr.length === 0) return null;
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {arr.map((r, i) => (
          <DataCell key={i} label={r.muscle} value={r.grade != null ? `${r.grade}/5` : null} />
        ))}
      </div>
    );
  };

  // ── Edema ──
  const renderEdema = (edema: any) => {
    if (!isNewEdemaFormat(edema)) {
      // Legacy string format — show as plain text
      if (edema && typeof edema === "string" && edema.trim()) {
        return <p className="text-sm text-foreground whitespace-pre-wrap">{edema}</p>;
      }
      return null;
    }
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

  const gonioNode = renderGonioJsonb(e.goniometry);
  const danielsNode = renderDaniels(e.muscle_strength_daniels);
  const edemaNode = renderEdema(e.edema_circummetry ?? e.edema);
  const testsNode = renderSpecificTests(e.specific_tests);

  const hasStrength = danielsNode || nn(e.muscle_strength_median) || nn(e.muscle_strength_cubital) || nn(e.muscle_strength_radial);
  const hasScales = nn(e.vancouver_score) || nn(e.osas_score) || nn(e.godet_test);

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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <DataCell label="EVA" value={nn(e.pain_score) ? `${e.pain_score}/10` : null} />
          <DataCell label="Localización" value={e.pain_location} />
          <DataCell label="Características" value={e.pain_characteristics} />
          <DataCell label="Factores agravantes" value={e.pain_aggravating_factors} />
          <DataCell label="Apariencia" value={e.pain_appearance} />
          <DataCell label="Irradiación" value={e.pain_radiation} />
        </div>
      </Section>

      {/* Goniometría */}
      <Section title="Goniometría">
        {gonioNode ?? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <DataCell label="AROM" value={e.arom} />
            <DataCell label="PROM" value={e.prom} />
            <DataCell label="Kapandji" value={e.kapandji} />
          </div>
        )}
        {!gonioNode && !nn(e.arom) && !nn(e.prom) && !nn(e.kapandji) && <NA />}
      </Section>

      {/* Fuerza muscular */}
      {hasStrength && (
        <Section title="Fuerza muscular">
          <div className="space-y-3">
            {danielsNode}
            {nn(e.muscle_strength_median) && <DataCell label="Nervio Mediano" value={e.muscle_strength_median} />}
            {nn(e.muscle_strength_cubital) && <DataCell label="Nervio Cubital" value={e.muscle_strength_cubital} />}
            {nn(e.muscle_strength_radial) && <DataCell label="Nervio Radial" value={e.muscle_strength_radial} />}
          </div>
        </Section>
      )}

      {/* Edema / Circometría */}
      {edemaNode && (
        <Section title="Edema / Circometría">
          {edemaNode}
        </Section>
      )}

      {/* Pruebas específicas */}
      {testsNode && (
        <Section title="Pruebas específicas">
          {testsNode}
        </Section>
      )}

      {/* Escalas */}
      {hasScales && (
        <Section title="Escalas">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {nn(e.vancouver_score) && <DataCell label="Vancouver (VSS)" value={e.vancouver_score} unit="/15" />}
            {nn(e.osas_score) && <DataCell label="OSAS" value={e.osas_score} unit="/60" />}
            {nn(e.godet_test) && <DataCell label="Test Godet" value={e.godet_test} />}
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
