-- Prep para la beta (docs/DECISIONS.md 2026-10-06): botón "Reportar
-- problema/sugerencia" visible en toda la app autenticada.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_created_at on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "feedback: crear propio" on public.feedback;
create policy "feedback: crear propio" on public.feedback
  for insert
  with check (user_id = auth.uid());

drop policy if exists "feedback: ver propio o admin" on public.feedback;
create policy "feedback: ver propio o admin" on public.feedback
  for select
  using (user_id = auth.uid() or is_super_admin());
