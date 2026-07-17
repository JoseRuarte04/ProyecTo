-- Nuevo estado de paciente: abandonó el tratamiento.
-- Migración aislada: ADD VALUE no puede usarse en la misma transacción
-- en la que se agrega, así que las columnas y funciones van en la siguiente.
ALTER TYPE public.patient_status ADD VALUE IF NOT EXISTS 'abandoned';
