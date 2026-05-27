import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Loader2, Search, MoreHorizontal, Pencil, UserX, UserCheck, UserPlus, MailX, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { TherapistEditDialog } from "@/components/admin/TherapistEditDialog";
import { InviteTherapistDialog } from "@/components/admin/InviteTherapistDialog";
import { cn } from "@/lib/utils";

interface Therapist {
  id: string;
  full_name: string;
  email: string;
  specialty: string | null;
  license_number: string | null;
  is_active: boolean;
  created_at: string;
  patient_count: number;
  team_count: number;
}

interface InactiveTherapist {
  id: string;
  full_name: string;
  email: string;
  specialty: string | null;
  patient_count: number;
  last_session_at: string | null;
  created_at: string;
}

interface PendingInvitation {
  user_id: string;
  email: string;
  full_name: string;
  invited_at: string;
  days_pending: number;
}

type TabKey = "active" | "inactive" | "pending";

export default function AdminTherapists() {
  const [therapists, setTherapists]             = useState<Therapist[]>([]);
  const [inactive, setInactive]                 = useState<InactiveTherapist[]>([]);
  const [pending, setPending]                   = useState<PendingInvitation[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [inactiveLoading, setInactiveLoading]   = useState(false);
  const [pendingLoading, setPendingLoading]      = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [search, setSearch]                     = useState("");
  const [tab, setTab]                           = useState<TabKey>("active");
  const [editTarget, setEditTarget]             = useState<Therapist | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Therapist | null>(null);
  const [cancelTarget, setCancelTarget]         = useState<PendingInvitation | null>(null);
  const [actionLoading, setActionLoading]       = useState<string | null>(null);
  const [inviteOpen, setInviteOpen]             = useState(false);

  const loadTherapists = () => {
    setLoading(true);
    supabase.rpc("admin_list_therapists").then(({ data, error }) => {
      if (error) setError("Error al cargar terapistas");
      else setTherapists((data as unknown as Therapist[]) || []);
      setLoading(false);
    });
  };

  const loadInactive = () => {
    setInactiveLoading(true);
    supabase.rpc("admin_get_inactive_therapists", { p_days: 30 }).then(({ data, error }) => {
      if (error) toast.error("Error al cargar terapistas inactivos");
      else setInactive((data as unknown as InactiveTherapist[]) || []);
      setInactiveLoading(false);
    });
  };

  const loadPending = () => {
    setPendingLoading(true);
    supabase.rpc("admin_list_pending_invitations").then(({ data, error }) => {
      if (error) toast.error("Error al cargar invitaciones pendientes");
      else setPending((data as unknown as PendingInvitation[]) || []);
      setPendingLoading(false);
    });
  };

  useEffect(() => {
    loadTherapists();
    loadPending();
  }, []);

  const handleTabChange = (t: TabKey) => {
    setTab(t);
    if (t === "inactive" && inactive.length === 0 && !inactiveLoading) {
      loadInactive();
    }
    if (t === "pending" && pending.length === 0 && !pendingLoading) {
      loadPending();
    }
  };

  const filtered = therapists.filter((t) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return t.full_name.toLowerCase().includes(term) || t.email.toLowerCase().includes(term);
  });

  const handleToggleActive = async (t: Therapist) => {
    setActionLoading(t.id);
    const rpc = t.is_active ? "admin_deactivate_therapist" : "admin_reactivate_therapist";
    const { error } = await supabase.rpc(rpc, { p_user_id: t.id });
    setActionLoading(null);
    if (error) { toast.error("Error: " + error.message); return; }
    setTherapists((prev) => prev.map((x) => x.id === t.id ? { ...x, is_active: !t.is_active } : x));
    toast.success(t.is_active ? "Terapista desactivado" : "Terapista reactivado");
  };

  const handleSaved = (updated: Pick<Therapist, "id" | "full_name" | "email" | "specialty" | "license_number">) => {
    setTherapists((prev) => prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x));
  };

  const handleCancelInvitation = async (inv: PendingInvitation) => {
    setActionLoading(inv.user_id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/cancel-therapist-invitation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ user_id: inv.user_id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al cancelar la invitación");
      } else {
        toast.success(`Invitación de ${inv.email} cancelada`);
        setPending((prev) => prev.filter((p) => p.user_id !== inv.user_id));
        // Remove from active list too if the zombie profile was there
        setTherapists((prev) => prev.filter((t) => t.id !== inv.user_id));
      }
    } catch {
      toast.error("Error de red al cancelar la invitación");
    }
    setActionLoading(null);
  };

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "active",   label: "Todos" },
    { key: "inactive", label: "Inactivos (30 días)" },
    { key: "pending",  label: "Invitaciones pendientes", badge: pending.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground">Terapistas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{therapists.length} en total</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" /> Invitar terapista
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className={cn(
                "inline-flex items-center justify-center text-[10px] font-semibold rounded-full h-4 min-w-4 px-1",
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "active" && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {search ? "No hay resultados para esa búsqueda." : "No hay terapistas registrados."}
            </p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Especialidad</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Pac.</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Eq.</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{t.full_name}</p>
                        {t.license_number && (
                          <p className="text-[11px] text-muted-foreground">{t.license_number}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.email}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{t.specialty || "—"}</td>
                      <td className="px-4 py-3 text-center text-foreground">{t.patient_count}</td>
                      <td className="px-4 py-3 text-center text-foreground">{t.team_count}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={t.is_active ? "default" : "destructive"} className="text-[11px]">
                          {t.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={actionLoading === t.id}>
                              {actionLoading === t.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <MoreHorizontal className="h-3.5 w-3.5" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditTarget(t)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                            {t.is_active ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeactivateTarget(t)}
                              >
                                <UserX className="h-3.5 w-3.5 mr-2" /> Desactivar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleToggleActive(t)}>
                                <UserCheck className="h-3.5 w-3.5 mr-2" /> Reactivar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "inactive" && (
        <>
          <p className="text-sm text-muted-foreground">
            Terapistas activos que no crearon ninguna sesión en los últimos 30 días.
          </p>
          {inactiveLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : inactive.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Todos los terapistas tuvieron actividad reciente.
            </p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Pacientes</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Última sesión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inactive.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{t.full_name}</p>
                        {t.specialty && <p className="text-[11px] text-muted-foreground">{t.specialty}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.email}</td>
                      <td className="px-4 py-3 text-center text-foreground">{t.patient_count}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {t.last_session_at
                          ? <span className="text-muted-foreground">
                              {format(parseISO(t.last_session_at), "d MMM yyyy", { locale: es })}
                            </span>
                          : <span className="text-destructive text-[11px]">Nunca</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "pending" && (
        <>
          <p className="text-sm text-muted-foreground">
            Invitaciones enviadas que aún no fueron aceptadas. El terapista no tiene acceso activo al sistema.
          </p>
          {pendingLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No hay invitaciones pendientes.
            </p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Invitado</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Días pendiente</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pending.map((inv) => (
                    <tr key={inv.user_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{inv.email}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {inv.full_name || <span className="text-xs italic">Sin nombre</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        {formatDistanceToNow(parseISO(inv.invited_at), { addSuffix: true, locale: es })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={inv.days_pending >= 7 ? "destructive" : "secondary"}
                          className="text-[11px]"
                        >
                          {inv.days_pending}d
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={actionLoading === inv.user_id}
                          onClick={() => setCancelTarget(inv)}
                        >
                          {actionLoading === inv.user_id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <MailX className="h-3.5 w-3.5" />}
                          Cancelar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editTarget && (
        <TherapistEditDialog
          therapist={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      <AlertDialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar terapista?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.full_name} perderá acceso al sistema. Podés reactivarlo en cualquier momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deactivateTarget) handleToggleActive(deactivateTarget);
                setDeactivateTarget(null);
              }}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar invitación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la cuenta pendiente de <strong>{cancelTarget?.email}</strong>. El terapista
              ya no podrá usar el link de invitación. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (cancelTarget) handleCancelInvitation(cancelTarget);
                setCancelTarget(null);
              }}
            >
              Cancelar invitación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InviteTherapistDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => { loadTherapists(); loadPending(); }}
      />
    </div>
  );
}
