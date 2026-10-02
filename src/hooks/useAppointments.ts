import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type FilterStatus = "all" | "pending" | "completed" | "absent" | "cancelled";

const FILTER_STATUSES: Record<Exclude<FilterStatus, "all">, Database["public"]["Enums"]["appointment_status"][]> = {
  pending: ["scheduled", "waiting"],
  completed: ["completed"],
  absent: ["absent", "absent_with_notice"],
  cancelled: ["cancelled"],
};

// Forma de las filas que devuelve useAppointments (join con patients)
export type AppointmentWithPatient = Tables<"appointments"> & {
  patients: Pick<Tables<"patients">, "first_name" | "last_name" | "phone"> | null;
};

export const APPOINTMENTS_KEY = "appointments-list";

export function useAppointments(filter: FilterStatus) {
  return useQuery({
    queryKey: [APPOINTMENTS_KEY, filter],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("*, patients(first_name, last_name, phone)")
        .order("appointment_date", { ascending: true });
      if (filter !== "all") q = q.in("status", FILTER_STATUSES[filter]);
      const { data } = await q;
      return data ?? [];
    },
  });
}

type AppointmentStatusValue = Database["public"]["Enums"]["appointment_status"];

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatusValue }) => {
      // Si el turno estaba cancelado y se reactiva, se limpia el motivo de cancelación.
      const { error } = await supabase
        .from("appointments")
        .update({ status, cancellation_reason: null, cancellation_notes: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] }); // turnos del día en el Dashboard
    },
    onError: () => toast.error("No se pudo cambiar el estado del turno"),
  });
}

type CancelPayload = {
  id: string;
  reason: string;
  notes?: string;
};

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason, notes }: CancelPayload) => {
      const { error } = await supabase.from("appointments").update({
        status: "cancelled" as const,
        cancellation_reason: reason,
        cancellation_notes: notes || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turno cancelado");
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
    },
    onError: () => toast.error("Error al cancelar turno"),
  });
}
