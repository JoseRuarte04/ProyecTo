import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, XCircle, AlertTriangle } from "lucide-react";

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

const TYPE_LABEL: Record<string, string> = {
  activo:          "Activo",
  activo_asistido: "Activo asistido",
  fortalecimiento: "Fortalecimiento",
};

const TYPE_COLOR: Record<string, string> = {
  activo:          "bg-blue-50 text-blue-700 border-blue-200",
  activo_asistido: "bg-green-50 text-green-700 border-green-200",
  fortalecimiento: "bg-amber-50 text-amber-700 border-amber-200",
};

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
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
        setPlanData(pd as PlanData);
        setStatus("valid");
      });
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-xl mx-auto">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest">RehabOT</p>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Plan de ejercicios domiciliarios</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">

        {/* ── LOADING ── */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <p className="text-sm">Cargando tu plan...</p>
          </div>
        )}

        {/* ── ERRORES ── */}
        {(status === "not_found" || status === "expired" || status === "revoked") && (
          <div className="mt-10 rounded-2xl border p-8 text-center space-y-3 border-red-200 bg-red-50">
            {status === "expired"
              ? <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
              : <XCircle className="h-12 w-12 text-red-400 mx-auto" />
            }
            <h2 className="text-lg font-semibold text-gray-800">
              {status === "expired"  ? "Este link ha expirado"  :
               status === "revoked"  ? "Este link fue revocado" :
               "Link no válido"}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
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
              <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
                <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Indicaciones generales</p>
                <p className="text-sm text-teal-800 whitespace-pre-wrap leading-relaxed">{planData.plan_notes}</p>
              </div>
            )}

            {planData.items.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">El plan no tiene ejercicios cargados todavía.</p>
            ) : (
              planData.items.map((item, idx) => {
                const ex = item.exercise;
                const typeColor = ex.exercise_type ? TYPE_COLOR[ex.exercise_type] : null;
                const typeLabel = ex.exercise_type ? TYPE_LABEL[ex.exercise_type] : null;
                const dosage = item.assigned_sets && item.assigned_reps
                  ? `${item.assigned_sets} series × ${item.assigned_reps} reps`
                  : item.assigned_sets ? `${item.assigned_sets} series`
                  : item.assigned_reps ? `${item.assigned_reps} reps`
                  : null;

                const ytId = ex.video_url ? extractYoutubeId(ex.video_url) : null;

                return (
                  <div key={idx} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    {/* Card header */}
                    <div className="px-4 py-3 border-b border-gray-100 flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-xs font-bold text-teal-600">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-gray-900 leading-tight">{ex.name}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {typeLabel && typeColor && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeColor}`}>
                              {typeLabel}
                            </span>
                          )}
                          {dosage && (
                            <span className="text-xs text-gray-500 font-medium">{dosage}</span>
                          )}
                          {item.frequency && (
                            <span className="text-xs text-gray-500">{item.frequency}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="px-4 py-3 space-y-3">
                      {ex.equipment && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Equipamiento</p>
                          <p className="text-sm text-gray-700">{ex.equipment}</p>
                        </div>
                      )}
                      {ex.starting_position && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Posición inicial</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ex.starting_position}</p>
                        </div>
                      )}
                      {ex.instructions && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Instrucciones</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ex.instructions}</p>
                        </div>
                      )}
                      {ex.precautions && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Precauciones</p>
                          <p className="text-sm text-amber-800 whitespace-pre-wrap leading-relaxed">{ex.precautions}</p>
                        </div>
                      )}
                      {item.item_notes && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Notas del terapeuta</p>
                          <p className="text-sm text-gray-600 italic whitespace-pre-wrap">{item.item_notes}</p>
                        </div>
                      )}

                      {/* Video */}
                      {ex.video_url && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Video de referencia</p>
                          {ytId ? (
                            <div className="rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
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
                              className="text-sm text-teal-600 underline underline-offset-2 break-all"
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
