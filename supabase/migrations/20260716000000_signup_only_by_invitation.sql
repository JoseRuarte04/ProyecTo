-- Cerrar el registro abierto: hasta ahora cualquiera podía hacer signUp sin
-- invitación y handle_new_user le creaba un perfil de profesional activo.
-- El guard rechaza la creación del usuario salvo que:
--   a) venga de una invitación nativa de Supabase (invited_at seteado por
--      el admin API / dashboard → flujo /accept-invite), o
--   b) exista una invitación de equipo pendiente para su email
--      (team_invitations → flujo /registro?token=...).
-- CREATE OR REPLACE conserva los grants existentes (el REVOKE de 20260429).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;
