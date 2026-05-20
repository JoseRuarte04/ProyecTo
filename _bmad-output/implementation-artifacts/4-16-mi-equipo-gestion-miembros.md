# Historia 4.16: "Mi equipo" — gestión de miembros para team-admins

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 5 — Frontend
**Dependencia:** RPCs `invite_to_team`, `resend_invitation`, `remove_team_member`, `set_team_member_role` disponibles (Historia 4.10); RLS `team_members: ver` y `teams: ver` aplicadas (Historias 4.3, 4.6)
**Tipo:** Solo frontend — nueva página + modificación de AppSidebar + App.tsx. Sin cambios de DB ni de types.ts.

---

## Historia

Como team-admin,
quiero acceder a una sección "Mi equipo" dentro de la app principal donde pueda ver los miembros activos de mi equipo, las invitaciones pendientes, invitar nuevos miembros por email, reenviar invitaciones y quitar miembros,
para gestionar mi equipo sin necesitar al super-admin.

---

## Estado Actual

No existe ninguna ruta `/mi-equipo` ni ninguna UI para gestionar equipos desde la app principal. El sidebar (`AppSidebar.tsx`) tiene los items hardcodeados y no tiene lógica condicional.

---

## Criterios de Aceptación

**AC1 — "Mi equipo" aparece en el sidebar solo para team-admins**
- Given: terapista es admin de al menos un equipo
- Then: ve el item "Mi equipo" en el sidebar con un ícono de `Users2`
- And: si no es admin de ningún equipo, el item NO aparece en el sidebar

**AC2 — La página muestra una card por cada equipo del que es admin**
- Given: terapista es admin de 2 equipos
- When: navega a `/mi-equipo`
- Then: ve 2 cards, una por equipo, cada una con:
  - Nombre del equipo + contador `X de Y miembros`
  - Sección "Miembros activos" con nombre, rol (Admin/Miembro) y botones "Quitar" (con confirmación) y toggle de rol
  - Sección "Invitaciones pendientes" con email, fecha de vencimiento y botón "Reenviar"
  - Campo de email + botón "Invitar" al pie de la card

**AC3 — Invitar por email funciona con feedback de resultado**
- Given: team-admin escribe un email y hace clic "Invitar"
- When: llama `invite_to_team()` y devuelve `result: "added"`
- Then: toast "Miembro agregado directamente" y el nuevo miembro aparece en la lista
- And: si `result: "invited"`, toast "Invitación enviada a {email}" y aparece en invitaciones pendientes
- And: si `result: "already_member"`, toast de warning "Ya es miembro del equipo"
- And: si `result: "limit_reached"`, toast de error "Límite de {N} miembros alcanzado"

**AC4 — Reenviar invitación actualiza el token y la fecha de vencimiento**
- Given: invitación con status 'pending' o 'expired'
- When: team-admin hace clic "Reenviar"
- Then: llama `resend_invitation()` y la fecha de vencimiento se actualiza a `now() + 7d`
- And: toast "Invitación reenviada"

**AC5 — Quitar miembro requiere confirmación**
- Given: team-admin hace clic "Quitar" de un miembro
- When: confirma en el AlertDialog
- Then: llama `remove_team_member()` y el miembro desaparece de la lista
- And: si el miembro es el único admin, el botón "Quitar" está deshabilitado (o la RPC devuelve error con toast)

**AC6 — Cambiar rol muestra el rol actual y lo alterna**
- Given: miembro tiene rol "Miembro"
- When: team-admin hace clic "Promover a admin"
- Then: llama `set_team_member_role()` con role='admin' y el badge del miembro cambia a "Admin"
- And: viceversa, si es Admin, el botón dice "Bajar a miembro"

---

## Archivos a crear / modificar

| Acción | Archivo |
|---|---|
| CREAR | `src/pages/MiEquipo.tsx` |
| CREAR | `src/hooks/useMyTeams.ts` |
| MODIFICAR | `src/components/AppSidebar.tsx` — agregar item condicional "Mi equipo" |
| MODIFICAR | `src/App.tsx` — agregar ruta `/mi-equipo` |

---

## Tareas

### Task 1 — Hook `useMyTeams`

Devuelve los equipos donde el usuario actual es admin, con miembros e invitaciones.

Archivo: `src/hooks/useMyTeams.ts`

