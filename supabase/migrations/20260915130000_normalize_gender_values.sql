-- Normaliza valores sucios de una carga vieja (M/F sueltos, sin pasar por
-- el Select del formulario) antes de renombrar el campo a "Sexo" en el
-- frontend. La columna sigue siendo texto libre, sin CHECK ni enum, mismo
-- patrón que el resto de los campos de opciones cerradas del proyecto
-- (ver src/components/patients/occupationalOptions.ts).
UPDATE public.patients SET gender = 'male' WHERE gender = 'M';
UPDATE public.patients SET gender = 'female' WHERE gender = 'F';
