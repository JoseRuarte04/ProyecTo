// Crea (si no existen) las 2 cuentas fijas que usan src/test/rls.test.ts y
// e2e/*.spec.ts — rls-test-a/b@example.com — contra el Supabase LOCAL que
// levantó `supabase start` en este mismo job de CI. Nunca contra producción
// (no recibe ni necesita ninguna URL/key de prod).
//
// Por qué INSERT directo a auth.users/auth.identities y no
// admin.inviteUserByEmail: se probó primero con inviteUserByEmail (deja
// invited_at seteado, que es lo que pide el trigger handle_new_user para
// no exigir una invitación de equipo — mismo mecanismo que la invitación
// individual de profesional en producción). Falló igual en la corrida real
// ("signup_not_allowed", confirmado en los logs del contenedor de auth):
// GoTrue v2.197.0 (la versión que levanta `supabase start` acá) hace el
// INSERT con invited_at NULL y recién lo completa con un UPDATE separado —
// el trigger, que corre AL INSERT, nunca llega a ver el invited_at seteado.
// Insertando la fila nosotros mismos, en un solo INSERT, no hay esa carrera.
import pg from "pg";

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  throw new Error(
    "Falta SUPABASE_DB_URL — ¿corriste este script después de `supabase start` + el step que exporta " +
      "`supabase status` a $GITHUB_ENV?",
  );
}

const USERS = [
  { email: "rls-test-a@example.com", password: process.env.RLS_TEST_USER_A_PASSWORD, name: "RLS Test A", envVar: "RLS_TEST_USER_A_PASSWORD" },
  { email: "rls-test-b@example.com", password: process.env.RLS_TEST_USER_B_PASSWORD, name: "RLS Test B", envVar: "RLS_TEST_USER_B_PASSWORD" },
  // Super-admin de prueba, solo para testear is_super_admin()/admin_* contra
  // Supabase LOCAL (nunca existió ni debe existir en producción). A
  // diferencia de A/B, además de la fila en auth.users necesita una fila en
  // admin_users (ver más abajo) — es lo único que hace a una cuenta
  // super-admin, profiles.role nunca cambia de 'professional' (confirmado
  // en handle_new_user, no hay escalada de privilegios por ahí).
  {
    email: "rls-test-admin@example.com",
    password: process.env.RLS_TEST_USER_ADMIN_PASSWORD,
    name: "RLS Test Admin",
    envVar: "RLS_TEST_USER_ADMIN_PASSWORD",
    isSuperAdmin: true,
  },
];

const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

try {
  // Local (Docker) suele traerla habilitada por default igual que producción,
  // pero no está en el baseline dump — se asegura acá por las dudas, no
  // rompe nada si ya estaba.
  await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  for (const user of USERS) {
    if (!user.password) throw new Error(`Falta ${user.envVar}`);

    const { rows: existing } = await client.query("SELECT id FROM auth.users WHERE email = $1", [user.email]);

    if (existing.length > 0) {
      await client.query("UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf')) WHERE id = $2", [
        user.password,
        existing[0].id,
      ]);
      if (user.isSuperAdmin) {
        await client.query("INSERT INTO admin_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [existing[0].id]);
      }
      console.log(`✓ ${user.email} ya existía, password actualizada (${existing[0].id})`);
      continue;
    }

    const { rows } = await client.query(
      `INSERT INTO auth.users (
         instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, invited_at, confirmation_token, recovery_token,
         email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data,
         is_super_admin, created_at, updated_at,
         phone_change, phone_change_token, email_change_token_current,
         is_sso_user, is_anonymous
       ) VALUES (
         '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         $1, crypt($2, gen_salt('bf')),
         now(), now(), '', '', '', '', $3::jsonb, $4::jsonb,
         false, now(), now(),
         '', '', '', false, false
       ) RETURNING id`,
      [
        user.email,
        user.password,
        JSON.stringify({ provider: "email", providers: ["email"] }),
        JSON.stringify({ full_name: user.name }),
      ],
    );
    const userId = rows[0].id;

    await client.query(
      // $1/$2 son el mismo valor (provider_id es texto, user_id uuid) — no se
      // reusa un solo parámetro porque pg no puede inferirle un tipo único.
      `INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, 'email', now(), now(), now())`,
      [userId, userId, JSON.stringify({ sub: userId, email: user.email, email_verified: true, phone_verified: false })],
    );

    if (user.isSuperAdmin) {
      await client.query("INSERT INTO admin_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [userId]);
    }

    console.log(`✓ ${user.email} creado en Supabase local (${userId})`);
  }
} finally {
  await client.end();
}
