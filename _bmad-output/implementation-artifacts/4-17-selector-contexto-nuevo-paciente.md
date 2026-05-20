# Historia 4.17: Selector de contexto al crear paciente

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 5 — Frontend
**Dependencia:** Historia 4.2 aplicada (`patients.team_id` existe); Historia 4.4 aplicada (RLS de patients acepta `team_id` si el usuario es miembro del equipo)
**Tipo:** Solo frontend — modifica `NewPatientForm.tsx`. Sin cambios de DB ni de types.ts.

---

## Historia

Como terapista que pertenece a uno o más equipos,
quiero que al crear un nuevo paciente pueda elegir si es un "Paciente personal" o un "Paciente del equipo X",
para que el paciente quede correctamente asignado desde el inicio y todos los miembros del equipo puedan verlo.

---

## Estado Actual

`src/components/patients/NewPatientForm.tsx` existe y funciona. Al hacer submit, inserta en `patients` con `professional_id = user.id`. No envía `team_id` (queda NULL por defecto).

El form NO debe cambiar para terapistas sin equipos — el comportamiento actual es el correcto para ellos.

---

## Criterios de Aceptación

**AC1 — Sin equipos: formulario igual que antes**
- Given: terapista no pertenece a ningún equipo
- Then: el formulario de nuevo paciente no muestra ningún selector adicional
- And: el paciente se crea con `team_id = null` (paciente personal)

**AC2 — Con equipos: selector aparece antes del formulario**
- Given: terapista pertenece a uno o más equipos
- When: navega a `/patients/new`
- Then: ve un selector encima de los campos del formulario con las opciones:
  - "Paciente personal" (valor null)
  - "Paciente de [nombre equipo]" por cada equipo al que pertenece
- And: "Paciente personal" está seleccionado por defecto

**AC3 — El team_id seleccionado se envía al crear el paciente**
- Given: terapista selecciona "Paciente de Clínica Norte"
- When: completa el formulario y hace submit
- Then: el INSERT en `patients` incluye `team_id = <id de Clínica Norte>`

**AC4 — El selector solo muestra equipos activos**
- Given: terapista pertenece a un equipo inactivo y uno activo
- Then: solo aparece el equipo activo en el selector

**AC5 — Estado de carga del selector no bloquea el formulario**
- Given: la query de equipos está cargando
- Then: el formulario muestra un skeleton mínimo en lugar del selector (no spinner de página completa)

---

## Archivos a modificar

| Acción | Archivo |
|---|---|
| MODIFICAR | `src/components/patients/NewPatientForm.tsx` |

---

## Tareas

### Task 1 — Leer el estado actual del formulario en el archivo

> El dev debe leer `NewPatientForm.tsx` completo antes de modificar para entender la estructura del `handleSubmit` y dónde inyectar el `team_id`. El archivo tiene ~350+ líneas con estado y validaciones. Los cambios son aditivos y mínimos.

---

### Task 2 — Cambios a aplicar en NewPatientForm.tsx

**Imports adicionales (al inicio del archivo):**
```typescript
import { useEffect, useState as useStateInternal } from "react";  // ya importado como useState
// Nota: el archivo ya importa useState, useEffect, useAuth, supabase — no duplicar
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
```

> Verificar que `RadioGroup` y `RadioGroupItem` existen en `src/components/ui/`. Si no existen, instalar con `npx shadcn@latest add radio-group`.

**Tipos e interfaces a agregar (después de los imports):**
```typescript
interface TeamOption {
  id: string;
  name: string;
}
```

**Estado a agregar dentro del componente (junto a los existentes):**
```typescript
const [teams, setTeams]           = useState<TeamOption[]>([]);
const [teamsLoading, setTeamsLoading] = useState(true);
const [selectedTeamId, setSelectedTeamId] = useState<string>("personal"); // "personal" o UUID
```

**Efecto para cargar equipos del terapista (agregar después del useAuth):**
```typescript
useEffect(() => {
  if (!user) return;
  supabase
    .from("team_members")
    .select("team_id, teams!inner(id, name, is_active)")
    .eq("user_id", user.id)
    .eq("teams.is_active", true)
    .then(({ data }) => {
      const opts = (data || []).map((r: any) => ({
        id:   r.teams.id   as string,
        name: r.teams.name as string,
      }));
      setTeams(opts);
      setTeamsLoading(false);
    });
}, [user]);
```

