-- Tipo de documento del paciente (DNI por defecto, para no romper altas existentes).
-- La columna dni sigue guardando el número sin importar el tipo elegido.
alter table public.patients
  add column document_type text not null default 'dni';

alter table public.patients
  add constraint patients_document_type_check
  check (document_type in ('dni', 'lc', 'le', 'passport', 'foreign_id', 'other'));
