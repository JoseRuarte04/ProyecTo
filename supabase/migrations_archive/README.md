# Migraciones archivadas (2026-10-11)

Los archivos de esta carpeta **ya están aplicados en producción**. Se
movieron acá (no se borraron) al armar
`supabase/migrations/20261011210000_baseline_schema.sql`, que reemplaza su
efecto acumulado con un snapshot fiel de cómo quedó el esquema real después
de aplicarlos todos (generado con `supabase db dump --linked`).

**Actualizado al revisar este PR antes de mergear (mismo día):** el
baseline se regeneró con un dump fresco (el original quedó armado antes de
que se mergeara Turnos Fase 4) y absorbió 2 migraciones más que para
entonces ya estaban aplicadas en producción: `20261011120000_reconstruct_admin_users_rpcs.sql`
y `20261011120100_feedback_status_triage.sql` (panel admin, PR #82),
`20261011210000_appointments_recurrence_id.sql` y
`20261011220000_appointment_reminders.sql` (Turnos Fase 4, PRs #90/#91).
Todas idénticas a las que vivían en `supabase/migrations/` — se archivan
por el mismo motivo que el resto: el baseline ya captura su efecto, dejarlas
activas además del baseline rompería un `supabase start`/`db reset` desde
cero (create table / create policy duplicados).

## Por qué hacía falta esto

Confirmado contra el historial real de Supabase (`supabase migration list
--linked`) que casi todos estos archivos tienen un timestamp distinto en
producción al de su propio nombre de archivo (se aplicaron vía herramientas
que no preservan el timestamp del archivo). Además, varias tablas base
(`patients`, `profiles`, `therapy_sessions`, `teams`, `team_members`,
`team_invitations`, `audit_log`, y otras — 21 de las 38 tablas de
producción) **nunca tuvieron un `CREATE TABLE` en ningún archivo del
repo**: el esquema original se armó con Lovable antes de que el proyecto
adoptara migraciones versionadas, y desde entonces solo se versionaron los
cambios incrementales.

Esto significaba que un `supabase start`/`db reset` desde cero no podía
reconstruir la base real — bloqueaba cualquier trabajo que necesitara un
entorno local limpio (dev local, restaurar un backup real, etc.). Ver
`docs/TASKS.md` y `docs/DECISIONS.md` [2026-10-11] para el detalle completo.

## Qué significa esto para vos

- **Nada cambia en producción.** Mover archivos locales no toca la base
  real — estos archivos ya cumplieron su función ahí.
- **No se pierde nada:** si algún día hace falta ver exactamente qué SQL
  se corrió en un momento puntual (ej. para entender un bug viejo), está
  todo acá, intacto, con su timestamp y nombre original.
- **De ahora en más**, un `supabase start`/`db reset` desde cero usa solo
  el baseline + lo que venga después — mucho más simple y confiable.
- Si en el futuro hace falta reconstruir *otra vez* un baseline (por
  ejemplo, después de muchas migraciones nuevas), el mismo proceso aplica:
  dump real → archivar lo viejo → nuevo baseline.
