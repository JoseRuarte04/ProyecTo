import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY       = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que el caller es super-admin usando su JWT
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { count } = await callerClient
      .from("admin_users")
      .select("user_id", { count: "exact", head: true });

    if (!count || count === 0) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, full_name, specialty, license_number } = await req.json();

    if (!email?.trim()) {
      return new Response(JSON.stringify({ error: "El email es obligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invitar al terapista usando la service role key
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      {
        data: {
          full_name:      full_name?.trim() || null,
          specialty:      specialty?.trim() || null,
          license_number: license_number?.trim() || null,
        },
      }
    );

    if (error) {
      console.error("invite-therapist error:", error);
      // Supabase devuelve error específico si el email ya existe
      const msg = error.message?.includes("already been registered")
        ? "Ese email ya está registrado en el sistema"
        : error.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, user_id: data.user?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("invite-therapist unexpected error:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
