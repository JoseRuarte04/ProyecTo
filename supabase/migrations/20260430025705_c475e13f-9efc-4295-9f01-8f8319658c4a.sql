ALTER POLICY "profiles: crear propio"
ON public.profiles
WITH CHECK (
  id = auth.uid()
  AND role = 'professional'::profile_role
  AND is_active = true
);

ALTER POLICY "profiles: editar propio si activo"
ON public.profiles
USING (id = auth.uid() AND is_active = true)
WITH CHECK (
  id = auth.uid()
  AND role = 'professional'::profile_role
  AND is_active = true
);

REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT INSERT (id, full_name, email, specialty, license_number, role) ON public.profiles TO authenticated;
GRANT UPDATE (full_name, email, specialty, license_number) ON public.profiles TO authenticated;