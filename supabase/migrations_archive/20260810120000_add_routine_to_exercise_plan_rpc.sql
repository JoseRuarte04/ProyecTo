-- Aplica una rutina (o un conjunto de ítems armado ad hoc en el wizard) al
-- plan de un paciente: crea el plan si no existe, o lo actualiza si ya existe
-- (el paciente siempre tiene un único plan — ver UNIQUE(patient_id)), y agrega
-- los ítems a continuación de los que ya tenía.
--
-- SECURITY INVOKER (default): corre con el auth.uid() real del profesional,
-- así que las RLS de exercise_plans/exercise_plan_items ya cubren el acceso
-- (no hace falta SECURITY DEFINER acá — se reserva para los RPCs que debe
-- poder llamar anon, como los de exercise_plan_tokens).
CREATE OR REPLACE FUNCTION add_routine_to_exercise_plan(
  p_patient_id     uuid,
  p_routine_id     uuid,
  p_items          jsonb, -- [{exercise_id, order_index, assigned_sets, assigned_reps, frequency, notes}, ...]
  p_start_date     date,
  p_duration_weeks integer,
  p_notes          text
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

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    JOIN exercise_library el ON el.id = (item->>'exercise_id')::uuid
    WHERE el.professional_id IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'one or more exercises do not belong to the caller';
  END IF;

  INSERT INTO exercise_plans (patient_id, professional_id, notes, start_date, duration_weeks, routine_id)
  VALUES (p_patient_id, auth.uid(), p_notes, p_start_date, p_duration_weeks, p_routine_id)
  ON CONFLICT (patient_id) DO UPDATE
    SET notes          = COALESCE(EXCLUDED.notes, exercise_plans.notes),
        start_date     = COALESCE(EXCLUDED.start_date, exercise_plans.start_date),
        duration_weeks = COALESCE(EXCLUDED.duration_weeks, exercise_plans.duration_weeks),
        routine_id     = EXCLUDED.routine_id,
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

REVOKE EXECUTE ON FUNCTION public.add_routine_to_exercise_plan(uuid, uuid, jsonb, date, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_routine_to_exercise_plan(uuid, uuid, jsonb, date, integer, text) TO authenticated;
