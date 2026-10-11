-- exercise_programs: nivel superior reutilizable que agrupa varios Planes
-- (exercise_routines), sin paciente asociado. Se arma en la Biblioteca y
-- después se aplica completo a un paciente (crea/extiende su exercise_plans).
CREATE TABLE exercise_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercise_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeutas acceden a sus programas"
  ON exercise_programs FOR ALL
  USING (professional_id = (select auth.uid()))
  WITH CHECK (professional_id = (select auth.uid()));

CREATE INDEX idx_exercise_programs_professional_id ON public.exercise_programs (professional_id);

-- exercise_program_routines: qué Planes (rutinas) componen el programa, y en
-- qué orden. RESTRICT: no se puede borrar un Plan que esté dentro de un
-- Programa sin sacarlo antes (mismo criterio que exercise_routine_items con
-- exercise_id).
CREATE TABLE exercise_program_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES exercise_programs(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES exercise_routines(id) ON DELETE RESTRICT,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercise_program_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeutas acceden a items de sus programas"
  ON exercise_program_routines FOR ALL
  USING (
    program_id IN (SELECT id FROM exercise_programs WHERE professional_id = (select auth.uid()))
  )
  WITH CHECK (
    program_id IN (SELECT id FROM exercise_programs WHERE professional_id = (select auth.uid()))
  );

CREATE INDEX idx_exercise_program_routines_program_id ON public.exercise_program_routines (program_id);
CREATE INDEX idx_exercise_program_routines_routine_id ON public.exercise_program_routines (routine_id);
