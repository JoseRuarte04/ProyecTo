import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { Loader2, Building2, X } from "lucide-react";

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export function AppLayout() {
  const { session, loading: authLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const { workspace, teams, loading: wsLoading, setWorkspace } = useWorkspace();
  const navigate = useNavigate();

  if (authLoading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (isAdmin === null) return <Spinner />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  // Esperar a que carguen los equipos antes de decidir si mostrar el picker
  if (wsLoading) return <Spinner />;

  // Si tiene equipos y no eligió workspace esta sesión → picker
  if (teams.length > 0 && !sessionStorage.getItem("workspace_chosen")) {
    return <Navigate to="/workspace-picker" replace />;
  }

  const isTeamMode = workspace.type === "team";

  const handleLeaveTeam = () => {
    setWorkspace({ type: "personal" });
    navigate("/dashboard");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header mobile */}
          <header className="h-14 flex items-center border-b border-border px-4 bg-card lg:hidden gap-3">
            <SidebarTrigger />
            <span className="font-semibold text-foreground flex-1">RehabOT</span>
            {isTeamMode && (
              <div className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[120px]">
                  {(workspace as { type: "team"; teamName: string }).teamName}
                </span>
                <button
                  onClick={handleLeaveTeam}
                  className="ml-0.5 hover:text-primary/60 transition-colors"
                  aria-label="Volver a personal"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}
