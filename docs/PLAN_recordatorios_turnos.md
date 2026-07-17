# Recordatorios de turnos — email automático + panel de WhatsApp manual

## Contexto

Hoy el único recordatorio es un botón manual de WhatsApp escondido en el detalle de cada turno (`Appointments.tsx:704-719`) — depende de que la terapeuta se acuerde, turno por turno. El objetivo es reducir ausentismo: **email automático** la tarde anterior a cada paciente con turno, más un **panel de WhatsApp asistido** (un click por paciente, con tracking de enviados) en Dashboard y Turnos. Fase futura ya contemplada en el modelo de datos: bot automático de WhatsApp ("RehaBot").

Hallazgos que habilitan esto: ya hay infraestructura de **Resend** funcionando (`send-team-invitation` usa `RESEND_API_KEY`, ya cargada como secret) y `patients` ya tiene `email` y `phone` (nullables — tolerar ausencias).

**Restricción conocida**: el `from` actual es `onboarding@resend.dev` (dominio de prueba), que solo entrega a la casilla del dueño de la cuenta Resend. Se construye todo igual (testeable contra esa casilla) con el `from` parametrizado por env var; cuando Jose verifique un dominio propio en Resend, es cambiar un secret.

## 1. Migración: tabla de tracking + cron

`supabase/migrations/<ts>_appointment_reminders.sql`:

```sql
CREATE TABLE public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'whatsapp_bot')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES public.profiles(id),  -- null = enviado por el sistema (cron)
  UNIQUE (appointment_id, channel)               -- idempotencia del cron
);
CREATE INDEX idx_appointment_reminders_appointment_id ON public.appointment_reminders (appointment_id);

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

-- Ver/insertar solo sobre turnos propios (mismo criterio que appointments)
CREATE POLICY "reminders: ver" ON public.appointment_reminders FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM appointments a WHERE a.id = appointment_id
       AND (a.professional_id = (select auth.uid()) OR is_my_patient(a.patient_id))));
CREATE POLICY "reminders: crear" ON public.appointment_reminders FOR INSERT TO authenticated
WITH CHECK (sent_by = (select auth.uid()) AND channel = 'whatsapp'
       AND EXISTS (SELECT 1 FROM appointments a WHERE a.id = appointment_id
       AND (a.professional_id = (select auth.uid()) OR is_my_patient(a.patient_id))));
-- Sin UPDATE/DELETE para authenticated. El cron escribe con service role.

-- Cron diario 21:00 UTC = 18:00 Argentina (sin DST): recordatorios de mañana
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.schedule('send-appointment-reminders', '0 21 * * *', $$
  SELECT net.http_post(
    url := 'https://pvuaqatdendcgumwktid.supabase.co/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', <secret — ver nota>)
  );
$$);
```

Nota del secret: guardarlo en Vault de Supabase (`vault.create_secret`) y leerlo en el body del cron con `vault.decrypted_secrets`, para no dejarlo plano en el SQL de la migración. `types.ts` se actualiza a mano (Row/Insert/Update de `appointment_reminders`).

## 2. Edge function `supabase/functions/send-appointment-reminders/index.ts`

Patrón de las 4 existentes (`Deno.serve`, CORS). Secciones:
1. **Auth**: rechazar si `req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")`.
2. **Ventana "mañana en ART"**: offset fijo `-03:00` (Argentina no tiene DST): calcular `[mañana 00:00 -03, mañana 24:00 -03]` en UTC.
3. **Query** (cliente service role, `SUPABASE_SERVICE_ROLE_KEY` disponible por default en edge functions): `appointments` con `status = 'scheduled'` en la ventana, join `patients(first_name, email)`, excluyendo los que ya tienen reminder `email` (left join / segunda query a `appointment_reminders`).
4. **Envío**: por cada turno con email → POST a Resend (template HTML con el branding del mail de invitaciones: fecha larga en español, hora, modalidad; si es virtual con `video_link`, incluir el link "conectate 5 minutos antes"). `from`: `Deno.env.get("REMINDER_FROM") ?? "RehabOT <onboarding@resend.dev>"`.
5. **Tracking**: insert en `appointment_reminders` (channel `email`, `sent_by` null) solo si Resend respondió OK.
6. **Respuesta**: `{ sent, skipped_no_email, already_sent, errors }` para poder auditar cada corrida en los logs.

