import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Loader2 } from "lucide-react";

export function AdminLayout() {
  const { session, loading } = useAuth();
  const isAdmin = useIsAdmin();

  // 1. Auth todavía cargando
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. Sin sesión → login
  if (!session) return <Navigate to="/login" replace />;

  // 3. Sesión activa pero query de admin todavía en curso → spinner
  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 4. Sesión activa pero no es admin → app normal
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center border-b border-border px-6 bg-card">
          <h1 className="font-medium text-sm text-foreground">Panel de Administración</h1>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
