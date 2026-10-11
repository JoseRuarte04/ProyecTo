-- Prep para la beta (docs/DECISIONS.md 2026-10-06): registro de consentimiento de
-- la política de privacidad. Tabla append-only — un usuario puede tener varias filas
-- a lo largo del tiempo (una por versión aceptada), nunca se edita ni se borra una
-- fila existente.

create table if not exists public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null,
  accepted_at timestamptz not null default now()
);

create index if not exists idx_privacy_consents_user_version
  on public.privacy_consents (user_id, policy_version);

alter table public.privacy_consents enable row level security;

drop policy if exists "privacy_consents: crear propio" on public.privacy_consents;
create policy "privacy_consents: crear propio" on public.privacy_consents
  for insert
  with check (user_id = auth.uid());

drop policy if exists "privacy_consents: ver propio" on public.privacy_consents;
create policy "privacy_consents: ver propio" on public.privacy_consents
  for select
  using (user_id = auth.uid() or is_super_admin());

-- Sin policies de update/delete a propósito: un consentimiento aceptado no se edita
-- ni se borra, queda como registro histórico.
