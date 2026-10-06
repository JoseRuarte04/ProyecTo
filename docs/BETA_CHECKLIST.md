# Checklist de beta cerrada (~30 profesionales, pacientes reales)

> Recorrido manual para que Jose lo haga con un email externo real (no
> `rls-test-a/b@example.com`) antes de invitar a nadie. Checkear cada paso en
> el navegador, no asumir que "si compila, funciona".

## 1. Invitación de un profesional nuevo (flujo nativo)

1. Como admin, invitar al email externo desde el panel de admin
   (`/admin/therapists` → invitar).
2. Confirmar que el mail llega (hoy sale por el servicio nativo de Supabase
   Auth — si no llega, revisar el rate limit del plan free antes de asumir
   que es un bug de código).
3. Abrir el link del mail → `/accept-invite` → tiene que pedir contraseña +
   el checkbox de política de privacidad (obligatorio para poder enviar).
4. Confirmar → tiene que entrar directo al dashboard.
5. **Si no tenía fila en `privacy_consents` por algún motivo**, al entrar al
   dashboard tiene que aparecer el diálogo bloqueante de consentimiento —
   confirmar que "Acepto" lo destraba.

## 2. Invitación de equipo (flujo separado, no se toca con lo de arriba)

1. Desde `/mi-equipo`, invitar al mismo (u otro) email externo a un equipo.
2. Confirmar que el mail llega — este sale por Resend con el dominio de
   prueba (`onboarding@resend.dev`), que **solo entrega al dueño de la
   cuenta de Resend**. Si el dueño de la cuenta no es el destinatario, el
   mail no va a llegar — no es un bug, es la limitación conocida hasta que
   haya dominio propio (ver sección de abajo).
3. Abrir el link → `/registro` → formulario completo (nombre, contraseña,
   checkbox de privacidad obligatorio) → crear cuenta.
4. Según si el proyecto exige confirmar el email: puede pedir confirmar
   desde el correo antes de poder loguear. El consentimiento, si no quedó
   registrado en ese paso (no hay sesión todavía mientras se espera la
   confirmación), se termina de pedir en el primer login real — mismo gate
   del punto 1.5.

## 3. Workspace → paciente → sesión

1. Login real → si tiene más de un equipo, elegir workspace.
2. Dar de alta un paciente de prueba (usar un DNI que no sea de nadie real).
3. Registrar una admisión / primera sesión.
4. Confirmar que no hay errores de consola en ningún paso.
5. **Borrar el paciente/datos de prueba al final** (o anotarlo para
   borrarlo después) — no dejar basura de este recorrido en producción.

## 4. Feedback

1. Con el mismo usuario, click en el botón flotante de feedback (esquina
   inferior).
2. Mandar un mensaje de prueba.
3. Como admin, ir a `/admin/feedback` y confirmar que aparece.

## 5. Banner de beta

1. Confirmar que aparece arriba del contenido al entrar.
2. Cerrarlo (×) → recargar la página → confirmar que no vuelve a aparecer
   (queda guardado en el navegador, no en la cuenta — en otro navegador
   volvería a aparecer).

---

## Antes de invitar a los 30 testers

Todo esto depende de Jose, no se puede resolver desde el código:

- [ ] **Dominio propio.** Sin esto, ninguna invitación de equipo llega a un
  externo real (ver punto 2 de arriba). Una vez comprado: verificarlo en
  Resend, cargar los registros DNS que da Resend, y configurar el SMTP
  custom de Supabase Auth (Dashboard → Auth → SMTP Settings) con las
  credenciales de Resend — esto además arregla el rate limit del servicio
  nativo de Supabase Auth (punto 1 de arriba), porque pasa a mandar los
  mails por Resend en vez del servicio de prueba.
- [ ] Una vez con el dominio: cargar el secret `RESEND_FROM` en la función
  `send-team-invitation` (`supabase secrets set RESEND_FROM="HisTO <invitaciones@mail.tudominio>" --project-ref pvuaqatdendcgumwktid`)
  y re-deployarla.
- [ ] Deployar `send-team-invitation` apenas se mergee su PR (el cambio de
  código no se auto-deploya, es una acción manual — ver PR correspondiente).
- [ ] Secrets de backups (`SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `BACKUP_ENCRYPTION_PASSPHRASE`) — detalle completo de cada uno en
  `docs/BACKUP_RESTORE.md`.
- [ ] Activar **Web Analytics** en el dashboard de Vercel (el paquete
  `@vercel/analytics` instalado no alcanza solo, hay que habilitarlo ahí).
- [ ] Revisar y completar el **email de contacto real** en `/privacidad`
  (hoy tiene un placeholder `[COMPLETAR]` a propósito, bien visible).
- [ ] Revisar los textos marcados como BORRADOR: política de privacidad
  completa, checkbox de consentimiento, banner de beta — son textos que
  escribió Claude Code, no textos legales revisados.
- [ ] Si no se hizo ya en esta sesión: rotar las passwords de
  `rls-test-a/b@example.com` (quedaron expuestas en un repo público desde
  julio — ver `docs/DECISIONS.md` 2026-10-06).
