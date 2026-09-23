-- Configuración de qué evaluaciones/escalas se muestran en el wizard de sesiones.
-- owner_type='professional': preferencia individual del profesional (workspace personal).
-- owner_type='team': preferencia compartida por todo el equipo (workspace de equipo, solo admins editan).
-- Ausencia de fila = habilitado (opt-out, no hace falta seedear nada).
create table if not exists evaluation_settings (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('professional', 'team')),
  owner_id uuid not null,
  evaluation_key text not null check (evaluation_key in (
    'barthel', 'fim', 'occupations', 'performance_context',
    'analitica_pain', 'analitica_edema', 'analitica_mobility', 'analitica_muscle_strength',
    'analitica_sensitivity', 'analitica_scar', 'analitica_specific_tests', 'analitica_other'
  )),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id, evaluation_key)
);

create index if not exists evaluation_settings_owner_idx on evaluation_settings (owner_type, owner_id);

alter table evaluation_settings enable row level security;

create trigger set_updated_at
  before update on evaluation_settings
  for each row
  execute function update_updated_at_column();

create policy "evaluation_settings: ver"
  on evaluation_settings for select
  using (
    (owner_type = 'professional' and owner_id = auth.uid())
    or (owner_type = 'team' and is_team_member(owner_id))
  );

create policy "evaluation_settings: gestionar"
  on evaluation_settings for all
  using (
    (owner_type = 'professional' and owner_id = auth.uid())
    or (owner_type = 'team' and is_team_admin(owner_id))
  )
  with check (
    (owner_type = 'professional' and owner_id = auth.uid())
    or (owner_type = 'team' and is_team_admin(owner_id))
  );
