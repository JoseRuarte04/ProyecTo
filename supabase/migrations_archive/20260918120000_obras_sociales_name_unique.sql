-- Evita duplicados case-insensitive en el catálogo compartido de obras
-- sociales (ej. "OSDE" y "osde" como dos filas distintas). El alta desde la
-- UI (ObrasSocialesAutocomplete) ya avisa "agregar" solo cuando no encuentra
-- coincidencia exacta entre los primeros 10 resultados de la búsqueda, pero
-- eso es solo una ayuda visual — sin este índice, nada impide la duplicación
-- real (dos usuarios cargando al mismo tiempo, o un término de búsqueda que
-- no trae el existente entre los primeros 10 resultados). Verificado contra
-- producción antes de aplicar: no había duplicados case-insensitive previos.
create unique index if not exists obras_sociales_name_lower_idx
  on public.obras_sociales (lower(name));
