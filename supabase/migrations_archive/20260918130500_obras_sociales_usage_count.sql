-- RPC para el guard de borrado de obras sociales. `patients` tiene RLS
-- scoped por profesional/equipo (ver policy "patients: ver"), así que un
-- count hecho directo desde el cliente solo vería los pacientes propios —
-- insuficiente acá porque obras_sociales es un catálogo 100% compartido
-- entre TODOS los profesionales del sistema (no solo del equipo del que
-- borra). SECURITY DEFINER para contar pacientes de cualquier profesional,
-- igual que is_active_professional() bypasea RLS para su propio chequeo.
create or replace function public.obra_social_usage_count(p_name text)
returns bigint
language sql
stable
security definer
set search_path to public
as $function$
  select count(*) from patients
  where is_deleted = false
    and insurance ilike p_name;
$function$;

revoke all on function public.obra_social_usage_count(text) from public;
grant execute on function public.obra_social_usage_count(text) to authenticated;
