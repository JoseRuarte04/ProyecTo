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

const NA = () => <span className="text-muted-foreground italic text-sm">No registrado</span>;

function DataCell({ label, value }: { label: string; value: any }) {
  const hasValue = value != null && value !== "";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {hasValue ? (
        <span className="text-sm font-medium text-foreground">{value}</span>
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

export default function FunctionalEvaluationPage() {
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
        .from("functional_evaluations")
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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
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

  const hasScores = nn(e.quickdash_score) || nn(e.fim_score) || nn(e.barthel_score);
  const hasAvd = nn(e.avd) || nn(e.aivd);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Evaluación Funcional</h1>
        {patientName && <p className="text-sm text-muted-foreground">{patientName}</p>}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {evalDate && <span>{evalDate}</span>}
          {sessionLabel && <span>· {sessionLabel}</span>}
        </div>
      </div>

      {/* Scores */}
      {hasScores && (
        <Section title="Escalas funcionales">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {nn(e.quickdash_score) && <DataCell label="QuickDASH" value={`${e.quickdash_score}/100`} />}
            {nn(e.fim_score) && <DataCell label="FIM" value={`${e.fim_score}/126`} />}
            {nn(e.barthel_score) && <DataCell label="Barthel" value={`${e.barthel_score}/100`} />}
          </div>
        </Section>
      )}

      {/* AVD */}
      {hasAvd && (
        <Section title="Actividades de la vida diaria">
          <div className="space-y-3">
            {nn(e.avd) && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">AVD</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{e.avd}</p>
              </div>
            )}
            {nn(e.aivd) && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">AIVD</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{e.aivd}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Otras áreas ocupacionales */}
      {(nn(e.health_management) || nn(e.physical_activity) || nn(e.sleep_rest)) && (
        <Section title="Otras áreas ocupacionales">
          <div className="space-y-3">
            {nn(e.health_management) && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Gestión de la salud</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{e.health_management}</p>
              </div>
            )}
            {nn(e.physical_activity) && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Actividad física</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{e.physical_activity}</p>
              </div>
            )}
            {nn(e.sleep_rest) && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Sueño y descanso</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{e.sleep_rest}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Notas */}
      {nn(e.notes) && (
        <Section title="Notas">
          <p className="text-sm text-foreground whitespace-pre-wrap">{e.notes}</p>
        </Section>
      )}

      {!hasScores && !hasAvd && !nn(e.notes) && !nn(e.health_management) && !nn(e.physical_activity) && !nn(e.sleep_rest) && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No hay datos registrados en esta evaluación.
        </div>
      )}
    </div>
  );
}
