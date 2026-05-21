import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Building2, LogOut, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const adminNavItems = [
  { title: "Dashboard",  url: "/admin/dashboard",  icon: LayoutDashboard },
  { title: "Terapistas", url: "/admin/therapists", icon: Users },
  { title: "Equipos",    url: "/admin/teams",      icon: Building2 },
  { title: "Actividad",  url: "/admin/activity",   icon: Activity },
];

export function AdminSidebar() {
  const { signOut } = useAuth();

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

      <div className="p-4 border-t border-border">
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
