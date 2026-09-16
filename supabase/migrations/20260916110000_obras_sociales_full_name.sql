-- Obras sociales: nombre completo para búsqueda + alta de nuevas desde la UI.
-- name sigue siendo el valor mostrado/guardado en pacientes (el acrónimo de
-- siempre); full_name es nueva, solo alimenta la búsqueda y se muestra como
-- subtítulo en el autocomplete.
alter table public.obras_sociales
  add column full_name text;

-- unaccent vive en el schema "extensions" en este proyecto (no en "public"),
-- hay que calificarlo explícito o la función rompe con search_path = public.
create or replace function public.update_obras_sociales_search()
returns trigger
language plpgsql
set search_path to public
as $function$
begin
  new.name_search = extensions.unaccent(lower(new.name || ' ' || coalesce(new.full_name, '')));
  return new;
end;
$function$;

-- Backfill: nombre completo de las obras sociales sindicales que hoy solo
-- tienen el acrónimo (confuso para buscar), verificado contra el Registro
-- Nacional de Obras Sociales (RNOS, sssalud.gob.ar). Las que no aparecen en
-- ese registro quedan sin completar — mejor vacío que un nombre inventado
-- (candidato en TASKS.md para completarlas cuando Jose confirme el dato).
update public.obras_sociales set full_name = 'Obra Social de los Empleados de Comercio y Actividades Civiles' where name = 'OSECAC';
update public.obras_sociales set full_name = 'Obra Social del Personal de Entidades Deportivas y Civiles' where name = 'OSPEDYC';
update public.obras_sociales set full_name = 'Obra Social de la Unión de Trabajadores del Turismo, Hoteleros y Gastronómicos de la República Argentina' where name = 'OSUTHGRA';
update public.obras_sociales set full_name = 'Obra Social del Personal de la Actividad del Turf' where name = 'OSPAT';
update public.obras_sociales set full_name = 'Obra Social de Docentes Particulares' where name = 'OSDOP';
update public.obras_sociales set full_name = 'Obra Social para la Actividad Docente' where name = 'OSPLAD';
update public.obras_sociales set full_name = 'Obra Social del Sindicato de Mecánicos y Afines del Transporte Automotor' where name = 'OSMATA';
update public.obras_sociales set full_name = 'Obra Social de Electricistas Navales' where name = 'OSEN';
update public.obras_sociales set full_name = 'Obra Social del Personal de las Telecomunicaciones de la República Argentina' where name = 'OSTEL';
update public.obras_sociales set full_name = 'Obra Social del Personal de la Empresa Nacional de Correos y Telégrafos y de las Comunicaciones de la República Argentina' where name = 'OSPEC';
update public.obras_sociales set full_name = 'Obra Social del Personal de la Sanidad Argentina' where name = 'OSPSA';
update public.obras_sociales set full_name = 'Obra Social de la Federación Argentina del Trabajador de las Universidades Nacionales' where name = 'OSFATUN';
update public.obras_sociales set full_name = 'Obra Social del Personal de la Industria del Cuero y Afines' where name = 'OSPICA';
update public.obras_sociales set full_name = 'Obra Social de la Federación Argentina de Trabajadores de Luz y Fuerza' where name = 'OSFATLYF';
update public.obras_sociales set full_name = 'Obra Social Ferroviaria' where name = 'OSFE';
update public.obras_sociales set full_name = 'Obra Social del Personal Rural y Estibadores de la República Argentina' where name = 'OSPRERA';
update public.obras_sociales set full_name = 'Obra Social del Personal de Prensa de la República Argentina' where name = 'OSPPRA';
update public.obras_sociales set full_name = 'Obra Social de la Actividad de Seguros, Reaseguros, Capitalización, Ahorro y Préstamo para la Vivienda' where name = 'OSSEG';
update public.obras_sociales set full_name = 'Obra Social de Capataces Estibadores Portuarios' where name = 'OSCEP';
update public.obras_sociales set full_name = 'Obra Social del Personal de Aguas Gaseosas y Afines' where name = 'OSPAGA';
update public.obras_sociales set full_name = 'Obra Social del Personal de Imprentas, Diarios y Afines' where name = 'OSPIDA';
update public.obras_sociales set full_name = 'Obra Social del Poder Judicial de la Nación' where name = 'OSPJN';
update public.obras_sociales set full_name = 'Obra Social del Personal de la Industria del Caucho' where name = 'OSPIC';
update public.obras_sociales set full_name = 'Obra Social del Personal de la Industria Lechera' where name = 'OSPIL';
update public.obras_sociales set full_name = 'Obra Social de los Supervisores de la Industria Metalmecánica de la República Argentina' where name = 'OSSIMRA';
update public.obras_sociales set full_name = 'Acción Social de Empresarios (Obra Social del Personal de Dirección)' where name = 'ASE';
update public.obras_sociales set full_name = 'Obra Social del Personal de Dirección de la Industria Privada del Petróleo' where name = 'OSDIPP';

-- Permitir que cualquier profesional activo sume una obra social nueva al
-- catálogo compartido (hoy solo se puede insertar por SQL directo). Mismo
-- criterio que exercise_library: cualquier profesional activo, sin dueño
-- individual porque el catálogo es compartido entre todos.
create policy "obras_sociales: crear activos"
on public.obras_sociales
for insert
to authenticated
with check (public.is_active_professional());
