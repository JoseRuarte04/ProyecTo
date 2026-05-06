import { useState } from "react";
import { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

export type ReportState = "idle" | "generating" | "ready" | "exporting";

export function useDischargeReport(
  patientId: string,
  episodeId: string | null,
  session: Session | null
) {
  const [state, setState] = useState<ReportState>("idle");
  const [reportText, setReportText] = useState("");

  const generate = async () => {
    if (!episodeId || !session) return;

    setState("generating");
    setReportText("");

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-discharge-report`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ patientId, episodeId }),
        }
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setReportText((prev) => prev + decoder.decode(value, { stream: true }));
      }

      setState("ready");
    } catch (err) {
      console.error("useDischargeReport error:", err);
      toast.error("Error al generar el informe. Intentá de nuevo.");
      setState("idle");
      setReportText("");
    }
  };

  const reset = () => {
    setState("idle");
    setReportText("");
  };

  return { state, setState, reportText, setReportText, generate, reset };
}
