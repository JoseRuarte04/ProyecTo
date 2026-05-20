# Historia 4.14: Admin — Editar, desactivar y reactivar terapistas

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 5 — Frontend
**Dependencia:** Historia 4.13 aplicada (`AdminTherapists.tsx` con lista real funcionando); RPCs `admin_upsert_therapist`, `admin_deactivate_therapist`, `admin_reactivate_therapist` disponibles (Historia 4.8)
**Tipo:** Solo frontend — modifica `AdminTherapists.tsx` + crea un componente de dialog. Sin cambios de DB ni de types.ts.

---

## Historia

Como super-admin,
quiero poder editar los datos de un terapista (nombre, email, especialidad, matrícula) y activar/desactivar su acceso al sistema directamente desde la lista de terapistas,
sin navegar a otra página.

---

## Criterios de Aceptación

**AC1 — Cada fila tiene acciones: editar y toggle de estado**
- Given: super-admin ve la lista de terapistas en `/admin/therapists`
- Then: cada fila tiene una columna de acciones con:
  - Botón "Editar" (ícono lápiz) → abre modal de edición
  - Botón "Desactivar" (si activo) o "Reactivar" (si inactivo)

**AC2 — Modal de edición muestra datos actuales y permite guardar**
- Given: super-admin hace clic en "Editar" de un terapista
- When: se abre el modal
- Then: los campos (nombre, email, especialidad, matrícula) están pre-llenados con los valores actuales
- And: al hacer clic en "Guardar", llama a `admin_upsert_therapist()` y muestra toast de éxito
- And: la lista se actualiza con los nuevos datos sin re-fetch completo

**AC3 — Desactivar pide confirmación**
- Given: super-admin hace clic en "Desactivar"
- When: aparece un `AlertDialog` de confirmación
- Then: al confirmar, llama a `admin_deactivate_therapist()`, el badge del terapista pasa a "Inactivo"
- And: el botón de acción cambia a "Reactivar"

**AC4 — Reactivar es inmediato (sin confirmación)**
- Given: terapista está inactivo
- When: super-admin hace clic en "Reactivar"
- Then: llama a `admin_reactivate_therapist()` directamente, el badge pasa a "Activo"

**AC5 — Feedback de carga en botones**
- Given: cualquier acción está en progreso
- Then: el botón correspondiente muestra spinner y está deshabilitado (evita doble-click)

---

## Archivos a modificar / crear

| Acción | Archivo |
|---|---|
| MODIFICAR | `src/pages/admin/AdminTherapists.tsx` — agregar columna de acciones + integrar dialog |
| CREAR | `src/components/admin/TherapistEditDialog.tsx` |

---

## Tareas

### Task 1 — TherapistEditDialog.tsx

Archivo: `src/components/admin/TherapistEditDialog.tsx`

