# Historia 4.15: Admin — Gestión de equipos

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 5 — Frontend
**Dependencia:** Historia 4.12 aplicada (AdminLayout con ruta `/admin/teams/:id`); RPCs `admin_create_team`, `admin_set_team_limit`, `admin_list_patients`, `admin_move_patient_to_team` disponibles (Historia 4.9); RPCs `admin_list_therapists` disponible (Historia 4.8, para el selector de admin al crear equipo)
**Tipo:** Solo frontend — modifica `AdminTeams.tsx` + crea `AdminTeamDetail.tsx` + actualiza App.tsx con la ruta `:id`. Sin cambios de DB ni de types.ts.

---

## Historia

Como super-admin,
quiero ver la lista de equipos, crear nuevos equipos asignando el primer admin, y entrar al detalle de cada equipo para ver sus miembros y pacientes y ajustar el límite de miembros.

---

## Criterios de Aceptación

**AC1 — Lista de equipos muestra nombre, miembros actuales vs límite, y estado**
- Given: super-admin navega a `/admin/teams`
- Then: ve una lista con cada equipo mostrando: nombre, `member_count / member_limit`, estado (Activo/Inactivo)
- And: cada fila tiene un link "Ver detalle" que lleva a `/admin/teams/:id`

**AC2 — Formulario "Crear equipo" en la misma página**
- Given: super-admin está en `/admin/teams`
- When: hace clic en "Nuevo equipo"
- Then: se abre un dialog con campos: Nombre del equipo, Seleccionar admin inicial (dropdown de terapistas activos), Límite de miembros (número, default 5)
- And: al confirmar, llama a `admin_create_team()` y el nuevo equipo aparece en la lista

**AC3 — Detalle del equipo muestra miembros**
- Given: super-admin navega a `/admin/teams/:id`
- Then: ve el nombre del equipo, el contador `X de Y miembros`, y una lista de miembros con nombre, email y rol (Admin/Miembro)

**AC4 — Ajustar límite de miembros desde el detalle**
- Given: super-admin está en `/admin/teams/:id`
- When: hace clic en "Ajustar límite", cambia el número y confirma
- Then: llama a `admin_set_team_limit()` y el contador actualiza

**AC5 — Ver pacientes del equipo desde el detalle**
- Given: super-admin está en `/admin/teams/:id`
- Then: ve una segunda sección con los pacientes del equipo (nombre, profesional responsable)
- And: cada paciente tiene una acción "Mover a..." (abre un selector de equipo) que llama `admin_move_patient_to_team()`

---

## Archivos a crear / modificar

| Acción | Archivo |
|---|---|
| REEMPLAZAR | `src/pages/admin/AdminTeams.tsx` |
| CREAR | `src/pages/admin/AdminTeamDetail.tsx` |
| MODIFICAR | `src/App.tsx` — cambiar la ruta `admin/teams/:id` para usar `AdminTeamDetail` |

---

## Tareas

### Task 1 — AdminTeams.tsx (lista + crear)

Archivo: `src/pages/admin/AdminTeams.tsx`

```typescript
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, ChevronRight } from "lucide-react";

interface Team {
  id: string;
  name: string;
  member_limit: number;
  is_active: boolean;
  created_at: string;
  member_count?: number;
}

interface TherapistOption {
  id: string;
  full_name: string;
  is_active: boolean;
}

export default function AdminTeams() {
  const navigate  = useNavigate();
  const [teams, setTeams]               = useState<Team[]>([]);
  const [loading, setLoading]           = useState(true);
  const [createOpen, setCreateOpen]     = useState(false);
  const [therapists, setTherapists]     = useState<TherapistOption[]>([]);
  const [saving, setSaving]             = useState(false);

  // Formulario de creación
  const [newName, setNewName]         = useState("");
  const [newAdmin, setNewAdmin]       = useState("");
  const [newLimit, setNewLimit]       = useState("5");

  const loadTeams = async () => {
    setLoading(true);
    // Obtener teams con conteo de miembros via subquery join
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, member_limit, is_active, created_at, team_members(count)")
      .order("created_at", { ascending: false });
    if (error) { toast.error("Error al cargar equipos"); setLoading(false); return; }
    const mapped = (data || []).map((t: any) => ({
      ...t,
      member_count: t.team_members?.[0]?.count ?? 0,
    }));
    setTeams(mapped);
    setLoading(false);
  };

  const loadTherapists = async () => {
    const { data } = await supabase.rpc("admin_list_therapists");
    setTherapists(
      ((data as unknown as TherapistOption[]) || []).filter((t) => t.is_active)
    );
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const openCreate = () => {
    setNewName(""); setNewAdmin(""); setNewLimit("5");
    loadTherapists();
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newAdmin) {
      toast.error("Nombre y admin inicial son obligatorios");
      return;
    }
    const limit = parseInt(newLimit, 10);
    if (isNaN(limit) || limit < 1) { toast.error("Límite inválido"); return; }

    setSaving(true);
    const { data, error } = await supabase.rpc("admin_create_team", {
      p_name:          newName.trim(),
      p_admin_user_id: newAdmin,
      p_member_limit:  limit,
    });
    setSaving(false);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Equipo creado");
    setCreateOpen(false);
    loadTeams();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground">Equipos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{teams.length} equipos</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo equipo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : teams.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No hay equipos creados aún.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Miembros</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teams.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {t.member_count ?? "—"} / {t.member_limit}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={t.is_active ? "default" : "secondary"} className="text-[11px]">
                      {t.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => navigate(`/admin/teams/${t.id}`)}
                    >
                      Ver detalle <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog crear equipo */}
      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo equipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre del equipo *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 text-sm" placeholder="Ej: Clínica Norte" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Admin inicial *</Label>
              <Select value={newAdmin} onValueChange={setNewAdmin}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar terapista" />
                </SelectTrigger>
                <SelectContent>
                  {therapists.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Límite de miembros</Label>
              <Input type="number" min={1} value={newLimit} onChange={(e) => setNewLimit(e.target.value)} className="h-9 text-sm w-28" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Crear equipo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

### Task 2 — AdminTeamDetail.tsx

Archivo: `src/pages/admin/AdminTeamDetail.tsx`

```typescript
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Users } from "lucide-react";

