import { useState } from "react";
import { LayoutDashboard, Users, Calendar, Dumbbell, MoreHorizontal, User, Users2, Building2, LogOut, ChevronsUpDown } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const tabItems = [
  { title: "Dashboard",  url: "/dashboard",    icon: LayoutDashboard },
  { title: "Pacientes",  url: "/patients",     icon: Users },
  { title: "Turnos",     url: "/appointments", icon: Calendar },
  { title: "Ejercicios", url: "/exercises",    icon: Dumbbell },
];

export function AppBottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { workspace, teams, setWorkspace } = useWorkspace();
  const [moreOpen, setMoreOpen] = useState(false);

  const isTeamMode = workspace.type === "team";
  const isTeamAdmin = isTeamMode && (workspace as { type: "team"; isAdmin: boolean }).isAdmin;

  const isActive = (url: string) => {
    if (url === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(url);
  };

  const moreActive = pathname.startsWith("/profile") || pathname.startsWith("/mi-equipo");

  const workspaceLabel =
    workspace.type === "personal"
      ? "Personal"
      : (workspace as { type: "team"; teamName: string }).teamName;

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "TO";

  const handleSetWorkspace = (ws: { type: "personal" } | { type: "team"; teamId: string }) => {
    setWorkspace(ws);
    sessionStorage.setItem("workspace_chosen", "1");
    setMoreOpen(false);
    navigate("/dashboard");
  };

  const goTo = (url: string) => {
    setMoreOpen(false);
    navigate(url);
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabItems.map((item) => {
          const active = isActive(item.url);
          return (
            <NavLink
              key={item.title}
              to={item.url}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              {item.title}
            </NavLink>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
            moreActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={moreActive ? 2.25 : 1.75} />
          Más
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Más</SheetTitle>
          </SheetHeader>

          {profile && (
            <button
              onClick={() => goTo("/profile")}
              className="flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left"
            >
              <Avatar className="h-10 w-10 border border-border">
                {profile.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} className="object-cover" />
                )}
                <AvatarFallback className="bg-primary/8 text-primary text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">Ver perfil</p>
              </div>
            </button>
          )}

          {teams.length > 0 && (
            <div className="border-b border-border px-5 py-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Espacio de trabajo
              </p>
              <div className="space-y-1">
                <button
                  onClick={() => handleSetWorkspace({ type: "personal" })}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                    workspace.type === "personal" ? "bg-primary/10 text-primary font-medium" : "text-foreground",
                  )}
                >
                  <User className="h-4 w-4 shrink-0" />
                  Personal
                </button>
                {teams.map((team) => {
                  const active = workspace.type === "team" && (workspace as { teamId: string }).teamId === team.id;
                  return (
                    <button
                      key={team.id}
                      onClick={() => handleSetWorkspace({ type: "team", teamId: team.id })}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                        active ? "bg-primary/10 text-primary font-medium" : "text-foreground",
                      )}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      {team.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="px-5 py-3">
            {isTeamAdmin && (
              <button
                onClick={() => goTo("/mi-equipo")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground"
              >
                <Users2 className="h-4 w-4 shrink-0" />
                Mi equipo
              </button>
            )}
            <button
              onClick={() => {
                setMoreOpen(false);
                signOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
