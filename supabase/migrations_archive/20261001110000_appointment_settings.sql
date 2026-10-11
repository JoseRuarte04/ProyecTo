-- Configuración de turnos por espacio de trabajo (personal o de equipo).
-- max_absences: cantidad de ausencias a partir de la cual se advierte al agendar
-- un turno nuevo al paciente. NULL = sin límite (sin advertencia).
create table if not exists appointment_settings (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('professional', 'team')),
  owner_id uuid not null,
  max_absences integer check (max_absences is null or max_absences >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id)
);

alter table appointment_settings enable row level security;

drop trigger if exists set_updated_at on appointment_settings;
create trigger set_updated_at
  before update on appointment_settings
  for each row
  execute function update_updated_at_column();

drop policy if exists "appointment_settings: ver" on appointment_settings;
create policy "appointment_settings: ver"
  on appointment_settings for select
  using (
    (owner_type = 'professional' and owner_id = auth.uid())
    or (owner_type = 'team' and is_team_member(owner_id))
  );

drop policy if exists "appointment_settings: gestionar" on appointment_settings;
create policy "appointment_settings: gestionar"
  on appointment_settings for all
  using (
    (owner_type = 'professional' and owner_id = auth.uid())
    or (owner_type = 'team' and is_team_admin(owner_id))
  )
  with check (
    (owner_type = 'professional' and owner_id = auth.uid())
    or (owner_type = 'team' and is_team_admin(owner_id))
  );
