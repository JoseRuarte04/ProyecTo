-- team_members: un miembro no-admin no podía ver al resto de su equipo.
--
-- Encontrado en la auditoría de seguridad del 2026-10-02
-- (docs/AUDIT_2026-10-02.md, importante #3): la policy de SELECT solo dejaba
-- ver la fila propia, la de super_admin, o si el caller era admin del
-- equipo (is_team_admin). Un miembro raso no veía a sus compañeros, lo que
-- rompe en silencio cualquier pantalla que liste el equipo a un no-admin
-- (switch de workspace / "Mi equipo").
--
-- Fix: cualquier miembro activo del equipo puede ver el roster completo,
-- usando is_team_member() (ya existía, mismo patrón que el resto del
-- esquema) en vez de limitarlo a admins.

DROP POLICY IF EXISTS "team_members: ver" ON public.team_members;
CREATE POLICY "team_members: ver"
ON public.team_members FOR SELECT
TO authenticated
USING (
  is_super_admin()
  OR is_team_member(team_id)
);
