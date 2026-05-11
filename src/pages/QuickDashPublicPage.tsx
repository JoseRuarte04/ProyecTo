import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  QUICKDASH_QUESTIONS,
  calcQuickDashScore,
  emptyQuickDash,
} from "@/components/evaluations/FunctionalScales";

type PageStatus = "loading" | "valid" | "expired" | "completed" | "not_found" | "submitting" | "success";

function scoreInterpretation(score: number): { label: string; colorClass: string } {
  if (score <= 25) return { label: "Leve",       colorClass: "text-green-700  bg-green-50  border-green-200"  };
  if (score <= 50) return { label: "Moderado",   colorClass: "text-yellow-700 bg-yellow-50 border-yellow-200" };
  if (score <= 75) return { label: "Severo",     colorClass: "text-orange-700 bg-orange-50 border-orange-200" };
  return             { label: "Muy severo", colorClass: "text-red-700    bg-red-50    border-red-200"    };
}

export default function QuickDashPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus]         = useState<PageStatus>("loading");
  const [items, setItems]           = useState<(number | null)[]>(emptyQuickDash());
  const [finalScore, setFinalScore] = useState<number | null>(null);

  useEffect(() => {
    if (!token) { setStatus("not_found"); return; }

    supabase.rpc("get_quickdash_token", { p_token: token }).then(({ data, error }) => {
      if (error || !data) { setStatus("not_found"); return; }
      const s = (data as { status: string }).status;
      if (s === "valid" || s === "expired" || s === "completed") setStatus(s as PageStatus);
      else setStatus("not_found");
    });
  }, [token]);

  const answeredCount = items.filter((v) => v !== null).length;
  const allAnswered   = answeredCount === 11;

  async function handleSubmit() {
    if (!token || !allAnswered) return;
    const score = calcQuickDashScore(items);
    if (score === null) return;

    setStatus("submitting");
    const { error } = await supabase.rpc("complete_quickdash_token", {
      p_token: token,
      p_items: items as any,
      p_score: score,
    });

    if (error) {
      toast.error("No se pudo enviar. Por favor intentá de nuevo.");
      setStatus("valid");
    } else {
      setFinalScore(score);
      setStatus("success");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header fijo */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest">RehabOT</p>
          <h1 className="text-base font-serif font-bold text-gray-900 leading-tight">
            Cuestionario QuickDASH
          </h1>
          <p className="text-xs text-muted-foreground">Miembro superior · Última semana</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* ── LOADING ── */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            <p className="text-sm">Verificando enlace...</p>
          </div>
        )}

        {/* ── INVÁLIDO / VENCIDO ── */}
        {(status === "not_found" || status === "expired") && (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-8 text-center space-y-3">
            <XCircle className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-lg font-semibold text-red-800">
              {status === "expired" ? "Este enlace venció" : "Enlace no válido"}
            </h2>
            <p className="text-sm text-red-600 leading-relaxed">
              {status === "expired"
                ? "El tiempo para completar este cuestionario expiró. Pedile a tu terapeuta que te envíe un nuevo enlace."
                : "Este enlace no existe o está incompleto. Revisá que hayas copiado la URL completa."}
            </p>
          </div>
        )}

        {/* ── YA COMPLETADO ── */}
        {status === "completed" && (
          <div className="mt-10 rounded-2xl border border-teal-200 bg-teal-50 p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-teal-500 mx-auto" />
            <h2 className="text-lg font-semibold text-teal-800">Ya completaste este cuestionario</h2>
            <p className="text-sm text-teal-600 leading-relaxed">
              Tus respuestas ya fueron registradas. Tu terapeuta puede verlas en tu historial clínico.
            </p>
          </div>
        )}

        {/* ── ÉXITO ── */}
        {status === "success" && finalScore !== null && (() => {
          const interp = scoreInterpretation(finalScore);
          return (
            <div className="space-y-4 mt-4">
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-teal-500 mx-auto" />
                <h2 className="text-base font-semibold text-teal-800">¡Gracias! Tus respuestas fueron enviadas</h2>
                <p className="text-sm text-teal-600">Tu terapeuta recibirá el resultado.</p>
              </div>
              <div className={`rounded-2xl border p-6 text-center space-y-1 ${interp.colorClass}`}>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Tu puntaje QuickDASH</p>
                <p className="text-5xl font-bold leading-none mt-1">
                  {finalScore.toFixed(1)}
                  <span className="text-xl font-normal">/100</span>
                </p>
                <p className="text-base font-semibold mt-1">{interp.label}</p>
                <p className="text-xs opacity-60 mt-2">0 = sin dificultad · 100 = máxima dificultad</p>
              </div>
            </div>
          );
        })()}

        {/* ── FORMULARIO ── */}
        {(status === "valid" || status === "submitting") && (
          <>
            {/* Barra de progreso */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{answeredCount} de 11 preguntas respondidas</span>
                {allAnswered && (
                  <span className="text-teal-600 font-medium">✓ Listo para enviar</span>
                )}
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all duration-300"
                  style={{ width: `${(answeredCount / 11) * 100}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Indicá cuánta dificultad tuviste para realizar cada actividad{" "}
              <strong>en la última semana</strong>, independientemente de si la realizás con la mano
              derecha, izquierda o las dos.
            </p>

            {/* Preguntas */}
            <div className="space-y-4">
              {QUICKDASH_QUESTIONS.map((item, idx) => {
                const value = items[idx];
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <p className="text-sm font-medium text-gray-800 mb-3 leading-snug">
                      <span className="text-teal-600 font-bold mr-1">{idx + 1}.</span>
                      {item.q}
                    </p>
                    <RadioGroup
                      value={value !== null ? String(value) : ""}
                      onValueChange={(v) => {
                        const next = [...items];
                        next[idx] = parseInt(v);
                        setItems(next);
                      }}
                      className="flex flex-col gap-2"
                    >
                      {item.scale.map((optLabel, i) => {
                        const val = i + 1;
                        const id  = `pub-qd-${idx}-${val}`;
                        return (
                          <Label
                            key={val}
                            htmlFor={id}
                            className={`flex items-center gap-3 cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                              value === val
                                ? "border-teal-500 bg-teal-50 text-teal-800"
                                : "border-gray-200 bg-gray-50 text-gray-700 hover:border-teal-200 hover:bg-white"
                            }`}
                          >
                            <RadioGroupItem value={String(val)} id={id} className="shrink-0" />
                            <span>
                              <span className="font-semibold text-gray-400 mr-1 text-xs">{val}.</span>
                              {optLabel}
                            </span>
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  </div>
                );
              })}
            </div>

            {/* Botón enviar */}
            <div className="pt-2 pb-10">
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered || status === "submitting"}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white h-12 text-base font-semibold rounded-xl shadow-md"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar respuestas"
                )}
              </Button>
              {!allAnswered && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Respondé las {11 - answeredCount} preguntas restantes para poder enviar
                </p>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
