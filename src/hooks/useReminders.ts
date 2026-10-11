import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type TomorrowAppointment = Tables<"appointments"> & {
  patients: Pick<Tables<"patients">, "first_name" | "last_name" | "phone" | "email"> | null;
  appointment_reminders: Pick<Tables<"appointment_reminders">, "channel" | "sent_at">[];
};

// Turnos pendientes (scheduled) de mañana, con los recordatorios ya enviados
// (si los hay) para no repetir el envío por WhatsApp sin querer.
export function useTomorrowReminders() {
  const tomorrow = addDays(new Date(), 1);
  return useQuery({
    queryKey: ["appointments", "reminders", "tomorrow", tomorrow.toDateString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(first_name, last_name, phone, email), appointment_reminders(channel, sent_at)")
        .eq("status", "scheduled")
        .gte("appointment_date", startOfDay(tomorrow).toISOString())
        .lte("appointment_date", endOfDay(tomorrow).toISOString())
        .order("appointment_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TomorrowAppointment[];
    },
  });
}

export function useMarkWhatsappSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appointmentId, userId }: { appointmentId: string; userId: string }) => {
      const { error } = await supabase
        .from("appointment_reminders")
        .insert({ appointment_id: appointmentId, channel: "whatsapp", sent_by: userId });
      // Doble click / ya marcado antes -> choca con el UNIQUE(appointment_id, channel), se ignora.
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", "reminders"] });
    },
  });
}
