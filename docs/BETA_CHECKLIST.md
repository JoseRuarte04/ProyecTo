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

### Dominio propio + Resend (en curso — comprándolo esta semana)

**Ya listo, sin esperar al dominio (2026-10-11):** la función
`send-team-invitation` desplegada en producción estaba **desactualizada**
desde antes del PR #52 — tenía el remitente de sandbox hardcodeado y ni
siquiera leía `RESEND_FROM` (encontrado comparando el código deployado
contra el del repo). Re-deployada con el código actual: mismo comportamiento
hasta que se cargue el secret (fallback a sandbox), lista para leerlo apenas
se configure. **No falta re-deployar nada más para esto.**

Pasos para cuando el dominio esté comprado (en orden, cada uno depende del
anterior):

1. **Resend → Domains → Add Domain.** Cargar el dominio. Resend da registros
   DNS (SPF, DKIM, y a veces un record de verificación) — cargarlos en el
   proveedor donde se compró el dominio (DNS management). Esperar a que
   Resend lo marque **Verified** (minutos a unas horas según el proveedor).
2. **Cargar el secret de la función de equipo:**
   ```
   supabase secrets set RESEND_FROM="HisTO <invitaciones@tudominio.com>" --project-ref pvuaqatdendcgumwktid
   ```
   (reemplazar `tudominio.com` por el dominio verificado en el paso 1; puede
   ser el dominio raíz o un subdominio tipo `mail.tudominio.com`, lo que se
   haya verificado). Los secrets se inyectan en runtime — no hace falta
   re-deployar la función de nuevo después de esto, ya está lista desde el
   punto anterior.
3. **Supabase Dashboard → Authentication → Settings → SMTP Settings →
   Enable Custom SMTP.** Esto arregla el rate limit del servicio nativo
   (que hoy limita las invitaciones individuales de profesional, ver punto 1
   del recorrido más arriba) pasando TODOS los mails de Auth (invitaciones,
   reset de password, confirmación de signup) por Resend en vez del
   servicio de prueba. Datos del SMTP relay de Resend:
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) o `587` (TLS)
   - Username: `resend`
   - Password: la API key de Resend (la misma que usa `RESEND_API_KEY`)
   - Sender email: una dirección del dominio verificado en el paso 1
   - Sender name: `HisTO`
4. **Probar los 2 flujos** del recorrido de arriba (punto 1: invitación
   individual; punto 2: invitación de equipo) con un email externo real —
   confirmar que ambos mails llegan.

Mientras no se complete esto: el botón "Copiar link" en las invitaciones de
equipo pendientes (`/mi-equipo`, PR #80) sirve de atajo manual — no hace
falta esperar al dominio para invitar equipos reales, solo hay que mandar el
link a mano en vez de que llegue por mail.

- [x] Secrets de backups (`SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `BACKUP_ENCRYPTION_PASSPHRASE`) — confirmado 2026-10-11 que están cargados
  en el Environment `production-backup` (no como repo secret, restringido a
  `main`). Cron semanal activo (lunes 6am UTC) + corrida manual exitosa el
  2026-10-08. Todavía no se vio una corrida automática por cron (recién
  empieza a aplicar) — confirmarlo el próximo lunes. Detalle completo de cada
  secret en `docs/BACKUP_RESTORE.md`.
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
