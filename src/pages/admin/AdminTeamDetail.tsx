import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Loader2, ArrowLeft, Users, MoreHorizontal, UserMinus, ShieldCheck, Shield, Pencil, Check, X, UserPlus } from "lucide-react";

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

interface TherapistOption {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface TeamOption {
  id: string;
  name: string;
}

const INDIVIDUAL_VALUE = "__individual__";

export default function AdminTeamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const [team, setTeam]         = useState<Team | null>(null);
  const [members, setMembers]   = useState<TeamMember[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newLimit, setNewLimit] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft]     = useState("");
  const [savingName, setSavingName]   = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const [therapists, setTherapists] = useState<TherapistOption[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberId, setNewMemberId] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);

  const [otherTeams, setOtherTeams] = useState<TeamOption[]>([]);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [movingPatientId, setMovingPatientId] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    const [teamRes, membersRes, patientsRes, teamsRes] = await Promise.all([
      supabase.from("teams").select("*").eq("id", id).single(),
      supabase.from("team_members").select("user_id, role, profiles(full_name, email)").eq("team_id", id),
      supabase.rpc("admin_list_patients", { p_team_id: id }),
      supabase.from("teams").select("id, name").eq("is_active", true).neq("id", id).order("name"),
    ]);
    const failed = [teamRes, membersRes, patientsRes, teamsRes].filter((r) => r.error);
    if (failed.length > 0) {
      toast.error(`No se pudo cargar parte de la info del equipo (${failed.length} consultas fallaron)`);
    }
    if (teamRes.data) { setTeam(teamRes.data); setNewLimit(String(teamRes.data.member_limit)); }
    setMembers((membersRes.data as unknown as TeamMember[]) || []);
    setPatients((patientsRes.data as unknown as Patient[]) || []);
    setOtherTeams((teamsRes.data as unknown as TeamOption[]) || []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const loadTherapists = async () => {
    const { data, error } = await supabase.rpc("admin_list_therapists");
    if (error) { toast.error("Error al cargar terapistas"); return; }
    setTherapists((data as unknown as TherapistOption[]) || []);
  };

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

  const startEditName = () => { if (!team) return; setNameDraft(team.name); setEditingName(true); };
  const cancelEditName = () => setEditingName(false);
  const saveName = async () => {
    if (!id || !team || !nameDraft.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from("teams").update({ name: nameDraft.trim() }).eq("id", id);
    setSavingName(false);
    if (error) { toast.error("Error al renombrar: " + error.message); return; }
    setTeam((t) => t ? { ...t, name: nameDraft.trim() } : t);
    setEditingName(false);
    toast.success("Equipo renombrado");
  };

  const doToggleActive = async () => {
    if (!id || !team) return;
    setTogglingActive(true);
    const { error } = await supabase.from("teams").update({ is_active: !team.is_active }).eq("id", id);
    setTogglingActive(false);
    if (error) { toast.error("Error: " + error.message); return; }
    setTeam((t) => t ? { ...t, is_active: !t.is_active } : t);
    toast.success(team.is_active ? "Equipo desactivado" : "Equipo reactivado");
  };
  const handleToggleActive = () => {
    if (team?.is_active) setConfirmDeactivate(true);
    else doToggleActive();
  };

  const openAddMember = () => {
    setNewMemberId("");
    loadTherapists();
    setAddingMember(true);
  };

  const availableTherapists = therapists.filter(
    (t) => t.is_active && !members.some((m) => m.user_id === t.id)
  );

  const handleAddMember = async () => {
    if (!id || !newMemberId) return;
    if (team && members.length >= team.member_limit) {
      toast.error(`El equipo ya está en su límite de ${team.member_limit} miembros`);
      return;
    }
    setSavingMember(true);
    const { error } = await supabase.from("team_members").insert({
      team_id: id, user_id: newMemberId, role: "member",
    });
    setSavingMember(false);
    if (error) { toast.error("Error al agregar: " + error.message); return; }
    toast.success("Miembro agregado");
    setAddingMember(false);
    load();
  };

  const handleToggleRole = async (m: TeamMember) => {
    if (!id) return;
    const newRole = m.role === "admin" ? "member" : "admin";
    setMemberActionId(m.user_id);
    const { error } = await supabase
      .from("team_members")
      .update({ role: newRole })
      .eq("team_id", id)
      .eq("user_id", m.user_id);
    setMemberActionId(null);
    if (error) { toast.error("Error: " + error.message); return; }
    setMembers((prev) => prev.map((x) => x.user_id === m.user_id ? { ...x, role: newRole } : x));
    toast.success(newRole === "admin" ? "Ahora es admin del equipo" : "Ahora es miembro");
  };

  const handleRemoveMember = async () => {
    if (!id || !removeTarget) return;
    setMemberActionId(removeTarget.user_id);
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", id)
      .eq("user_id", removeTarget.user_id);
    setMemberActionId(null);
    setRemoveTarget(null);
    if (error) { toast.error("Error: " + error.message); return; }
    setMembers((prev) => prev.filter((x) => x.user_id !== removeTarget.user_id));
    toast.success("Miembro quitado del equipo");
  };

  const handleMovePatient = async (patientId: string) => {
    const target = moveTargets[patientId];
    if (!target) { toast.error("Elegí un equipo destino"); return; }
    const p_team_id = target === INDIVIDUAL_VALUE ? null : target;
    setMovingPatientId(patientId);
    const { error } = await supabase.rpc("admin_move_patient_to_team", {
      p_patient_id: patientId,
      p_team_id,
    });
    setMovingPatientId(null);
    if (error) { toast.error("Error: " + error.message); return; }
    setPatients((prev) => prev.filter((p) => p.id !== patientId));
    toast.success(p_team_id ? "Paciente movido de equipo" : "Paciente movido a individual");
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
        <div className="flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="h-8 text-base font-semibold max-w-xs"
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveName} disabled={savingName}>
                {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditName} disabled={savingName}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-semibold text-foreground">{team.name}</h2>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={startEditName}>
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Users className="h-3.5 w-3.5" />
            {members.length} de {team.member_limit} miembros
            <Badge variant={team.is_active ? "default" : "secondary"} className="text-[11px] ml-1">
              {team.is_active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={handleToggleActive}
          disabled={togglingActive}
        >
          {togglingActive && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {team.is_active ? "Desactivar equipo" : "Reactivar equipo"}
        </Button>
      </div>

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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Miembros</h3>
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={openAddMember}>
            <UserPlus className="h-3.5 w-3.5" /> Agregar miembro
          </Button>
        </div>
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
                  <th className="px-4 py-2.5"></th>
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
                    <td className="px-4 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={memberActionId === m.user_id}>
                            {memberActionId === m.user_id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <MoreHorizontal className="h-3.5 w-3.5" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleToggleRole(m)}>
                            {m.role === "admin"
                              ? <><Shield className="h-3.5 w-3.5 mr-2" /> Hacer miembro</>
                              : <><ShieldCheck className="h-3.5 w-3.5 mr-2" /> Hacer admin</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setRemoveTarget(m)}
                          >
                            <UserMinus className="h-3.5 w-3.5 mr-2" /> Quitar del equipo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {addingMember && (
          <div className="border border-border rounded-lg p-3 flex items-center gap-3">
            <Select value={newMemberId} onValueChange={setNewMemberId}>
              <SelectTrigger className="h-9 text-sm flex-1">
                <SelectValue placeholder="Seleccionar terapista" />
              </SelectTrigger>
              <SelectContent>
                {availableTherapists.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No hay terapistas disponibles</div>
                ) : (
                  availableTherapists.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name?.trim() || t.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddMember} disabled={savingMember || !newMemberId}>
              {savingMember && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Agregar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingMember(false)} disabled={savingMember}>
              Cancelar
            </Button>
          </div>
        )}
      </section>

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
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Mover a</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{p.full_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{p.professional_name}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={moveTargets[p.id] ?? ""}
                          onValueChange={(v) => setMoveTargets((prev) => ({ ...prev, [p.id]: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs w-44">
                            <SelectValue placeholder="Equipo destino" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={INDIVIDUAL_VALUE}>Individual (sin equipo)</SelectItem>
                            {otherTeams.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                          disabled={!moveTargets[p.id] || movingPatientId === p.id}
                          onClick={() => handleMovePatient(p.id)}
                        >
                          {movingPatientId === p.id && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                          Mover
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar este equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              El equipo deja de contar como activo (no aparecerá en "equipos activos" ni en las
              métricas del dashboard). Los miembros y pacientes asignados no se modifican, y podés
              reactivarlo en cualquier momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { setConfirmDeactivate(false); doToggleActive(); }}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar del equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.profiles?.full_name ?? "Este terapista"} deja de ser miembro de {team.name}.
              Sus pacientes personales y su acceso al sistema no se modifican.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleRemoveMember}>
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
