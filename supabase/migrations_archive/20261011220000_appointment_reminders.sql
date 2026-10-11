-- Recordatorios de turnos (docs/PLAN_recordatorios_turnos.md): tabla de
-- tracking para idempotencia del envío (email automático del cron + lo que
-- se marca como enviado a mano por WhatsApp).

CREATE TABLE public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'whatsapp_bot')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES public.profiles(id),
  UNIQUE (appointment_id, channel)
);
CREATE INDEX idx_appointment_reminders_appointment_id ON public.appointment_reminders (appointment_id);

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders: ver" ON public.appointment_reminders FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM appointments a WHERE a.id = appointment_id
       AND (a.professional_id = (select auth.uid()) OR is_my_patient(a.patient_id))));
CREATE POLICY "reminders: crear" ON public.appointment_reminders FOR INSERT TO authenticated
WITH CHECK (sent_by = (select auth.uid()) AND channel = 'whatsapp'
       AND EXISTS (SELECT 1 FROM appointments a WHERE a.id = appointment_id
       AND (a.professional_id = (select auth.uid()) OR is_my_patient(a.patient_id))));