interface TeamMember {
  user_id: string;
  role: string;
  profiles: { full_name: string; email: string } | null;
}

interface Patient {
  id: string;
  full_name: string;
  professional_name: string;
}

interface Team {
  id: string;
  name: string;
  member_limit: number;
  is_active: boolean;
}

export default function AdminTeamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const [team, setTeam]         = useState<Team | null>(null);
  const [members, setMembers]   = useState<TeamMember[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newLimit, setNewLimit] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [teamRes, membersRes, patientsRes] = await Promise.all([
        supabase.from("teams").select("*").eq("id", id).single(),
        supabase.from("team_members").select("user_id, role, profiles(full_name, email)").eq("team_id", id),
        supabase.rpc("admin_list_patients", { p_team_id: id }),
      ]);
      if (teamRes.data) { setTeam(teamRes.data); setNewLimit(String(teamRes.data.member_limit)); }
      setMembers((membersRes.data as unknown as TeamMember[]) || []);
      setPatients((patientsRes.data as unknown as Patient[]) || []);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSetLimit = async () => {
    if (!id || !team) return;
    const limit = parseInt(newLimit, 10);
    if (isNaN(limit) || limit < 1) { toast.error("Límite inválido"); return; }
    setSavingLimit(true);
    const { error } = await supabase.rpc("admin_set_team_limit", { p_team_id: id, p_limit: limit });
    setSavingLimit(false);
    if (error) { toast.error("Error: " + error.message); return; }
    setTeam((t) => t ? { ...t, member_limit: limit } : t);
    toast.success("Límite actualizado");
  };

  const handleMovePatient = async (patientId: string) => {
    // Placeholder: en una iteración futura, abrir un selector de equipo destino.
    // Por ahora, quitar del equipo (pasar a individual).
    const { error } = await supabase.rpc("admin_move_patient_to_team", {
      p_patient_id: patientId,
      p_team_id:    null,
    });
    if (error) { toast.error("Error: " + error.message); return; }
    setPatients((prev) => prev.filter((p) => p.id !== patientId));
    toast.success("Paciente movido a individual");
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!team) return <p className="text-sm text-muted-foreground">Equipo no encontrado.</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/admin/teams")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground">{team.name}</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {members.length} de {team.member_limit} miembros
            <Badge variant={team.is_active ? "default" : "secondary"} className="text-[11px] ml-1">
              {team.is_active ? "Activo" : "Inactivo"}
            </Badge>
          </p>
        </div>
      </div>

      {/* Límite */}
      <section className="border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Límite de miembros</h3>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={members.length}
            value={newLimit}
            onChange={(e) => setNewLimit(e.target.value)}
            className="h-8 w-24 text-sm"
          />
          <Button size="sm" onClick={handleSetLimit} disabled={savingLimit}>
            {savingLimit && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Guardar
          </Button>
          <p className="text-xs text-muted-foreground">Mínimo: {members.length} (miembros actuales)</p>
        </div>
      </section>

      {/* Miembros */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Miembros</h3>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin miembros.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nombre</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Rol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{m.profiles?.full_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{m.profiles?.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={m.role === "admin" ? "default" : "secondary"} className="text-[11px]">
                        {m.role === "admin" ? "Admin" : "Miembro"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pacientes */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Pacientes del equipo</h3>
        {patients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este equipo no tiene pacientes asignados.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Paciente</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Profesional</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{p.full_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{p.professional_name}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => handleMovePatient(p.id)}
                      >
                        Quitar del equipo
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

---

### Task 3 — Actualizar App.tsx

Cambiar la ruta `admin/teams/:id` para usar el nuevo componente:

```typescript
// Agregar import:
import AdminTeamDetail from "./pages/admin/AdminTeamDetail";

// Cambiar la ruta (reemplazar el Route existente de teams/:id):
<Route path="teams/:id" element={<AdminTeamDetail />} />
```

---

### Task 4 — Verificación manual

1. En `/admin/teams`, crear un equipo nuevo → el equipo aparece en la lista
2. Hacer clic en "Ver detalle" → lleva a `/admin/teams/:id`
3. En el detalle, cambiar el límite a un valor mayor al actual → "Guardar" → el contador `X de Y` actualiza
4. Intentar poner un límite menor a los miembros actuales → debe aparecer toast de error (la RPC rechaza y el error llega al frontend)
5. Si hay pacientes en el equipo, "Quitar del equipo" los mueve a individual (team_id = NULL) y desaparecen de la lista

---

## Decisiones de Diseño

### Por qué "Mover a..." solo quita del equipo (no selecciona equipo destino)

El selector de equipo destino es funcionalidad adicional que requiere cargar la lista de equipos en un nested select. Para el MVP, "Quitar del equipo" es la acción más crítica (desasignar). Mover a otro equipo específico puede hacerse desde el detalle del equipo destino (crear paciente ahí o reasignar desde ese lado). Se deja un comentario `// Placeholder` en el código para la futura mejora.

---

## Historia siguiente

**4.16 — Mi equipo — gestión de miembros**: sección "Mi equipo" en la app principal (no /admin) para que los team-admins gestionen su equipo: ver miembros, invitar, reenviar, quitar, cambiar roles.
