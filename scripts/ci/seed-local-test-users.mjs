// Crea (si no existen) las 2 cuentas fijas que usan src/test/rls.test.ts y
// e2e/*.spec.ts — rls-test-a/b@example.com — contra el Supabase LOCAL que
// levantó `supabase start` en este mismo job de CI. Nunca contra producción
// (no recibe ni necesita ninguna URL/key de prod).
//
// Por qué no alcanza con signUp/admin.createUser: el trigger
// "handle_new_user" (ver supabase/migrations/20261011210000_baseline_schema.sql)
// rechaza cualquier alta salvo que `invited_at` esté seteado o exista una fila
// pendiente en `team_invitations` para ese email — en una base local recién
// creada no hay ninguna de las dos. `inviteUserByEmail` es el único camino de
// la Admin API que deja `invited_at` seteado (mismo mecanismo que ya usa la
// invitación individual de profesional en producción), así que crea la cuenta
// sin pelearse con el trigger. El mail de invite no se lee en ningún lado (no
// hace falta: el paso siguiente ya deja una password conocida).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — ¿corriste este script después de " +
      "`supabase start` + el step que exporta `supabase status` a $GITHUB_ENV?",
  );
}

const USERS = [
  { email: "rls-test-a@example.com", password: process.env.RLS_TEST_USER_A_PASSWORD, name: "RLS Test A" },
  { email: "rls-test-b@example.com", password: process.env.RLS_TEST_USER_B_PASSWORD, name: "RLS Test B" },
];

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const user of USERS) {
  if (!user.password) {
    throw new Error(`Falta la password de ${user.email} (RLS_TEST_USER_${user === USERS[0] ? "A" : "B"}_PASSWORD)`);
  }

  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw new Error(`No se pudo listar usuarios: ${listErr.message}`);

  let userId = list.users.find((u) => u.email === user.email)?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(user.email, {
      data: { full_name: user.name },
    });
    if (error) throw new Error(`No se pudo invitar a ${user.email}: ${error.message}`);
    userId = data.user.id;
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    password: user.password,
    email_confirm: true,
  });
  if (updErr) throw new Error(`No se pudo fijar la password de ${user.email}: ${updErr.message}`);

  console.log(`✓ ${user.email} listo en Supabase local (${userId})`);
}
