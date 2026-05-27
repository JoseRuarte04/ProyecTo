import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Building2, LogOut, Activity, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const adminNavItems = [
  { title: "Dashboard",   url: "/admin/dashboard",   icon: LayoutDashboard },
  { title: "Terapistas",  url: "/admin/therapists",  icon: Users },
  { title: "Equipos",     url: "/admin/teams",        icon: Building2 },
  { title: "Pacientes",   url: "/admin/patients",     icon: UsersRound },
  { title: "Actividad",   url: "/admin/activity",     icon: Activity },
];

export function AdminSidebar() {
  const { signOut, profile } = useAuth();

  const initials = profile?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "SA";

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card min-h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <p className="font-serif text-base font-semibold text-foreground">Panel Admin</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">RehabOT</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {adminNavItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.title}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-3">
        {/* Info del admin logueado */}
        {profile && (
          <div className="flex items-center gap-2.5 px-1">
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-foreground truncate">{profile.full_name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground text-[13px] hover:text-destructive hover:bg-destructive/10"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
