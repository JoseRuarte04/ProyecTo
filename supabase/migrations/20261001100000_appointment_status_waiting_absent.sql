-- Estados nuevos de turno: sala de espera, ausente y ausente con aviso.
-- 'completed' sigue siendo "atendido" y 'cancelled' sigue existiendo para cancelaciones.
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'waiting';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'absent';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'absent_with_notice';
