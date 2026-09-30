-- Campo "Objetivo" dentro de lo que en la UI pasó a llamarse "Evolución"
-- (antes "Intervenciones"). Texto libre, uno por sesión.
ALTER TABLE public.therapy_sessions
  ADD COLUMN IF NOT EXISTS session_goals text NULL;
