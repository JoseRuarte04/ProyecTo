-- Corrige un espacio final en name_search cuando full_name es null
-- (coalesce a '' deja "acronimo " con espacio colgante). No afecta el
-- matching de ILIKE, es solo prolijidad del dato.
create or replace function public.update_obras_sociales_search()
returns trigger
language plpgsql
set search_path to public
as $function$
begin
  new.name_search = trim(extensions.unaccent(lower(new.name || ' ' || coalesce(new.full_name, ''))));
  return new;
end;
$function$;

update public.obras_sociales set name_search = trim(name_search) where name_search like '% ';
