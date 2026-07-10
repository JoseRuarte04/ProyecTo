import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { LayoutDashboard, Users, Calendar, Dumbbell, Plus, User, CalendarCheck } from "lucide-react";
import { StatusDot } from "@/components/status";

// Evento global para abrir la paleta desde cualquier botón (ej. "Buscar" del Dashboard)
export const OPEN_COMMAND_PALETTE_EVENT = "open-command-palette";
export const openCommandPalette = () =>
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));

const NAV_ITEMS = [
  { label: "Dashboard",               url: "/dashboard",    icon: LayoutDashboard },
  { label: "Pacientes",               url: "/patients",     icon: Users },
  { label: "Turnos",                  url: "/appointments", icon: Calendar },
  { label: "Biblioteca de Ejercicios", url: "/exercises",   icon: Dumbbell },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  // Atajo de teclado + evento global
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpenEvent = () => setOpen(true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  // Pacientes del workspace actual — se cargan recién al abrir la paleta
  const { data: patients = [] } = useQuery({
    queryKey: ["command-palette-patients", workspace.type, workspace.type === "team" ? workspace.teamId : user?.id],
    enabled: open && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("patients")
        .select("id, first_name, last_name, dni, status")
        .eq("is_deleted", false)
        .order("last_name");
      if (workspace.type === "personal") q = q.eq("professional_id", user!.id);
      else q = q.eq("team_id", workspace.teamId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const go = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar pacientes o ir a una sección..." />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        {patients.length > 0 && (
          <CommandGroup heading="Pacientes">
            {patients.map((p) => (
              <CommandItem
                key={p.id}
                value={`${p.last_name} ${p.first_name} ${p.dni ?? ""}`}
                onSelect={() => go(`/patients/${p.id}`)}
                className="gap-3"
              >
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">
                  {p.last_name}, {p.first_name}
                  {p.dni && <span className="text-muted-foreground text-xs ml-2">DNI {p.dni}</span>}
                </span>
                <StatusDot status={p.status} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Acciones">
          <CommandItem value="nuevo paciente crear" onSelect={() => go("/patients/new")} className="gap-3">
            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
            Nuevo paciente
          </CommandItem>
          <CommandItem value="nuevo turno agendar" onSelect={() => go("/appointments")} className="gap-3">
            <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            Nuevo turno
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ir a">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.url}
              value={`ir ${item.label}`}
              onSelect={() => go(item.url)}
              className="gap-3"
            >
              <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
