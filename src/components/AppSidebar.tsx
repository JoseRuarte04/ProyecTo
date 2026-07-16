import { LayoutDashboard, Users, Calendar, Dumbbell, LogOut, Users2, User, Building2, ChevronsUpDown } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { title: "Dashboard",  url: "/dashboard",    icon: LayoutDashboard },
  { title: "Pacientes",  url: "/patients",     icon: Users },
  { title: "Turnos",     url: "/appointments", icon: Calendar },
  { title: "Ejercicios", url: "/exercises",    icon: Dumbbell },
  { title: "Perfil",     url: "/profile",      icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { workspace, teams, setWorkspace } = useWorkspace();

  const isTeamMode = workspace.type === "team";
  const isTeamAdmin = isTeamMode && (workspace as { type: "team"; isAdmin: boolean }).isAdmin;

  const navItems = [
    ...baseNavItems,
    ...(isTeamAdmin ? [{ title: "Mi equipo", url: "/mi-equipo", icon: Users2 }] : []),
  ];

  const handleSetWorkspace = (ws: { type: "personal" } | { type: "team"; teamId: string }) => {
    setWorkspace(ws);
    sessionStorage.setItem("workspace_chosen", "1");
    navigate("/dashboard");
  };

  const handleChangePicker = () => {
    // Limpiar la elección para volver a mostrar el picker
    sessionStorage.removeItem("workspace_chosen");
    navigate("/workspace-picker");
  };

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

  const isActive = (url: string) => {
    if (url === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        {!collapsed ? (
          <div className="px-5 pt-6 pb-3">
            {/* Logo row */}
            <div className="flex items-center mb-4">
              <div className="flex-1 min-w-0">
                <p className="font-serif text-xl font-semibold text-foreground tracking-tight">RehabOT</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground mt-0.5">
                  Clínica · Terapia Ocupacional
                </p>
              </div>
              <SidebarTrigger className="ml-2 shrink-0 text-muted-foreground hover:text-foreground" />
            </div>

            {/* Workspace switcher — solo si pertenece a al menos un equipo */}
            {teams.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                      isTeamMode
                        ? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/15"
                        : "bg-muted/60 border-transparent text-foreground hover:bg-muted"
                    )}
                  >
                    {isTeamMode ? (
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="flex-1 text-left truncate">{workspaceLabel}</span>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuItem
                    onClick={() => handleSetWorkspace({ type: "personal" })}
                    className={cn(
                      "gap-2",
                      workspace.type === "personal" ? "font-semibold" : ""
                    )}
                  >
                    <User className="h-4 w-4 shrink-0" />
                    Personal
                    {workspace.type === "personal" && (
                      <span className="ml-auto text-[10px] text-muted-foreground">activo</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {teams.map((team) => {
                    const active = workspace.type === "team" && (workspace as { teamId: string }).teamId === team.id;
                    return (
                      <DropdownMenuItem
                        key={team.id}
                        onClick={() => handleSetWorkspace({ type: "team", teamId: team.id })}
                        className={cn("gap-2", active ? "font-semibold" : "")}
                      >
                        <Building2 className="h-4 w-4 shrink-0 text-primary" />
                        {team.name}
                        {active && (
                          <span className="ml-auto text-[10px] text-muted-foreground">activo</span>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleChangePicker} className="gap-2 text-muted-foreground">
                    <ChevronsUpDown className="h-4 w-4 shrink-0" />
                    Cambiar perfil...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="font-serif text-lg font-semibold text-foreground">R</p>
            {isTeamMode && (
              <div className="h-2 w-2 rounded-full bg-primary" title={workspaceLabel} />
            )}
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="py-5">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 mb-3 text-[10px] tracking-[0.14em] uppercase text-muted-foreground font-medium">
              Trabajo
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className={`relative flex items-center rounded-lg text-[13px] transition-colors ${
                          collapsed
                            ? `justify-center p-0 ${active ? "text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/60"}`
                            : `gap-3 px-3 py-3 ${
                                active
                                  ? "border-l-[3px] border-l-primary text-foreground font-semibold"
                                  : "border-l-[3px] border-l-transparent text-sidebar-foreground font-normal hover:bg-sidebar-accent/60"
                              }`
                        }`}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.5} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Colapsado el sidebar mide 3rem: con p-5 al botón le quedaban ~8px clickeables */}
      <SidebarFooter className={cn("border-t border-sidebar-border", collapsed ? "p-1 items-center" : "p-5")}>
        {!collapsed && profile && (
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-9 w-9 border border-border">
              {profile.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name} className="object-cover" />
              )}
              <AvatarFallback className="bg-primary/8 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{profile.full_name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {profile.specialty || "T. Ocupacional"}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={signOut}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={cn(
            "text-muted-foreground hover:text-destructive text-[13px]",
            collapsed ? "h-9 w-9 shrink-0" : "w-full justify-start",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
