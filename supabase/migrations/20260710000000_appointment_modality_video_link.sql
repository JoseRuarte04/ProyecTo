-- Modalidad del turno (presencial/virtual) y link de videollamada (Daily.co)
create type public.appointment_modality as enum ('in_person', 'virtual');

alter table public.appointments
  add column modality public.appointment_modality not null default 'in_person',
  add column video_link text;
