


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "extensions";


ALTER SCHEMA "extensions" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."appointment_modality" AS ENUM (
    'in_person',
    'virtual'
);


ALTER TYPE "public"."appointment_modality" OWNER TO "postgres";


CREATE TYPE "public"."appointment_status" AS ENUM (
    'scheduled',
    'completed',
    'cancelled',
    'waiting',
    'absent',
    'absent_with_notice'
);


ALTER TYPE "public"."appointment_status" OWNER TO "postgres";


CREATE TYPE "public"."appointment_type" AS ENUM (
    'consultation',
    'follow_up',
    'evaluation'
);


ALTER TYPE "public"."appointment_type" OWNER TO "postgres";


CREATE TYPE "public"."audit_action" AS ENUM (
    'insert',
    'update',
    'delete',
    'soft_delete',
    'restore',
    'deactivate'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."audit_context" AS ENUM (
    'user',
    'system'
);


ALTER TYPE "public"."audit_context" OWNER TO "postgres";


CREATE TYPE "public"."clinical_file_category" AS ENUM (
    'study',
    'photo',
    'document'
);


ALTER TYPE "public"."clinical_file_category" OWNER TO "postgres";


CREATE TYPE "public"."dominance_type" AS ENUM (
    'right',
    'left',
    'ambidextrous'
);


ALTER TYPE "public"."dominance_type" OWNER TO "postgres";


CREATE TYPE "public"."exercise_category" AS ENUM (
    'general',
    'occupation',
    'sport',
    'joint_protection',
    'skin_care'
);


ALTER TYPE "public"."exercise_category" OWNER TO "postgres";


CREATE TYPE "public"."patient_status" AS ENUM (
    'active',
    'discharged',
    'paused',
    'abandoned'
);


ALTER TYPE "public"."patient_status" OWNER TO "postgres";


CREATE TYPE "public"."profile_role" AS ENUM (
    'professional',
    'admin',
    'patient'
);


ALTER TYPE "public"."profile_role" OWNER TO "postgres";


CREATE TYPE "public"."treatment_plan_status" AS ENUM (
    'active',
    'completed',
    'archived'
);


ALTER TYPE "public"."treatment_plan_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "extensions"."grant_pg_cron_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
    revoke trigger on cron.job_run_details from postgres;
  END IF;
END;
$$;


ALTER FUNCTION "extensions"."grant_pg_cron_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_cron_access"() IS 'Grants access to pg_cron';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_graphql_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
begin
    if not exists (
        select 1
        from pg_catalog.pg_event_trigger_ddl_commands() ev
        join pg_catalog.pg_extension e on ev.objid = e.oid
        where e.extname = 'pg_graphql'
    ) then
        return;
    end if;

    drop function if exists graphql_public.graphql;
    create or replace function graphql_public.graphql(
        "operationName" text default null,
        query text default null,
        variables jsonb default null,
        extensions jsonb default null
    )
        returns jsonb
        language sql
    as $$
        select graphql.resolve(
            query := query,
            variables := coalesce(variables, '{}'),
            "operationName" := "operationName",
            extensions := extensions
        );
    $$;

    -- Attach the wrapper to the extension so DROP EXTENSION cascades to it,
    -- which in turn triggers set_graphql_placeholder to reinstall the "not enabled" stub.
    alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);

    grant usage on schema graphql to postgres, anon, authenticated, service_role;
    grant execute on function graphql.resolve to postgres, anon, authenticated, service_role;
    grant usage on schema graphql to postgres with grant option;
    grant usage on schema graphql_public to postgres with grant option;
end;
$_$;


ALTER FUNCTION "extensions"."grant_pg_graphql_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_graphql_access"() IS 'Grants access to pg_graphql';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_net_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8.0', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "extensions"."grant_pg_net_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_net_access"() IS 'Grants access to pg_net';



CREATE OR REPLACE FUNCTION "extensions"."pgrst_ddl_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_ddl_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."pgrst_drop_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_drop_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."set_graphql_placeholder"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
            set search_path to ''
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION "extensions"."set_graphql_placeholder"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."set_graphql_placeholder"() IS 'Reintroduces placeholder function for graphql_public.graphql';



