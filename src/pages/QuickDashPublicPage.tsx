import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  QUICKDASH_QUESTIONS,
  calcQuickDashScore,
  emptyQuickDash,
} from "@/components/evaluations/FunctionalScales";

type PageStatus = "loading" | "valid" | "expired" | "completed" | "not_found" | "submitting" | "success";

function scoreInterpretation(score: number): { label: string; colorClass: string } {
  if (score <= 25) return { label: "Leve",       colorClass: "text-success bg-success/10 border-success/20" };
  if (score <= 50) return { label: "Moderado",   colorClass: "text-warning bg-warning/10 border-warning/30" };
  if (score <= 75) return { label: "Severo",     colorClass: "text-orange-700 bg-orange-50 border-orange-200" };
  return             { label: "Muy severo", colorClass: "text-destructive bg-destructive/5 border-destructive/20" };
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
    <div className="min-h-screen bg-background">
      {/* Header fijo */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <img src="/favicon.svg" alt="RehabOT" className="h-9 w-9 rounded-[10px] shrink-0" />
          <div>
            <p className="field-label text-primary">RehabOT</p>
            <h1 className="font-serif text-base font-semibold text-foreground leading-tight">
              Cuestionario QuickDASH
            </h1>
            <p className="text-xs text-muted-foreground">Miembro superior · Última semana</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* ── LOADING ── */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Verificando enlace...</p>
          </div>
        )}

        {/* ── INVÁLIDO / VENCIDO ── */}
        {(status === "not_found" || status === "expired") && (
          <div className="mt-10 rounded-[12px] border border-destructive/20 bg-destructive/5 p-8 text-center space-y-3">
            <XCircle className="h-12 w-12 text-destructive/70 mx-auto" />
            <h2 className="font-serif text-lg font-semibold text-foreground">
              {status === "expired" ? "Este enlace venció" : "Enlace no válido"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {status === "expired"
                ? "El tiempo para completar este cuestionario expiró. Pedile a tu terapeuta que te envíe un nuevo enlace."
                : "Este enlace no existe o está incompleto. Revisá que hayas copiado la URL completa."}
            </p>
          </div>
        )}

        {/* ── YA COMPLETADO ── */}
        {status === "completed" && (
          <div className="mt-10 rounded-[12px] border border-success/20 bg-success/10 p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h2 className="font-serif text-lg font-semibold text-foreground">Ya completaste este cuestionario</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tus respuestas ya fueron registradas. Tu terapeuta puede verlas en tu historial clínico.
            </p>
          </div>
        )}

        {/* ── ÉXITO ── */}
        {status === "success" && finalScore !== null && (() => {
          const interp = scoreInterpretation(finalScore);
          return (
            <div className="space-y-4 mt-4">
              <div className="rounded-[12px] border border-success/20 bg-success/10 p-6 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <h2 className="font-serif text-base font-semibold text-foreground">¡Gracias! Tus respuestas fueron enviadas</h2>
                <p className="text-sm text-muted-foreground">Tu terapeuta recibirá el resultado.</p>
              </div>
              <div className={cn("rounded-[12px] border p-6 text-center space-y-1", interp.colorClass)}>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Tu puntaje QuickDASH</p>
                <p className="text-5xl font-bold leading-none mt-1 tabular-nums">
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
                  <span className="text-success font-medium">✓ Listo para enviar</span>
                )}
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${(answeredCount / 11) * 100}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Indicá cuánta dificultad tuviste para realizar cada actividad{" "}
              <strong className="text-foreground">en la última semana</strong>, independientemente de si la realizás con la mano
              derecha, izquierda o las dos.
            </p>

            {/* Preguntas */}
            <div className="space-y-4">
              {QUICKDASH_QUESTIONS.map((item, idx) => {
                const value = items[idx];
                return (
                  <div key={idx} className="dashboard-card p-4">
                    <p className="text-sm font-medium text-foreground mb-3 leading-snug">
                      <span className="text-primary font-bold mr-1">{idx + 1}.</span>
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
                            className={cn(
                              "flex items-center gap-3 cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors",
                              value === val
                                ? "border-primary bg-primary/5 text-foreground font-medium"
                                : "border-border bg-muted/40 text-foreground hover:border-primary/30 hover:bg-card"
                            )}
                          >
                            <RadioGroupItem value={String(val)} id={id} className="shrink-0" />
                            <span>
                              <span className="font-semibold text-muted-foreground mr-1 text-xs">{val}.</span>
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
                className="w-full h-12 text-base font-semibold"
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
