import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getExerciseType, extractYoutubeId } from "@/components/exercises/exerciseLibrary";

type PageStatus = "loading" | "valid" | "expired" | "revoked" | "not_found";

interface PlanExercise {
  name: string;
  exercise_type: string | null;
  instructions: string | null;
  starting_position: string | null;
  precautions: string | null;
  equipment: string | null;
  video_url: string | null;
}

interface PlanItem {
  order_index: number;
  assigned_sets: number | null;
  assigned_reps: number | null;
  frequency: string | null;
  item_notes: string | null;
  exercise: PlanExercise;
}

interface PlanData {
  plan_notes: string | null;
  items: PlanItem[];
}

export default function PlanPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [planData, setPlanData] = useState<PlanData | null>(null);

  useEffect(() => {
    if (!token) { setStatus("not_found"); return; }

    supabase.rpc("get_exercise_plan_token", { p_token: token }).then(({ data, error }) => {
      if (error || !data) { setStatus("not_found"); return; }
      const s = (data as { status: string }).status;

      if (s === "expired") { setStatus("expired"); return; }
      if (s === "revoked") { setStatus("revoked"); return; }
      if (s !== "valid")   { setStatus("not_found"); return; }

      // Token válido — traer datos del plan
      supabase.rpc("get_exercise_plan_public", { p_token: token }).then(({ data: pd }) => {
        if (!pd) { setStatus("not_found"); return; }
        setPlanData(pd as unknown as PlanData);
        setStatus("valid");
      });
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <img src="/favicon.svg" alt="RehabOT" className="h-9 w-9 rounded-[10px] shrink-0" />
          <div>
            <p className="field-label text-primary">RehabOT</p>
            <h1 className="font-serif text-base font-semibold text-foreground leading-tight">
              Plan de ejercicios domiciliarios
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">

        {/* ── LOADING ── */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Cargando tu plan...</p>
          </div>
        )}

        {/* ── ERRORES ── */}
        {(status === "not_found" || status === "expired" || status === "revoked") && (
          <div className={cn(
            "mt-10 rounded-[12px] border p-8 text-center space-y-3",
            status === "expired" ? "border-warning/30 bg-warning/10" : "border-destructive/20 bg-destructive/5"
          )}>
            {status === "expired"
              ? <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
              : <XCircle className="h-12 w-12 text-destructive/70 mx-auto" />
            }
            <h2 className="font-serif text-lg font-semibold text-foreground">
              {status === "expired"  ? "Este link ha expirado"  :
               status === "revoked"  ? "Este link fue revocado" :
               "Link no válido"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {status === "expired"
                ? "Este link ya no está disponible. Consultá a tu terapeuta para obtener uno nuevo."
                : status === "revoked"
                ? "El terapeuta revocó este link. Consultale para obtener uno nuevo."
                : "Este link no existe o no es correcto. Revisá que hayas copiado la URL completa."}
            </p>
          </div>
        )}

        {/* ── PLAN ── */}
        {status === "valid" && planData && (
          <div className="space-y-4 pb-10">
            {planData.plan_notes && (
              <div className="rounded-[12px] border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="field-label text-primary mb-1">Indicaciones generales</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{planData.plan_notes}</p>
              </div>
            )}

            {planData.items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">El plan no tiene ejercicios cargados todavía.</p>
            ) : (
              planData.items.map((item, idx) => {
                const ex = item.exercise;
                const type = getExerciseType(ex.exercise_type);
                const dosage = item.assigned_sets && item.assigned_reps
                  ? `${item.assigned_sets} series × ${item.assigned_reps} reps`
                  : item.assigned_sets ? `${item.assigned_sets} series`
                  : item.assigned_reps ? `${item.assigned_reps} reps`
                  : null;

                const ytId = ex.video_url ? extractYoutubeId(ex.video_url) : null;

                return (
                  <div key={idx} className="dashboard-card overflow-hidden">
                    {/* Card header */}
                    <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-serif text-base font-semibold text-foreground leading-tight">{ex.name}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {type && (
                            <span className={cn("field-label px-1.5 py-0.5 rounded border", type.badgeClass)}>
                              {type.label}
                            </span>
                          )}
                          {dosage && (
                            <span className="text-xs text-foreground font-medium">{dosage}</span>
                          )}
                          {item.frequency && (
                            <span className="text-xs text-muted-foreground">{item.frequency}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="px-4 py-3 space-y-3">
                      {ex.equipment && (
                        <div>
                          <p className="field-label mb-0.5">Equipamiento</p>
                          <p className="text-sm text-foreground">{ex.equipment}</p>
                        </div>
                      )}
                      {ex.starting_position && (
                        <div>
                          <p className="field-label mb-0.5">Posición inicial</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ex.starting_position}</p>
                        </div>
                      )}
                      {ex.instructions && (
                        <div>
                          <p className="field-label mb-0.5">Instrucciones</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ex.instructions}</p>
                        </div>
                      )}
                      {ex.precautions && (
                        <div className="flex gap-3 rounded-[10px] border border-warning/30 bg-warning/10 px-3 py-2.5">
                          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          <div>
                            <p className="field-label mb-0.5">Precauciones</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ex.precautions}</p>
                          </div>
                        </div>
                      )}
                      {item.item_notes && (
                        <div>
                          <p className="field-label mb-0.5">Notas del terapeuta</p>
                          <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{item.item_notes}</p>
                        </div>
                      )}

                      {/* Video */}
                      {ex.video_url && (
                        <div>
                          <p className="field-label mb-1.5">Video de referencia</p>
                          {ytId ? (
                            <div className="rounded-[10px] overflow-hidden border border-border" style={{ aspectRatio: "16/9" }}>
                              <iframe
                                src={`https://www.youtube.com/embed/${ytId}`}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full"
                                title={ex.name}
                              />
                            </div>
                          ) : (
                            <a
                              href={ex.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary underline underline-offset-2 break-all"
                            >
                              {ex.video_url}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
