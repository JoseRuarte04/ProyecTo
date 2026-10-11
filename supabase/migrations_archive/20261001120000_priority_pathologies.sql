-- Semáforo de prioridades de turnos: la terapista asigna un nivel (rojo/amarillo/verde)
-- a patologías (CIE-10 o texto libre). Personal o de equipo (solo admins editan).
create table if not exists priority_pathologies (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('professional', 'team')),
  owner_id uuid not null,
  code text,
  label text not null,
  level text not null check (level in ('red', 'yellow', 'green')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists priority_pathologies_owner_label_idx
  on priority_pathologies (owner_type, owner_id, lower(label));

alter table priority_pathologies enable row level security;

drop trigger if exists set_updated_at on priority_pathologies;
create trigger set_updated_at
  before update on priority_pathologies
  for each row
  execute function update_updated_at_column();

drop policy if exists "priority_pathologies: ver" on priority_pathologies;
create policy "priority_pathologies: ver"
  on priority_pathologies for select
  using (
    (owner_type = 'professional' and owner_id = auth.uid())
    or (owner_type = 'team' and is_team_member(owner_id))
  );

drop policy if exists "priority_pathologies: gestionar" on priority_pathologies;
create policy "priority_pathologies: gestionar"
  on priority_pathologies for all
  using (
    (owner_type = 'professional' and owner_id = auth.uid())
    or (owner_type = 'team' and is_team_admin(owner_id))
  )
  with check (
    (owner_type = 'professional' and owner_id = auth.uid())
    or (owner_type = 'team' and is_team_admin(owner_id))
  );
