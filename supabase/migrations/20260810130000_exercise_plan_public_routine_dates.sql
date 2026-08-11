-- get_exercise_plan_public suma start_date/duration_weeks al JSON para que
-- el paciente vea la programación del programa en el link público.
CREATE OR REPLACE FUNCTION get_exercise_plan_public(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_result  json;
BEGIN
  SELECT plan_id INTO v_plan_id
  FROM exercise_plan_tokens
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'plan_notes',     ep.notes,
    'start_date',     ep.start_date,
    'duration_weeks', ep.duration_weeks,
    'items', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'order_index',   epi.order_index,
            'assigned_sets', epi.assigned_sets,
            'assigned_reps', epi.assigned_reps,
            'frequency',     epi.frequency,
            'item_notes',    epi.notes,
            'exercise', json_build_object(
              'name',             el.name,
              'exercise_type',    el.exercise_type,
              'instructions',     el.instructions,
              'starting_position',el.starting_position,
              'precautions',      el.precautions,
              'equipment',        el.equipment,
              'video_url',        el.video_url
            )
          )
          ORDER BY epi.order_index
        )
        FROM exercise_plan_items epi
        JOIN exercise_library el ON el.id = epi.exercise_id
        WHERE epi.plan_id = v_plan_id
      ),
      '[]'::json
    )
  )
  INTO v_result
  FROM exercise_plans ep
  WHERE ep.id = v_plan_id;

  RETURN v_result;
END;
$$;
