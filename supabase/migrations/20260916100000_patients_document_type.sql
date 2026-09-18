-- Tipo de documento del paciente (DNI por defecto, para no romper altas existentes).
-- La columna dni sigue guardando el número sin importar el tipo elegido.
-- IF NOT EXISTS / DROP...IF EXISTS: la columna y el constraint ya se aplicaron
-- directo contra producción (pvuaqatdendcgumwktid) antes de mergear este PR,
-- así que esta migración tiene que poder correr de nuevo sin romper — acá o
-- contra una base nueva reconstruida desde cero.
alter table public.patients
  add column if not exists document_type text not null default 'dni';

alter table public.patients
  drop constraint if exists patients_document_type_check;

alter table public.patients
  add constraint patients_document_type_check
  check (document_type in ('dni', 'lc', 'le', 'passport', 'foreign_id', 'other'));