```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TeamMemberWithProfile {
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profiles: { full_name: string; email: string } | null;
}

export interface TeamInvitation {
  id: string;
  email: string;
  expires_at: string;
  status: string;
}

export interface MyTeam {
  id: string;
  name: string;
  member_limit: number;
  members: TeamMemberWithProfile[];
  invitations: TeamInvitation[];
}

export function useMyTeams() {
  const { user } = useAuth();
  const [teams, setTeams]     = useState<MyTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    // Equipos donde el usuario es admin
    const { data: adminRows } = await supabase
      .from("team_members")
      .select("team_id, teams(id, name, member_limit)")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!adminRows || adminRows.length === 0) {
      setTeams([]);
      setLoading(false);
      return;
    }

    const teamIds = adminRows.map((r: any) => r.team_id as string);

    // Miembros e invitaciones en paralelo
    const [membersRes, invitationsRes] = await Promise.all([
      supabase
        .from("team_members")
        .select("team_id, user_id, role, joined_at, profiles(full_name, email)")
        .in("team_id", teamIds),
      supabase
        .from("team_invitations")
        .select("id, team_id, email, expires_at, status")
        .in("team_id", teamIds)
        .eq("status", "pending"),
    ]);

    const members     = (membersRes.data     as unknown as (TeamMemberWithProfile & { team_id: string })[]) || [];
    const invitations = (invitationsRes.data as unknown as (TeamInvitation    & { team_id: string })[]) || [];

    const result: MyTeam[] = adminRows.map((r: any) => ({
      id:           r.teams.id,
      name:         r.teams.name,
      member_limit: r.teams.member_limit,
      members:      members.filter((m) => m.team_id === r.team_id),
      invitations:  invitations.filter((i) => i.team_id === r.team_id),
    }));

    setTeams(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  return { teams, loading, reload: load };
}
```

---

### Task 2 — MiEquipo.tsx

Archivo: `src/pages/MiEquipo.tsx`

