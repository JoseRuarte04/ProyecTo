-- exercise_routines: plantillas reutilizables de ejercicios (nivel intermedio
-- entre la biblioteca y el plan de un paciente), sin paciente asociado.
CREATE TABLE exercise_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercise_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeutas acceden a sus rutinas"
  ON exercise_routines FOR ALL
  USING (professional_id = (select auth.uid()))
  WITH CHECK (professional_id = (select auth.uid()));

CREATE INDEX idx_exercise_routines_professional_id ON public.exercise_routines (professional_id);

-- exercise_routine_items: ejercicios de la rutina con dosificación sugerida
-- (default, no asignada a nadie todavía).
CREATE TABLE exercise_routine_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid NOT NULL REFERENCES exercise_routines(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercise_library(id) ON DELETE RESTRICT,
  order_index integer NOT NULL DEFAULT 0,
  suggested_sets integer,
  suggested_reps integer,
  frequency text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercise_routine_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeutas acceden a items de sus rutinas"
  ON exercise_routine_items FOR ALL
  USING (
    routine_id IN (SELECT id FROM exercise_routines WHERE professional_id = (select auth.uid()))
  )
  WITH CHECK (
    routine_id IN (SELECT id FROM exercise_routines WHERE professional_id = (select auth.uid()))
  );

CREATE INDEX idx_exercise_routine_items_routine_id  ON public.exercise_routine_items (routine_id);
CREATE INDEX idx_exercise_routine_items_exercise_id ON public.exercise_routine_items (exercise_id);
