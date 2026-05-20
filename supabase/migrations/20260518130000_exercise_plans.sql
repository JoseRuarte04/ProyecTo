-- exercise_plans: plan de ejercicios domiciliarios del paciente
CREATE TABLE exercise_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercise_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeutas acceden a sus planes de ejercicios"
  ON exercise_plans FOR ALL
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

-- exercise_plan_items: ejercicios dentro del plan
CREATE TABLE exercise_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES exercise_plans(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercise_library(id) ON DELETE RESTRICT,
  order_index integer NOT NULL DEFAULT 0,
  assigned_sets integer,
  assigned_reps integer,
  frequency text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercise_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeutas acceden a items de sus planes"
  ON exercise_plan_items FOR ALL
  USING (
    plan_id IN (
      SELECT id FROM exercise_plans WHERE professional_id = auth.uid()
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT id FROM exercise_plans WHERE professional_id = auth.uid()
    )
  );
