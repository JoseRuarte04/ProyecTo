import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type FilterStatus = "all" | "scheduled" | "completed" | "cancelled";

export const APPOINTMENTS_KEY = "appointments-list";

export function useAppointments(filter: FilterStatus) {
  return useQuery({
    queryKey: [APPOINTMENTS_KEY, filter],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("*, patients(first_name, last_name, phone)")
        .order("appointment_date", { ascending: true });
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      return data ?? [];
    },
  });
}

export function useCompleteAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "completed" as const }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turno completado");
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
    },
    onError: () => toast.error("Error al completar turno"),
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
