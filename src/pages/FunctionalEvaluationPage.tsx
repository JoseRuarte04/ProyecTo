import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Eye } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  QUICKDASH_QUESTIONS,
  FIM_GROUPS, FIM_COGNITIVE_GROUPS,
  BARTHEL_ITEMS,
} from "@/components/evaluations/FunctionalScales";

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
  const [qdOpen, setQdOpen] = useState(false);
  const [fimOpen, setFimOpen] = useState(false);
  const [barthelOpen, setBarthelOpen] = useState(false);

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
            {nn(e.quickdash_score) && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">QuickDASH</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{e.quickdash_score}/100</span>
                  {e.quickdash_items && (
                    <Button variant="ghost" size="sm" onClick={() => setQdOpen(true)} className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                      <Eye className="h-3 w-3" /> Ver detalle
                    </Button>
                  )}
                </div>
              </div>
            )}
            {nn(e.fim_score) && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">FIM</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{e.fim_score}/126</span>
                  {e.fim_items && (
                    <Button variant="ghost" size="sm" onClick={() => setFimOpen(true)} className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                      <Eye className="h-3 w-3" /> Ver detalle
                    </Button>
                  )}
                </div>
              </div>
            )}
            {nn(e.barthel_score) && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Barthel</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{e.barthel_score}/100</span>
                  {e.barthel_items && (
                    <Button variant="ghost" size="sm" onClick={() => setBarthelOpen(true)} className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                      <Eye className="h-3 w-3" /> Ver detalle
                    </Button>
                  )}
                </div>
              </div>
            )}
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

      {/* QuickDASH detail dialog */}
      <Dialog open={qdOpen} onOpenChange={setQdOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>QuickDASH — {e.quickdash_score}/100</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {QUICKDASH_QUESTIONS.map((q, i) => {
              const items = Array.isArray(e.quickdash_items) ? e.quickdash_items : [];
              const val = items[i];
              const label = val != null ? q.scale[val - 1] : null;
              return (
                <div key={i} className="border-b border-border/30 pb-3 last:border-0">
                  <p className="text-xs text-muted-foreground mb-1"><span className="font-semibold text-foreground/70">{i + 1}.</span> {q.q}</p>
                  {label != null
                    ? <p className="text-sm font-medium text-foreground">{val} — {label}</p>
                    : <p className="text-sm text-muted-foreground italic">No registrado</p>
                  }
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* FIM detail dialog */}
      <Dialog open={fimOpen} onOpenChange={setFimOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>FIM — {e.fim_score}/126</DialogTitle>
          </DialogHeader>
          {(() => {
            const FIM_LEVEL: Record<number, string> = {
              1: "Dependiente total", 2: "Asistencia máxima", 3: "Asistencia moderada",
              4: "Asistencia mínima", 5: "Solo supervisión",
              6: "Independiente con adaptaciones", 7: "Independencia total",
            };
            const items = (e.fim_items && typeof e.fim_items === "object") ? e.fim_items as Record<string, any> : {};
            const allGroups = [...FIM_GROUPS, ...FIM_COGNITIVE_GROUPS];
            return (
              <div className="space-y-4 mt-2">
                {allGroups.map(group => {
                  const subtotal = group.items
                    .map(it => items[it.key])
                    .filter((v): v is number => v != null)
                    .reduce((a, b) => a + b, 0);
                  const hasAny = group.items.some(it => items[it.key] != null);
                  return (
                    <div key={group.name}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{group.name}</p>
                        {hasAny && <span className="text-xs font-semibold text-muted-foreground">{subtotal}/{group.max}</span>}
                      </div>
                      <div className="space-y-1.5">
                        {group.items.map(it => {
                          const v = items[it.key];
                          return (
                            <div key={it.key} className="flex items-center justify-between gap-3 border-b border-border/30 pb-1.5 last:border-0">
                              <span className="text-xs text-foreground flex-1">{it.label}</span>
                              {v != null
                                ? <span className="text-xs font-medium text-foreground shrink-0">{v} — {FIM_LEVEL[v]}</span>
                                : <span className="text-xs text-muted-foreground italic shrink-0">No registrado</span>
                              }
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Barthel detail dialog */}
      <Dialog open={barthelOpen} onOpenChange={setBarthelOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Índice de Barthel — {e.barthel_score}/100</DialogTitle>
          </DialogHeader>
          {(() => {
            const items = (e.barthel_items && typeof e.barthel_items === "object") ? e.barthel_items as Record<string, any> : {};
            const barthelInterpretation = (s: number) => {
              if (s <= 20) return "Dependencia total";
              if (s <= 60) return "Dependencia severa";
              if (s <= 90) return "Dependencia moderada";
              if (s <= 99) return "Dependencia escasa";
              return "Independiente";
            };
            return (
              <div className="space-y-1.5 mt-2">
                {BARTHEL_ITEMS.map(item => {
                  const v = items[item.key];
                  const opt = item.options.find(o => o.v === v);
                  return (
                    <div key={item.key} className="flex items-center justify-between gap-3 border-b border-border/30 pb-1.5 last:border-0">
                      <span className="text-xs text-foreground flex-1 font-medium">{item.label}</span>
                      {opt != null
                        ? <span className="text-xs font-medium text-foreground shrink-0">{opt.v} — {opt.l}</span>
                        : <span className="text-xs text-muted-foreground italic shrink-0">No registrado</span>
                      }
                    </div>
                  );
                })}
                {nn(e.barthel_score) && (
                  <p className="text-xs text-center text-muted-foreground pt-3">
                    Interpretación: <span className="font-semibold text-foreground">{barthelInterpretation(e.barthel_score)}</span>
                  </p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
