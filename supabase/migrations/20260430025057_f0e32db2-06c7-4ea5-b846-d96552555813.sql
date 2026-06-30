ALTER POLICY "clinical_records: acceso profesional"
ON public.patient_clinical_records
USING (public.is_active_professional() AND public.is_my_patient(patient_id))
WITH CHECK (public.is_active_professional() AND public.is_my_patient(patient_id));

ALTER POLICY "occupational_profiles: acceso profesional"
ON public.patient_occupational_profiles
USING (public.is_active_professional() AND public.is_my_patient(patient_id))
WITH CHECK (public.is_active_professional() AND public.is_my_patient(patient_id));

ALTER POLICY "clinical_files: ver"
ON public.clinical_files
USING (public.is_active_professional() AND uploaded_by = auth.uid() AND public.is_my_patient(patient_id));

ALTER POLICY "clinical_files: crear"
ON public.clinical_files
WITH CHECK (public.is_active_professional() AND uploaded_by = auth.uid() AND public.is_my_patient(patient_id));

ALTER POLICY "clinical_files: editar"
ON public.clinical_files
USING (public.is_active_professional() AND uploaded_by = auth.uid() AND public.is_my_patient(patient_id))
WITH CHECK (public.is_active_professional() AND uploaded_by = auth.uid() AND public.is_my_patient(patient_id));

ALTER POLICY "clinical_files: eliminar"
ON public.clinical_files
USING (public.is_active_professional() AND uploaded_by = auth.uid() AND public.is_my_patient(patient_id));