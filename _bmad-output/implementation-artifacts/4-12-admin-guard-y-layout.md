# Historia 4.12: Admin guard y layout base del panel /admin

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 5 — Frontend
**Dependencia:** Historia 4.8 aplicada (RPC `admin_get_stats` disponible); Historia 4.11 seed aplicado (al menos un usuario en admin_users para poder probar)
**Tipo:** Solo frontend — nuevos archivos + modificación de App.tsx. Sin cambios de DB ni de types.ts.

---

## Historia

Como super-admin,
quiero que al navegar a `/admin` aparezca un panel de administración separado de la app principal, con su propio layout y navegación,
y que si un terapista regular intenta acceder a `/admin`, sea redirigido silenciosamente a `/dashboard`.

---

## Estado Actual

`App.tsx` tiene todas las rutas dentro de `AppLayout`. No existe ninguna ruta `/admin`, ningún guard de admin, ni layout separado para administración.

`AuthContext` expone `useAuth()` con `{ session, user, profile, loading }`. No existe un hook `useIsAdmin`.

---

## Criterios de Aceptación

**AC1 — `/admin` redirige a `/admin/dashboard`**
- Given: super-admin navega a `/admin`
- Then: es redirigido automáticamente a `/admin/dashboard`

**AC2 — AdminRoute bloquea a no-admins**
- Given: terapista regular (no en admin_users) navega a `/admin/dashboard`
- When: el guard verifica `is_super_admin()`
- Then: es redirigido a `/dashboard` sin mostrar contenido de admin

**AC3 — Layout de admin es distinto del layout principal**
- Given: super-admin está en `/admin/dashboard`
- Then: NO ve el sidebar de la app principal (AppSidebar)
- And: ve una barra lateral de admin con links: "Dashboard", "Terapistas", "Equipos"
- And: ve un header con el nombre "Panel de Administración" y un link "← Volver a la app"

**AC4 — Estado de carga visible mientras se verifica la sesión**
- Given: super-admin navega a `/admin`
- When: el guard está verificando `is_super_admin()` (puede ser lento en la primera carga)
- Then: ve un spinner centrado en pantalla (igual al de AppLayout)

**AC5 — Las sub-rutas admin muestran páginas placeholder**
- Given: super-admin navega a `/admin/therapists` o `/admin/teams`
- Then: ve la página correspondiente dentro del AdminLayout (aunque sea un placeholder vacío)

---

## Archivos a crear / modificar

| Acción | Archivo |
|---|---|
| CREAR | `src/hooks/useIsAdmin.ts` |
| CREAR | `src/components/AdminLayout.tsx` |
| CREAR | `src/components/AdminSidebar.tsx` |
| CREAR | `src/pages/admin/AdminDashboard.tsx` (placeholder) |
| CREAR | `src/pages/admin/AdminTherapists.tsx` (placeholder) |
| CREAR | `src/pages/admin/AdminTeams.tsx` (placeholder) |
| MODIFICAR | `src/App.tsx` — agregar rutas `/admin/*` |

---

## Tareas

### Task 1 — Hook `useIsAdmin`

Archivo: `src/hooks/useIsAdmin.ts`

```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = cargando

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }
    supabase.rpc("is_super_admin").then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [session]);

  return isAdmin;
}
```

> **Nota**: `null` representa el estado de carga (antes de que la RPC responda). El componente `AdminRoute` muestra spinner mientras `isAdmin === null`.

---

### Task 2 — AdminLayout + AdminSidebar

Archivo: `src/components/AdminSidebar.tsx`

```typescript
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Building2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Terapistas",  url: "/admin/therapists",  icon: Users },
  { title: "Equipos",     url: "/admin/teams",        icon: Building2 },
];

export function AdminSidebar() {
  const navigate = useNavigate();

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
          className="w-full justify-start text-muted-foreground text-[13px]"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a la app
        </Button>
      </div>
    </aside>
  );
}
```

Archivo: `src/components/AdminLayout.tsx`

