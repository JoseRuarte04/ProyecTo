-- Seed de bootstrap de super-admins.
-- Aplicar via Supabase MCP apply_migration o supabase db push.

INSERT INTO public.admin_users (user_id) VALUES
  ('a0d7e6ad-cb8e-4887-81e5-cad387a697da'::uuid)
ON CONFLICT (user_id) DO NOTHING;
