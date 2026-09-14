-- El catálogo global de ejercicios (exercise_library.professional_id IS
-- NULL, ver 20260823100000) debe poder aplicarse a un paciente igual que
-- cualquier ejercicio propio. add_routine_to_exercise_plan validaba
-- ownership con `professional_id IS DISTINCT FROM auth.uid()`, que rechaza
-- toda fila con professional_id NULL — se amplía para permitir NULL
-- (catálogo) además de las propias del que llama.
CREATE OR REPLACE FUNCTION add_routine_to_exercise_plan(
  p_patient_id     uuid,
  p_routine_id     uuid,
  p_items          jsonb, -- [{exercise_id, order_index, assigned_sets, assigned_reps, frequency, notes}, ...]
  p_start_date     date,
  p_duration_weeks integer,
  p_notes          text,
  p_program_id     uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_plan_id   uuid;
  v_max_order integer;
BEGIN
  IF p_routine_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM exercise_routines
    WHERE id = p_routine_id AND professional_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'routine not found or not owned by caller';
  END IF;

  IF p_program_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM exercise_programs
    WHERE id = p_program_id AND professional_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'program not found or not owned by caller';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    JOIN exercise_library el ON el.id = (item->>'exercise_id')::uuid
    WHERE el.professional_id IS NOT NULL
      AND el.professional_id IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'one or more exercises do not belong to the caller';
  END IF;

  INSERT INTO exercise_plans (patient_id, professional_id, notes, start_date, duration_weeks, routine_id, program_id)
  VALUES (p_patient_id, auth.uid(), p_notes, p_start_date, p_duration_weeks, p_routine_id, p_program_id)
  ON CONFLICT (patient_id) DO UPDATE
    SET notes          = COALESCE(EXCLUDED.notes, exercise_plans.notes),
        start_date     = COALESCE(EXCLUDED.start_date, exercise_plans.start_date),
        duration_weeks = COALESCE(EXCLUDED.duration_weeks, exercise_plans.duration_weeks),
        routine_id     = EXCLUDED.routine_id,
        program_id     = EXCLUDED.program_id,
        updated_at     = now()
  RETURNING id INTO v_plan_id;

  SELECT COALESCE(MAX(order_index), -1) INTO v_max_order
  FROM exercise_plan_items WHERE plan_id = v_plan_id;

  INSERT INTO exercise_plan_items (plan_id, exercise_id, order_index, assigned_sets, assigned_reps, frequency, notes)
  SELECT
    v_plan_id,
    (item->>'exercise_id')::uuid,
    v_max_order + 1 + (item->>'order_index')::integer,
    NULLIF(item->>'assigned_sets', '')::integer,
    NULLIF(item->>'assigned_reps', '')::integer,
    item->>'frequency',
    item->>'notes'
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_plan_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_routine_to_exercise_plan(uuid, uuid, jsonb, date, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_routine_to_exercise_plan(uuid, uuid, jsonb, date, integer, text, uuid) TO authenticated;
