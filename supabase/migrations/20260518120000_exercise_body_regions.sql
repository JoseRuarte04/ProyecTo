-- exercise_body_regions: apartados navegables de la biblioteca de ejercicios
CREATE TABLE exercise_body_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  professional_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercise_body_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeutas acceden a sus apartados"
  ON exercise_body_regions FOR ALL
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

-- FK en exercise_library: nullable, ON DELETE SET NULL para que al borrar un
-- apartado los ejercicios queden sin apartado en lugar de bloquearse o borrarse
ALTER TABLE exercise_library
  ADD COLUMN body_region_id uuid
    REFERENCES exercise_body_regions(id)
    ON DELETE SET NULL;
