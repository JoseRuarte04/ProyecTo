import { LayoutDashboard, Users, Calendar, Dumbbell, LogOut, Users2, ChevronDown, User, Building2 } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const baseNavItems = [
  { title: "Dashboard",  url: "/dashboard",    icon: LayoutDashboard },
  { title: "Pacientes",  url: "/patients",     icon: Users },
  { title: "Turnos",     url: "/appointments", icon: Calendar },
  { title: "Ejercicios", url: "/exercises",    icon: Dumbbell },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { workspace, teams, setWorkspace } = useWorkspace();

  const isTeamAdmin = workspace.type === "team" && workspace.isAdmin;

  const navItems = [
    ...baseNavItems,
    ...(isTeamAdmin ? [{ title: "Mi equipo", url: "/mi-equipo", icon: Users2 }] : []),
  ];

  const handleSetWorkspace = (ws: { type: "personal" } | { type: "team"; teamId: string }) => {
    setWorkspace(ws);
    navigate("/dashboard");
  };

  const workspaceLabel =
    workspace.type === "personal" ? "Personal" : workspace.teamName;

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
            <div className="flex items-center mb-3">
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
                  <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium bg-muted/60 hover:bg-muted transition-colors text-foreground">
                    {workspace.type === "personal" ? (
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    <span className="flex-1 text-left truncate">{workspaceLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuItem
                    onClick={() => handleSetWorkspace({ type: "personal" })}
                    className={workspace.type === "personal" ? "font-semibold" : ""}
                  >
                    <User className="h-4 w-4 mr-2 shrink-0" />
                    Personal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {teams.map((team) => (
                    <DropdownMenuItem
                      key={team.id}
                      onClick={() => handleSetWorkspace({ type: "team", teamId: team.id })}
                      className={
                        workspace.type === "team" && workspace.teamId === team.id
                          ? "font-semibold"
                          : ""
                      }
                    >
                      <Building2 className="h-4 w-4 mr-2 shrink-0" />
                      {team.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="font-serif text-lg font-semibold text-foreground">R</p>
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

      <SidebarFooter className="p-5 border-t border-sidebar-border">
        {!collapsed && profile && (
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-9 w-9 border border-border">
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
          className="w-full justify-start text-muted-foreground hover:text-destructive text-[13px]"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
