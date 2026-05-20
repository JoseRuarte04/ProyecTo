# Historia 4.1: Tablas Base — teams, team_members, admin_users, team_invitations

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 1 — Infraestructura de datos (sin tocar RLS existente)
**Tipo:** Solo DB — 4 migraciones SQL + actualización de types.ts. Sin cambios de UI.

---

## Historia

Como arquitecto del sistema,
quiero crear las 4 tablas base del sistema de equipos y administración,
para que las fases siguientes puedan construir RLS, RPCs y UI sobre una base de datos sólida.

---

## Contexto y Restricciones Críticas

### Por qué esta historia no toca RLS existente
Esta es la Fase 1 de 5. El objetivo exclusivo es crear tablas nuevas y habilitar RLS en ellas (sin políticas = acceso bloqueado por defecto). Las políticas reales se agregan en la Historia 4.3–4.6. **No modificar ninguna tabla, política, función ni trigger existente.**

### Rollback
Si algo falla: `DROP TABLE team_invitations, team_members, admin_users, teams CASCADE;`
Esto no afecta ningún dato ni funcionalidad existente.

### Orden de migración obligatorio
Las 4 migraciones deben aplicarse en este orden por dependencias de FK:
1. `teams` (sin dependencias externas nuevas)
2. `team_members` (FK a `teams`)
3. `team_invitations` (FK a `teams`)
4. `admin_users` (sin FK a las anteriores)

---

## Criterios de Aceptación

**AC1 — Tabla `teams` creada correctamente**
- Given: se aplica la migración
- When: se inspecciona el schema
- Then: existe `public.teams` con columnas: `id uuid PK`, `name text NOT NULL`, `created_by uuid NOT NULL REFERENCES auth.users(id)`, `member_limit integer NOT NULL DEFAULT 5`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT now()`
- And: RLS habilitado (sin políticas aún — acceso bloqueado por defecto)

**AC2 — Tabla `team_members` creada correctamente**
- Given: se aplica la migración
- When: se inspecciona el schema
- Then: existe `public.team_members` con columnas: `team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `role text NOT NULL CHECK (role IN ('admin', 'member'))`, `invited_by uuid REFERENCES auth.users(id)`, `joined_at timestamptz NOT NULL DEFAULT now()`
- And: PRIMARY KEY (team_id, user_id)
- And: índices en `user_id` y en `(team_id, role)`
- And: RLS habilitado sin políticas

**AC3 — Tabla `team_invitations` creada correctamente**
- Given: se aplica la migración
- When: se inspecciona el schema
- Then: existe `public.team_invitations` con columnas: `id uuid PK DEFAULT gen_random_uuid()`, `team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE`, `email text NOT NULL`, `token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()`, `invited_by uuid NOT NULL REFERENCES auth.users(id)`, `created_at timestamptz NOT NULL DEFAULT now()`, `expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'`, `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired'))`
- And: índices en `email`, `token`, y `(team_id, status)`
- And: RLS habilitado sin políticas