Deploy vía MCP `deploy_edge_function`; el código queda versionado en el repo.

## 3. Frontend

**`src/lib/whatsapp.ts`** — extraer `buildReminderMessage(appt: { appointment_date, modality, video_link }, firstName)` con el texto exacto que hoy está inline en el detalle del turno (`Appointments.tsx:704-707`), y reutilizarlo en ambos lados.

**`src/hooks/useReminders.ts`** (nuevo, react-query):
- `useTomorrowReminders()`: turnos `scheduled` de mañana (rango `startOfDay/endOfDay` de `addDays(new Date(),1)`, como `useDayAppointments` en `useDashboard.ts:7-20`) con `patients(first_name, last_name, phone, email)` + `appointment_reminders(channel, sent_at)` anidado.
- `useMarkWhatsappSent()`: mutación que inserta `{ appointment_id, channel: 'whatsapp', sent_by: user.id }` e invalida la query. Ignorar error de UNIQUE (doble click) silenciosamente.

**`src/components/reminders/RemindersPanel.tsx`** (nuevo): `Sheet` lateral (shadcn) con los turnos de mañana ordenados por hora. Por fila: hora + nombre del paciente + estado del email (✓ enviado / "sin email" / "se envía 18hs") + botón WhatsApp: `window.open(whatsappUrl(...buildReminderMessage...))` + `useMarkWhatsappSent`; si ya se mandó, ✓ con hora. Pacientes sin teléfono: botón deshabilitado con "sin teléfono".

**`src/pages/Appointments.tsx`**: botón "Recordatorios" (icono `BellRing`) en las actions del `PageHeader` (~línea 186-206) que abre el Sheet. Soportar `?reminders=1` en la URL para abrirlo al montar (link desde el Dashboard). Reemplazar el mensaje inline del detalle por `buildReminderMessage`.

**`src/pages/Dashboard.tsx`**: card "Recordatorios de mañana" en la columna lateral (línea ~155, patrón `dashboard-card p-5` idéntico a las 3 existentes): count de turnos de mañana sin WhatsApp enviado, primeros 3 nombres con hora, link "Enviar recordatorios →" a `/appointments?reminders=1`.

## 4. Tests

Sumar a `src/test/rls.test.ts`: (a) B no puede ver reminders de un turno de A; (b) B no puede insertar un reminder sobre el turno de A; (c) A no puede insertar con `sent_by` de otro usuario ni `channel: 'email'` (reservado al sistema). Requiere crear un turno fijo de prueba para A en el `beforeAll` (mismo patrón reutilizable del paciente fijo).

## 5. Orden de commits

1. Migración + types.ts (verificable por SQL)
2. Edge function + deploy
3. Helper `buildReminderMessage` + hook `useReminders`
4. `RemindersPanel` + integración en Appointments
5. Card del Dashboard
6. Tests de RLS nuevos

## 6. Verificación end-to-end

- **Función**: `curl -X POST .../functions/v1/send-appointment-reminders -H "x-cron-secret: ..."` con un turno de prueba mañana cuyo paciente tenga el email del dueño de la cuenta Resend → llega el mail, se inserta el reminder, segunda corrida devuelve `already_sent`.
- **Cron**: `SELECT * FROM cron.job;` para confirmar el schedule.
- **UI** (dev 8080): crear turno mañana → card en Dashboard lo muestra → abrir panel desde Turnos → click WhatsApp abre wa.me con el mensaje correcto y queda la tilde ✓; recargar → persiste.
- **Suite completa** `npm test` (RLS nuevos incluidos) + lint techo 239 + build.

## 7. Pasos manuales de Jose

- Setear el secret `CRON_SECRET` de la edge function (yo genero el valor y paso el comando/lugar exacto).
- **Para producción real**: verificar un dominio propio en Resend y setear `REMINDER_FROM` (hasta entonces los emails solo llegan a su propia casilla — el panel de WhatsApp funciona completo desde el día uno).