CREATE OR REPLACE FUNCTION "public"."add_routine_to_exercise_plan"("p_patient_id" "uuid", "p_routine_id" "uuid", "p_items" "jsonb", "p_start_date" "date", "p_duration_weeks" integer, "p_notes" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."add_routine_to_exercise_plan"("p_patient_id" "uuid", "p_routine_id" "uuid", "p_items" "jsonb", "p_start_date" "date", "p_duration_weeks" integer, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_routine_to_exercise_plan"("p_patient_id" "uuid", "p_routine_id" "uuid", "p_items" "jsonb", "p_start_date" "date", "p_duration_weeks" integer, "p_notes" "text", "p_program_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
    WHERE el.professional_id IS DISTINCT FROM auth.uid()
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


ALTER FUNCTION "public"."add_routine_to_exercise_plan"("p_patient_id" "uuid", "p_routine_id" "uuid", "p_items" "jsonb", "p_start_date" "date", "p_duration_weeks" integer, "p_notes" "text", "p_program_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_team"("p_name" "text", "p_admin_user_id" "uuid", "p_member_limit" integer DEFAULT 5) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_team_id uuid;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_user_id AND is_active = true) THEN
    RAISE EXCEPTION 'El usuario designado como admin no tiene un perfil activo';
  END IF;

  IF p_member_limit < 1 THEN
    RAISE EXCEPTION 'El límite de miembros debe ser al menos 1';
  END IF;

  INSERT INTO teams (name, created_by, member_limit, is_active)
  VALUES (p_name, auth.uid(), p_member_limit, true)
  RETURNING id INTO v_team_id;

  INSERT INTO team_members (team_id, user_id, role, invited_by)
  VALUES (v_team_id, p_admin_user_id, 'admin', auth.uid());

  PERFORM insert_audit_log(
    'insert'::audit_action, 'teams', v_team_id,
    format('Equipo "%s" creado por admin con admin inicial %s', p_name, p_admin_user_id)
  );

  RETURN v_team_id;
END;
$$;


ALTER FUNCTION "public"."admin_create_team"("p_name" "text", "p_admin_user_id" "uuid", "p_member_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_deactivate_therapist"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  UPDATE profiles
  SET is_active = false, deactivated_at = now(), updated_at = now()
  WHERE id = p_user_id AND is_active = true;

  PERFORM insert_audit_log('update'::audit_action, 'profiles', p_user_id, 'Terapista desactivado por admin');
END;
$$;


ALTER FUNCTION "public"."admin_deactivate_therapist"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_active_teams"() RETURNS TABLE("team_id" "uuid", "team_name" "text", "session_count" integer, "patient_count" integer, "member_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    t.id                                                            AS team_id,
    t.name                                                         AS team_name,
    COALESCE(
      (SELECT COUNT(*)::int
       FROM therapy_sessions ts
       JOIN patients p ON p.id = ts.patient_id
       WHERE p.team_id = t.id
         AND ts.is_deleted = false
         AND ts.created_at >= now() - interval '30 days'),
      0
    )                                                              AS session_count,
    COALESCE(
      (SELECT COUNT(*)::int
       FROM patients p
       WHERE p.team_id = t.id AND p.is_deleted = false),
      0
    )                                                              AS patient_count,
    COALESCE(
      (SELECT COUNT(*)::int
       FROM team_members tm WHERE tm.team_id = t.id),
      0
    )                                                              AS member_count
  FROM teams t
  WHERE t.is_active = true
  ORDER BY session_count DESC, patient_count DESC
  LIMIT 5;
END;
$$;


ALTER FUNCTION "public"."admin_get_active_teams"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_activity"("p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "action" "text", "table_name" "text", "description" "text", "created_at" timestamp with time zone, "performed_by" "uuid", "full_name" "text", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.action::text,
    al.table_name,
    al.description,
    al.created_at,
    al.performed_by,
    COALESCE(NULLIF(p.full_name, ''), p.email) AS full_name,
    p.email
  FROM audit_log al
  LEFT JOIN profiles p ON p.id = al.performed_by
  ORDER BY al.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."admin_get_activity"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_inactive_therapists"("p_days" integer DEFAULT 30) RETURNS TABLE("id" "uuid", "full_name" "text", "email" "text", "specialty" "text", "patient_count" integer, "last_session_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    pr.id                                                AS id,
    pr.full_name                                         AS full_name,
    pr.email                                             AS email,
    pr.specialty                                         AS specialty,
    COALESCE(
      (SELECT COUNT(*)::int FROM patients pt
       WHERE pt.professional_id = pr.id AND pt.is_deleted = false),
      0
    )                                                    AS patient_count,
    (SELECT MAX(ts.created_at)
     FROM therapy_sessions ts
     WHERE ts.professional_id = pr.id AND ts.is_deleted = false) AS last_session_at,
    pr.created_at                                        AS created_at
  FROM profiles pr
  WHERE pr.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM therapy_sessions ts
      WHERE ts.professional_id = pr.id
        AND ts.is_deleted = false
        AND ts.created_at >= now() - (p_days || ' days')::interval
    )
  ORDER BY last_session_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."admin_get_inactive_therapists"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_monthly_sessions"() RETURNS TABLE("month" "text", "session_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC('month', gs.month_start), 'Mon YY') AS month,
    COALESCE(
      (SELECT COUNT(*)::int
       FROM therapy_sessions ts
       WHERE ts.is_deleted = false
         AND DATE_TRUNC('month', ts.created_at) = gs.month_start),
      0
    ) AS session_count
  FROM (
    SELECT generate_series(
      DATE_TRUNC('month', now()) - interval '5 months',
      DATE_TRUNC('month', now()),
      interval '1 month'
    ) AS month_start
  ) gs
  ORDER BY gs.month_start;
END;
$$;


ALTER FUNCTION "public"."admin_get_monthly_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_stale_invitations"("p_days" integer DEFAULT 7) RETURNS TABLE("invitation_id" "uuid", "team_id" "uuid", "team_name" "text", "email" "text", "invited_by_name" "text", "created_at" timestamp with time zone, "days_pending" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    ti.id                                          AS invitation_id,
    t.id                                           AS team_id,
    t.name                                         AS team_name,
    ti.email                                       AS email,
    COALESCE(pr.full_name, pr.email::text, '—')   AS invited_by_name,
    ti.created_at                                  AS created_at,
    EXTRACT(DAY FROM now() - ti.created_at)::int  AS days_pending
  FROM team_invitations ti
  JOIN teams t ON t.id = ti.team_id
  LEFT JOIN profiles pr ON pr.id = ti.invited_by
  WHERE ti.status = 'pending'
    AND ti.created_at < now() - (p_days || ' days')::interval
  ORDER BY ti.created_at ASC;
END;
$$;


ALTER FUNCTION "public"."admin_get_stale_invitations"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_stats"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total_therapists  bigint;
  v_total_patients    bigint;
  v_sessions_week     bigint;
  v_total_teams       bigint;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT COUNT(*) INTO v_total_therapists FROM profiles WHERE is_active = true;
  SELECT COUNT(*) INTO v_total_patients FROM patients WHERE is_deleted = false;
  SELECT COUNT(*) INTO v_sessions_week FROM therapy_sessions
  WHERE is_deleted = false
    AND session_date >= date_trunc('week', now())
    AND session_date <  date_trunc('week', now()) + interval '7 days';
  SELECT COUNT(*) INTO v_total_teams FROM teams WHERE is_active = true;

  RETURN jsonb_build_object(
    'total_therapists',   v_total_therapists,
    'total_patients',     v_total_patients,
    'sessions_this_week', v_sessions_week,
    'total_teams',        v_total_teams
  );
END;
$$;


ALTER FUNCTION "public"."admin_get_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_trends"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_now              timestamptz := now();
  v_week_start       timestamptz := date_trunc('week', v_now);
  v_prev_week_start  timestamptz := v_week_start - interval '7 days';

  v_therapists_this  int;
  v_therapists_prev  int;
  v_patients_this    int;
  v_patients_prev    int;
  v_sessions_this    int;
  v_sessions_prev    int;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT COUNT(*) INTO v_therapists_this
  FROM profiles WHERE created_at >= v_week_start AND is_active = true;

  SELECT COUNT(*) INTO v_therapists_prev
  FROM profiles WHERE created_at >= v_prev_week_start AND created_at < v_week_start AND is_active = true;

  SELECT COUNT(*) INTO v_patients_this
  FROM patients WHERE created_at >= v_week_start AND is_deleted = false;

  SELECT COUNT(*) INTO v_patients_prev
  FROM patients WHERE created_at >= v_prev_week_start AND created_at < v_week_start AND is_deleted = false;

  SELECT COUNT(*) INTO v_sessions_this
  FROM therapy_sessions WHERE created_at >= v_week_start AND is_deleted = false;

  SELECT COUNT(*) INTO v_sessions_prev
  FROM therapy_sessions WHERE created_at >= v_prev_week_start AND created_at < v_week_start AND is_deleted = false;

  RETURN jsonb_build_object(
    'therapists_this_week', v_therapists_this,
    'therapists_last_week', v_therapists_prev,
    'patients_this_week',   v_patients_this,
    'patients_last_week',   v_patients_prev,
    'sessions_this_week',   v_sessions_this,
    'sessions_last_week',   v_sessions_prev
  );
END;
$$;


ALTER FUNCTION "public"."admin_get_trends"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_patients"("p_team_id" "uuid" DEFAULT NULL::"uuid", "p_professional_id" "uuid" DEFAULT NULL::"uuid", "p_include_deleted" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "full_name" "text", "professional_id" "uuid", "professional_name" "text", "team_id" "uuid", "team_name" "text", "status" "text", "created_at" timestamp with time zone, "is_deleted" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    pat.id,
    (pat.last_name || ', ' || pat.first_name) AS full_name,
    pat.professional_id,
    prof.full_name   AS professional_name,
    pat.team_id,
    t.name           AS team_name,
    pat.status::text AS status,
    pat.created_at,
    pat.is_deleted
  FROM patients pat
  JOIN profiles prof ON prof.id = pat.professional_id
  LEFT JOIN teams t   ON t.id  = pat.team_id
  WHERE (p_include_deleted OR pat.is_deleted = false)
    AND (p_team_id IS NULL         OR pat.team_id         = p_team_id)
    AND (p_professional_id IS NULL OR pat.professional_id = p_professional_id)
  ORDER BY pat.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."admin_list_patients"("p_team_id" "uuid", "p_professional_id" "uuid", "p_include_deleted" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_pending_invitations"() RETURNS TABLE("user_id" "uuid", "email" "text", "full_name" "text", "invited_at" timestamp with time zone, "days_pending" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    u.id::uuid                                          AS user_id,
    u.email::text                                       AS email,
    COALESCE(p.full_name, '')::text                     AS full_name,
    u.invited_at::timestamptz                           AS invited_at,
    DATE_PART('day', now() - u.invited_at)::int         AS days_pending
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.invited_at IS NOT NULL
    AND u.last_sign_in_at IS NULL
    AND u.deleted_at IS NULL
  ORDER BY u.invited_at DESC;
END;
$$;


ALTER FUNCTION "public"."admin_list_pending_invitations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_therapists"() RETURNS TABLE("id" "uuid", "full_name" "text", "email" "text", "specialty" "text", "license_number" "text", "is_active" boolean, "created_at" timestamp with time zone, "patient_count" bigint, "team_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  RETURN QUERY
  SELECT
    p.id, p.full_name, p.email, p.specialty, p.license_number, p.is_active, p.created_at,
    (SELECT COUNT(*) FROM patients pt WHERE pt.professional_id = p.id AND pt.is_deleted = false) AS patient_count,
    (SELECT COUNT(*) FROM team_members tm WHERE tm.user_id = p.id) AS team_count
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE NOT (u.invited_at IS NOT NULL AND u.last_sign_in_at IS NULL)
    AND u.deleted_at IS NULL
  ORDER BY p.full_name;
END;
$$;


ALTER FUNCTION "public"."admin_list_therapists"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_move_patient_to_team"("p_patient_id" "uuid", "p_team_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_old_team_id uuid;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT team_id INTO v_old_team_id FROM patients WHERE id = p_patient_id AND is_deleted = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente no encontrado'; END IF;

  IF p_team_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id AND is_active = true) THEN
      RAISE EXCEPTION 'El equipo destino no existe o está inactivo';
    END IF;
  END IF;

  UPDATE patients SET team_id = p_team_id WHERE id = p_patient_id;

  PERFORM insert_audit_log(
    'update'::audit_action, 'patients', p_patient_id,
    format('Paciente movido de equipo %s a equipo %s por admin', v_old_team_id, p_team_id),
    jsonb_build_object('before', jsonb_build_object('team_id', v_old_team_id), 'after', jsonb_build_object('team_id', p_team_id))
  );
END;
$$;


ALTER FUNCTION "public"."admin_move_patient_to_team"("p_patient_id" "uuid", "p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_reactivate_therapist"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  UPDATE profiles
  SET is_active = true, deactivated_at = NULL, updated_at = now()
  WHERE id = p_user_id AND is_active = false;

  PERFORM insert_audit_log('update'::audit_action, 'profiles', p_user_id, 'Terapista reactivado por admin');
END;
$$;


ALTER FUNCTION "public"."admin_reactivate_therapist"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_team_limit"("p_team_id" "uuid", "p_limit" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_current_count int;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id) THEN
    RAISE EXCEPTION 'Equipo no encontrado';
  END IF;

  SELECT COUNT(*) INTO v_current_count FROM team_members WHERE team_id = p_team_id;

  IF p_limit < v_current_count THEN
    RAISE EXCEPTION 'El nuevo límite (%) es menor al número actual de miembros (%)', p_limit, v_current_count;
  END IF;

  UPDATE teams SET member_limit = p_limit WHERE id = p_team_id;
END;
$$;


ALTER FUNCTION "public"."admin_set_team_limit"("p_team_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_feedback_status"("p_feedback_id" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_status NOT IN ('new', 'seen', 'resolved') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM feedback WHERE id = p_feedback_id) THEN
    RAISE EXCEPTION 'Feedback no encontrado';
  END IF;

  UPDATE feedback
  SET status = p_status,
      resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END
  WHERE id = p_feedback_id;
END;
$$;


ALTER FUNCTION "public"."admin_update_feedback_status"("p_feedback_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_upsert_therapist"("p_user_id" "uuid", "p_full_name" "text", "p_email" "text", "p_specialty" "text" DEFAULT NULL::"text", "p_license" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_old_email text;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil no encontrado para el usuario %', p_user_id;
  END IF;

  SELECT email INTO v_old_email FROM profiles WHERE id = p_user_id;

  UPDATE profiles
  SET full_name = p_full_name, email = p_email, specialty = p_specialty,
      license_number = p_license, updated_at = now()
  WHERE id = p_user_id;

  IF v_old_email IS DISTINCT FROM p_email THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email AND id <> p_user_id) THEN
      RAISE EXCEPTION 'Ya existe otro usuario con ese email';
    END IF;

    UPDATE auth.users
    SET email = p_email, email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now()
    WHERE id = p_user_id;

    UPDATE auth.identities
    SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(p_email)), updated_at = now()
    WHERE user_id = p_user_id AND provider = 'email';

    PERFORM insert_audit_log(
      'update'::audit_action, 'profiles', p_user_id,
      format('Email de login cambiado de %s a %s por admin', v_old_email, p_email)
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."admin_upsert_therapist"("p_user_id" "uuid", "p_full_name" "text", "p_email" "text", "p_specialty" "text", "p_license" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."appointments_lock_ownership"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (NEW.patient_id IS DISTINCT FROM OLD.patient_id
          OR NEW.professional_id IS DISTINCT FROM OLD.professional_id) THEN
    RAISE EXCEPTION 'No se puede cambiar el paciente ni el profesional de un turno'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."appointments_lock_ownership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_obra_social_delete_in_use"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_count bigint;
begin
  v_count := public.obra_social_usage_count(old.name);
  if v_count > 0 then
    -- 23503 = foreign_key_violation: es el mismo tipo de error que daría una FK real.
    raise exception '"%" está en uso por % paciente%: no se puede eliminar',
      old.name, v_count, case when v_count = 1 then '' else 's' end
      using errcode = '23503';
  end if;
  return old;
end;
$$;


ALTER FUNCTION "public"."block_obra_social_delete_in_use"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_invitation"("p_invitation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inv team_invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM team_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;

  IF NOT (is_team_admin(v_inv.team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF v_inv.status != 'pending' THEN
    RAISE EXCEPTION 'Solo se pueden cancelar invitaciones pendientes';
  END IF;

  UPDATE team_invitations
  SET status = 'cancelled'
  WHERE id = p_invitation_id;
END;
$$;


ALTER FUNCTION "public"."cancel_invitation"("p_invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_quickdash_token"("p_token" "uuid", "p_items" "jsonb", "p_score" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row   quickdash_tokens;
  v_item  numeric;
  v_score numeric;
  v_fe_id uuid;
  i       int;
BEGIN
  SELECT * INTO v_row
  FROM quickdash_tokens
  WHERE token = p_token
    AND completed_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El enlace no es válido, ya fue utilizado o expiró';
  END IF;

  IF jsonb_array_length(p_items) <> 11 THEN
    RAISE EXCEPTION 'Datos inválidos';
  END IF;

  FOR i IN 0..10 LOOP
    v_item := (p_items->>i)::numeric;
    IF v_item < 1 OR v_item > 5 THEN
      RAISE EXCEPTION 'Datos inválidos';
    END IF;
  END LOOP;

  v_score := round((((
    (p_items->>0)::numeric + (p_items->>1)::numeric + (p_items->>2)::numeric +
    (p_items->>3)::numeric + (p_items->>4)::numeric + (p_items->>5)::numeric +
    (p_items->>6)::numeric + (p_items->>7)::numeric + (p_items->>8)::numeric +
    (p_items->>9)::numeric + (p_items->>10)::numeric
  ) / 11.0) - 1) * 25, 1);

  UPDATE quickdash_tokens
  SET
    completed_at = now(),
    completed_by = 'patient',
    result = jsonb_build_object('items', p_items, 'score', v_score)
  WHERE id = v_row.id;

  IF v_row.session_id IS NOT NULL THEN
    SELECT id INTO v_fe_id
    FROM functional_evaluations
    WHERE session_id = v_row.session_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_fe_id IS NOT NULL THEN
      UPDATE functional_evaluations
      SET quickdash_items = p_items, quickdash_score = v_score
      WHERE id = v_fe_id;
    ELSE
      INSERT INTO functional_evaluations (
        patient_id, professional_id, episode_id, session_id,
        evaluation_date, quickdash_items, quickdash_score
      )
      VALUES (
        v_row.patient_id, v_row.created_by, v_row.episode_id, v_row.session_id,
        current_date, p_items, v_score
      );
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."complete_quickdash_token"("p_token" "uuid", "p_items" "jsonb", "p_score" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_exercise_plan_token"("p_plan_id" "uuid", "p_patient_id" "uuid", "p_expires_at" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_plan  exercise_plans%ROWTYPE;
  v_token uuid;
BEGIN
  SELECT * INTO v_plan FROM exercise_plans WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Validar acceso al paciente del plan (cubre propio + equipo)
  IF NOT is_my_patient(v_plan.patient_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Revocar tokens activos previos del plan
  UPDATE exercise_plan_tokens SET revoked_at = now()
  WHERE plan_id = p_plan_id AND revoked_at IS NULL;

  -- Crear nuevo token; professional_id del plan (no del caller)
  INSERT INTO exercise_plan_tokens (plan_id, patient_id, professional_id, expires_at)
  VALUES (p_plan_id, p_patient_id, v_plan.professional_id, p_expires_at)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;


ALTER FUNCTION "public"."create_exercise_plan_token"("p_plan_id" "uuid", "p_patient_id" "uuid", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_quickdash_token"("p_session_id" "uuid", "p_patient_id" "uuid", "p_expires_at" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_new_token  uuid;
  v_episode_id uuid;
BEGIN
  SELECT episode_id INTO v_episode_id
  FROM therapy_sessions
  WHERE id = p_session_id AND professional_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sin permisos sobre esta sesión';
  END IF;

  UPDATE quickdash_tokens
  SET completed_at = now(), completed_by = 'therapist'
  WHERE session_id = p_session_id
    AND completed_at IS NULL
    AND expires_at > now();

  INSERT INTO quickdash_tokens (patient_id, episode_id, session_id, created_by, expires_at)
  VALUES (p_patient_id, v_episode_id, p_session_id, auth.uid(), p_expires_at)
  RETURNING token INTO v_new_token;

  RETURN v_new_token;
END;
$$;


ALTER FUNCTION "public"."create_quickdash_token"("p_session_id" "uuid", "p_patient_id" "uuid", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_exercise_plan_public"("p_token" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_exercise_plan_public"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_exercise_plan_token"("p_token" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row exercise_plan_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM exercise_plan_tokens WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'not_found');
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN json_build_object('status', 'revoked', 'expires_at', v_row.expires_at);
  END IF;

  IF v_row.expires_at < now() THEN
    RETURN json_build_object('status', 'expired', 'expires_at', v_row.expires_at);
  END IF;

  RETURN json_build_object('status', 'valid', 'expires_at', v_row.expires_at);
END;
$$;


ALTER FUNCTION "public"."get_exercise_plan_token"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invitation_by_token"("p_token" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inv  team_invitations%ROWTYPE;
  v_team teams%ROWTYPE;
BEGIN
  SELECT * INTO v_inv
  FROM team_invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'reason', v_inv.status);
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE team_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = v_inv.team_id;

  RETURN jsonb_build_object(
    'valid',      true,
    'email',      v_inv.email,
    'team_name',  v_team.name,
    'expires_at', v_inv.expires_at
  );
END;
$$;


ALTER FUNCTION "public"."get_invitation_by_token"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "public"."profile_role"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_role"() IS 'Preparada para fase 2 (admin). No usada en policies de fase 1.';



CREATE OR REPLACE FUNCTION "public"."get_quickdash_token"("p_token" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row quickdash_tokens;
BEGIN
  SELECT * INTO v_row FROM quickdash_tokens WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_row.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'completed');
  END IF;

  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  RETURN jsonb_build_object('status', 'valid', 'expires_at', v_row.expires_at);
END;
$$;


ALTER FUNCTION "public"."get_quickdash_token"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_activity"("p_team_id" "uuid") RETURNS TABLE("id" "uuid", "action" "text", "table_name" "text", "description" "text", "created_at" timestamp with time zone, "performed_by" "uuid", "full_name" "text", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid      uuid    := auth.uid();
  v_is_admin boolean;
  v_is_super boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM team_members tm2
    WHERE tm2.team_id = p_team_id AND tm2.user_id = v_uid AND tm2.role = 'admin'
  ) INTO v_is_admin;

  SELECT EXISTS(
    SELECT 1 FROM admin_users au2 WHERE au2.user_id = v_uid
  ) INTO v_is_super;

  IF NOT (v_is_admin OR v_is_super) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.action::text,
    al.table_name,
    al.description,
    al.created_at,
    al.performed_by,
    COALESCE(NULLIF(pr.full_name, ''), pr.email) AS full_name,
    pr.email
  FROM audit_log al
  LEFT JOIN profiles pr ON pr.id = al.performed_by
  WHERE al.record_id IN (
    -- La primera subquery necesita alias para que "id" no sea ambiguo con la columna retornada
    SELECT pat.id FROM patients pat WHERE pat.team_id = p_team_id
    UNION
    SELECT ts.id FROM therapy_sessions ts
    JOIN patients pt ON pt.id = ts.patient_id
    WHERE pt.team_id = p_team_id
    UNION
    SELECT pcr.id FROM patient_clinical_records pcr
    JOIN patients pt ON pt.id = pcr.patient_id
    WHERE pt.team_id = p_team_id
    UNION
    SELECT pop.id FROM patient_occupational_profiles pop
    JOIN patients pt ON pt.id = pop.patient_id
    WHERE pt.team_id = p_team_id
    UNION
    SELECT te.id FROM treatment_episodes te
    JOIN patients pt ON pt.id = te.patient_id
    WHERE pt.team_id = p_team_id
    UNION
    SELECT ae.id FROM analytical_evaluations ae
    JOIN patients pt ON pt.id = ae.patient_id
    WHERE pt.team_id = p_team_id
    UNION
    SELECT fe.id FROM functional_evaluations fe
    JOIN patients pt ON pt.id = fe.patient_id
    WHERE pt.team_id = p_team_id
    UNION
    SELECT tp.id FROM treatment_plans tp
    JOIN patients pt ON pt.id = tp.patient_id
    WHERE pt.team_id = p_team_id
  )
  ORDER BY al.created_at DESC
  LIMIT 50;
END;
$$;


ALTER FUNCTION "public"."get_team_activity"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_analytical_eval_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'insert', 'analytical_evaluations', NEW.id,
    'Nueva evaluación analítica para paciente ID: ' || NEW.patient_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_analytical_eval_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_analytical_eval_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action, 'analytical_evaluations', NEW.id, 'Evaluación analítica actualizada',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_analytical_eval_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_clinical_record_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'insert', 'patient_clinical_records', NEW.id,
    'Ficha clínica creada para paciente ID: ' || NEW.patient_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_clinical_record_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_clinical_record_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD IS DISTINCT FROM NEW THEN
    PERFORM insert_audit_log(
      'update'::audit_action, 'patient_clinical_records', NEW.id,
      'Ficha clínica actualizada',
      jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_clinical_record_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_file_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- ── Soft delete ──────────────────────────────────────────────────
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at = NOW();
    PERFORM insert_audit_log(
      'soft_delete', 'clinical_files', NEW.id,
      'Archivo eliminado: ' || NEW.file_name
    );
  END IF;

  -- ── Restauración ─────────────────────────────────────────────────
  -- [FIX 3] Rama que faltaba en v4.
  IF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    NEW.deleted_at = NULL;
    PERFORM insert_audit_log(
      'restore', 'clinical_files', NEW.id,
      'Archivo restaurado: ' || NEW.file_name
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_file_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_functional_eval_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'insert', 'functional_evaluations', NEW.id,
    'Nueva evaluación funcional para paciente ID: ' || NEW.patient_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_functional_eval_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_functional_eval_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action, 'functional_evaluations', NEW.id, 'Evaluación funcional actualizada',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_functional_eval_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inv team_invitations%ROWTYPE;
BEGIN
  -- Registro solo por invitación
  IF NEW.invited_at IS NULL AND NOT EXISTS (
    SELECT 1 FROM team_invitations
    WHERE email = NEW.email AND status = 'pending' AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'signup_not_allowed: el registro es únicamente por invitación';
  END IF;

  -- Lógica existente: crear profile
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    'professional'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Auto-join si existe invitación pendiente para el email
  SELECT * INTO v_inv
  FROM team_invitations
  WHERE email = NEW.email AND status = 'pending' AND expires_at > now()
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO team_members (team_id, user_id, role, invited_by)
    VALUES (v_inv.team_id, NEW.id, 'member', v_inv.invited_by)
    ON CONFLICT DO NOTHING;

    UPDATE team_invitations SET status = 'accepted' WHERE id = v_inv.id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_occupational_profile_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'insert', 'patient_occupational_profiles', NEW.id,
    'Perfil ocupacional creado para paciente ID: ' || NEW.patient_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_occupational_profile_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_occupational_profile_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD IS DISTINCT FROM NEW THEN
    PERFORM insert_audit_log(
      'update'::audit_action, 'patient_occupational_profiles', NEW.id,
      'Perfil ocupacional actualizado',
      jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_occupational_profile_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_patient_discharge"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'discharged' AND OLD.status <> 'discharged' THEN
    NEW.discharged_at = NOW();
  END IF;
  IF NEW.status <> 'discharged' AND OLD.status = 'discharged' THEN
    NEW.discharged_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_patient_discharge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_patient_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'insert', 'patients', NEW.id,
    'Nuevo paciente: ' || NEW.first_name || ' ' || NEW.last_name
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_patient_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_patient_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- ── Soft delete ──────────────────────────────────────────────────
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at = NOW();
    -- [FIX 2] auth.uid() puede ser NULL en contexto sistema.
    -- deleted_by es nullable: NULL documenta que fue una operación del sistema.
    NEW.deleted_by = auth.uid();

    -- [FIX 7] Un paciente eliminado no puede quedar con status='active'.
    -- Lo forzamos a 'paused' antes de que el CHECK lo rechace.
    IF NEW.status = 'active' THEN
      NEW.status = 'paused';
    END IF;

    PERFORM insert_audit_log(
      'soft_delete', 'patients', NEW.id,
      'Paciente eliminado: ' || NEW.first_name || ' ' || NEW.last_name
    );
  END IF;

  -- ── Restauración ─────────────────────────────────────────────────
  IF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    NEW.deleted_at = NULL;
    NEW.deleted_by = NULL;
    -- No restauramos status automáticamente: el profesional lo decide.
    PERFORM insert_audit_log(
      'restore', 'patients', NEW.id,
      'Paciente restaurado: ' || NEW.first_name || ' ' || NEW.last_name
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_patient_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_patient_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action, 'patients', NEW.id, 'Paciente actualizado',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_patient_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_plan_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'insert', 'treatment_plans', NEW.id,
    'Nuevo plan de tratamiento: ' || NEW.title || ' — paciente ID: ' || NEW.patient_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_plan_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_plan_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at = NOW();
    PERFORM insert_audit_log(
      'soft_delete', 'treatment_plans', NEW.id,
      'Plan terapéutico eliminado: ' || NEW.title
    );
  END IF;

  IF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    NEW.deleted_at = NULL;
    PERFORM insert_audit_log(
      'restore', 'treatment_plans', NEW.id,
      'Plan terapéutico restaurado: ' || NEW.title
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_plan_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_profile_activation_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action, 'profiles', NEW.id,
    CASE
      WHEN NEW.is_active = true  THEN 'Terapista reactivado'
      WHEN NEW.is_active = false THEN 'Terapista desactivado'
    END,
    jsonb_build_object(
      'before', jsonb_build_object('is_active', OLD.is_active),
      'after',  jsonb_build_object('is_active', NEW.is_active)
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_profile_activation_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_profile_deactivation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.deactivated_at = NOW();
    PERFORM insert_audit_log(
      'deactivate', 'profiles', NEW.id,
      'Profesional desactivado: ' || NEW.full_name
    );
  END IF;

  IF NEW.is_active = true AND OLD.is_active = false THEN
    -- Reactivación: solo posible via service role en fase 1.
    -- En fase 2 lo gestiona el panel admin.
    NEW.deactivated_at = NULL;
    PERFORM insert_audit_log(
      'restore', 'profiles', NEW.id,
      'Profesional reactivado: ' || NEW.full_name
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_profile_deactivation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_session_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'insert', 'therapy_sessions', NEW.id,
    'Nueva sesión registrada para paciente ID: ' || NEW.patient_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_session_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_session_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at = NOW();
    PERFORM insert_audit_log(
      'soft_delete', 'therapy_sessions', NEW.id,
      'Sesión eliminada. Fecha: ' || NEW.session_date::TEXT
    );
  END IF;

  IF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    NEW.deleted_at = NULL;
    PERFORM insert_audit_log(
      'restore', 'therapy_sessions', NEW.id,
      'Sesión restaurada. Fecha: ' || NEW.session_date::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_session_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_session_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action, 'therapy_sessions', NEW.id, 'Sesión actualizada',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_session_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_team_invitation_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action, 'team_invitations', NEW.id,
    format('Invitación %s actualizada: %s → %s', NEW.id, OLD.status, NEW.status),
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_team_invitation_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_team_member_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_log(
      'insert'::audit_action, 'team_members', NEW.user_id,
      format('Miembro %s agregado al equipo %s con rol %s', NEW.user_id, NEW.team_id, NEW.role),
      jsonb_build_object('team_id', NEW.team_id, 'role', NEW.role, 'invited_by', NEW.invited_by)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM insert_audit_log(
      'update'::audit_action, 'team_members', NEW.user_id,
      format('Miembro %s actualizado en equipo %s', NEW.user_id, NEW.team_id),
      jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM insert_audit_log(
      'delete'::audit_action, 'team_members', OLD.user_id,
      format('Miembro %s eliminado del equipo %s (rol: %s)', OLD.user_id, OLD.team_id, OLD.role),
      jsonb_build_object('team_id', OLD.team_id, 'role', OLD.role)
    );
    RETURN OLD;
  END IF;
END;
$$;


ALTER FUNCTION "public"."handle_team_member_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_treatment_episode_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action, 'treatment_episodes', NEW.id, 'Episodio de tratamiento actualizado',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_treatment_episode_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_treatment_plan_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM insert_audit_log(
    'update'::audit_action, 'treatment_plans', NEW.id, 'Plan de tratamiento actualizado',
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_treatment_plan_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_audit_log"("p_action" "public"."audit_action", "p_table_name" "text", "p_record_id" "uuid", "p_description" "text" DEFAULT NULL::"text", "p_changes" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid     UUID;
  v_context audit_context;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    v_context := 'user';
  ELSE
    v_context := 'system';
  END IF;

  INSERT INTO audit_log (performed_by, action, action_context, table_name, record_id, description, changes)
  VALUES (v_uid, p_action, v_context, p_table_name, p_record_id, p_description, p_changes);
END;
$$;


ALTER FUNCTION "public"."insert_audit_log"("p_action" "public"."audit_action", "p_table_name" "text", "p_record_id" "uuid", "p_description" "text", "p_changes" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_to_team"("p_team_id" "uuid", "p_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_team      teams%ROWTYPE;
  v_profile   profiles%ROWTYPE;
  v_count     int;
  v_inv_token uuid;
BEGIN
  IF NOT (is_team_admin(p_team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipo no encontrado o inactivo'; END IF;

  SELECT COUNT(*) INTO v_count FROM team_members WHERE team_id = p_team_id;
  IF v_count >= v_team.member_limit THEN
    RETURN jsonb_build_object('result', 'limit_reached', 'limit', v_team.member_limit);
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE email = p_email AND is_active = true;

  IF FOUND THEN
    IF EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = v_profile.id) THEN
      RETURN jsonb_build_object('result', 'already_member');
    END IF;

    INSERT INTO team_members (team_id, user_id, role, invited_by)
    VALUES (p_team_id, v_profile.id, 'member', auth.uid());

    RETURN jsonb_build_object('result', 'added');
  ELSE
    UPDATE team_invitations
    SET status = 'expired'
    WHERE team_id = p_team_id AND email = p_email AND status = 'pending';

    INSERT INTO team_invitations (team_id, email, invited_by)
    VALUES (p_team_id, p_email, auth.uid())
    RETURNING token INTO v_inv_token;

    RETURN jsonb_build_object('result', 'invited', 'token', v_inv_token);
  END IF;
END;
$$;


ALTER FUNCTION "public"."invite_to_team"("p_team_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_professional"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = true
  );
$$;


ALTER FUNCTION "public"."is_active_professional"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_active_professional"() IS 'Usada en tablas que NO usan is_my_patient() (patients, exercise_library,
   treatment_plan_exercises). En las demás, is_my_patient() ya verifica is_active.
   Llamar ambas en la misma policy duplicaría la query a profiles.';



CREATE OR REPLACE FUNCTION "public"."is_my_patient"("p_patient_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM patients p
    JOIN profiles pr ON pr.id = p.professional_id
    WHERE p.id         = p_patient_id
      AND p.is_deleted = false
      AND pr.is_active = true
      AND (
        p.professional_id = auth.uid()
        OR (
          p.team_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM team_members tm
            JOIN teams t ON t.id = tm.team_id
            WHERE tm.team_id = p.team_id
              AND tm.user_id = auth.uid()
              AND t.is_active = true
          )
        )
      )
  );
$$;


ALTER FUNCTION "public"."is_my_patient"("p_patient_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_my_patient"("p_patient_id" "uuid") IS 'Tres condiciones en una query: el paciente pertenece al profesional,
   no está eliminado, y el profesional está activo.
   SECURITY DEFINER: evita recursión con RLS de patients y profiles.
   Las policies que usan esta función NO necesitan is_active_professional().';



CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_admin"("p_team_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_team_admin"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_member"("p_team_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_team_member"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_obra_social_name"("p" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select lower(extensions.unaccent(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))));
$$;


ALTER FUNCTION "public"."normalize_obra_social_name"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obra_social_usage_count"("p_name" "text") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(*) from patients
  where is_deleted = false
    and insurance is not null
    and public.normalize_obra_social_name(insurance) = public.normalize_obra_social_name(p_name);
$$;


ALTER FUNCTION "public"."obra_social_usage_count"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propagate_obra_social_rename"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.name is distinct from old.name then
    update public.patients
       set insurance = new.name
     where insurance is not null
       and public.normalize_obra_social_name(insurance) = public.normalize_obra_social_name(old.name);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."propagate_obra_social_rename"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_team_member"("p_team_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_member_role text;
  v_admin_count int;
BEGIN
  IF NOT (is_team_admin(p_team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT role INTO v_member_role FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El usuario no es miembro de este equipo'; END IF;

  IF v_member_role = 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count FROM team_members WHERE team_id = p_team_id AND role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'No se puede quitar al único administrador del equipo';
    END IF;
  END IF;

  DELETE FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."remove_team_member"("p_team_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resend_invitation"("p_invitation_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inv   team_invitations%ROWTYPE;
  v_token uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_inv FROM team_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;

  IF NOT (is_team_admin(v_inv.team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE team_invitations
  SET token = v_token, expires_at = now() + interval '7 days', status = 'pending'
  WHERE id = p_invitation_id;

  RETURN v_token;
END;
$$;


ALTER FUNCTION "public"."resend_invitation"("p_invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_cie10"("search_input" "text", "max_results" integer DEFAULT 10) RETURNS TABLE("code" "text", "description" "text", "category" "text", "rank" real)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  normalized text;
  words text[];
BEGIN
  normalized := lower(search_input);
  normalized := replace(normalized, 'á', 'a');
  normalized := replace(normalized, 'é', 'e');
  normalized := replace(normalized, 'í', 'i');
  normalized := replace(normalized, 'ó', 'o');
  normalized := replace(normalized, 'ú', 'u');
  normalized := replace(normalized, 'ü', 'u');
  normalized := replace(normalized, 'ñ', 'n');
  normalized := regexp_replace(normalized, '\mfx\M', 'fractura', 'g');
  normalized := regexp_replace(normalized, '\mmr\M', 'manguito rotador', 'g');
  normalized := regexp_replace(normalized, '\mstc\M', 'sindrome tunel carpiano', 'g');
  normalized := regexp_replace(normalized, '\msdrc\M', 'sindrome dolor regional complejo', 'g');
  normalized := regexp_replace(normalized, '\macv\M', 'accidente cerebrovascular', 'g');
  normalized := regexp_replace(normalized, '\mms\M', 'miembro superior', 'g');
  normalized := regexp_replace(normalized, '\mmi\M', 'miembro inferior', 'g');
  normalized := regexp_replace(normalized, '\mlca\M', 'ligamento cruzado anterior', 'g');
  normalized := regexp_replace(normalized, '\mlcp\M', 'ligamento cruzado posterior', 'g');
  normalized := regexp_replace(normalized, '\mela\M', 'esclerosis lateral amiotrofica', 'g');
  normalized := regexp_replace(normalized, '\mdr\M', 'derecho', 'g');
  normalized := regexp_replace(normalized, '\mizq\M', 'izquierdo', 'g');

  words := array(
    SELECT w FROM unnest(string_to_array(trim(normalized), ' ')) w WHERE length(w) > 2
  );

  IF normalized ~ '^[a-z][0-9]' THEN
    RETURN QUERY
      SELECT c.code, c.description, c.category,
             CASE WHEN lower(c.code) = normalized THEN 1.0::real
                  WHEN lower(c.code) LIKE normalized || '%' THEN 0.9::real
                  ELSE 0.7::real END AS rank
      FROM cie10 c
      WHERE lower(c.code) ILIKE '%' || normalized || '%'
      ORDER BY rank DESC, c.code
      LIMIT max_results;
    RETURN;
  END IF;

  IF array_length(words, 1) >= 2 THEN
    RETURN QUERY
      SELECT c.code, c.description, c.category,
             ((SELECT COUNT(*)::real FROM unnest(words) w WHERE c.description_search ILIKE '%' || w || '%') /
             array_length(words, 1)::real) AS rank
      FROM cie10 c
      WHERE (
        SELECT COUNT(*) FROM unnest(words) w WHERE c.description_search ILIKE '%' || w || '%'
      ) = array_length(words, 1)
      ORDER BY rank DESC, c.code
      LIMIT max_results;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT c.code, c.description, c.category,
           CASE WHEN c.description_search ILIKE normalized || '%' THEN 0.9::real
                ELSE 0.7::real END AS rank
    FROM cie10 c
    WHERE c.description_search ILIKE '%' || normalized || '%'
       OR lower(c.code) ILIKE '%' || normalized || '%'
    ORDER BY rank DESC, c.code
    LIMIT max_results;
END;
$$;


ALTER FUNCTION "public"."search_cie10"("search_input" "text", "max_results" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_team_member_role"("p_team_id" "uuid", "p_user_id" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_role text;
  v_admin_count  int;
BEGIN
  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Rol inválido: "%". Usar "admin" o "member"', p_role;
  END IF;

  IF NOT (is_team_admin(p_team_id) OR is_super_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT role INTO v_current_role FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El usuario no es miembro de este equipo'; END IF;

  IF p_role = 'member' AND v_current_role = 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count FROM team_members WHERE team_id = p_team_id AND role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Debe quedar al menos un administrador en el equipo';
    END IF;
  END IF;

  UPDATE team_members SET role = p_role WHERE team_id = p_team_id AND user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."set_team_member_role"("p_team_id" "uuid", "p_user_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_session"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_session RECORD;
  v_patient_id uuid;
BEGIN
  -- Validar ownership y que la sesión existe y no está borrada
  SELECT * INTO v_session
  FROM therapy_sessions
  WHERE id = p_session_id
    AND professional_id = auth.uid()
    AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión no encontrada o sin permisos de acceso';
  END IF;

  -- No permitir eliminar sesiones de admisión
  IF v_session.session_type = 'admission' THEN
    RAISE EXCEPTION 'No se puede eliminar una sesión de admisión';
  END IF;

  v_patient_id := v_session.patient_id;

  -- Soft delete (el trigger handle_session_soft_delete registrará deleted_at y el audit log)
  UPDATE therapy_sessions
  SET is_deleted = true
  WHERE id = p_session_id;

  -- Si era una sesión de alta, revertir el estado del paciente a activo si no quedan otras altas
  IF v_session.session_type = 'discharge' THEN
    DECLARE
      remaining_discharge int;
    BEGIN
      SELECT COUNT(*) INTO remaining_discharge
      FROM therapy_sessions
      WHERE patient_id = v_patient_id
        AND session_type = 'discharge'
        AND is_deleted = false;

      IF remaining_discharge = 0 THEN
        UPDATE patients SET status = 'active'
        WHERE id = v_patient_id AND status = 'discharged';
      END IF;
    END;
  END IF;
END;
$$;


ALTER FUNCTION "public"."soft_delete_session"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_cie10_search"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  NEW.description_search = extensions.unaccent(lower(NEW.description));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_cie10_search"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_obras_sociales_search"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.name_search = trim(extensions.unaccent(lower(new.name || ' ' || coalesce(new.full_name, ''))));
  return new;
end;
$$;


ALTER FUNCTION "public"."update_obras_sociales_search"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_obra_social"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  if new.full_name is not null then
    new.full_name := nullif(btrim(regexp_replace(new.full_name, '\s+', ' ', 'g')), '');
  end if;

  if new.name = '' then
    raise exception 'El nombre de la obra social no puede estar vacío' using errcode = '23514';
  end if;
  if length(new.name) > 120 then
    raise exception 'El nombre de la obra social no puede superar los 120 caracteres' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.obras_sociales o
    where o.id <> coalesce(new.id, -1)
      and public.normalize_obra_social_name(o.name) = public.normalize_obra_social_name(new.name)
  ) then
    -- 23505 = unique_violation: el front ya lo traduce a "ya existe".
    raise exception 'Ya existe una obra social con ese nombre' using errcode = '23505';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_obra_social"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_owner_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.owner_type = 'professional' THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.owner_id) THEN
      RAISE EXCEPTION 'owner_id % no corresponde a un profesional existente', NEW.owner_id;
    END IF;
  ELSIF NEW.owner_type = 'team' THEN
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.owner_id) THEN
      RAISE EXCEPTION 'owner_id % no corresponde a un equipo existente', NEW.owner_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_owner_id"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytical_evaluations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "evaluation_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "pain_score" integer,
    "pain" "text",
    "edema" "text",
    "arom" "text",
    "prom" "text",
    "kapandji" "text",
    "muscle_strength" "text",
    "sensitivity" "text",
    "trophic_state" "text",
    "scar" "text",
    "posture" "text",
    "emotional_state" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pain_appearance" "text",
    "pain_location" "text",
    "pain_radiation" "text",
    "pain_characteristics" "text",
    "pain_aggravating_factors" "text",
    "edema_circummetry" "jsonb",
    "godet_test" "text",
    "dynamometer_msd" "jsonb",
    "dynamometer_msi" "jsonb",
    "muscle_strength_median" "text",
    "muscle_strength_cubital" "text",
    "muscle_strength_radial" "text",
    "sensitivity_functional" "text",
    "sensitivity_protective" "text",
    "vancouver_score" integer,
    "osas_score" integer,
    "scar_evaluation" "jsonb",
    "specific_tests" "jsonb",
    "goniometry" "jsonb",
    "episode_id" "uuid",
    "sensitivity_tacto_ligero" "text",
    "sensitivity_dos_puntos" "text",
    "sensitivity_picking_up" "text",
    "sensitivity_semmes_weinstein" "text",
    "sensitivity_toco_pincho" "text",
    "sensitivity_temperatura" "text",
    "dppd_fingers" "jsonb",
    "dynamometer_notes" "text",
    "muscle_strength_daniels" "jsonb",
    "pains" "jsonb",
    "sections_config" "jsonb",
    "mobility_observations" "text",
    CONSTRAINT "analytical_evaluations_godet_test_check" CHECK (("godet_test" = ANY (ARRAY['negative'::"text", '1+'::"text", '2+'::"text", '3+'::"text", '4+'::"text"]))),
    CONSTRAINT "analytical_evaluations_osas_score_check" CHECK ((("osas_score" >= 0) AND ("osas_score" <= 60))),
    CONSTRAINT "analytical_evaluations_pain_score_check" CHECK ((("pain_score" >= 0) AND ("pain_score" <= 10))),
    CONSTRAINT "analytical_evaluations_vancouver_score_check" CHECK ((("vancouver_score" >= 0) AND ("vancouver_score" <= 15)))
);


ALTER TABLE "public"."analytical_evaluations" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytical_evaluations" IS 'pain_score (INT) y pain (TEXT) son independientes: uno para gráficos,
   otro para descripción libre. Sin relación forzada entre ellos.';



COMMENT ON COLUMN "public"."analytical_evaluations"."pain_appearance" IS 'A de ALICIA: aparición del dolor (cuándo, cómo comenzó).';



COMMENT ON COLUMN "public"."analytical_evaluations"."pain_location" IS 'L de ALICIA: localización del dolor.';



COMMENT ON COLUMN "public"."analytical_evaluations"."pain_radiation" IS 'I de ALICIA: irradiación del dolor.';



COMMENT ON COLUMN "public"."analytical_evaluations"."pain_characteristics" IS 'C de ALICIA: características (punzante, urente, opresivo).';



COMMENT ON COLUMN "public"."analytical_evaluations"."pain_aggravating_factors" IS 'A de ALICIA: agravantes y atenuantes del dolor.';



COMMENT ON COLUMN "public"."analytical_evaluations"."edema_circummetry" IS 'Circometría: medidas en cm por zona, comparadas con miembro sano.';



COMMENT ON COLUMN "public"."analytical_evaluations"."godet_test" IS 'Test de Godet: negative, 1+, 2+, 3+, 4+.';



COMMENT ON COLUMN "public"."analytical_evaluations"."dynamometer_msd" IS 'Dinamómetro miembro superior derecho en kgf.';



COMMENT ON COLUMN "public"."analytical_evaluations"."dynamometer_msi" IS 'Dinamómetro miembro superior izquierdo en kgf.';



COMMENT ON COLUMN "public"."analytical_evaluations"."muscle_strength_median" IS 'Fuerza muscular nervio mediano — escala Daniels.';



COMMENT ON COLUMN "public"."analytical_evaluations"."muscle_strength_cubital" IS 'Fuerza muscular nervio cubital — escala Daniels.';



COMMENT ON COLUMN "public"."analytical_evaluations"."muscle_strength_radial" IS 'Fuerza muscular nervio radial — escala Daniels.';



COMMENT ON COLUMN "public"."analytical_evaluations"."sensitivity_functional" IS 'Sensibilidad epicrítica: tacto ligero, discriminación 2 puntos, picking up test.';



COMMENT ON COLUMN "public"."analytical_evaluations"."sensitivity_protective" IS 'Sensibilidad protopática: toco-pincho, temperatura frío-calor.';



COMMENT ON COLUMN "public"."analytical_evaluations"."vancouver_score" IS 'Escala Vancouver VSS (0-15). 0 = cicatriz normal.';



COMMENT ON COLUMN "public"."analytical_evaluations"."osas_score" IS 'Escala OSAS observador (0-60). Menor = mejor.';



COMMENT ON COLUMN "public"."analytical_evaluations"."scar_evaluation" IS 'Evaluación detallada de cicatriz: localización, vascularización, pigmentación, flexibilidad, sensibilidad, relieve, temperatura, observaciones.';



COMMENT ON COLUMN "public"."analytical_evaluations"."specific_tests" IS 'Pruebas especiales: Finkelstein, Phalen, Froment, Wartenberg, Jobe, etc. JSON: {test_name: true/false/null}.';



COMMENT ON COLUMN "public"."analytical_evaluations"."goniometry" IS 'Goniometría AROM/PROM por articulación: hombro, codo, muñeca, mano, pulgar. JSON estructurado.';



CREATE TABLE IF NOT EXISTS "public"."appointment_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_by" "uuid",
    CONSTRAINT "appointment_reminders_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'whatsapp'::"text", 'whatsapp_bot'::"text"])))
);


ALTER TABLE "public"."appointment_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "max_absences" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "appointment_settings_max_absences_check" CHECK ((("max_absences" IS NULL) OR ("max_absences" >= 1))),
    CONSTRAINT "appointment_settings_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['professional'::"text", 'team'::"text"])))
);


ALTER TABLE "public"."appointment_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "appointment_date" timestamp with time zone NOT NULL,
    "type" "public"."appointment_type" DEFAULT 'consultation'::"public"."appointment_type" NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'scheduled'::"public"."appointment_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "appointment_end" timestamp with time zone,
    "cancellation_reason" "text",
    "cancellation_notes" "text",
    "is_overtime" boolean DEFAULT false NOT NULL,
    "modality" "public"."appointment_modality" DEFAULT 'in_person'::"public"."appointment_modality" NOT NULL,
    "video_link" "text",
    "recurrence_id" "uuid"
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


COMMENT ON TABLE "public"."appointments" IS 'Sin soft delete propio: status=cancelled es el mecanismo de anulación.
   Una cita cancelada es información clínica válida que se preserva.';



CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "performed_by" "uuid",
    "action" "public"."audit_action" NOT NULL,
    "action_context" "public"."audit_context" DEFAULT 'user'::"public"."audit_context" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changes" "jsonb",
    CONSTRAINT "chk_audit_context" CHECK (((("action_context" = 'user'::"public"."audit_context") AND ("performed_by" IS NOT NULL)) OR (("action_context" = 'system'::"public"."audit_context") AND ("performed_by" IS NULL))))
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_log" IS 'Trazabilidad inmutable. Sin UPDATE ni DELETE permitidos via RLS.
   performed_by=NULL + action_context=system: operación sin usuario autenticado.
   insert_audit_log() es SECURITY DEFINER y bypassa RLS: la policy INSERT
   solo protege inserts directos desde la app, no los de triggers.';



COMMENT ON COLUMN "public"."audit_log"."performed_by" IS 'ON DELETE RESTRICT: los profiles no pueden borrarse si tienen audit logs.
   Consistente con el diseño: profiles se desactivan, no se borran.';



CREATE TABLE IF NOT EXISTS "public"."cie10" (
    "id" integer NOT NULL,
    "code" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text",
    "description_search" "text"
);


ALTER TABLE "public"."cie10" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cie10_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cie10_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cie10_id_seq" OWNED BY "public"."cie10"."id";



CREATE TABLE IF NOT EXISTS "public"."clinical_files" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "category" "public"."clinical_file_category" DEFAULT 'document'::"public"."clinical_file_category" NOT NULL,
    "description" "text",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "photo_date" "date" DEFAULT CURRENT_DATE,
    "session_id" "uuid",
    "episode_id" "uuid",
    CONSTRAINT "clinical_files_file_name_check" CHECK (("char_length"("file_name") > 0)),
    CONSTRAINT "clinical_files_file_path_check" CHECK (("char_length"("file_path") > 0))
);


ALTER TABLE "public"."clinical_files" OWNER TO "postgres";


COMMENT ON TABLE "public"."clinical_files" IS 'Soft delete propio: un archivo puede eliminarse sin afectar al paciente.
   Al marcar is_deleted=true, la app elimina el archivo físico de Supabase Storage.
   file_path con CHECK: protección mínima contra strings vacíos.';



COMMENT ON COLUMN "public"."clinical_files"."photo_date" IS 'Fecha de la foto/archivo. Default hoy, editable por la terapista.';



COMMENT ON COLUMN "public"."clinical_files"."session_id" IS 'Sesión a la que pertenece este archivo. Opcional.';



CREATE TABLE IF NOT EXISTS "public"."episode_diagnoses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "episode_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "code" "text",
    "label" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."episode_diagnoses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluation_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "evaluation_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evaluation_settings_evaluation_key_check" CHECK (("evaluation_key" = ANY (ARRAY['barthel'::"text", 'fim'::"text", 'occupations'::"text", 'performance_context'::"text", 'analitica_pain'::"text", 'analitica_edema'::"text", 'analitica_mobility'::"text", 'analitica_muscle_strength'::"text", 'analitica_sensitivity'::"text", 'analitica_scar'::"text", 'analitica_specific_tests'::"text", 'analitica_other'::"text"]))),
    CONSTRAINT "evaluation_settings_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['professional'::"text", 'team'::"text"])))
);


ALTER TABLE "public"."evaluation_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_body_regions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_body_regions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "category" "public"."exercise_category" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_custom_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_custom_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_custom_category_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "custom_category_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_custom_category_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_library" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "professional_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "body_region" "text",
    "default_repetitions" integer,
    "default_frequency" "text",
    "instructions" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_sets" integer,
    "default_duration" "text",
    "video_url" "text",
    "body_region_id" "uuid",
    "exercise_type" "text",
    "starting_position" "text",
    "precautions" "text",
    "equipment" "text",
    "suggested_sets" integer,
    "suggested_reps" integer,
    CONSTRAINT "exercise_library_default_repetitions_check" CHECK (("default_repetitions" > 0)),
    CONSTRAINT "exercise_library_exercise_type_check" CHECK (("exercise_type" = ANY (ARRAY['activo'::"text", 'activo_asistido'::"text", 'fortalecimiento'::"text"])))
);


ALTER TABLE "public"."exercise_library" OWNER TO "postgres";


COMMENT ON TABLE "public"."exercise_library" IS 'professional_id NULL = global. NOT NULL = propio del profesional.
   is_active = false: retira del catálogo sin borrar. Resuelve el conflicto
   con ON DELETE RESTRICT de treatment_plan_exercises.';



CREATE TABLE IF NOT EXISTS "public"."exercise_plan_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "assigned_sets" integer,
    "assigned_reps" integer,
    "frequency" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_plan_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_plan_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone
);


ALTER TABLE "public"."exercise_plan_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_date" "date",
    "duration_weeks" integer,
    "routine_id" "uuid",
    "program_id" "uuid",
    CONSTRAINT "exercise_plans_duration_weeks_check" CHECK ((("duration_weeks" IS NULL) OR ("duration_weeks" > 0)))
);


ALTER TABLE "public"."exercise_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_program_routines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_id" "uuid" NOT NULL,
    "routine_id" "uuid" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_program_routines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_routine_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "routine_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "suggested_sets" integer,
    "suggested_reps" integer,
    "frequency" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_routine_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_routines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exercise_routines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "route" "text",
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "feedback_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'seen'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."functional_evaluations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "evaluation_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "barthel_score" integer,
    "dominance" "public"."dominance_type",
    "avd" "text",
    "aivd" "text",
    "physical_activity" "text",
    "sleep_rest" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dash_score" integer,
    "health_management" "text",
    "episode_id" "uuid",
    "quickdash_items" "jsonb",
    "quickdash_score" numeric,
    "fim_items" "jsonb",
    "fim_score" integer,
    "barthel_items" "jsonb",
    "occupations_items" "jsonb",
    "occupations_notes" "text",
    "context_environmental_factors" "text",
    "context_personal_factors" "text",
    "performance_pattern_habits" "text",
    "performance_pattern_routines" "text",
    "performance_pattern_roles" "text",
    "performance_pattern_rituals" "text",
    "performance_skill_motor" "text",
    "performance_skill_processing" "text",
    "performance_skill_social_interaction" "text",
    "client_factor_values_beliefs_spirituality" "text",
    "client_factor_body_functions" "text",
    "client_factor_body_structures" "text",
    CONSTRAINT "functional_evaluations_barthel_score_check" CHECK ((("barthel_score" >= 0) AND ("barthel_score" <= 100))),
    CONSTRAINT "functional_evaluations_dash_score_check" CHECK ((("dash_score" >= 0) AND ("dash_score" <= 100)))
);


ALTER TABLE "public"."functional_evaluations" OWNER TO "postgres";


COMMENT ON TABLE "public"."functional_evaluations" IS 'Sin soft delete propio: registros clínicos inmutables desde la app.
   session_id nullable: NULL = evaluación independiente (ej: evaluación inicial).
   El frontend envía session_id cuando la evaluación ocurre dentro de una sesión.';



COMMENT ON COLUMN "public"."functional_evaluations"."dash_score" IS 'Escala DASH evaluación funcional (0-100).';



COMMENT ON COLUMN "public"."functional_evaluations"."health_management" IS 'Gestión de la salud en contexto de evaluación funcional.';



CREATE TABLE IF NOT EXISTS "public"."obras_sociales" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "name_search" "text",
    "is_active" boolean DEFAULT true,
    "type" character varying(20) DEFAULT 'sindical'::character varying,
    "full_name" "text"
);


ALTER TABLE "public"."obras_sociales" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."obras_sociales_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."obras_sociales_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."obras_sociales_id_seq" OWNED BY "public"."obras_sociales"."id";



CREATE TABLE IF NOT EXISTS "public"."patient_clinical_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "injury_date" "date",
    "symptom_start_date" "date",
    "injury_mechanism" "text",
    "current_treatment" "text",
    "weeks_post_injury" integer,
    "weeks_post_surgery" integer,
    "studies" "text",
    "next_oyt_appointment" "date",
    "doctor_name" "text",
    "medical_history" "text",
    "pharmacological_treatment" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "diagnosis" "text",
    "treatment_type" "text",
    "immobilization_weeks" integer,
    "episode_id" "uuid",
    "days_post_injury" integer,
    "days_post_surgery" integer,
    "immobilization_days" integer,
    "immobilization_type" "text",
    "surgery_date" "date",
    "referral_reason" "text",
    CONSTRAINT "patient_clinical_records_immobilization_weeks_check" CHECK (("immobilization_weeks" >= 0)),
    CONSTRAINT "patient_clinical_records_treatment_type_check" CHECK (("treatment_type" = ANY (ARRAY['surgery'::"text", 'conservative'::"text", 'mixed'::"text"]))),
    CONSTRAINT "patient_clinical_records_weeks_post_injury_check" CHECK (("weeks_post_injury" >= 0)),
    CONSTRAINT "patient_clinical_records_weeks_post_surgery_check" CHECK (("weeks_post_surgery" >= 0))
);


ALTER TABLE "public"."patient_clinical_records" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_clinical_records" IS 'Sin soft delete propio: registro 1-a-1 con patients.
   Protección via is_my_patient() en RLS: si el paciente está eliminado,
   is_my_patient() devuelve false y bloquea el acceso a esta tabla.
   ON DELETE CASCADE solo opera si un admin borra físicamente al paciente.';



COMMENT ON COLUMN "public"."patient_clinical_records"."diagnosis" IS 'DX clínico del paciente.';



COMMENT ON COLUMN "public"."patient_clinical_records"."treatment_type" IS 'Tipo de tratamiento: surgery (quirúrgico), conservative (conservador), mixed.';



COMMENT ON COLUMN "public"."patient_clinical_records"."immobilization_weeks" IS 'Semanas de inmovilización. Dato independiente de semanas post-lesión/cirugía.';



CREATE TABLE IF NOT EXISTS "public"."patient_occupational_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "support_network" "text",
    "education" "text",
    "job" "text",
    "leisure" "text",
    "physical_activity" "text",
    "sleep_rest" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dominance" "text",
    "health_management" "text",
    "avd" "text",
    "aivd" "text",
    "dash_score" integer,
    "employment_status" "text",
    "marital_status" "text",
    "education_level" "text",
    CONSTRAINT "patient_occupational_profiles_dash_score_check" CHECK ((("dash_score" >= 0) AND ("dash_score" <= 100))),
    CONSTRAINT "patient_occupational_profiles_dominance_check" CHECK (("dominance" = ANY (ARRAY['right'::"text", 'left'::"text", 'ambidextrous'::"text"])))
);


ALTER TABLE "public"."patient_occupational_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_occupational_profiles" IS 'Sin soft delete propio: registro 1-a-1 con patients.
   Protegida via is_my_patient() en RLS.';



COMMENT ON COLUMN "public"."patient_occupational_profiles"."dominance" IS 'Lateralidad: right, left, ambidextrous.';



COMMENT ON COLUMN "public"."patient_occupational_profiles"."health_management" IS 'Gestión de la salud: adherencia a turnos médicos, hábitos de salud.';



COMMENT ON COLUMN "public"."patient_occupational_profiles"."avd" IS 'Actividades de la vida diaria.';



COMMENT ON COLUMN "public"."patient_occupational_profiles"."aivd" IS 'Actividades instrumentales de la vida diaria.';



COMMENT ON COLUMN "public"."patient_occupational_profiles"."dash_score" IS 'Escala DASH (0-100). 0 = sin discapacidad, 100 = máxima discapacidad.';



CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "user_profile_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "dni" "text" NOT NULL,
    "birth_date" "date",
    "phone" "text",
    "address" "text",
    "insurance" "text",
    "admission_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "public"."patient_status" DEFAULT 'active'::"public"."patient_status" NOT NULL,
    "discharged_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nationality" "text",
    "insurances" "jsonb",
    "insurance_number" "text",
    "gender" "text",
    "email" "text",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "emergency_contact_relation" "text",
    "team_id" "uuid",
    "abandoned_at" timestamp with time zone,
    "abandon_reason" "text",
    "allergies" "text",
    "emergency_contact_first_name" "text",
    "emergency_contact_last_name" "text",
    "document_type" "text" DEFAULT 'dni'::"text" NOT NULL,
    "preferred_name" "text",
    CONSTRAINT "chk_deleted_patient_status" CHECK ((("is_deleted" = false) OR ("status" <> 'active'::"public"."patient_status"))),
    CONSTRAINT "patients_document_type_check" CHECK (("document_type" = ANY (ARRAY['dni'::"text", 'lc'::"text", 'le'::"text", 'passport'::"text", 'foreign_id'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


COMMENT ON TABLE "public"."patients" IS 'Ficha clínica. NUNCA borrar físicamente: usar is_deleted = true.
   deleted_by: quién hizo el soft delete (NULL si fue el sistema).
   chk_deleted_patient_status: un paciente eliminado no puede estar activo.';



CREATE TABLE IF NOT EXISTS "public"."priority_pathologies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "code" "text",
    "label" "text" NOT NULL,
    "level" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "priority_pathologies_level_check" CHECK (("level" = ANY (ARRAY['red'::"text", 'yellow'::"text", 'green'::"text"]))),
    CONSTRAINT "priority_pathologies_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['professional'::"text", 'team'::"text"])))
);


ALTER TABLE "public"."priority_pathologies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."privacy_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "policy_version" "text" NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."privacy_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."profile_role" DEFAULT 'professional'::"public"."profile_role" NOT NULL,
    "specialty" "text",
    "license_number" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "deactivated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text",
    CONSTRAINT "chk_deactivated_at" CHECK (((("is_active" = true) AND ("deactivated_at" IS NULL)) OR (("is_active" = false) AND ("deactivated_at" IS NOT NULL))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Usuarios autenticados. NUNCA borrar físicamente: usar is_active = false.
   Reactivación en fase 1: requiere service role o Supabase Dashboard.
   SQL: UPDATE profiles SET is_active = true WHERE id = <uuid>;';



COMMENT ON COLUMN "public"."profiles"."deactivated_at" IS 'Auto-completado por trg_profiles_deactivated_at. No modificar manualmente.';



CREATE TABLE IF NOT EXISTS "public"."quickdash_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "text",
    "result" "jsonb",
    "episode_id" "uuid",
    CONSTRAINT "quickdash_tokens_completed_by_check" CHECK (("completed_by" = ANY (ARRAY['patient'::"text", 'therapist'::"text"])))
);


ALTER TABLE "public"."quickdash_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "team_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."team_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "team_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "member_limit" integer DEFAULT 5 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."therapy_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "session_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "general_observations" "text",
    "evolution" "text",
    "symptom_changes" "text",
    "clinical_changes" "text",
    "treatment_adjustments" "text",
    "next_appointment" "date",
    "notes" "text",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_number" integer,
    "week_at_session" integer,
    "session_type" "text" DEFAULT 'follow_up'::"text",
    "interventions" "text",
    "home_instructions_sent" "text",
    "episode_id" "uuid",
    "avd_followup" "text",
    "session_goals" "text",
    CONSTRAINT "therapy_sessions_session_number_check" CHECK (("session_number" > 0)),
    CONSTRAINT "therapy_sessions_session_type_check" CHECK (("session_type" = ANY (ARRAY['admission'::"text", 'follow_up'::"text", 'discharge'::"text"]))),
    CONSTRAINT "therapy_sessions_week_at_session_check" CHECK (("week_at_session" >= 0))
);


ALTER TABLE "public"."therapy_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."therapy_sessions" IS 'Soft delete propio: sesión independiente que puede eliminarse sin afectar
   al paciente. Las evaluaciones vinculadas via session_id pasan a NULL (SET NULL)
   pero se preservan.';



COMMENT ON COLUMN "public"."therapy_sessions"."session_number" IS 'Número de sesión (1ra, 2da...). La terapista lo ingresa manualmente.';



COMMENT ON COLUMN "public"."therapy_sessions"."week_at_session" IS 'Semana POP o post lesión al momento de la sesión.';



COMMENT ON COLUMN "public"."therapy_sessions"."session_type" IS 'Tipo: admission (admisión/primera vez), follow_up (seguimiento), discharge (alta).';



COMMENT ON COLUMN "public"."therapy_sessions"."interventions" IS 'Lo que se abordó en el día (En el día de hoy se aborda:...).';



COMMENT ON COLUMN "public"."therapy_sessions"."home_instructions_sent" IS 'Indicaciones enviadas vía telefónica o al alta de la sesión.';



CREATE TABLE IF NOT EXISTS "public"."treatment_episodes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "episode_number" integer DEFAULT 1 NOT NULL,
    "admission_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "discharge_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "diagnosis" "text",
    "notes" "text",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "affected_side" "text",
    "referral_date" "date",
    CONSTRAINT "treatment_episodes_affected_side_check" CHECK (("affected_side" = ANY (ARRAY['MSD'::"text", 'MSI'::"text", 'both'::"text"]))),
    CONSTRAINT "treatment_episodes_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'discharged'::"text"])))
);


ALTER TABLE "public"."treatment_episodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."treatment_plan_exercises" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "treatment_plan_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "custom_name" "text",
    "custom_description" "text",
    "repetitions" integer,
    "sets" integer,
    "frequency" "text",
    "duration" "text",
    "order_index" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "treatment_plan_exercises_repetitions_check" CHECK (("repetitions" > 0)),
    CONSTRAINT "treatment_plan_exercises_sets_check" CHECK (("sets" > 0))
);


ALTER TABLE "public"."treatment_plan_exercises" OWNER TO "postgres";


COMMENT ON COLUMN "public"."treatment_plan_exercises"."exercise_id" IS 'RESTRICT: protege historial clínico de planes existentes.
   Para retirar un ejercicio del catálogo sin borrar planes:
   UPDATE exercise_library SET is_active = false WHERE id = <uuid>;';



CREATE TABLE IF NOT EXISTS "public"."treatment_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "objective" "text",
    "indications" "text",
    "skin_care" "text",
    "joint_protection_guidelines" "text",
    "home_item_recommendations" "text",
    "status" "public"."treatment_plan_status" DEFAULT 'active'::"public"."treatment_plan_status" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "notes" "text",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "episode_id" "uuid",
    CONSTRAINT "chk_plan_dates" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date")))
);


ALTER TABLE "public"."treatment_plans" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cie10" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cie10_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."obras_sociales" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."obras_sociales_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."analytical_evaluations"
    ADD CONSTRAINT "analytical_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_reminders"
    ADD CONSTRAINT "appointment_reminders_appointment_id_channel_key" UNIQUE ("appointment_id", "channel");



ALTER TABLE ONLY "public"."appointment_reminders"
    ADD CONSTRAINT "appointment_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_settings"
    ADD CONSTRAINT "appointment_settings_owner_type_owner_id_key" UNIQUE ("owner_type", "owner_id");



ALTER TABLE ONLY "public"."appointment_settings"
    ADD CONSTRAINT "appointment_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cie10"
    ADD CONSTRAINT "cie10_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinical_files"
    ADD CONSTRAINT "clinical_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."episode_diagnoses"
    ADD CONSTRAINT "episode_diagnoses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluation_settings"
    ADD CONSTRAINT "evaluation_settings_owner_type_owner_id_evaluation_key_key" UNIQUE ("owner_type", "owner_id", "evaluation_key");



ALTER TABLE ONLY "public"."evaluation_settings"
    ADD CONSTRAINT "evaluation_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_body_regions"
    ADD CONSTRAINT "exercise_body_regions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_categories"
    ADD CONSTRAINT "exercise_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_custom_categories"
    ADD CONSTRAINT "exercise_custom_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_custom_category_assignments"
    ADD CONSTRAINT "exercise_custom_category_assi_exercise_id_custom_category_i_key" UNIQUE ("exercise_id", "custom_category_id");



ALTER TABLE ONLY "public"."exercise_custom_category_assignments"
    ADD CONSTRAINT "exercise_custom_category_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_library"
    ADD CONSTRAINT "exercise_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_plan_items"
    ADD CONSTRAINT "exercise_plan_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_plan_tokens"
    ADD CONSTRAINT "exercise_plan_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_plan_tokens"
    ADD CONSTRAINT "exercise_plan_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."exercise_plans"
    ADD CONSTRAINT "exercise_plans_patient_id_key" UNIQUE ("patient_id");



ALTER TABLE ONLY "public"."exercise_plans"
    ADD CONSTRAINT "exercise_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_program_routines"
    ADD CONSTRAINT "exercise_program_routines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_programs"
    ADD CONSTRAINT "exercise_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_routine_items"
    ADD CONSTRAINT "exercise_routine_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_routines"
    ADD CONSTRAINT "exercise_routines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."functional_evaluations"
    ADD CONSTRAINT "functional_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."obras_sociales"
    ADD CONSTRAINT "obras_sociales_name_valid" CHECK ((("btrim"("name") <> ''::"text") AND ("length"("name") <= 120))) NOT VALID;



ALTER TABLE ONLY "public"."obras_sociales"
    ADD CONSTRAINT "obras_sociales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_clinical_records"
    ADD CONSTRAINT "patient_clinical_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_occupational_profiles"
    ADD CONSTRAINT "patient_occupational_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."priority_pathologies"
    ADD CONSTRAINT "priority_pathologies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."privacy_consents"
    ADD CONSTRAINT "privacy_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quickdash_tokens"
    ADD CONSTRAINT "quickdash_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quickdash_tokens"
    ADD CONSTRAINT "quickdash_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id", "user_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."therapy_sessions"
    ADD CONSTRAINT "therapy_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatment_episodes"
    ADD CONSTRAINT "treatment_episodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatment_plan_exercises"
    ADD CONSTRAINT "treatment_plan_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatment_plans"
    ADD CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_categories"
    ADD CONSTRAINT "uq_exercise_category" UNIQUE ("exercise_id", "category");



ALTER TABLE ONLY "public"."patient_occupational_profiles"
    ADD CONSTRAINT "uq_occupational_profile_patient" UNIQUE ("patient_id");



CREATE INDEX "evaluation_settings_owner_idx" ON "public"."evaluation_settings" USING "btree" ("owner_type", "owner_id");



CREATE UNIQUE INDEX "exercise_body_regions_professional_name_lower_idx" ON "public"."exercise_body_regions" USING "btree" ("professional_id", "lower"("name"));



CREATE UNIQUE INDEX "exercise_custom_categories_professional_name_lower_idx" ON "public"."exercise_custom_categories" USING "btree" ("professional_id", "lower"("name"));



CREATE INDEX "idx_analytical_evals_patient_date" ON "public"."analytical_evaluations" USING "btree" ("patient_id", "evaluation_date" DESC);



CREATE INDEX "idx_analytical_evals_patient_id" ON "public"."analytical_evaluations" USING "btree" ("patient_id");



CREATE INDEX "idx_analytical_evals_professional_id" ON "public"."analytical_evaluations" USING "btree" ("professional_id");



CREATE INDEX "idx_analytical_evals_session_id" ON "public"."analytical_evaluations" USING "btree" ("session_id");



CREATE INDEX "idx_analytical_evaluations_episode_id" ON "public"."analytical_evaluations" USING "btree" ("episode_id");



CREATE INDEX "idx_appointment_reminders_appointment_id" ON "public"."appointment_reminders" USING "btree" ("appointment_id");



CREATE INDEX "idx_appointments_patient_date" ON "public"."appointments" USING "btree" ("patient_id", "appointment_date");



CREATE INDEX "idx_appointments_patient_id" ON "public"."appointments" USING "btree" ("patient_id");



CREATE INDEX "idx_appointments_professional_date" ON "public"."appointments" USING "btree" ("professional_id", "appointment_date");



CREATE INDEX "idx_appointments_recurrence_id" ON "public"."appointments" USING "btree" ("recurrence_id") WHERE ("recurrence_id" IS NOT NULL);



CREATE INDEX "idx_appointments_status" ON "public"."appointments" USING "btree" ("status");



CREATE INDEX "idx_audit_log_created_at" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_log_performed_by" ON "public"."audit_log" USING "btree" ("performed_by");



CREATE INDEX "idx_audit_log_table_record" ON "public"."audit_log" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_cie10_code" ON "public"."cie10" USING "btree" ("code");



CREATE INDEX "idx_cie10_description" ON "public"."cie10" USING "gin" ("to_tsvector"('"spanish"'::"regconfig", "description"));



CREATE INDEX "idx_cie10_search" ON "public"."cie10" USING "btree" ("description_search");



CREATE INDEX "idx_clinical_files_active" ON "public"."clinical_files" USING "btree" ("patient_id", "is_deleted") WHERE ("is_deleted" = false);



CREATE INDEX "idx_clinical_files_category" ON "public"."clinical_files" USING "btree" ("category");



CREATE INDEX "idx_clinical_files_episode_id" ON "public"."clinical_files" USING "btree" ("episode_id");



CREATE INDEX "idx_clinical_files_patient_id" ON "public"."clinical_files" USING "btree" ("patient_id");



CREATE INDEX "idx_clinical_files_session_id" ON "public"."clinical_files" USING "btree" ("session_id");



CREATE INDEX "idx_clinical_files_uploaded_by" ON "public"."clinical_files" USING "btree" ("uploaded_by");



CREATE INDEX "idx_clinical_records_episode_id" ON "public"."patient_clinical_records" USING "btree" ("episode_id");



CREATE INDEX "idx_clinical_records_patient_id" ON "public"."patient_clinical_records" USING "btree" ("patient_id");



CREATE INDEX "idx_episode_diagnoses_episode_id" ON "public"."episode_diagnoses" USING "btree" ("episode_id");



CREATE INDEX "idx_episode_diagnoses_patient_id" ON "public"."episode_diagnoses" USING "btree" ("patient_id");



CREATE INDEX "idx_exercise_body_regions_professional_id" ON "public"."exercise_body_regions" USING "btree" ("professional_id");



CREATE INDEX "idx_exercise_categories_exercise_id" ON "public"."exercise_categories" USING "btree" ("exercise_id");



CREATE INDEX "idx_exercise_custom_cat_assignments_category_id" ON "public"."exercise_custom_category_assignments" USING "btree" ("custom_category_id");



CREATE INDEX "idx_exercise_library_active" ON "public"."exercise_library" USING "btree" ("professional_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_exercise_library_body_region_id" ON "public"."exercise_library" USING "btree" ("body_region_id");



CREATE INDEX "idx_exercise_library_professional_id" ON "public"."exercise_library" USING "btree" ("professional_id");



CREATE INDEX "idx_exercise_plan_items_exercise_id" ON "public"."exercise_plan_items" USING "btree" ("exercise_id");



CREATE INDEX "idx_exercise_plan_items_plan_id" ON "public"."exercise_plan_items" USING "btree" ("plan_id");



CREATE INDEX "idx_exercise_plan_tokens_patient_id" ON "public"."exercise_plan_tokens" USING "btree" ("patient_id");



CREATE INDEX "idx_exercise_plan_tokens_plan_id" ON "public"."exercise_plan_tokens" USING "btree" ("plan_id");



CREATE INDEX "idx_exercise_plan_tokens_professional_id" ON "public"."exercise_plan_tokens" USING "btree" ("professional_id");



CREATE INDEX "idx_exercise_plans_patient_id" ON "public"."exercise_plans" USING "btree" ("patient_id");



CREATE INDEX "idx_exercise_plans_professional_id" ON "public"."exercise_plans" USING "btree" ("professional_id");



CREATE INDEX "idx_exercise_plans_routine_id" ON "public"."exercise_plans" USING "btree" ("routine_id");



CREATE INDEX "idx_exercise_program_routines_program_id" ON "public"."exercise_program_routines" USING "btree" ("program_id");



CREATE INDEX "idx_exercise_program_routines_routine_id" ON "public"."exercise_program_routines" USING "btree" ("routine_id");



CREATE INDEX "idx_exercise_programs_professional_id" ON "public"."exercise_programs" USING "btree" ("professional_id");



CREATE INDEX "idx_exercise_routine_items_exercise_id" ON "public"."exercise_routine_items" USING "btree" ("exercise_id");



CREATE INDEX "idx_exercise_routine_items_routine_id" ON "public"."exercise_routine_items" USING "btree" ("routine_id");



CREATE INDEX "idx_exercise_routines_professional_id" ON "public"."exercise_routines" USING "btree" ("professional_id");



CREATE INDEX "idx_feedback_created_at" ON "public"."feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_functional_evals_patient_date" ON "public"."functional_evaluations" USING "btree" ("patient_id", "evaluation_date" DESC);



CREATE INDEX "idx_functional_evals_patient_id" ON "public"."functional_evaluations" USING "btree" ("patient_id");



CREATE INDEX "idx_functional_evals_professional_id" ON "public"."functional_evaluations" USING "btree" ("professional_id");



CREATE INDEX "idx_functional_evals_session_id" ON "public"."functional_evaluations" USING "btree" ("session_id");



CREATE INDEX "idx_functional_evaluations_episode_id" ON "public"."functional_evaluations" USING "btree" ("episode_id");



CREATE INDEX "idx_obras_sociales_search" ON "public"."obras_sociales" USING "btree" ("name_search");



CREATE INDEX "idx_occupational_profiles_patient_id" ON "public"."patient_occupational_profiles" USING "btree" ("patient_id");



CREATE INDEX "idx_patients_deleted_by" ON "public"."patients" USING "btree" ("deleted_by");



CREATE INDEX "idx_patients_dni" ON "public"."patients" USING "btree" ("dni");



CREATE INDEX "idx_patients_is_deleted" ON "public"."patients" USING "btree" ("is_deleted");



CREATE INDEX "idx_patients_name_fts" ON "public"."patients" USING "gin" ("to_tsvector"('"simple"'::"regconfig", (("first_name" || ' '::"text") || "last_name")));



CREATE INDEX "idx_patients_professional_active" ON "public"."patients" USING "btree" ("professional_id", "status", "is_deleted") WHERE ("is_deleted" = false);



CREATE INDEX "idx_patients_professional_id" ON "public"."patients" USING "btree" ("professional_id");



CREATE INDEX "idx_patients_status" ON "public"."patients" USING "btree" ("status");



CREATE INDEX "idx_patients_user_profile_id" ON "public"."patients" USING "btree" ("user_profile_id");



CREATE INDEX "idx_plan_exercises_exercise_id" ON "public"."treatment_plan_exercises" USING "btree" ("exercise_id");



CREATE INDEX "idx_plan_exercises_plan_id" ON "public"."treatment_plan_exercises" USING "btree" ("treatment_plan_id");



CREATE INDEX "idx_privacy_consents_user_version" ON "public"."privacy_consents" USING "btree" ("user_id", "policy_version");



CREATE INDEX "idx_profiles_is_active" ON "public"."profiles" USING "btree" ("is_active");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_quickdash_tokens_created_by" ON "public"."quickdash_tokens" USING "btree" ("created_by");



CREATE INDEX "idx_quickdash_tokens_patient_id" ON "public"."quickdash_tokens" USING "btree" ("patient_id");



CREATE INDEX "idx_quickdash_tokens_session_id" ON "public"."quickdash_tokens" USING "btree" ("session_id");



CREATE INDEX "idx_sessions_is_deleted" ON "public"."therapy_sessions" USING "btree" ("is_deleted");



CREATE INDEX "idx_sessions_patient_date" ON "public"."therapy_sessions" USING "btree" ("patient_id", "session_date" DESC) WHERE ("is_deleted" = false);



CREATE INDEX "idx_sessions_patient_id" ON "public"."therapy_sessions" USING "btree" ("patient_id");



CREATE INDEX "idx_sessions_professional" ON "public"."therapy_sessions" USING "btree" ("professional_id");



CREATE INDEX "idx_team_invitations_invited_by" ON "public"."team_invitations" USING "btree" ("invited_by");



CREATE INDEX "idx_team_members_invited_by" ON "public"."team_members" USING "btree" ("invited_by");



CREATE INDEX "idx_teams_created_by" ON "public"."teams" USING "btree" ("created_by");



CREATE INDEX "idx_therapy_sessions_episode_id" ON "public"."therapy_sessions" USING "btree" ("episode_id");



CREATE INDEX "idx_treatment_episodes_patient_id" ON "public"."treatment_episodes" USING "btree" ("patient_id");



CREATE INDEX "idx_treatment_episodes_professional_id" ON "public"."treatment_episodes" USING "btree" ("professional_id");



CREATE INDEX "idx_treatment_plans_episode_id" ON "public"."treatment_plans" USING "btree" ("episode_id");



CREATE INDEX "idx_treatment_plans_patient_id" ON "public"."treatment_plans" USING "btree" ("patient_id");



CREATE INDEX "idx_treatment_plans_patient_status" ON "public"."treatment_plans" USING "btree" ("patient_id", "status") WHERE ("is_deleted" = false);



CREATE INDEX "idx_treatment_plans_professional_id" ON "public"."treatment_plans" USING "btree" ("professional_id");



CREATE INDEX "idx_treatment_plans_status" ON "public"."treatment_plans" USING "btree" ("status");



CREATE UNIQUE INDEX "obras_sociales_name_lower_idx" ON "public"."obras_sociales" USING "btree" ("lower"("name"));



CREATE INDEX "patients_team_id_idx" ON "public"."patients" USING "btree" ("team_id");



CREATE INDEX "patients_team_professional_idx" ON "public"."patients" USING "btree" ("team_id", "professional_id") WHERE ("is_deleted" = false);



CREATE UNIQUE INDEX "priority_pathologies_owner_label_idx" ON "public"."priority_pathologies" USING "btree" ("owner_type", "owner_id", "lower"("label"));



CREATE INDEX "quickdash_tokens_episode_id_idx" ON "public"."quickdash_tokens" USING "btree" ("episode_id");



CREATE INDEX "team_invitations_email_idx" ON "public"."team_invitations" USING "btree" ("email");



CREATE INDEX "team_invitations_team_status_idx" ON "public"."team_invitations" USING "btree" ("team_id", "status");



CREATE INDEX "team_invitations_token_idx" ON "public"."team_invitations" USING "btree" ("token");



CREATE INDEX "team_members_team_role_idx" ON "public"."team_members" USING "btree" ("team_id", "role");



CREATE INDEX "team_members_user_id_idx" ON "public"."team_members" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_episode_number_per_patient" ON "public"."treatment_episodes" USING "btree" ("patient_id", "episode_number") WHERE ("is_deleted" = false);



CREATE UNIQUE INDEX "uq_patients_dni_personal_active" ON "public"."patients" USING "btree" ("dni", "professional_id") WHERE (("team_id" IS NULL) AND ("is_deleted" = false));



CREATE UNIQUE INDEX "uq_patients_dni_team_active" ON "public"."patients" USING "btree" ("dni", "team_id") WHERE (("team_id" IS NOT NULL) AND ("is_deleted" = false));



CREATE OR REPLACE TRIGGER "handle_updated_at_treatment_episodes" BEFORE UPDATE ON "public"."treatment_episodes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."appointment_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."evaluation_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."priority_pathologies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_analytical_eval_update" AFTER UPDATE ON "public"."analytical_evaluations" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."handle_analytical_eval_update"();



CREATE OR REPLACE TRIGGER "trg_analytical_evals_insert" AFTER INSERT ON "public"."analytical_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_analytical_eval_insert"();



CREATE OR REPLACE TRIGGER "trg_analytical_evals_updated_at" BEFORE UPDATE ON "public"."analytical_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_appointments_lock_ownership" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."appointments_lock_ownership"();



CREATE OR REPLACE TRIGGER "trg_appointments_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_cie10_search" BEFORE INSERT OR UPDATE ON "public"."cie10" FOR EACH ROW EXECUTE FUNCTION "public"."update_cie10_search"();



CREATE OR REPLACE TRIGGER "trg_clinical_files_soft_delete" BEFORE UPDATE OF "is_deleted" ON "public"."clinical_files" FOR EACH ROW EXECUTE FUNCTION "public"."handle_file_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_clinical_files_updated_at" BEFORE UPDATE ON "public"."clinical_files" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_clinical_record_insert" AFTER INSERT ON "public"."patient_clinical_records" FOR EACH ROW EXECUTE FUNCTION "public"."handle_clinical_record_insert"();



CREATE OR REPLACE TRIGGER "trg_clinical_record_update" AFTER UPDATE ON "public"."patient_clinical_records" FOR EACH ROW EXECUTE FUNCTION "public"."handle_clinical_record_update"();



CREATE OR REPLACE TRIGGER "trg_clinical_records_updated_at" BEFORE UPDATE ON "public"."patient_clinical_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_exercise_library_updated_at" BEFORE UPDATE ON "public"."exercise_library" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_functional_eval_update" AFTER UPDATE ON "public"."functional_evaluations" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."handle_functional_eval_update"();



CREATE OR REPLACE TRIGGER "trg_functional_evals_insert" AFTER INSERT ON "public"."functional_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_functional_eval_insert"();



CREATE OR REPLACE TRIGGER "trg_functional_evals_updated_at" BEFORE UPDATE ON "public"."functional_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_obras_sociales_block_delete" BEFORE DELETE ON "public"."obras_sociales" FOR EACH ROW EXECUTE FUNCTION "public"."block_obra_social_delete_in_use"();



CREATE OR REPLACE TRIGGER "trg_obras_sociales_normalize" BEFORE INSERT OR UPDATE ON "public"."obras_sociales" FOR EACH ROW EXECUTE FUNCTION "public"."validate_obra_social"();



CREATE OR REPLACE TRIGGER "trg_obras_sociales_rename" AFTER UPDATE OF "name" ON "public"."obras_sociales" FOR EACH ROW EXECUTE FUNCTION "public"."propagate_obra_social_rename"();



CREATE OR REPLACE TRIGGER "trg_obras_sociales_search" BEFORE INSERT OR UPDATE ON "public"."obras_sociales" FOR EACH ROW EXECUTE FUNCTION "public"."update_obras_sociales_search"();



CREATE OR REPLACE TRIGGER "trg_occupational_profile_insert" AFTER INSERT ON "public"."patient_occupational_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_occupational_profile_insert"();



CREATE OR REPLACE TRIGGER "trg_occupational_profile_update" AFTER UPDATE ON "public"."patient_occupational_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_occupational_profile_update"();



CREATE OR REPLACE TRIGGER "trg_occupational_profiles_updated_at" BEFORE UPDATE ON "public"."patient_occupational_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_patient_update" AFTER UPDATE ON "public"."patients" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."handle_patient_update"();



CREATE OR REPLACE TRIGGER "trg_patients_discharged_at" BEFORE UPDATE OF "status" ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."handle_patient_discharge"();



CREATE OR REPLACE TRIGGER "trg_patients_insert" AFTER INSERT ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."handle_patient_insert"();



CREATE OR REPLACE TRIGGER "trg_patients_soft_delete" BEFORE UPDATE OF "is_deleted" ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."handle_patient_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_patients_updated_at" BEFORE UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_plan_exercises_updated_at" BEFORE UPDATE ON "public"."treatment_plan_exercises" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_profile_activation_update" AFTER UPDATE ON "public"."profiles" FOR EACH ROW WHEN (("old"."is_active" IS DISTINCT FROM "new"."is_active")) EXECUTE FUNCTION "public"."handle_profile_activation_change"();



CREATE OR REPLACE TRIGGER "trg_profiles_deactivated_at" BEFORE UPDATE OF "is_active" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_profile_deactivation"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_session_update" AFTER UPDATE ON "public"."therapy_sessions" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."handle_session_update"();



CREATE OR REPLACE TRIGGER "trg_sessions_insert" AFTER INSERT ON "public"."therapy_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_session_insert"();



CREATE OR REPLACE TRIGGER "trg_sessions_soft_delete" BEFORE UPDATE OF "is_deleted" ON "public"."therapy_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_session_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_sessions_updated_at" BEFORE UPDATE ON "public"."therapy_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_team_invitation_update" AFTER UPDATE ON "public"."team_invitations" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."handle_team_invitation_update"();



CREATE OR REPLACE TRIGGER "trg_team_member_delete" AFTER DELETE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."handle_team_member_change"();



CREATE OR REPLACE TRIGGER "trg_team_member_insert" AFTER INSERT ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."handle_team_member_change"();



CREATE OR REPLACE TRIGGER "trg_team_member_update" AFTER UPDATE ON "public"."team_members" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."handle_team_member_change"();



CREATE OR REPLACE TRIGGER "trg_treatment_episode_update" AFTER UPDATE ON "public"."treatment_episodes" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."handle_treatment_episode_update"();



CREATE OR REPLACE TRIGGER "trg_treatment_plan_update" AFTER UPDATE ON "public"."treatment_plans" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."handle_treatment_plan_update"();



CREATE OR REPLACE TRIGGER "trg_treatment_plans_insert" AFTER INSERT ON "public"."treatment_plans" FOR EACH ROW EXECUTE FUNCTION "public"."handle_plan_insert"();



CREATE OR REPLACE TRIGGER "trg_treatment_plans_soft_delete" BEFORE UPDATE OF "is_deleted" ON "public"."treatment_plans" FOR EACH ROW EXECUTE FUNCTION "public"."handle_plan_soft_delete"();



CREATE OR REPLACE TRIGGER "trg_treatment_plans_updated_at" BEFORE UPDATE ON "public"."treatment_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_owner_id" BEFORE INSERT OR UPDATE ON "public"."appointment_settings" FOR EACH ROW EXECUTE FUNCTION "public"."validate_owner_id"();



CREATE OR REPLACE TRIGGER "validate_owner_id" BEFORE INSERT OR UPDATE ON "public"."evaluation_settings" FOR EACH ROW EXECUTE FUNCTION "public"."validate_owner_id"();



CREATE OR REPLACE TRIGGER "validate_owner_id" BEFORE INSERT OR UPDATE ON "public"."priority_pathologies" FOR EACH ROW EXECUTE FUNCTION "public"."validate_owner_id"();



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytical_evaluations"
    ADD CONSTRAINT "analytical_evaluations_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."treatment_episodes"("id");



ALTER TABLE ONLY "public"."analytical_evaluations"
    ADD CONSTRAINT "analytical_evaluations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytical_evaluations"
    ADD CONSTRAINT "analytical_evaluations_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."analytical_evaluations"
    ADD CONSTRAINT "analytical_evaluations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointment_reminders"
    ADD CONSTRAINT "appointment_reminders_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_reminders"
    ADD CONSTRAINT "appointment_reminders_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."clinical_files"
    ADD CONSTRAINT "clinical_files_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."treatment_episodes"("id");



ALTER TABLE ONLY "public"."clinical_files"
    ADD CONSTRAINT "clinical_files_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinical_files"
    ADD CONSTRAINT "clinical_files_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clinical_files"
    ADD CONSTRAINT "clinical_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."episode_diagnoses"
    ADD CONSTRAINT "episode_diagnoses_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."treatment_episodes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."episode_diagnoses"
    ADD CONSTRAINT "episode_diagnoses_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_body_regions"
    ADD CONSTRAINT "exercise_body_regions_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exercise_categories"
    ADD CONSTRAINT "exercise_categories_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_library"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_custom_categories"
    ADD CONSTRAINT "exercise_custom_categories_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_custom_category_assignments"
    ADD CONSTRAINT "exercise_custom_category_assignments_custom_category_id_fkey" FOREIGN KEY ("custom_category_id") REFERENCES "public"."exercise_custom_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_custom_category_assignments"
    ADD CONSTRAINT "exercise_custom_category_assignments_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_library"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_library"
    ADD CONSTRAINT "exercise_library_body_region_id_fkey" FOREIGN KEY ("body_region_id") REFERENCES "public"."exercise_body_regions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exercise_library"
    ADD CONSTRAINT "exercise_library_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."exercise_plan_items"
    ADD CONSTRAINT "exercise_plan_items_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_library"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."exercise_plan_items"
    ADD CONSTRAINT "exercise_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."exercise_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_plan_tokens"
    ADD CONSTRAINT "exercise_plan_tokens_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."exercise_plan_tokens"
    ADD CONSTRAINT "exercise_plan_tokens_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."exercise_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_plan_tokens"
    ADD CONSTRAINT "exercise_plan_tokens_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exercise_plans"
    ADD CONSTRAINT "exercise_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_plans"
    ADD CONSTRAINT "exercise_plans_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exercise_plans"
    ADD CONSTRAINT "exercise_plans_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."exercise_programs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exercise_plans"
    ADD CONSTRAINT "exercise_plans_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."exercise_routines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exercise_program_routines"
    ADD CONSTRAINT "exercise_program_routines_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."exercise_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_program_routines"
    ADD CONSTRAINT "exercise_program_routines_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."exercise_routines"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."exercise_programs"
    ADD CONSTRAINT "exercise_programs_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exercise_routine_items"
    ADD CONSTRAINT "exercise_routine_items_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_library"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."exercise_routine_items"
    ADD CONSTRAINT "exercise_routine_items_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."exercise_routines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_routines"
    ADD CONSTRAINT "exercise_routines_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."functional_evaluations"
    ADD CONSTRAINT "functional_evaluations_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."treatment_episodes"("id");



ALTER TABLE ONLY "public"."functional_evaluations"
    ADD CONSTRAINT "functional_evaluations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."functional_evaluations"
    ADD CONSTRAINT "functional_evaluations_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."functional_evaluations"
    ADD CONSTRAINT "functional_evaluations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_clinical_records"
    ADD CONSTRAINT "patient_clinical_records_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."treatment_episodes"("id");



ALTER TABLE ONLY "public"."patient_clinical_records"
    ADD CONSTRAINT "patient_clinical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_occupational_profiles"
    ADD CONSTRAINT "patient_occupational_profiles_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."privacy_consents"
    ADD CONSTRAINT "privacy_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quickdash_tokens"
    ADD CONSTRAINT "quickdash_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."quickdash_tokens"
    ADD CONSTRAINT "quickdash_tokens_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."treatment_episodes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quickdash_tokens"
    ADD CONSTRAINT "quickdash_tokens_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quickdash_tokens"
    ADD CONSTRAINT "quickdash_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey_profiles" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."therapy_sessions"
    ADD CONSTRAINT "therapy_sessions_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."treatment_episodes"("id");



ALTER TABLE ONLY "public"."therapy_sessions"
    ADD CONSTRAINT "therapy_sessions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."therapy_sessions"
    ADD CONSTRAINT "therapy_sessions_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."treatment_episodes"
    ADD CONSTRAINT "treatment_episodes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."treatment_episodes"
    ADD CONSTRAINT "treatment_episodes_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."treatment_plan_exercises"
    ADD CONSTRAINT "treatment_plan_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_library"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."treatment_plan_exercises"
    ADD CONSTRAINT "treatment_plan_exercises_treatment_plan_id_fkey" FOREIGN KEY ("treatment_plan_id") REFERENCES "public"."treatment_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."treatment_plans"
    ADD CONSTRAINT "treatment_plans_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."treatment_episodes"("id");



ALTER TABLE ONLY "public"."treatment_plans"
    ADD CONSTRAINT "treatment_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."treatment_plans"
    ADD CONSTRAINT "treatment_plans_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_users: ver" ON "public"."admin_users" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "analytical_evals: crear" ON "public"."analytical_evaluations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_professional"() AND ("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "analytical_evals: editar" ON "public"."analytical_evaluations" FOR UPDATE TO "authenticated" USING (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id")))) WITH CHECK (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



CREATE POLICY "analytical_evals: ver" ON "public"."analytical_evaluations" FOR SELECT TO "authenticated" USING (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



ALTER TABLE "public"."analytical_evaluations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_settings: gestionar" ON "public"."appointment_settings" USING (((("owner_type" = 'professional'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'team'::"text") AND "public"."is_team_admin"("owner_id")))) WITH CHECK (((("owner_type" = 'professional'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'team'::"text") AND "public"."is_team_admin"("owner_id"))));



CREATE POLICY "appointment_settings: ver" ON "public"."appointment_settings" FOR SELECT USING (((("owner_type" = 'professional'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'team'::"text") AND "public"."is_team_member"("owner_id"))));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments: crear" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_professional"() AND ("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "appointments: editar" ON "public"."appointments" FOR UPDATE TO "authenticated" USING (("public"."is_active_professional"() AND (("professional_id" = "auth"."uid"()) OR "public"."is_my_patient"("patient_id")))) WITH CHECK (("public"."is_active_professional"() AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "appointments: ver" ON "public"."appointments" FOR SELECT TO "authenticated" USING (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log: insertar usuario propio" ON "public"."audit_log" FOR INSERT TO "authenticated" WITH CHECK ((("action_context" = 'user'::"public"."audit_context") AND ("performed_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "audit_log: ver" ON "public"."audit_log" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR ("performed_by" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."cie10" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cie10: lectura autenticados" ON "public"."cie10" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."clinical_files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clinical_files: crear" ON "public"."clinical_files" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND "public"."is_active_professional"() AND ("uploaded_by" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "clinical_files: editar" ON "public"."clinical_files" FOR UPDATE USING (("public"."is_active_professional"() AND ("uploaded_by" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id"))) WITH CHECK (("public"."is_active_professional"() AND ("uploaded_by" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "clinical_files: eliminar" ON "public"."clinical_files" FOR DELETE USING (("public"."is_active_professional"() AND ("uploaded_by" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "clinical_files: ver" ON "public"."clinical_files" FOR SELECT TO "authenticated" USING (("public"."is_active_professional"() AND ("is_deleted" = false) AND (("uploaded_by" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



CREATE POLICY "clinical_records: acceso profesional" ON "public"."patient_clinical_records" USING (("public"."is_active_professional"() AND "public"."is_my_patient"("patient_id"))) WITH CHECK (("public"."is_active_professional"() AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "custom_cat_assignments: gestionar propios" ON "public"."exercise_custom_category_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."exercise_library" "el"
  WHERE (("el"."id" = "exercise_custom_category_assignments"."exercise_id") AND ("el"."professional_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."exercise_library" "el"
  WHERE (("el"."id" = "exercise_custom_category_assignments"."exercise_id") AND ("el"."professional_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "custom_categories: gestionar propias" ON "public"."exercise_custom_categories" USING (("professional_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("professional_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."episode_diagnoses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "episode_diagnoses: acceso profesional" ON "public"."episode_diagnoses" USING (("public"."is_active_professional"() AND "public"."is_my_patient"("patient_id"))) WITH CHECK (("public"."is_active_professional"() AND "public"."is_my_patient"("patient_id")));



ALTER TABLE "public"."evaluation_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evaluation_settings: gestionar" ON "public"."evaluation_settings" USING (((("owner_type" = 'professional'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'team'::"text") AND "public"."is_team_admin"("owner_id")))) WITH CHECK (((("owner_type" = 'professional'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'team'::"text") AND "public"."is_team_admin"("owner_id"))));



CREATE POLICY "evaluation_settings: ver" ON "public"."evaluation_settings" FOR SELECT USING (((("owner_type" = 'professional'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'team'::"text") AND "public"."is_team_member"("owner_id"))));



ALTER TABLE "public"."exercise_body_regions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_categories: gestionar propios" ON "public"."exercise_categories" USING ((EXISTS ( SELECT 1
   FROM "public"."exercise_library" "el"
  WHERE (("el"."id" = "exercise_categories"."exercise_id") AND ("el"."professional_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."exercise_library" "el"
  WHERE (("el"."id" = "exercise_categories"."exercise_id") AND ("el"."professional_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "exercise_categories: ver" ON "public"."exercise_categories" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."exercise_library" "el"
  WHERE (("el"."id" = "exercise_categories"."exercise_id") AND (("el"."professional_id" IS NULL) OR ("el"."professional_id" = ( SELECT "auth"."uid"() AS "uid"))) AND ("el"."is_active" = true)))));



ALTER TABLE "public"."exercise_custom_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_custom_category_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_library" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_library: crear propios" ON "public"."exercise_library" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND "public"."is_active_professional"()));



CREATE POLICY "exercise_library: editar propios" ON "public"."exercise_library" FOR UPDATE USING ((("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_active_professional"()));



CREATE POLICY "exercise_library: eliminar propios" ON "public"."exercise_library" FOR DELETE USING ((("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_active_professional"()));



CREATE POLICY "exercise_library: ver activos propios y globales" ON "public"."exercise_library" FOR SELECT USING (((("professional_id" IS NULL) OR ("professional_id" = ( SELECT "auth"."uid"() AS "uid"))) AND ("is_active" = true) AND "public"."is_active_professional"()));



ALTER TABLE "public"."exercise_plan_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_plan_items: acceso" ON "public"."exercise_plan_items" TO "authenticated" USING (("plan_id" IN ( SELECT "exercise_plans"."id"
   FROM "public"."exercise_plans"
  WHERE (("exercise_plans"."professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("exercise_plans"."patient_id"))))) WITH CHECK (("plan_id" IN ( SELECT "exercise_plans"."id"
   FROM "public"."exercise_plans"
  WHERE (("exercise_plans"."professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("exercise_plans"."patient_id")))));



ALTER TABLE "public"."exercise_plan_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_plan_tokens: crear" ON "public"."exercise_plan_tokens" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_professional"() AND ("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "exercise_plan_tokens: editar" ON "public"."exercise_plan_tokens" FOR UPDATE TO "authenticated" USING ((("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))) WITH CHECK ((("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id")));



CREATE POLICY "exercise_plan_tokens: ver" ON "public"."exercise_plan_tokens" FOR SELECT TO "authenticated" USING ((("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id")));



ALTER TABLE "public"."exercise_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercise_plans: crear" ON "public"."exercise_plans" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_professional"() AND ("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "exercise_plans: editar" ON "public"."exercise_plans" FOR UPDATE TO "authenticated" USING ((("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))) WITH CHECK ((("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id")));



CREATE POLICY "exercise_plans: ver" ON "public"."exercise_plans" FOR SELECT TO "authenticated" USING ((("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id")));



ALTER TABLE "public"."exercise_program_routines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_routine_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_routines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback: crear propio" ON "public"."feedback" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "feedback: ver propio o admin" ON "public"."feedback" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"()));



CREATE POLICY "functional_evals: crear" ON "public"."functional_evaluations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_professional"() AND ("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "functional_evals: editar" ON "public"."functional_evaluations" FOR UPDATE TO "authenticated" USING (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id")))) WITH CHECK (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



CREATE POLICY "functional_evals: ver" ON "public"."functional_evaluations" FOR SELECT TO "authenticated" USING (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



ALTER TABLE "public"."functional_evaluations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."obras_sociales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "obras_sociales: borrar activos" ON "public"."obras_sociales" FOR DELETE TO "authenticated" USING ("public"."is_active_professional"());



CREATE POLICY "obras_sociales: crear activos" ON "public"."obras_sociales" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_professional"());



CREATE POLICY "obras_sociales: editar activos" ON "public"."obras_sociales" FOR UPDATE TO "authenticated" USING ("public"."is_active_professional"()) WITH CHECK ("public"."is_active_professional"());



CREATE POLICY "obras_sociales: lectura autenticados" ON "public"."obras_sociales" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "occupational_profiles: acceso profesional" ON "public"."patient_occupational_profiles" USING (("public"."is_active_professional"() AND "public"."is_my_patient"("patient_id"))) WITH CHECK (("public"."is_active_professional"() AND "public"."is_my_patient"("patient_id")));



ALTER TABLE "public"."patient_clinical_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_occupational_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patients: crear" ON "public"."patients" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND "public"."is_active_professional"() AND ("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("team_id" IS NULL) OR "public"."is_team_member"("team_id"))));



CREATE POLICY "patients: editar" ON "public"."patients" FOR UPDATE USING ((("is_deleted" = false) AND "public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("team_id" IS NOT NULL) AND "public"."is_team_member"("team_id"))))) WITH CHECK (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("team_id" IS NOT NULL) AND "public"."is_team_member"("team_id")))));



CREATE POLICY "patients: ver" ON "public"."patients" FOR SELECT USING ((("is_deleted" = false) AND "public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("team_id" IS NOT NULL) AND "public"."is_team_member"("team_id")))));



CREATE POLICY "plan_exercises: acceso profesional" ON "public"."treatment_plan_exercises" TO "authenticated" USING (("public"."is_active_professional"() AND (EXISTS ( SELECT 1
   FROM "public"."treatment_plans" "tp"
  WHERE (("tp"."id" = "treatment_plan_exercises"."treatment_plan_id") AND ("tp"."is_deleted" = false) AND (("tp"."professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("tp"."patient_id"))))))) WITH CHECK (("public"."is_active_professional"() AND (EXISTS ( SELECT 1
   FROM "public"."treatment_plans" "tp"
  WHERE (("tp"."id" = "treatment_plan_exercises"."treatment_plan_id") AND ("tp"."is_deleted" = false) AND (("tp"."professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("tp"."patient_id")))))));



ALTER TABLE "public"."priority_pathologies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "priority_pathologies: gestionar" ON "public"."priority_pathologies" USING (((("owner_type" = 'professional'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'team'::"text") AND "public"."is_team_admin"("owner_id")))) WITH CHECK (((("owner_type" = 'professional'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'team'::"text") AND "public"."is_team_admin"("owner_id"))));



CREATE POLICY "priority_pathologies: ver" ON "public"."priority_pathologies" FOR SELECT USING (((("owner_type" = 'professional'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'team'::"text") AND "public"."is_team_member"("owner_id"))));



ALTER TABLE "public"."privacy_consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "privacy_consents: crear propio" ON "public"."privacy_consents" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "privacy_consents: ver propio" ON "public"."privacy_consents" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles: crear propio" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles: editar propio si activo" ON "public"."profiles" FOR UPDATE USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_active" = true))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ("role" = 'professional'::"public"."profile_role") AND ("is_active" = true)));



CREATE POLICY "profiles: ver compañeros de equipo" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."team_members" "tm1"
     JOIN "public"."team_members" "tm2" ON (("tm1"."team_id" = "tm2"."team_id")))
  WHERE (("tm1"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tm2"."user_id" = "profiles"."id"))))));



CREATE POLICY "profiles: ver propio" ON "public"."profiles" FOR SELECT USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."quickdash_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quickdash_tokens: insert" ON "public"."quickdash_tokens" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_professional"() AND ("created_by" = "auth"."uid"()) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "quickdash_tokens: update propio" ON "public"."quickdash_tokens" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR "public"."is_my_patient"("patient_id"))) WITH CHECK ((("created_by" = "auth"."uid"()) OR "public"."is_my_patient"("patient_id")));



CREATE POLICY "quickdash_tokens: ver" ON "public"."quickdash_tokens" FOR SELECT TO "authenticated" USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id")));



CREATE POLICY "reminders: crear" ON "public"."appointment_reminders" FOR INSERT TO "authenticated" WITH CHECK ((("sent_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("channel" = 'whatsapp'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."appointments" "a"
  WHERE (("a"."id" = "appointment_reminders"."appointment_id") AND (("a"."professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("a"."patient_id")))))));



CREATE POLICY "reminders: ver" ON "public"."appointment_reminders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."appointments" "a"
  WHERE (("a"."id" = "appointment_reminders"."appointment_id") AND (("a"."professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("a"."patient_id"))))));



ALTER TABLE "public"."team_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_invitations: actualizar" ON "public"."team_invitations" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"() OR "public"."is_team_admin"("team_id")));



CREATE POLICY "team_invitations: crear" ON "public"."team_invitations" FOR INSERT TO "authenticated" WITH CHECK ((("public"."is_super_admin"() OR "public"."is_team_admin"("team_id")) AND ("invited_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "team_invitations: ver" ON "public"."team_invitations" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR "public"."is_team_admin"("team_id") OR ("invited_by" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members: gestionar" ON "public"."team_members" TO "authenticated" USING (("public"."is_super_admin"() OR "public"."is_team_admin"("team_id"))) WITH CHECK (("public"."is_super_admin"() OR "public"."is_team_admin"("team_id")));



CREATE POLICY "team_members: ver" ON "public"."team_members" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR "public"."is_team_member"("team_id")));



ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams: crear" ON "public"."teams" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_super_admin"() AND ("created_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "teams: editar" ON "public"."teams" FOR UPDATE TO "authenticated" USING ("public"."is_super_admin"());



CREATE POLICY "teams: eliminar" ON "public"."teams" FOR DELETE TO "authenticated" USING ("public"."is_super_admin"());



CREATE POLICY "teams: ver" ON "public"."teams" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR "public"."is_team_member"("id")));



CREATE POLICY "terapeutas acceden a items de sus programas" ON "public"."exercise_program_routines" USING (("program_id" IN ( SELECT "exercise_programs"."id"
   FROM "public"."exercise_programs"
  WHERE ("exercise_programs"."professional_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("program_id" IN ( SELECT "exercise_programs"."id"
   FROM "public"."exercise_programs"
  WHERE ("exercise_programs"."professional_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "terapeutas acceden a items de sus rutinas" ON "public"."exercise_routine_items" USING (("routine_id" IN ( SELECT "exercise_routines"."id"
   FROM "public"."exercise_routines"
  WHERE ("exercise_routines"."professional_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("routine_id" IN ( SELECT "exercise_routines"."id"
   FROM "public"."exercise_routines"
  WHERE ("exercise_routines"."professional_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "terapeutas acceden a sus apartados" ON "public"."exercise_body_regions" USING (("professional_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("professional_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "terapeutas acceden a sus programas" ON "public"."exercise_programs" USING (("professional_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("professional_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "terapeutas acceden a sus rutinas" ON "public"."exercise_routines" USING (("professional_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("professional_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."therapy_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "therapy_sessions: crear" ON "public"."therapy_sessions" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND "public"."is_active_professional"() AND ("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "therapy_sessions: editar" ON "public"."therapy_sessions" FOR UPDATE TO "authenticated" USING ((("is_deleted" = false) AND "public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id")))) WITH CHECK (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



CREATE POLICY "therapy_sessions: ver" ON "public"."therapy_sessions" FOR SELECT TO "authenticated" USING ((("is_deleted" = false) AND "public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



ALTER TABLE "public"."treatment_episodes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "treatment_episodes: crear" ON "public"."treatment_episodes" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND "public"."is_active_professional"() AND ("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "treatment_episodes: editar" ON "public"."treatment_episodes" FOR UPDATE TO "authenticated" USING (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id")))) WITH CHECK (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



CREATE POLICY "treatment_episodes: ver" ON "public"."treatment_episodes" FOR SELECT TO "authenticated" USING (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



ALTER TABLE "public"."treatment_plan_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."treatment_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "treatment_plans: crear" ON "public"."treatment_plans" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND "public"."is_active_professional"() AND ("professional_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_my_patient"("patient_id")));



CREATE POLICY "treatment_plans: editar" ON "public"."treatment_plans" FOR UPDATE TO "authenticated" USING (("public"."is_active_professional"() AND ("is_deleted" = false) AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id")))) WITH CHECK (("public"."is_active_professional"() AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



CREATE POLICY "treatment_plans: ver" ON "public"."treatment_plans" FOR SELECT TO "authenticated" USING (("public"."is_active_professional"() AND ("is_deleted" = false) AND (("professional_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_my_patient"("patient_id"))));



GRANT USAGE ON SCHEMA "extensions" TO "anon";
GRANT USAGE ON SCHEMA "extensions" TO "authenticated";
GRANT USAGE ON SCHEMA "extensions" TO "service_role";
GRANT ALL ON SCHEMA "extensions" TO "dashboard_user";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "extensions"."grant_pg_cron_access"() FROM "supabase_admin";
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "supabase_admin" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."grant_pg_graphql_access"() TO "postgres" WITH GRANT OPTION;



REVOKE ALL ON FUNCTION "extensions"."grant_pg_net_access"() FROM "supabase_admin";
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "supabase_admin" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."pgrst_ddl_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."pgrst_drop_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."set_graphql_placeholder"() TO "postgres" WITH GRANT OPTION;



REVOKE ALL ON FUNCTION "public"."add_routine_to_exercise_plan"("p_patient_id" "uuid", "p_routine_id" "uuid", "p_items" "jsonb", "p_start_date" "date", "p_duration_weeks" integer, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_routine_to_exercise_plan"("p_patient_id" "uuid", "p_routine_id" "uuid", "p_items" "jsonb", "p_start_date" "date", "p_duration_weeks" integer, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_routine_to_exercise_plan"("p_patient_id" "uuid", "p_routine_id" "uuid", "p_items" "jsonb", "p_start_date" "date", "p_duration_weeks" integer, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_routine_to_exercise_plan"("p_patient_id" "uuid", "p_routine_id" "uuid", "p_items" "jsonb", "p_start_date" "date", "p_duration_weeks" integer, "p_notes" "text", "p_program_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_routine_to_exercise_plan"("p_patient_id" "uuid", "p_routine_id" "uuid", "p_items" "jsonb", "p_start_date" "date", "p_duration_weeks" integer, "p_notes" "text", "p_program_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_routine_to_exercise_plan"("p_patient_id" "uuid", "p_routine_id" "uuid", "p_items" "jsonb", "p_start_date" "date", "p_duration_weeks" integer, "p_notes" "text", "p_program_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_create_team"("p_name" "text", "p_admin_user_id" "uuid", "p_member_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_create_team"("p_name" "text", "p_admin_user_id" "uuid", "p_member_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_team"("p_name" "text", "p_admin_user_id" "uuid", "p_member_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_deactivate_therapist"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_deactivate_therapist"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_deactivate_therapist"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_active_teams"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_active_teams"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_active_teams"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_activity"("p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_activity"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_activity"("p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_inactive_therapists"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_inactive_therapists"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_inactive_therapists"("p_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_monthly_sessions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_monthly_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_monthly_sessions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_stale_invitations"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_stale_invitations"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_stale_invitations"("p_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_trends"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_trends"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_trends"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_patients"("p_team_id" "uuid", "p_professional_id" "uuid", "p_include_deleted" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_patients"("p_team_id" "uuid", "p_professional_id" "uuid", "p_include_deleted" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_patients"("p_team_id" "uuid", "p_professional_id" "uuid", "p_include_deleted" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_pending_invitations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_pending_invitations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_pending_invitations"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_therapists"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_therapists"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_therapists"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_move_patient_to_team"("p_patient_id" "uuid", "p_team_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_move_patient_to_team"("p_patient_id" "uuid", "p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_move_patient_to_team"("p_patient_id" "uuid", "p_team_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_reactivate_therapist"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_reactivate_therapist"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_reactivate_therapist"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_team_limit"("p_team_id" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_team_limit"("p_team_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_team_limit"("p_team_id" "uuid", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_update_feedback_status"("p_feedback_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_update_feedback_status"("p_feedback_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_feedback_status"("p_feedback_id" "uuid", "p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_upsert_therapist"("p_user_id" "uuid", "p_full_name" "text", "p_email" "text", "p_specialty" "text", "p_license" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_upsert_therapist"("p_user_id" "uuid", "p_full_name" "text", "p_email" "text", "p_specialty" "text", "p_license" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_upsert_therapist"("p_user_id" "uuid", "p_full_name" "text", "p_email" "text", "p_specialty" "text", "p_license" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."appointments_lock_ownership"() TO "anon";
GRANT ALL ON FUNCTION "public"."appointments_lock_ownership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."appointments_lock_ownership"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."block_obra_social_delete_in_use"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."block_obra_social_delete_in_use"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_invitation"("p_invitation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_invitation"("p_invitation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_invitation"("p_invitation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_quickdash_token"("p_token" "uuid", "p_items" "jsonb", "p_score" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."complete_quickdash_token"("p_token" "uuid", "p_items" "jsonb", "p_score" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_quickdash_token"("p_token" "uuid", "p_items" "jsonb", "p_score" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_exercise_plan_token"("p_plan_id" "uuid", "p_patient_id" "uuid", "p_expires_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_exercise_plan_token"("p_plan_id" "uuid", "p_patient_id" "uuid", "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_exercise_plan_token"("p_plan_id" "uuid", "p_patient_id" "uuid", "p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_quickdash_token"("p_session_id" "uuid", "p_patient_id" "uuid", "p_expires_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_quickdash_token"("p_session_id" "uuid", "p_patient_id" "uuid", "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_quickdash_token"("p_session_id" "uuid", "p_patient_id" "uuid", "p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_exercise_plan_public"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_exercise_plan_public"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_exercise_plan_public"("p_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_exercise_plan_token"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_exercise_plan_token"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_exercise_plan_token"("p_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_quickdash_token"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_quickdash_token"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_quickdash_token"("p_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_team_activity"("p_team_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_team_activity"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_activity"("p_team_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_analytical_eval_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_analytical_eval_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_analytical_eval_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_analytical_eval_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_clinical_record_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_clinical_record_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_clinical_record_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_clinical_record_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_file_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_file_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_file_soft_delete"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_functional_eval_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_functional_eval_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_functional_eval_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_functional_eval_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_occupational_profile_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_occupational_profile_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_occupational_profile_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_occupational_profile_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_patient_discharge"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_patient_discharge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_patient_discharge"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_patient_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_patient_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_patient_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_patient_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_patient_soft_delete"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_patient_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_patient_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_plan_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_plan_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_plan_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_plan_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_plan_soft_delete"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_profile_activation_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_profile_activation_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_profile_deactivation"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_profile_deactivation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_profile_deactivation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_session_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_session_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_session_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_session_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_session_soft_delete"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_session_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_session_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_team_invitation_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_team_invitation_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_team_member_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_team_member_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_treatment_episode_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_treatment_episode_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_treatment_plan_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_treatment_plan_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_audit_log"("p_action" "public"."audit_action", "p_table_name" "text", "p_record_id" "uuid", "p_description" "text", "p_changes" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_audit_log"("p_action" "public"."audit_action", "p_table_name" "text", "p_record_id" "uuid", "p_description" "text", "p_changes" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."invite_to_team"("p_team_id" "uuid", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invite_to_team"("p_team_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_to_team"("p_team_id" "uuid", "p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_active_professional"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_active_professional"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_professional"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_my_patient"("p_patient_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_my_patient"("p_patient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_my_patient"("p_patient_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_super_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_team_admin"("p_team_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_team_admin"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_admin"("p_team_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_team_member"("p_team_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_team_member"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_member"("p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_obra_social_name"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_obra_social_name"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_obra_social_name"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obra_social_usage_count"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obra_social_usage_count"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obra_social_usage_count"("p_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."propagate_obra_social_rename"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."propagate_obra_social_rename"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_team_member"("p_team_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_team_member"("p_team_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_team_member"("p_team_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resend_invitation"("p_invitation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resend_invitation"("p_invitation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resend_invitation"("p_invitation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_cie10"("search_input" "text", "max_results" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_cie10"("search_input" "text", "max_results" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_cie10"("search_input" "text", "max_results" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_team_member_role"("p_team_id" "uuid", "p_user_id" "uuid", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_team_member_role"("p_team_id" "uuid", "p_user_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_team_member_role"("p_team_id" "uuid", "p_user_id" "uuid", "p_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_session"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_session"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_session"("p_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_cie10_search"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_cie10_search"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_cie10_search"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_obras_sociales_search"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_obras_sociales_search"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_obras_sociales_search"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_obra_social"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_obra_social"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_obra_social"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_owner_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_owner_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_owner_id"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."analytical_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."analytical_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."analytical_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_reminders" TO "anon";
GRANT ALL ON TABLE "public"."appointment_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_settings" TO "anon";
GRANT ALL ON TABLE "public"."appointment_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_settings" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."cie10" TO "anon";
GRANT ALL ON TABLE "public"."cie10" TO "authenticated";
GRANT ALL ON TABLE "public"."cie10" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cie10_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cie10_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cie10_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."clinical_files" TO "anon";
GRANT ALL ON TABLE "public"."clinical_files" TO "authenticated";
GRANT ALL ON TABLE "public"."clinical_files" TO "service_role";



GRANT ALL ON TABLE "public"."episode_diagnoses" TO "anon";
GRANT ALL ON TABLE "public"."episode_diagnoses" TO "authenticated";
GRANT ALL ON TABLE "public"."episode_diagnoses" TO "service_role";



GRANT ALL ON TABLE "public"."evaluation_settings" TO "anon";
GRANT ALL ON TABLE "public"."evaluation_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_settings" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_body_regions" TO "anon";
GRANT ALL ON TABLE "public"."exercise_body_regions" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_body_regions" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_categories" TO "anon";
GRANT ALL ON TABLE "public"."exercise_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_categories" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_custom_categories" TO "anon";
GRANT ALL ON TABLE "public"."exercise_custom_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_custom_categories" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_custom_category_assignments" TO "anon";
GRANT ALL ON TABLE "public"."exercise_custom_category_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_custom_category_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_library" TO "anon";
GRANT ALL ON TABLE "public"."exercise_library" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_library" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_plan_items" TO "anon";
GRANT ALL ON TABLE "public"."exercise_plan_items" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_plan_items" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_plan_tokens" TO "anon";
GRANT ALL ON TABLE "public"."exercise_plan_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_plan_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_plans" TO "anon";
GRANT ALL ON TABLE "public"."exercise_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_plans" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_program_routines" TO "anon";
GRANT ALL ON TABLE "public"."exercise_program_routines" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_program_routines" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_programs" TO "anon";
GRANT ALL ON TABLE "public"."exercise_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_programs" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_routine_items" TO "anon";
GRANT ALL ON TABLE "public"."exercise_routine_items" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_routine_items" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_routines" TO "anon";
GRANT ALL ON TABLE "public"."exercise_routines" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_routines" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."functional_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."functional_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."functional_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."obras_sociales" TO "anon";
GRANT ALL ON TABLE "public"."obras_sociales" TO "authenticated";
GRANT ALL ON TABLE "public"."obras_sociales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."obras_sociales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."obras_sociales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."obras_sociales_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."patient_clinical_records" TO "anon";
GRANT ALL ON TABLE "public"."patient_clinical_records" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_clinical_records" TO "service_role";



GRANT ALL ON TABLE "public"."patient_occupational_profiles" TO "anon";
GRANT ALL ON TABLE "public"."patient_occupational_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_occupational_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."priority_pathologies" TO "anon";
GRANT ALL ON TABLE "public"."priority_pathologies" TO "authenticated";
GRANT ALL ON TABLE "public"."priority_pathologies" TO "service_role";



GRANT ALL ON TABLE "public"."privacy_consents" TO "anon";
GRANT ALL ON TABLE "public"."privacy_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."privacy_consents" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT INSERT("id") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("full_name"),UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("email"),UPDATE("email") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("role") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("specialty"),UPDATE("specialty") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT("license_number"),UPDATE("license_number") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."quickdash_tokens" TO "anon";
GRANT ALL ON TABLE "public"."quickdash_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."quickdash_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."team_invitations" TO "anon";
GRANT ALL ON TABLE "public"."team_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."team_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."therapy_sessions" TO "anon";
GRANT ALL ON TABLE "public"."therapy_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."therapy_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."treatment_episodes" TO "anon";
GRANT ALL ON TABLE "public"."treatment_episodes" TO "authenticated";
GRANT ALL ON TABLE "public"."treatment_episodes" TO "service_role";



GRANT ALL ON TABLE "public"."treatment_plan_exercises" TO "anon";
GRANT ALL ON TABLE "public"."treatment_plan_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."treatment_plan_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."treatment_plans" TO "anon";
GRANT ALL ON TABLE "public"."treatment_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."treatment_plans" TO "service_role";












ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";










-- ─────────────────────────────────────────────────────────────────────────
-- Lo que "supabase db dump --schema public,extensions" no trae, porque vive
-- en otros schemas administrados por la plataforma (auth, storage). Ver
-- docs/TASKS.md y docs/DECISIONS.md [2026-10-11] para el contexto completo.
-- ─────────────────────────────────────────────────────────────────────────

-- Trigger que crea el perfil (profiles) al confirmarse un alta/invitación.
-- La función "handle_new_user" ya está en el dump de arriba (vive en public).
DROP TRIGGER IF EXISTS "on_auth_user_created" ON auth.users;
CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Buckets de Storage.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 2097152,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('clinical-files', 'clinical-files', false, 52428800,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'video/mp4', 'video/quicktime'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies de storage.objects para ambos buckets.
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND COALESCE(metadata ->> 'mimetype', '') = ANY (ARRAY['image/jpeg', 'image/png', 'image/webp'])
);

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND COALESCE(metadata ->> 'mimetype', '') = ANY (ARRAY['image/jpeg', 'image/png', 'image/webp'])
);

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "clinical_files_select" ON storage.objects;
CREATE POLICY "clinical_files_select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'clinical-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "clinical_files_insert" ON storage.objects;
CREATE POLICY "clinical_files_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clinical-files'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND COALESCE(metadata ->> 'mimetype', '') = ANY (ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/quicktime'])
);

DROP POLICY IF EXISTS "clinical_files_update" ON storage.objects;
CREATE POLICY "clinical_files_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'clinical-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
WITH CHECK (
  bucket_id = 'clinical-files'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND COALESCE(metadata ->> 'mimetype', '') = ANY (ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/quicktime'])
);

DROP POLICY IF EXISTS "clinical_files_delete" ON storage.objects;
CREATE POLICY "clinical_files_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'clinical-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
