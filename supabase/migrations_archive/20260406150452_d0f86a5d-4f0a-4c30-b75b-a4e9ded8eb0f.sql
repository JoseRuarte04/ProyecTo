CREATE TABLE public.exercise_custom_category_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id UUID NOT NULL REFERENCES public.exercise_library(id) ON DELETE CASCADE,
  custom_category_id UUID NOT NULL REFERENCES public.exercise_custom_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(exercise_id, custom_category_id)
);

ALTER TABLE public.exercise_custom_category_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_cat_assignments: gestionar propios"
ON public.exercise_custom_category_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exercise_library el
    WHERE el.id = exercise_custom_category_assignments.exercise_id
    AND el.professional_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM exercise_library el
    WHERE el.id = exercise_custom_category_assignments.exercise_id
    AND el.professional_id = auth.uid()
  )
);