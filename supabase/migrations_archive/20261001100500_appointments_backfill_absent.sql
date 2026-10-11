-- Los turnos cancelados con motivo "No asistió" pasan al estado propio "ausente".
-- Va en un archivo aparte de la migración que agrega los valores del enum:
-- Postgres no permite usar un valor nuevo en la misma transacción que lo crea.
UPDATE public.appointments
SET status = 'absent', cancellation_reason = NULL
WHERE status = 'cancelled' AND cancellation_reason = 'no_show';
