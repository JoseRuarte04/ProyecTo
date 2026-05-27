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
    // Placeholder: quitar del equipo (mover a individual)
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
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {members.length} de {team.member_limit} miembros
            <Badge variant={team.is_active ? "default" : "secondary"} className="text-[11px] ml-1">
              {team.is_active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>
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
