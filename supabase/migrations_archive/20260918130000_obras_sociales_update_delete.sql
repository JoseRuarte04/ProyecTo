-- Permitir editar y borrar obras sociales del catálogo compartido desde la
-- UI (hoy solo había policy de SELECT/INSERT). Mismo criterio que el resto
-- del catálogo: cualquier profesional activo, sin dueño individual.
drop policy if exists "obras_sociales: editar activos" on public.obras_sociales;

create policy "obras_sociales: editar activos"
on public.obras_sociales
for update
to authenticated
using (public.is_active_professional())
with check (public.is_active_professional());

drop policy if exists "obras_sociales: borrar activos" on public.obras_sociales;

create policy "obras_sociales: borrar activos"
on public.obras_sociales
for delete
to authenticated
using (public.is_active_professional());