```typescript
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface Therapist {
  id: string;
  full_name: string;
  email: string;
  specialty: string | null;
  license_number: string | null;
}

interface Props {
  therapist: Therapist;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: Pick<Therapist, "id" | "full_name" | "email" | "specialty" | "license_number">) => void;
}

export function TherapistEditDialog({ therapist, open, onClose, onSaved }: Props) {
  const [fullName, setFullName]   = useState(therapist.full_name);
  const [email, setEmail]         = useState(therapist.email);
  const [specialty, setSpecialty] = useState(therapist.specialty ?? "");
  const [license, setLicense]     = useState(therapist.license_number ?? "");
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("admin_upsert_therapist", {
      p_user_id:   therapist.id,
      p_full_name: fullName.trim(),
      p_email:     email.trim(),
      p_specialty: specialty.trim() || null,
      p_license:   license.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Error al guardar: " + error.message);
      return;
    }
    toast.success("Datos actualizados");
    onSaved({
      id:             therapist.id,
      full_name:      fullName.trim(),
      email:          email.trim(),
      specialty:      specialty.trim() || null,
      license_number: license.trim() || null,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar terapista</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Especialidad</Label>
            <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="h-9 text-sm" placeholder="Ej: Terapia Ocupacional" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Matrícula</Label>
            <Input value={license} onChange={(e) => setLicense(e.target.value)} className="h-9 text-sm" placeholder="Ej: MN12345" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Task 2 — Modificar AdminTherapists.tsx

Agregar la columna de acciones y la lógica de activar/desactivar/modal. Se muestra solo el diff conceptual (los bloques a agregar al archivo existente):

**Imports adicionales a agregar al inicio:**
```typescript
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, UserX, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TherapistEditDialog } from "@/components/admin/TherapistEditDialog";
```

**Estado adicional a agregar (dentro del componente, junto a los existentes):**
```typescript
const [editTarget, setEditTarget]           = useState<Therapist | null>(null);
const [deactivateTarget, setDeactivateTarget] = useState<Therapist | null>(null);
const [actionLoading, setActionLoading]     = useState<string | null>(null); // id del therapist en progreso
```

**Función para desactivar/reactivar:**
```typescript
const handleToggleActive = async (t: Therapist) => {
  setActionLoading(t.id);
  const rpc = t.is_active ? "admin_deactivate_therapist" : "admin_reactivate_therapist";
  const { error } = await supabase.rpc(rpc, { p_user_id: t.id });
  setActionLoading(null);
  if (error) { toast.error("Error: " + error.message); return; }
  setTherapists((prev) =>
    prev.map((x) => x.id === t.id ? { ...x, is_active: !t.is_active } : x)
  );
  toast.success(t.is_active ? "Terapista desactivado" : "Terapista reactivado");
};
```

**Función para aplicar edición:**
```typescript
const handleSaved = (updated: Pick<Therapist, "id" | "full_name" | "email" | "specialty" | "license_number">) => {
  setTherapists((prev) =>
    prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x)
  );
};
```

**Columna de acciones en el `<thead>` (agregar después de la columna "Estado"):**
```tsx
<th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Acciones</th>
```

**Celda de acciones en cada `<tr>` (agregar después de la celda "Estado"):**
```tsx
<td className="px-4 py-3 text-right">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={actionLoading === t.id}>
        {actionLoading === t.id
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <MoreHorizontal className="h-3.5 w-3.5" />}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => setEditTarget(t)}>
        <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
      </DropdownMenuItem>
      {t.is_active ? (
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setDeactivateTarget(t)}
        >
          <UserX className="h-3.5 w-3.5 mr-2" /> Desactivar
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={() => handleToggleActive(t)}>
          <UserCheck className="h-3.5 w-3.5 mr-2" /> Reactivar
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
</td>
```

**Dialogs a agregar al final del JSX (después de la tabla, antes del cierre del fragmento):**
```tsx
{editTarget && (
  <TherapistEditDialog
    therapist={editTarget}
    open={!!editTarget}
    onClose={() => setEditTarget(null)}
    onSaved={handleSaved}
  />
)}

<AlertDialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Desactivar terapista?</AlertDialogTitle>
      <AlertDialogDescription>
        {deactivateTarget?.full_name} perderá acceso al sistema. Podrás reactivarlo en cualquier momento.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive hover:bg-destructive/90"
        onClick={() => {
          if (deactivateTarget) handleToggleActive(deactivateTarget);
          setDeactivateTarget(null);
        }}
      >
        Desactivar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### Task 3 — Verificación manual

1. En `/admin/therapists`, hacer clic en el ícono `⋯` de un terapista activo → el menú debe mostrar "Editar" y "Desactivar"
2. Hacer clic en "Editar" → el modal se abre con los campos pre-llenados → cambiar el nombre → "Guardar" → la tabla debe actualizarse sin re-fetch y aparecer un toast "Datos actualizados"
3. Hacer clic en "Desactivar" → aparece el AlertDialog → al confirmar, el badge del terapista cambia a "Inactivo" y el menú ahora muestra "Reactivar"
4. Hacer clic en "Reactivar" → sin confirmación, el badge vuelve a "Activo"
5. No debe poder desactivarse el propio usuario super-admin (esto no requiere guard en frontend — la DB lo permite, pero agregar nota en la historia para que sea considerado en iteración futura)

---

## Decisiones de Diseño

### Por qué DropdownMenu para las acciones (no botones directos en la celda)

Las tablas de admin tienden a ganar más acciones con el tiempo (ver historial, ver pacientes, etc.). Un menú contextual `DropdownMenu` es extensible sin romper el layout de la tabla. Los botones directos se quedan sin espacio con más de 2 acciones.

### Por qué "Desactivar" pide confirmación pero "Reactivar" no

Desactivar tiene efecto inmediato y visible: el terapista pierde acceso. Es una acción destructiva reversible, pero con impacto real. "Reactivar" es la acción correctiva — no tiene consecuencias negativas y no necesita fricción adicional.

### Por qué la lista se actualiza localmente (no re-fetch tras guardar)

Re-fetch implica que toda la tabla se recarga y el scroll vuelve al inicio. La actualización local (`setTherapists(prev => prev.map(...))`) mantiene la posición del scroll y es instantánea. La fuente de verdad es el servidor — si el usuario recarga la página, verá el estado real.

---

## Historia siguiente

**4.15 — Admin gestión de equipos**: `/admin/teams` con lista de equipos + formulario "Crear equipo" + `/admin/teams/:id` con detalle de miembros y pacientes del equipo.
