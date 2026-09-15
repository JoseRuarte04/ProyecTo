import { useQuery } from "@tanstack/react-query";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function warnOnError(context: string, error: unknown) {
  if (!error) return;
  console.error(`Error cargando ${context}:`, error);
  toast.error(`No se pudo cargar: ${context}`, { description: "Probá recargar la página." });
}

type Workspace = { type: "personal" | "team"; teamId?: string };

export function useDayAppointments(date: Date) {
  return useQuery({
    queryKey: ["appointments", "day", date.toDateString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, appointment_end, type, status, notes, patients(id, first_name, last_name, birth_date)")
        .gte("appointment_date", startOfDay(date).toISOString())
        .lte("appointment_date", endOfDay(date).toISOString())
        .order("appointment_date");
      warnOnError("turnos del día", error);
      return data ?? [];
    },
  });
}

export function useActivePatients(workspace: Workspace, userId: string | undefined) {
  return useQuery({
    queryKey: ["patients", "active", workspace.type, workspace.teamId, userId],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select("id, first_name, last_name, admission_date", { count: "exact" })
        .eq("status", "active")
        .eq("is_deleted", false)
        .order("admission_date", { ascending: false })
        .limit(3);

      if (workspace.type === "personal") {
        query = query.eq("professional_id", userId!);
      } else {
        query = query.eq("team_id", workspace.teamId!);
      }

      const { data, count, error } = await query;
      warnOnError("pacientes activos", error);
      return { patients: data ?? [], count: count ?? 0 };
    },
  });
}

export function useRecentSessions(workspace: Workspace, userId: string | undefined) {
  return useQuery({
    queryKey: ["sessions", "recent", workspace.type, workspace.teamId, userId],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from("therapy_sessions")
        .select("id, session_date, session_type, session_number, patient_id, patients!inner(first_name, last_name, professional_id, team_id)")
        .eq("is_deleted", false)
        .order("session_date", { ascending: false })
        .limit(3);

      if (workspace.type === "personal") {
        query = query.eq("patients.professional_id", userId!);
      } else {
        query = query.eq("patients.team_id", workspace.teamId!);
      }

      const { data, error } = await query;
      warnOnError("sesiones recientes", error);
      return data ?? [];
    },
  });
}

export function useStalePatients(workspace: Workspace, userId: string | undefined) {
  return useQuery({
    queryKey: ["patients", "stale", workspace.type, workspace.teamId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const cutoff = subDays(new Date(), 14).toISOString().split("T")[0];

      let recentQuery = supabase
        .from("therapy_sessions")
        .select("patient_id, patients!inner(professional_id, team_id)")
        .gte("session_date", cutoff)
        .eq("is_deleted", false);

      if (workspace.type === "personal") {
        recentQuery = recentQuery.eq("patients.professional_id", userId!);
      } else {
        recentQuery = recentQuery.eq("patients.team_id", workspace.teamId!);
      }

      const { data: recentData, error: recentError } = await recentQuery;
      warnOnError("pacientes sin sesión reciente", recentError);
      const recentIds = [...new Set((recentData ?? []).map((r: any) => r.patient_id))];

      let query = supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("status", "active")
        .eq("is_deleted", false)
        .limit(4);

      if (workspace.type === "personal") {
        query = query.eq("professional_id", userId!);
      } else {
        query = query.eq("team_id", workspace.teamId!);
      }

      if (recentIds.length > 0) {
        query = query.not("id", "in", `(${recentIds.join(",")})`);
      }

      const { data, error } = await query;
      warnOnError("pacientes sin sesión reciente", error);
      return data ?? [];
    },
  });
}
