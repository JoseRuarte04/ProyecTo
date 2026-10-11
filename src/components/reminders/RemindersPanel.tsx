import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTomorrowReminders, useMarkWhatsappSent } from "@/hooks/useReminders";
import { buildReminderMessage, whatsappUrl } from "@/lib/whatsapp";

export function RemindersPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const { data: appointments = [], isLoading } = useTomorrowReminders();
  const { mutate: markSent } = useMarkWhatsappSent();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Recordatorios de mañana</SheetTitle>
          <SheetDescription>
            Turnos pendientes de confirmar para {format(new Date(Date.now() + 86400000), "EEEE d 'de' MMMM", { locale: es })}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
          ) : appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No hay turnos agendados para mañana.</p>
          ) : (
            appointments.map(a => {
              const whatsappSent = a.appointment_reminders.find(r => r.channel === "whatsapp");
              const emailSent = a.appointment_reminders.find(r => r.channel === "email");
              const message = buildReminderMessage(a, a.patients?.first_name ?? "");
              const url = a.patients?.phone ? whatsappUrl(a.patients.phone, message) : null;

              return (
                <div key={a.id} className="flex items-center justify-between gap-2 border border-border rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {format(new Date(a.appointment_date), "HH:mm")} · {a.patients?.last_name}, {a.patients?.first_name}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3" />
                      {emailSent ? "Email enviado" : a.patients?.email ? "Se envía a las 18hs" : "Sin email"}
                    </p>
                  </div>
                  {whatsappSent ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {format(new Date(whatsappSent.sent_at), "HH:mm")}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!url}
                      className="gap-1.5 shrink-0 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      onClick={() => {
                        if (!url || !user) return;
                        window.open(url, "_blank");
                        markSent({ appointmentId: a.id, userId: user.id });
                      }}
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> {url ? "WhatsApp" : "Sin teléfono"}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
