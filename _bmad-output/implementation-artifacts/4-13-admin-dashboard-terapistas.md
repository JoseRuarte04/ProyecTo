# Historia 4.13: Admin — Dashboard con stats + lista de terapistas

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 5 — Frontend
**Dependencia:** Historia 4.12 aplicada (AdminLayout y rutas /admin/* funcionando); RPCs `admin_get_stats()` y `admin_list_therapists()` disponibles (Historia 4.8)
**Tipo:** Solo frontend — reemplaza los placeholders de AdminDashboard.tsx y AdminTherapists.tsx. Sin cambios de DB ni de types.ts.

---

## Historia

Como super-admin,
quiero ver en `/admin/dashboard` las métricas globales del sistema y en `/admin/therapists` la lista completa de terapistas (activos e inactivos),
para tener visibilidad inmediata del estado del sistema al entrar al panel.

---

## Estado Actual

`src/pages/admin/AdminDashboard.tsx` y `src/pages/admin/AdminTherapists.tsx` son placeholders vacíos creados en la Historia 4.12.

---

## Criterios de Aceptación

**AC1 — Dashboard muestra 4 cards de stats**
- Given: super-admin navega a `/admin/dashboard`
- When: la página carga
- Then: ve 4 tarjetas: "Terapistas activos", "Pacientes totales", "Sesiones esta semana", "Equipos activos"
- And: cada tarjeta muestra el número real devuelto por `admin_get_stats()`
- And: mientras carga, las tarjetas muestran un skeleton o "—"

**AC2 — Lista de terapistas muestra activos e inactivos**
- Given: super-admin navega a `/admin/therapists`
- When: la página carga
- Then: ve una tabla/lista con `full_name`, `email`, `specialty`, `patient_count`, `team_count` y un badge de estado (Activo / Inactivo)
- And: los terapistas inactivos se muestran con el badge "Inactivo" en rojo/destructive
- And: la lista está ordenada por nombre (el ordenamiento viene de la RPC)

**AC3 — Buscador en la lista de terapistas**
- Given: super-admin está en `/admin/therapists`
- When: escribe en el buscador
- Then: la lista se filtra en cliente por `full_name` o `email` (sin re-fetch)

**AC4 — Estado vacío y de error**
- Given: no hay terapistas o la RPC falla
- Then: se muestra un mensaje apropiado (vacío: "No hay terapistas"; error: "Error al cargar")

---

## Archivos a modificar

| Acción | Archivo |
|---|---|
| REEMPLAZAR | `src/pages/admin/AdminDashboard.tsx` |
| REEMPLAZAR | `src/pages/admin/AdminTherapists.tsx` |

---

## Tareas

### Task 1 — AdminDashboard.tsx con stats reales

Archivo: `src/pages/admin/AdminDashboard.tsx`

```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, UserCheck, Calendar, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Stats {
  total_therapists: number;
  total_patients: number;
  sessions_this_week: number;
  total_teams: number;
}

const statCards = [
  { key: "total_therapists",  label: "Terapistas activos",    icon: UserCheck,  color: "text-green-600"  },
  { key: "total_patients",    label: "Pacientes totales",      icon: Users,      color: "text-blue-600"   },
  { key: "sessions_this_week",label: "Sesiones esta semana",   icon: Calendar,   color: "text-purple-600" },
  { key: "total_teams",       label: "Equipos activos",        icon: Building2,  color: "text-orange-600" },
] as const;

export default function AdminDashboard() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("admin_get_stats").then(({ data, error }) => {
      if (error) setError("Error al cargar estadísticas");
      else setStats(data as unknown as Stats);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl font-semibold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Vista global del sistema</p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              {loading ? (
                <p className="text-2xl font-bold text-foreground">—</p>
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {stats?.[key] ?? 0}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

### Task 2 — AdminTherapists.tsx con lista real

Archivo: `src/pages/admin/AdminTherapists.tsx`

```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";

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

export default function AdminTherapists() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");

  useEffect(() => {
    supabase.rpc("admin_list_therapists").then(({ data, error }) => {
      if (error) setError("Error al cargar terapistas");
      else setTherapists((data as unknown as Therapist[]) || []);
      setLoading(false);
    });
  }, []);

  const filtered = therapists.filter((t) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return t.full_name.toLowerCase().includes(term) || t.email.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground">Terapistas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{therapists.length} en total</p>
        </div>
      </div>

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
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {t.specialty || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground">{t.patient_count}</td>
                  <td className="px-4 py-3 text-center text-foreground">{t.team_count}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={t.is_active ? "default" : "destructive"} className="text-[11px]">
                      {t.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

---

### Task 3 — Verificación manual

1. Loguearse como super-admin → navegar a `/admin/dashboard`
   - Las 4 cards deben mostrar números reales (no "—" tras la carga)
2. Navegar a `/admin/therapists`
   - La tabla debe listar todos los terapistas del sistema
   - Buscar por nombre parcial — la lista debe filtrarse en tiempo real
   - Si existe algún terapista inactivo, debe aparecer con badge "Inactivo" rojo
3. Sin red (dev tools → offline): el error "Error al cargar" debe aparecer en lugar del spinner infinito

---

## Decisiones de Diseño

### Por qué el filtro de búsqueda es en cliente (no re-fetch)

La lista de terapistas de un sistema típico de TO tiene decenas de registros, no miles. Un fetch único con filtro en cliente es más simple (sin debounce, sin estados de búsqueda en la query) y la experiencia es instantánea. Si el sistema crece a cientos de terapistas, se puede agregar server-side filtering sin cambiar la interfaz.

### Por qué las columnas tienen `hidden md:table-cell` / `hidden lg:table-cell`

El panel admin se usará mayormente en desktop, pero puede abrirse en tablet. Las columnas de email y especialidad son menos críticas en pantallas chicas — ocultarlas evita overflow horizontal sin necesitar scroll horizontal o truncado agresivo.

---

## Historia siguiente

**4.14 — Admin CRUD terapistas**: botones "Editar", "Desactivar" y "Reactivar" en la lista de terapistas, con modal de edición que llama `admin_upsert_therapist`, `admin_deactivate_therapist` y `admin_reactivate_therapist`.