**Modificar el `handleSubmit` (o la función que hace el INSERT) para incluir `team_id`:**

Buscar la línea donde se construye el objeto a insertar en `patients`. Agregar el campo:
```typescript
team_id: selectedTeamId === "personal" ? null : selectedTeamId,
```

El objeto de insert quedará similar a:
```typescript
const { error } = await supabase.from("patients").insert({
  // ...campos existentes...
  professional_id: user.id,
  team_id: selectedTeamId === "personal" ? null : selectedTeamId,
});
```

**JSX del selector (agregar ANTES de los campos del formulario, DESPUÉS del título/header):**

```tsx
{/* Selector de contexto — solo si tiene equipos */}
{!teamsLoading && teams.length > 0 && (
  <div className="mb-6 p-4 rounded-lg border border-border bg-muted/20">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      ¿A quién pertenece este paciente?
    </p>
    <RadioGroup
      value={selectedTeamId}
      onValueChange={setSelectedTeamId}
      className="space-y-2"
    >
      <div className="flex items-center gap-2.5">
        <RadioGroupItem value="personal" id="ctx-personal" />
        <label htmlFor="ctx-personal" className="text-sm cursor-pointer">
          Paciente personal
        </label>
      </div>
      {teams.map((t) => (
        <div key={t.id} className="flex items-center gap-2.5">
          <RadioGroupItem value={t.id} id={`ctx-${t.id}`} />
          <label htmlFor={`ctx-${t.id}`} className="text-sm cursor-pointer">
            Paciente de <span className="font-medium">{t.name}</span>
          </label>
        </div>
      ))}
    </RadioGroup>
  </div>
)}

{/* Skeleton mínimo mientras carga */}
{teamsLoading && (
  <div className="mb-6 h-12 rounded-lg border border-border bg-muted/20 animate-pulse" />
)}
```

---

### Task 3 — Verificación manual

1. Loguearse como terapista **sin equipos** → `/patients/new` → el selector NO aparece → crear paciente → `patients.team_id` debe ser NULL (verificar en Supabase Studio)
2. Loguearse como terapista **con un equipo activo** → `/patients/new` → el selector aparece con "Paciente personal" + "Paciente de [equipo]"
3. Seleccionar el equipo → completar el formulario → crear → `patients.team_id` debe ser el UUID del equipo
4. Loguearse como **otro miembro del equipo** → ir a `/patients` → el paciente recién creado debe aparecer en su lista (el RLS `is_my_patient()` ahora lo permite)

---

## Decisiones de Diseño

### Por qué el selector usa `RadioGroup` y no un `<Select>`

Con 2-4 opciones visibles (personal + 1-3 equipos típicos), un `RadioGroup` es más rápido de usar — se ve todo de golpe, sin necesidad de abrir un dropdown. Es especialmente apropiado cuando "Paciente personal" es la opción frecuente y el usuario necesita decidir conscientemente si cambiarla.

### Por qué el default es siempre "Paciente personal"

Aunque el terapista pertenezca a equipos, la mayoría de sus pacientes nuevos pueden ser personales (el terapista trabaja tanto en la clínica del equipo como de forma independiente). Defaultear a "personal" evita asignaciones accidentales a un equipo. El terapista debe elegir activamente "Paciente del equipo X" cuando lo desea.

### Por qué la query filtra `teams.is_active = true`

Si el terapista pertenece a un equipo desactivado (is_active = false), sus pacientes de ese equipo ya no son accesibles vía RLS (la `is_my_patient()` lo excluye). No tiene sentido mostrar ese equipo en el selector porque el paciente quedaría asignado a un equipo sin acceso efectivo.

---

## Historia siguiente

**4.18 — Diferenciación visual de pacientes de equipo**: agregar un badge/indicador en la lista de pacientes (`Patients.tsx`) que muestre si el paciente es de equipo o personal, y el nombre del equipo.
