-- evaluation_settings, appointment_settings, priority_pathologies: el
-- "dueño polimórfico" (owner_type 'professional'|'team' + owner_id) no
-- puede tener FK real (es polimórfico), y hasta ahora no validaba que
-- owner_id exista de verdad como profesional o equipo según corresponda.
--
-- Encontrado en la auditoría de seguridad/integridad del 2026-10-02
-- (docs/AUDIT_2026-10-02.md, importante #9): un owner_id equivocado (bug o
-- INSERT manual) no fallaba — la fila quedaba huérfana en silencio, sin
-- aplicarle a nadie.
--
-- Fix: trigger BEFORE INSERT/UPDATE compartido por las 3 tablas, que valida
-- la existencia real del dueño. SECURITY DEFINER para que el chequeo sea
-- autoritativo sin depender de qué filas de profiles/teams sean visibles
-- bajo el RLS del caller.

CREATE OR REPLACE FUNCTION public.validate_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP TRIGGER IF EXISTS validate_owner_id ON public.evaluation_settings;
CREATE TRIGGER validate_owner_id
BEFORE INSERT OR UPDATE ON public.evaluation_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_owner_id();

DROP TRIGGER IF EXISTS validate_owner_id ON public.appointment_settings;
CREATE TRIGGER validate_owner_id
BEFORE INSERT OR UPDATE ON public.appointment_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_owner_id();

DROP TRIGGER IF EXISTS validate_owner_id ON public.priority_pathologies;
CREATE TRIGGER validate_owner_id
BEFORE INSERT OR UPDATE ON public.priority_pathologies
FOR EACH ROW EXECUTE FUNCTION public.validate_owner_id();
