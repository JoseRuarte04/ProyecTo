-- Performance de RLS e índices (advisors de Supabase, informe 2026-07-15).
--
-- 1) auth_rls_initplan: 64 políticas (public + storage) llaman auth.uid()
-- directo, que Postgres re-evalúa POR CADA FILA. Envuelto en (select ...)
-- se evalúa una sola vez por query (InitPlan). El bloque DO reescribe cada
-- política desde pg_policies reemplazando auth.uid() → (select auth.uid()),
-- sin tocar ninguna otra parte de la expresión (misma semántica).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (COALESCE(qual, '') ~ 'auth\.uid\(\)' OR COALESCE(with_check, '') ~ 'auth\.uid\(\)')
      -- saltear las que ya están envueltas
      AND COALESCE(qual, '') !~ 'SELECT auth\.uid\(\)'
      AND COALESCE(with_check, '') !~ 'SELECT auth\.uid\(\)'
  LOOP
    EXECUTE 'ALTER POLICY ' || quote_ident(r.policyname)
      || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename)
      || CASE WHEN r.qual IS NOT NULL
           THEN ' USING (' || replace(r.qual, 'auth.uid()', '(select auth.uid())') || ')'
           ELSE '' END
      || CASE WHEN r.with_check IS NOT NULL
           THEN ' WITH CHECK (' || replace(r.with_check, 'auth.uid()', '(select auth.uid())') || ')'
           ELSE '' END;
  END LOOP;
END $$;

-- 2) unindexed_foreign_keys: 15 FKs sin índice de cobertura. Afecta joins
-- y sobre todo los chequeos de integridad al borrar/actualizar la fila padre.

CREATE INDEX IF NOT EXISTS idx_exercise_body_regions_professional_id ON public.exercise_body_regions (professional_id);
CREATE INDEX IF NOT EXISTS idx_exercise_library_body_region_id       ON public.exercise_library (body_region_id);
CREATE INDEX IF NOT EXISTS idx_exercise_plan_items_exercise_id       ON public.exercise_plan_items (exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_plan_items_plan_id           ON public.exercise_plan_items (plan_id);
CREATE INDEX IF NOT EXISTS idx_exercise_plan_tokens_patient_id       ON public.exercise_plan_tokens (patient_id);
CREATE INDEX IF NOT EXISTS idx_exercise_plan_tokens_plan_id          ON public.exercise_plan_tokens (plan_id);
CREATE INDEX IF NOT EXISTS idx_exercise_plan_tokens_professional_id  ON public.exercise_plan_tokens (professional_id);
CREATE INDEX IF NOT EXISTS idx_exercise_plans_patient_id             ON public.exercise_plans (patient_id);
CREATE INDEX IF NOT EXISTS idx_exercise_plans_professional_id        ON public.exercise_plans (professional_id);
CREATE INDEX IF NOT EXISTS idx_quickdash_tokens_created_by           ON public.quickdash_tokens (created_by);
CREATE INDEX IF NOT EXISTS idx_quickdash_tokens_patient_id           ON public.quickdash_tokens (patient_id);
CREATE INDEX IF NOT EXISTS idx_quickdash_tokens_session_id           ON public.quickdash_tokens (session_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_by           ON public.team_invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_team_members_invited_by               ON public.team_members (invited_by);
CREATE INDEX IF NOT EXISTS idx_teams_created_by                      ON public.teams (created_by);

-- Nota: el advisor también marca 7 tablas con "multiple permissive policies"
-- (una policy ALL + una SELECT que se superponen). Consolidarlas cambia
-- semántica de permisos con facilidad y el beneficio con este volumen es
-- marginal — se deja documentado y a propósito sin tocar.