```typescript
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useMyTeams, type MyTeam, type TeamMemberWithProfile } from "@/hooks/useMyTeams";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Loader2, Users2, UserX, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function TeamCard({ team, onReload }: { team: MyTeam; onReload: () => void }) {
  const { user } = useAuth();
  const [email, setEmail]               = useState("");
  const [inviting, setInviting]         = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMemberWithProfile | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    const { data, error } = await supabase.rpc("invite_to_team", {
      p_team_id: team.id,
      p_email:   email.trim(),
    });
    setInviting(false);
    if (error) { toast.error("Error: " + error.message); return; }
    const res = data as { result: string; limit?: number };
    if (res.result === "added")         { toast.success("Miembro agregado directamente"); setEmail(""); onReload(); }
    else if (res.result === "invited")  { toast.success(`Invitación enviada a ${email.trim()}`); setEmail(""); onReload(); }
    else if (res.result === "already_member") toast.warning("Ya es miembro del equipo");
    else if (res.result === "limit_reached")  toast.error(`Límite de ${res.limit} miembros alcanzado`);
  };

  const handleRemove = async (m: TeamMemberWithProfile) => {
    setActionLoading(m.user_id);
    const { error } = await supabase.rpc("remove_team_member", {
      p_team_id: team.id,
      p_user_id: m.user_id,
    });
    setActionLoading(null);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Miembro eliminado");
    onReload();
  };

  const handleToggleRole = async (m: TeamMemberWithProfile) => {
    const newRole = m.role === "admin" ? "member" : "admin";
    setActionLoading(m.user_id + "_role");
    const { error } = await supabase.rpc("set_team_member_role", {
      p_team_id: team.id,
      p_user_id: m.user_id,
      p_role:    newRole,
    });
    setActionLoading(null);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success(newRole === "admin" ? "Promovido a admin" : "Rol cambiado a miembro");
    onReload();
  };

  const handleResend = async (invitationId: string, email: string) => {
    setActionLoading(invitationId);
    const { error } = await supabase.rpc("resend_invitation", { p_invitation_id: invitationId });
    setActionLoading(null);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success(`Invitación reenviada a ${email}`);
    onReload();
  };

  const adminCount = team.members.filter((m) => m.role === "admin").length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header de la card */}
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">{team.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {team.members.length} de {team.member_limit} miembros
          </p>
        </div>
      </div>

      {/* Miembros activos */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Miembros activos</p>
        {team.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin miembros.</p>
        ) : (
          <div className="space-y-2">
            {team.members.map((m) => {
              const isSelf  = m.user_id === user?.id;
              const isLoading = actionLoading === m.user_id || actionLoading === m.user_id + "_role";
              return (
                <div key={m.user_id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.profiles?.full_name ?? "—"}
                      {isSelf && <span className="text-[11px] text-muted-foreground ml-1">(tú)</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.profiles?.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={m.role === "admin" ? "default" : "secondary"} className="text-[11px]">
                      {m.role === "admin" ? "Admin" : "Miembro"}
                    </Badge>
                    {!isSelf && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] text-muted-foreground"
                          disabled={isLoading}
                          onClick={() => handleToggleRole(m)}
                        >
                          {m.role === "admin" ? "Bajar a miembro" : "Promover"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={isLoading || (m.role === "admin" && adminCount <= 1)}
                          onClick={() => setRemoveTarget(m)}
                        >
                          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invitaciones pendientes */}
      {team.invitations.length > 0 && (
        <div className="px-5 py-4 border-b border-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Invitaciones pendientes</p>
          <div className="space-y-2">
            {team.invitations.map((inv) => {
              const expires = parseISO(inv.expires_at);
              const expired = expires < new Date();
              return (
                <div key={inv.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{inv.email}</p>
                    <p className={`text-[11px] ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                      {expired ? "Vencida" : `Vence ${format(expires, "d MMM", { locale: es })}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 shrink-0"
                    disabled={actionLoading === inv.id}
                    onClick={() => handleResend(inv.id, inv.email)}
                  >
                    {actionLoading === inv.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    Reenviar
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invitar */}
      <div className="px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Invitar</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="email@ejemplo.com"
            className="h-9 text-sm flex-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            disabled={inviting}
          />
          <Button size="sm" onClick={handleInvite} disabled={inviting || !email.trim()}>
            {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Invitar"}
          </Button>
        </div>
      </div>

      {/* AlertDialog para quitar miembro */}
      <AlertDialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar miembro?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.profiles?.full_name} perderá acceso a los pacientes del equipo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (removeTarget) handleRemove(removeTarget); setRemoveTarget(null); }}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function MiEquipo() {
  const { teams, loading, reload } = useMyTeams();

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (teams.length === 0) return (
    <div className="text-center py-16 space-y-2">
      <Users2 className="h-10 w-10 text-muted-foreground mx-auto" />
      <p className="text-sm font-medium text-foreground">No sos admin de ningún equipo</p>
      <p className="text-sm text-muted-foreground">Contactá al administrador para que te asigne como admin de un equipo.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground tracking-tight">Mi equipo</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestioná los miembros de tus equipos</p>
      </div>
      {teams.map((t) => (
        <TeamCard key={t.id} team={t} onReload={reload} />
      ))}
    </div>
  );
}
```

---

### Task 3 — Modificar AppSidebar.tsx

Agregar "Mi equipo" condicionalmente si el usuario es admin de al menos un equipo.

**Imports adicionales:**
```typescript
import { Users2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
```

**Estado adicional dentro del componente AppSidebar:**
```typescript
const { user } = useAuth();
const [isTeamAdmin, setIsTeamAdmin] = useState(false);

useEffect(() => {
  if (!user) return;
  supabase
    .from("team_members")
    .select("team_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "admin")
    .then(({ count }) => setIsTeamAdmin((count ?? 0) > 0));
}, [user]);
```

**Item a agregar en `navItems` (condicionalmente) — reemplazar el array estático por un computed:**
```typescript
const navItems = [
  { title: "Dashboard",  url: "/dashboard",   icon: LayoutDashboard },
  { title: "Pacientes",  url: "/patients",    icon: Users },
  { title: "Turnos",     url: "/appointments",icon: Calendar },
  { title: "Ejercicios", url: "/exercises",   icon: Dumbbell },
  ...(isTeamAdmin ? [{ title: "Mi equipo", url: "/mi-equipo", icon: Users2 }] : []),
];
```

> La declaración de `navItems` pasa de `const` fuera del componente a `const` dentro del componente (necesita acceso a `isTeamAdmin`).

---

### Task 4 — Modificar App.tsx

```typescript
// Import adicional:
import MiEquipo from "./pages/MiEquipo";

// Ruta adicional dentro del Route path="/" element={<AppLayout />}:
<Route path="mi-equipo" element={<MiEquipo />} />
```

---

### Task 5 — Verificación manual

1. Loguearse como terapista que es admin de un equipo → ver "Mi equipo" en el sidebar
2. Navegar a `/mi-equipo` → la card del equipo aparece con miembros e invitaciones
3. Invitar un email sin cuenta → aparece en "Invitaciones pendientes" con fecha de vencimiento
4. Invitar el mismo email de nuevo → la invitación anterior desaparece y aparece una nueva con nueva fecha
5. Hacer clic en "Reenviar" de una invitación → toast "Invitación reenviada", fecha actualizada al recargar
6. Quitar un miembro (no el único admin) → confirmación → el miembro desaparece
7. Loguearse como terapista sin equipos → "Mi equipo" NO aparece en el sidebar

---

## Decisiones de Diseño

### Por qué `useMyTeams` carga solo los equipos donde el usuario es admin

El hook es para la página "Mi equipo" que es solo para team-admins. Un miembro regular (sin rol admin) no accede a esta página. El hook filtra por `role = 'admin'` en la primera query para evitar cargar datos innecesarios.

### Por qué el botón "Quitar" está deshabilitado para el último admin

La RPC `remove_team_member` lanzará EXCEPTION si se intenta quitar al único admin. El frontend puede prevenir el intento al deshabilitar el botón (`adminCount <= 1 && m.role === "admin"`). Esto mejora la UX sin depender solo del error de la RPC para comunicar la restricción.

---

## Historia siguiente

**4.17 — Selector de contexto al crear paciente**: modificar `NewPatientForm.tsx` para mostrar un selector "Paciente personal / Paciente de [equipo]" cuando el terapista pertenece a algún equipo.
