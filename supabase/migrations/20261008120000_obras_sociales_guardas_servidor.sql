-- Obras sociales: las protecciones que hoy viven solo en el front pasan a la base.
-- Hallazgos del QA del 2026-10-08 (informe fuera del repo):
--  1. Renombrar una obra social en uso dejaba huérfanos a los pacientes (patients.insurance es texto
--     copiado, no una FK) y la guarda de borrado pasaba a contar 0 usos.
--  2. La guarda "no se puede borrar si está en uso" era solo del front: cualquier profesional podía
--     borrar una obra social en uso con un DELETE directo contra la API.
--  3. El índice único (lower(name)) no ve espacios ni tildes: "OSDE " y "Galenó" entraban junto a
--     "OSDE" y "Galeno".
--  4. La base aceptaba nombres vacíos y de 5000 caracteres.
--  5. obra_social_usage_count respondía sin login (el REVOKE FROM PUBLIC no saca el permiso directo de
--     anon) y su ilike no escapaba % ni _.
--
-- Todo es idempotente y no falla si en producción ya hay datos "sucios": la unicidad se valida con un
-- trigger (solo mira filas nuevas o editadas) y el CHECK se crea NOT VALID (no revisa las existentes).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Normalización: minúsculas, sin tildes, sin espacios de más
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.normalize_obra_social_name(p text)
returns text
language sql
stable
set search_path to public
as $function$
  select lower(extensions.unaccent(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))));
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Conteo de uso: coincidencia exacta normalizada (sin comodines) y sin acceso anónimo
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: obras_sociales es un catálogo compartido entre todos los profesionales, y `patients`
-- tiene RLS por profesional/equipo; hay que contar pacientes de cualquiera (ver migración 20260918130500).
create or replace function public.obra_social_usage_count(p_name text)
returns bigint
language sql
stable
security definer
set search_path to public
as $function$
  select count(*) from patients
  where is_deleted = false
    and insurance is not null
    and public.normalize_obra_social_name(insurance) = public.normalize_obra_social_name(p_name);
$function$;

revoke all on function public.obra_social_usage_count(text) from public;
revoke all on function public.obra_social_usage_count(text) from anon;
grant execute on function public.obra_social_usage_count(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Al insertar/editar: limpiar el nombre, validarlo y rechazar duplicados "disfrazados"
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.validate_obra_social()
returns trigger
language plpgsql
set search_path to public
as $function$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if new.full_name is not null then
    new.full_name := nullif(btrim(regexp_replace(new.full_name, '\s+', ' ', 'g')), '');
  end if;

  if new.name = '' then
    raise exception 'El nombre de la obra social no puede estar vacío' using errcode = '23514';
  end if;
  if length(new.name) > 120 then
    raise exception 'El nombre de la obra social no puede superar los 120 caracteres' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.obras_sociales o
    where o.id <> coalesce(new.id, -1)
      and public.normalize_obra_social_name(o.name) = public.normalize_obra_social_name(new.name)
  ) then
    -- 23505 = unique_violation: el front ya lo traduce a "ya existe".
    raise exception 'Ya existe una obra social con ese nombre' using errcode = '23505';
  end if;

  return new;
end;
$function$;

-- Se llama "normalize" para que dispare antes que trg_obras_sociales_search (orden alfabético):
-- así name_search se calcula con el nombre ya limpio.
drop trigger if exists trg_obras_sociales_normalize on public.obras_sociales;
create trigger trg_obras_sociales_normalize
  before insert or update on public.obras_sociales
  for each row execute function public.validate_obra_social();

-- Red de seguridad extra, NOT VALID para no fallar si hay filas viejas fuera de regla.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'obras_sociales_name_valid' and conrelid = 'public.obras_sociales'::regclass
  ) then
    alter table public.obras_sociales
      add constraint obras_sociales_name_valid
      check (btrim(name) <> '' and length(name) <= 120) not valid;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Renombrar: actualizar a los pacientes que tenían el nombre viejo
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: los pacientes son de distintos profesionales y su RLS no deja tocarlos a quien renombra.
-- Solo cambia el texto de la cobertura; incluye pacientes dados de baja para que no queden con el nombre viejo.
create or replace function public.propagate_obra_social_rename()
returns trigger
language plpgsql
security definer
set search_path to public
as $function$
begin
  if new.name is distinct from old.name then
    update public.patients
       set insurance = new.name
     where insurance is not null
       and public.normalize_obra_social_name(insurance) = public.normalize_obra_social_name(old.name);
  end if;
  return new;
end;
$function$;

revoke all on function public.propagate_obra_social_rename() from public;
revoke all on function public.propagate_obra_social_rename() from anon;
revoke all on function public.propagate_obra_social_rename() from authenticated;

drop trigger if exists trg_obras_sociales_rename on public.obras_sociales;
create trigger trg_obras_sociales_rename
  after update of name on public.obras_sociales
  for each row execute function public.propagate_obra_social_rename();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Borrar: no se puede si algún paciente la tiene cargada (guarda en la base, no solo en el front)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.block_obra_social_delete_in_use()
returns trigger
language plpgsql
set search_path to public
as $function$
declare
  v_count bigint;
begin
  v_count := public.obra_social_usage_count(old.name);
  if v_count > 0 then
    -- 23503 = foreign_key_violation: es el mismo tipo de error que daría una FK real.
    raise exception '"%" está en uso por % paciente%: no se puede eliminar',
      old.name, v_count, case when v_count = 1 then '' else 's' end
      using errcode = '23503';
  end if;
  return old;
end;
$function$;

revoke all on function public.block_obra_social_delete_in_use() from public;
revoke all on function public.block_obra_social_delete_in_use() from anon;
revoke all on function public.block_obra_social_delete_in_use() from authenticated;

drop trigger if exists trg_obras_sociales_block_delete on public.obras_sociales;
create trigger trg_obras_sociales_block_delete
  before delete on public.obras_sociales
  for each row execute function public.block_obra_social_delete_in_use();
