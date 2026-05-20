# Historia 4.18: Diferenciación visual de pacientes de equipo

**Status:** ready-for-dev
**Épico:** 4 — Roles, Equipos y Panel de Administración
**Fase:** 5 — Frontend (última historia del épico)
**Dependencia:** Historia 4.17 aplicada (pacientes ya pueden tener `team_id`); Historia 4.4 aplicada (RLS permite ver pacientes del equipo)
**Tipo:** Solo frontend — modifica `Patients.tsx`. Sin cambios de DB ni de types.ts.

---

## Historia

Como terapista miembro de un equipo,
quiero ver de un vistazo en la lista de pacientes cuáles son míos y cuáles son de mi equipo,
para entender el origen de cada paciente sin tener que entrar a su perfil.

---

## Estado Actual

`src/pages/Patients.tsx` lista pacientes con `id, first_name, last_name, dni, status, insurance, admission_date, therapy_sessions(session_date, is_deleted)`. No incluye `team_id` ni el nombre del equipo.

Todos los pacientes se ven iguales visualmente, sin distinción entre "míos" y "del equipo".

---

## Criterios de Aceptación

**AC1 — La query incluye el nombre del equipo**
- Given: la query de pacientes se ejecuta
- Then: incluye `team_id, teams(name)` en el select de Supabase
- And: funciona correctamente para pacientes sin equipo (`team_id = null`, join devuelve null)

**AC2 — Badge "Equipo [nombre]" visible en cada paciente del equipo**
- Given: paciente P tiene `team_id != null`
- Then: en la fila/card de P aparece un badge compacto con el nombre del equipo
- And: el badge se muestra junto al nombre del paciente o debajo de él (sin romper el layout)

**AC3 — Pacientes personales no tienen badge**
- Given: paciente con `team_id = null`
- Then: no aparece ningún badge ni indicador adicional (comportamiento actual preservado)

**AC4 — Filtro de pestañas sigue funcionando**
- Given: se agrega la info de equipo a la query
- Then: los filtros de status (Todos, Activos, Pausados, Alta) siguen filtrando correctamente

**AC5 — Buscador incluye el nombre del equipo**
- Given: terapista busca por nombre de equipo ("Norte")
- Then: los pacientes de "Clínica Norte" aparecen en los resultados

---

## Archivos a modificar

| Acción | Archivo |
|---|---|
| MODIFICAR | `src/pages/Patients.tsx` |

---

## Tareas

### Task 1 — Actualizar la query para incluir el equipo

En `fetchPatients()`, la query actual es:
```typescript
supabase
  .from("patients")
  .select("id, first_name, last_name, dni, status, insurance, admission_date, therapy_sessions(session_date, is_deleted)")
  .eq("is_deleted", false)
  .order("last_name", { ascending: true });
```

Cambiar el `.select()` para incluir el join con teams:
```typescript
.select("id, first_name, last_name, dni, status, insurance, admission_date, team_id, teams(name), therapy_sessions(session_date, is_deleted)")
```

El join `teams(name)` es LEFT JOIN implícito en Supabase — pacientes sin `team_id` devolverán `teams: null`, no causarán error.

---

### Task 2 — Actualizar el filtro del buscador

El buscador actual filtra por `first_name`, `last_name`, `dni`. Agregar el nombre del equipo:

```typescript
const filtered = patients.filter((p) => {
  if (!search) return true;
  const term = search.toLowerCase();
  const teamName = (p.teams as { name: string } | null)?.name?.toLowerCase() ?? "";
  return (
    p.first_name?.toLowerCase().includes(term) ||
    p.last_name?.toLowerCase().includes(term) ||
    p.dni?.toLowerCase().includes(term) ||
    teamName.includes(term)
  );
});
```

---

### Task 3 — Agregar el badge en el JSX de cada paciente

Localizar en `Patients.tsx` el JSX que renderiza cada fila/card de paciente. Buscar donde se muestra el nombre del paciente (`first_name`, `last_name`) y agregar el badge a continuación.

El componente de badge a insertar:
```tsx
{p.teams && (
  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary/80 bg-primary/8 border border-primary/20 rounded-full px-2 py-0.5">
    {(p.teams as { name: string }).name}
  </span>
)}
```

> Usar un `<span>` con estilos inline en lugar de `<Badge>` de shadcn para que sea más compacto y no ocupe una línea entera. Ajustar colores si el tema del proyecto difiere.

El bloque de nombre del paciente quedará similar a:
```tsx
<div className="flex items-center gap-2 flex-wrap">
  <p className="font-medium text-foreground">
    {p.last_name}, {p.first_name}
  </p>
  {p.teams && (
    <span className="inline-flex items-center text-[10px] font-medium text-primary/80 bg-primary/8 border border-primary/20 rounded-full px-2 py-0.5">
      {(p.teams as { name: string }).name}
    </span>
  )}
</div>
```

> El dev debe ubicar exactamente dónde está el nombre del paciente en el JSX actual y aplicar el cambio ahí. El HTML exacto depende del layout actual de `Patients.tsx` que puede haber cambiado.

---

### Task 4 — Verificación manual

1. Como terapista miembro de un equipo, ir a `/patients` → los pacientes del equipo deben mostrar el badge con el nombre del equipo
2. Los propios pacientes (sin equipo) no deben tener badge
3. Buscar por nombre del equipo → los pacientes de ese equipo deben aparecer en los resultados
4. Los filtros de status (Activos, Pausados, Alta) siguen funcionando correctamente
5. Verificar que no hay regresión para terapistas sin equipos: su lista de pacientes se ve igual que antes

---

## Decisiones de Diseño

### Por qué un `<span>` inline y no el componente `<Badge>` de shadcn

`<Badge>` ocupa espacio vertical significativo si hay múltiples elementos en una fila. Un `<span>` inline-flex permite que el badge quede al lado del nombre sin saltar de línea, manteniendo el layout denso de la lista de pacientes.

### Por qué solo mostrar el nombre del equipo (no "Equipo de: X")

El contexto es claro — solo los pacientes de equipo tienen el badge. El prefijo "Equipo de:" sería redundante. La brevedad mejora la legibilidad en una lista con muchas filas.

### Por qué no agregar un filtro de pestaña "Del equipo"

Los filtros actuales son por status clínico (activo, pausado, alta). Un filtro por "del equipo vs personal" es una dimensión diferente que mezclaría conceptos. Si se necesita en el futuro, se puede agregar como un filtro secundario o un dropdown adicional. Por ahora, el badge visual es suficiente para el MVP.

---

## Hito: Épico 4 completado

Con esta historia aplicada, el Épico 4 está completo:

✅ **Fase 1** — Tablas base (teams, team_members, team_invitations, admin_users, patients.team_id, audit_log.changes)  
✅ **Fase 2** — Funciones helper (is_super_admin, is_team_member, is_team_admin) + is_my_patient actualizada + RLS de todas las tablas  
✅ **Fase 3** — Auditoría extendida con triggers UPDATE + insert_audit_log con changes  
✅ **Fase 4** — RPCs admin (terapistas y equipos) + RPCs de equipo + RPCs existentes actualizadas + seed  
✅ **Fase 5** — Frontend: AdminLayout + guard + dashboard + lista terapistas con CRUD + gestión de equipos + "Mi equipo" + selector al crear paciente + diferenciación visual  

El sistema de roles, equipos y panel de administración está completo.