```typescript
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Loader2 } from "lucide-react";

export function AdminLayout() {
  const { session, loading } = useAuth();
  const isAdmin = useIsAdmin();

  // Auth loading
  if (loading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin)  return <Navigate to="/dashboard" replace />;

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
```

---

### Task 3 — Páginas placeholder para rutas admin

Archivo: `src/pages/admin/AdminDashboard.tsx`

```typescript
export default function AdminDashboard() {
  return (
    <div>
      <h2 className="font-serif text-xl font-semibold text-foreground mb-1">Dashboard</h2>
      <p className="text-sm text-muted-foreground">Estadísticas globales del sistema.</p>
    </div>
  );
}
```

Archivo: `src/pages/admin/AdminTherapists.tsx`

```typescript
export default function AdminTherapists() {
  return (
    <div>
      <h2 className="font-serif text-xl font-semibold text-foreground mb-1">Terapistas</h2>
      <p className="text-sm text-muted-foreground">Gestión de terapistas del sistema.</p>
    </div>
  );
}
```

Archivo: `src/pages/admin/AdminTeams.tsx`

```typescript
export default function AdminTeams() {
  return (
    <div>
      <h2 className="font-serif text-xl font-semibold text-foreground mb-1">Equipos</h2>
      <p className="text-sm text-muted-foreground">Gestión de equipos.</p>
    </div>
  );
}
```

---

### Task 4 — Modificar `App.tsx`

Agregar imports y rutas `/admin/*`. El resto del archivo no cambia.

**Imports a agregar** (después de los imports existentes):
```typescript
import { AdminLayout } from "@/components/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTherapists from "./pages/admin/AdminTherapists";
import AdminTeams from "./pages/admin/AdminTeams";
```

**Rutas a agregar** (dentro de `<Routes>`, después de la ruta `path="/plan/:token"`):
```typescript
<Route path="/admin" element={<AdminLayout />}>
  <Route index element={<Navigate to="/admin/dashboard" replace />} />
  <Route path="dashboard"   element={<AdminDashboard />} />
  <Route path="therapists"  element={<AdminTherapists />} />
  <Route path="teams"       element={<AdminTeams />} />
  <Route path="teams/:id"   element={<AdminTeams />} />
</Route>
```

> `teams/:id` reutiliza `AdminTeams` temporalmente. La Historia 4.15 creará `AdminTeamDetail.tsx` separado.

---

### Task 5 — Verificación manual

1. Compilar sin errores: `npm run build` (o el dev server)
2. Loguearse como terapista regular → navegar a `/admin/dashboard` → debe redirigir a `/dashboard`
3. Loguearse como super-admin → navegar a `/admin` → debe llegar a `/admin/dashboard` con el AdminLayout
4. Verificar que el link "Volver a la app" lleva a `/dashboard`
5. Navegar entre `/admin/therapists` y `/admin/teams` — ambas páginas deben cargarse con el sidebar activo correcto

---

## Decisiones de Diseño

### Por qué `useIsAdmin` devuelve `null` (no `false`) mientras carga

El guard necesita tres estados posibles: cargando, no-admin, admin. Si devolviera `false` mientras carga, el guard redirigiría prematuramente a `/dashboard` antes de que la RPC responda — efecto de parpadeo ("flash of unauthorized content"). Con `null`, el spinner se muestra hasta tener certeza.

### Por qué AdminLayout es un componente separado (no una variante de AppLayout)

AppLayout usa `SidebarProvider` y `AppSidebar` del sistema de sidebar de shadcn/ui. AdminLayout tiene una barra lateral más simple (no colapsable, no necesita el contexto de sidebar). Mezclarlos crearía acoplamiento innecesario y haría difícil diferenciar visualmente ambos contextos.

### Por qué las páginas admin viven en `src/pages/admin/`

Convencion de carpetas: páginas de la app principal en `src/pages/`, páginas de admin en `src/pages/admin/`. Esto facilita encontrarlas y no mezclarlas con las páginas regulares.

---

## Historia siguiente

**4.13 — Admin dashboard de terapistas**: implementa `/admin/dashboard` con stats reales (`admin_get_stats`) y `/admin/therapists` con la tabla de terapistas (`admin_list_therapists`).
