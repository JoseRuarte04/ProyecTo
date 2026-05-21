import { useEffect, useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
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
import { Loader2, Users2, UserX, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ActivityItem {
  id: string;
  action: string;
  table_name: string;
  description: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
}

function initials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    return name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }
  return (email?.[0] ?? "?").toUpperCase();
}

function TeamActivity({ teamId }: { teamId: string }) {
  const [items, setItems]   = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase.rpc("get_team_activity", { p_team_id: teamId }).then(({ data, error: rpcError }) => {
      if (rpcError) {
        setError("No se pudo cargar la actividad");
        setLoading(false);
        return;
      }
      setItems((data as unknown as ActivityItem[]) || []);
      setLoading(false);
    });
  }, [teamId]);

  if (loading) return (
    <div className="flex justify-center py-4">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <p className="text-xs text-destructive py-2">{error}</p>
  );

  if (items.length === 0) return (
    <p className="text-xs text-muted-foreground py-2">Sin actividad reciente.</p>
  );

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const displayName = item.full_name || item.email || "Sistema";
        const ini = initials(item.full_name, item.email);
        const ago = formatDistanceToNow(parseISO(item.created_at), { addSuffix: true, locale: es });
        return (
          <div key={item.id} className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5">
              {ini}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground leading-snug">
                <span className="font-medium">{displayName}</span>
                {" · "}
                <span className="text-muted-foreground">{item.description || item.table_name}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{ago}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamCard({ team, onReload }: { team: MyTeam; onReload: () => void }) {
  const { user } = useAuth();
  const [email, setEmail]                 = useState("");
  const [inviting, setInviting]           = useState(false);
  const [removeTarget, setRemoveTarget]   = useState<TeamMemberWithProfile | null>(null);
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
    if (res.result === "added")               { toast.success("Miembro agregado directamente"); setEmail(""); onReload(); }
    else if (res.result === "invited")         { toast.success(`Invitación enviada a ${email.trim()}`); setEmail(""); onReload(); }
    else if (res.result === "already_member")  toast.warning("Ya es miembro del equipo");
    else if (res.result === "limit_reached")   toast.error(`Límite de ${res.limit} miembros alcanzado`);
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

  const handleResend = async (invitationId: string, invEmail: string) => {
    setActionLoading(invitationId);
    const { error } = await supabase.rpc("resend_invitation", { p_invitation_id: invitationId });
    setActionLoading(null);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success(`Invitación reenviada a ${invEmail}`);
    onReload();
  };

  const handleCancel = async (invitationId: string, invEmail: string) => {
    setActionLoading(invitationId + "_cancel");
    const { error } = await supabase.rpc("cancel_invitation", { p_invitation_id: invitationId });
    setActionLoading(null);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success(`Invitación a ${invEmail} cancelada`);
    onReload();
  };

  const adminCount = team.members.filter((m) => m.role === "admin").length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">{team.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {team.members.length} de {team.member_limit} miembros
          </p>
        </div>
      </div>

      <div className="px-5 py-4 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Miembros activos</p>
        {team.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin miembros.</p>
        ) : (
          <div className="space-y-2">
            {team.members.map((m) => {
              const isSelf    = m.user_id === user?.id;
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
                          {isLoading
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <UserX className="h-3.5 w-3.5" />}
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

      {team.invitations.length > 0 && (
        <div className="px-5 py-4 border-b border-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Invitaciones pendientes</p>
          <div className="space-y-2">
            {team.invitations.map((inv) => {
              const expires = parseISO(inv.expires_at);
              const expired = expires < new Date();
              const isResending = actionLoading === inv.id;
              const isCancelling = actionLoading === inv.id + "_cancel";
              const isBusy = isResending || isCancelling;
              return (
                <div key={inv.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{inv.email}</p>
                    <p className={`text-[11px] ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                      {expired ? "Vencida" : `Vence ${format(expires, "d MMM", { locale: es })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1"
                      disabled={isBusy}
                      onClick={() => handleResend(inv.id, inv.email)}
                    >
                      {isResending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <RefreshCw className="h-3.5 w-3.5" />}
                      Reenviar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
                      disabled={isBusy}
                      onClick={() => handleCancel(inv.id, inv.email)}
                    >
                      {isCancelling
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <X className="h-3.5 w-3.5" />}
                      Cancelar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Actividad reciente del equipo */}
      <div className="px-5 py-4 border-t border-border">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Actividad reciente</p>
        <TeamActivity teamId={team.id} />
      </div>

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