**AC4 — Tabla `admin_users` creada correctamente**
- Given: se aplica la migración
- When: se inspecciona el schema
- Then: existe `public.admin_users` con columnas: `user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, `created_at timestamptz NOT NULL DEFAULT now()`
- And: RLS habilitado sin políticas

**AC5 — Archivos de migración en el lugar correcto**
- Given: se aplican las migraciones
- When: se lista `supabase/migrations/`
- Then: existen exactamente 4 archivos nuevos con prefijos timestamp en orden cronológico ascendente y nombres descriptivos

**AC6 — types.ts actualizado**
- Given: las 4 tablas nuevas existen en DB
- When: se revisa `src/integrations/supabase/types.ts`
- Then: las 4 tablas aparecen en la sección `Tables` con sus tipos Row/Insert/Update/Relationships correctos
- And: no hay errores de TypeScript en el proyecto (`npm run lint`)

---

## Tareas

### Task 1 — Migración: tabla `teams`
Archivo: `supabase/migrations/YYYYMMDDHHMMSS_create_teams.sql`

```sql
CREATE TABLE public.teams (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  created_by   uuid        NOT NULL REFERENCES auth.users(id),
  member_limit integer     NOT NULL DEFAULT 5,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
-- Políticas se agregan en Historia 4.6
```

### Task 2 — Migración: tabla `team_members`
Archivo: `supabase/migrations/YYYYMMDDHHMMSS_create_team_members.sql`
(timestamp posterior a `teams`)

```sql
CREATE TABLE public.team_members (
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by uuid REFERENCES auth.users(id),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX team_members_user_id_idx   ON public.team_members(user_id);
CREATE INDEX team_members_team_role_idx ON public.team_members(team_id, role);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
-- Políticas se agregan en Historia 4.6
```

### Task 3 — Migración: tabla `team_invitations`
Archivo: `supabase/migrations/YYYYMMDDHHMMSS_create_team_invitations.sql`

```sql
CREATE TABLE public.team_invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  token       uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by  uuid        NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  status      text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired'))
);

CREATE INDEX team_invitations_email_idx ON public.team_invitations(email);
CREATE INDEX team_invitations_token_idx ON public.team_invitations(token);
CREATE INDEX team_invitations_team_status_idx ON public.team_invitations(team_id, status);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
-- Políticas se agregan en Historia 4.6
```

### Task 4 — Migración: tabla `admin_users`
Archivo: `supabase/migrations/YYYYMMDDHHMMSS_create_admin_users.sql`

```sql
CREATE TABLE public.admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- Políticas se agregan en Historia 4.6
-- Los 3 super-admins se insertan en Historia 4.11 (seed de bootstrap)
```

### Task 5 — Actualizar `src/integrations/supabase/types.ts`

Agregar las 4 tablas nuevas en la sección `Tables` del tipo `Database["public"]["Tables"]`. Ubicarlas en orden alfabético.

**Bloque a insertar para `admin_users`** (va antes de `analytical_evaluations`):

```typescript
admin_users: {
  Row: {
    created_at: string
    user_id: string
  }
  Insert: {
    created_at?: string
    user_id: string
  }
  Update: {
    created_at?: string
    user_id?: string
  }
  Relationships: []
}
```

**Bloque para `team_invitations`** (va en orden alfabético, entre las `t`):

```typescript
team_invitations: {
  Row: {
    created_at: string
    email: string
    expires_at: string
    id: string
    invited_by: string
    status: string
    team_id: string
    token: string
  }
  Insert: {
    created_at?: string
    email: string
    expires_at?: string
    id?: string
    invited_by: string
    status?: string
    team_id: string
    token?: string
  }
  Update: {
    created_at?: string
    email?: string
    expires_at?: string
    id?: string
    invited_by?: string
    status?: string
    team_id?: string
    token?: string
  }
  Relationships: [
    {
      foreignKeyName: "team_invitations_invited_by_fkey"
      columns: ["invited_by"]
      isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "team_invitations_team_id_fkey"
      columns: ["team_id"]
      isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },
  ]
}
```

**Bloque para `team_members`**:

```typescript
team_members: {
  Row: {
    invited_by: string | null
    joined_at: string
    role: string
    team_id: string
    user_id: string
  }
  Insert: {
    invited_by?: string | null
    joined_at?: string
    role: string
    team_id: string
    user_id: string
  }
  Update: {
    invited_by?: string | null
    joined_at?: string
    role?: string
    team_id?: string
    user_id?: string
  }
  Relationships: [
    {
      foreignKeyName: "team_members_invited_by_fkey"
      columns: ["invited_by"]
      isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
      isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "team_members_user_id_fkey"
      columns: ["user_id"]
      isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}
```

**Bloque para `teams`**:

```typescript
teams: {
  Row: {
    created_at: string
    created_by: string
    id: string
    is_active: boolean
    member_limit: number
    name: string
  }
  Insert: {
    created_at?: string
    created_by: string
    id?: string
    is_active?: boolean
    member_limit?: number
    name: string
  }
  Update: {
    created_at?: string
    created_by?: string
    id?: string
    is_active?: boolean
    member_limit?: number
    name?: string
  }
  Relationships: [
    {
      foreignKeyName: "teams_created_by_fkey"
      columns: ["created_by"]
      isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}
```

### Task 6 — Verificación final

- [ ] Ejecutar `npm run lint` — sin errores de TypeScript
- [ ] Verificar que la app sigue funcionando: `npm run dev`, iniciar sesión, cargar pacientes y sesiones — no debe haber nada roto (las 4 tablas nuevas no están referenciadas por ningún código existente)
- [ ] Confirmar que las 4 migraciones están en `supabase/migrations/` con timestamps correctos

---

## Contexto Técnico del Proyecto

### Convenciones de migraciones en este proyecto
- Prefijo timestamp: `YYYYMMDDHHMMSS_nombre_descriptivo.sql`
- Ubicación: `supabase/migrations/`
- Aplicar en orden cronológico (el timestamp garantiza el orden)
- Cada migración es atómica (una responsabilidad, rollback posible)
- Ver migraciones anteriores para referencia de estilo: `supabase/migrations/20260518130000_exercise_plans.sql`

### Convenciones de types.ts
- Archivo: `src/integrations/supabase/types.ts`
- Las tablas van en orden alfabético dentro de `Tables`
- Relaciones se agregan en el array `Relationships` de cada tabla con FK
- Usar `string` para uuid (es como Supabase lo tipea), `string` para timestamptz
- **No correr generadores automáticos** — editar manualmente (el proyecto no tiene CLI local configurado)
- Referencia de formato exacto: ver como están definidas `exercise_plans`, `exercise_plan_items` ya en el archivo

### Stack relevante
- Supabase JS 2.101.1 — cliente en `src/integrations/supabase/client.ts`
- TypeScript 5.8.3 en modo permisivo (`strictNullChecks: false`) — los tipos null son opcionales pero convenientes
- No hay backend propio — todo es Supabase directo

### Notas de seguridad
- `auth.users(id)` como FK target es correcto en Supabase (tabla del esquema `auth`, accesible como FK desde `public`)
- `ENABLE ROW LEVEL SECURITY` sin políticas = deny-all por defecto. Esto es intencional y seguro.
- No agregar políticas en esta historia — se agregan en las historias 4.3–4.6

---

## Historia siguiente
**4.2 — Extensiones de schema existente**: agrega `team_id` a `patients`, `changes` a `audit_log`, e índices de rendimiento.
