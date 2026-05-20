---
stepsCompleted: [1, 2, 3, 4, 5, 6]
documentsIncluded:
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/planning-artifacts/architecture-quickdash-externo.md"
  - "_bmad-output/planning-artifacts/architecture-dashboard-evolucion.md"
  - "_bmad-output/project-context.md"
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-18
**Project:** RehabOT

## Document Inventory

| Tipo | Archivo | Estado |
|---|---|---|
| Epics & Stories | `epics.md` | ✅ Encontrado |
| UX Design | `ux-design-specification.md` | ✅ Encontrado |
| Arquitectura (referencia) | `architecture-quickdash-externo.md` | ✅ Encontrado (feature ya implementada) |
| Arquitectura (referencia) | `architecture-dashboard-evolucion.md` | ✅ Encontrado (feature pendiente — fuera del scope actual) |
| Project Context | `project-context.md` | ✅ Encontrado |
| PRD | — | ⚠️ No existe (scope definido directamente en epics.md) |

## PRD Analysis

> **Nota:** No existe PRD formal. Los requerimientos fueron extraídos del scope declarado por el usuario y documentados en `epics.md`. Se usan como fuente de verdad los FRs, NFRs y requerimientos adicionales del documento de epics.

### Functional Requirements (fuente: epics.md)

FR1: Crear, editar y eliminar apartados de la biblioteca (`exercise_body_regions`) con nombre configurable.
FR2: Agregar campos a `exercise_library`: `body_region_id`, `exercise_type` (enum), `starting_position`, `precautions`, `equipment`, `suggested_sets`, `suggested_reps`.
FR3: UI con panel izquierdo de apartados navegables.
FR4: Dentro de cada apartado: 3 tabs (Activos / Activos asistidos / Fortalecimiento).
FR5: Ejercicios como cards con datos relevantes.
FR6: Crear y editar ejercicios con todos los campos nuevos + URL de video con preview YouTube.
FR7: Eliminar ejercicios de la biblioteca.
FR8: Exportación a PDF funcional con nuevos campos.
FR9: Eliminar UI vieja de categorías.
FR10: Nuevo tab "Ejercicios" en perfil del paciente.
FR11: Crear plan con dosificación por ejercicio (series, reps, frecuencia, notas).
FR12: Reordenar ejercicios del plan.
FR13: Vista del plan con dosificación asignada.
FR14: Generar token UUID con expiración configurable.
FR15: Página pública sin auth con plan completo (instrucciones, video, dosificación).
FR16: Estado activo / expirado / revocado del link.
FR17: Gestión y revocación de links desde el perfil del paciente.

**Total FRs: 17**

### Non-Functional Requirements (fuente: epics.md)

NFR1: Seguridad / Multi-tenancy — RLS en todas las tablas nuevas + RPCs con SECURITY DEFINER para acceso anónimo.
NFR2: Privacidad — la página pública no expone nombre del paciente ni datos de sesión.
NFR3: Sin dependencias nuevas — solo librerías ya instaladas.
NFR4: PDF — patrón existente html2canvas + jsPDF, nuevos campos incluidos.
NFR5: Notificaciones — solo `toast` de `sonner`.
NFR6: Compatibilidad — soporte desktop y tablet desde 768px.

**Total NFRs: 6**

### Additional Requirements

- Sistema de tokens sigue el patrón de `quickdash_tokens` (referencia en codebase)
- Tipos TypeScript de tablas nuevas actualizados manualmente en `types.ts`
- `.maybeSingle()` para queries donde el registro puede no existir
- `createPortal` si hay dropdowns dentro de modales
- `order_index` para persistir orden de ejercicios en el plan
- Página pública registrada en `App.tsx` fuera de `<AppLayout>`

## Epic Coverage Validation

### Coverage Matrix

| FR | Requerimiento | Epic / Story | Estado |
|---|---|---|---|
| FR1 | CRUD apartados de biblioteca | Epic 1 / Story 1.1 | ✅ Cubierto |
| FR2 | Nuevos campos en `exercise_library` | Epic 1 / Story 1.2 | ✅ Cubierto |
| FR3 | Panel izquierdo de apartados | Epic 1 / Story 1.3 | ✅ Cubierto |
| FR4 | Tabs Activos / AA / Fortalecimiento | Epic 1 / Story 1.3 | ✅ Cubierto |
| FR5 | Cards de ejercicios | Epic 1 / Story 1.3 | ✅ Cubierto |
| FR6 | Formulario completo + preview YouTube | Epic 1 / Story 1.2 | ✅ Cubierto |
| FR7 | Eliminar ejercicios | Epic 1 / Story 1.2 | ✅ Cubierto |
| FR8 | Exportación PDF con campos nuevos | Epic 1 / Story 1.4 | ✅ Cubierto |
| FR9 | Eliminar UI vieja de categorías | Epic 1 / Story 1.3 | ✅ Cubierto |
| FR10 | Tab "Ejercicios" en perfil del paciente | Epic 2 / Story 2.1 | ✅ Cubierto |
| FR11 | Crear plan con dosificación | Epic 2 / Story 2.1 | ✅ Cubierto |
| FR12 | Reordenar ejercicios del plan | Epic 2 / Story 2.2 | ✅ Cubierto |
| FR13 | Vista del plan con dosificación | Epic 2 / Story 2.1 | ✅ Cubierto |
| FR14 | Generar token con expiración | Epic 3 / Story 3.1 | ✅ Cubierto |
| FR15 | Página pública sin auth | Epic 3 / Story 3.2 | ✅ Cubierto |
| FR16 | Estado activo / expirado / revocado | Epic 3 / Story 3.1 + 3.2 | ✅ Cubierto |
| FR17 | Gestión y revocación de links | Epic 3 / Story 3.1 | ✅ Cubierto |

### Missing Requirements

Ninguno.

### Coverage Statistics

- Total FRs: 17
- FRs cubiertos en epics: 17
- **Cobertura: 100%**

## UX Alignment Assessment

### UX Document Status

✅ Encontrado: `ux-design-specification.md` (2026-05-06)

### Observación crítica: Scope del UX doc vs. scope actual

⚠️ **El UX spec existente cubre una feature diferente** — describe las "Páginas de Evaluación Dedicadas" (SessionCard + AnalyticalEvaluationPage + FunctionalEvaluationPage), que NO forman parte de los Epics 1-3 actualmente planificados.

Los 3 epics actuales (biblioteca de ejercicios, plan de paciente, link compartible) **no tienen un UX spec dedicado**. Sin embargo, esto no es bloqueante por las siguientes razones:

1. **Sistema de diseño establecido**: `project-context.md` documenta todos los patrones de UI aplicables (tokens semánticos Tailwind, Shadcn/ui, lucide-react, patrón de tabs con subrayado, notificaciones con `sonner`).
2. **Patrón de referencia explícito en epics**: Epic 3 referencia `QuickDashTokenManager` como modelo visual exacto. Epic 1 tiene layout two-panel descrito con suficiente detalle.
3. **UX-DRs capturados**: Los requerimientos de UX para los 3 epics fueron documentados como UX-DR1–UX-DR10 en `epics.md`.

### Alignment Issues

| Aspecto | Estado | Nota |
|---|---|---|
| Sistema de diseño (tokens, componentes) | ✅ Alineado | `project-context.md` + Shadcn/ui |
| Patrones de navegación | ✅ Alineado | `useNavigate()`, rutas en `App.tsx` |
| Patrón de tokens compartibles | ✅ Alineado | Referencia explícita a `quickdash_tokens` |
| UX de página pública (Epic 3) | ✅ Alineado | UX-DR6/7 + patrón `QuickDashPublicPage.tsx` |
| UX específico biblioteca two-panel | ⚠️ Sin mockup | Suficientemente descrito en UX-DR1–3 y epics |

### Warnings

- ⚠️ No existe UX spec dedicado para los 3 epics actuales. El riesgo es bajo porque el sistema de diseño está consolidado y los patrones existentes son referencia directa. Se recomienda que el agente de dev consulte `project-context.md` antes de implementar cualquier componente de UI.

## Epic Quality Review

### Checklist por Epic

| Check | Epic 1 | Epic 2 | Epic 3 |
|---|---|---|---|
| Entrega valor al usuario | ✅ | ✅ | ✅ |
| Funciona de forma independiente | ✅ | ✅ (requiere E1) | ✅ (requiere E2) |
| Stories con tamaño apropiado | ✅ | ⚠️ Ver Issue #2 | ✅ |
| Sin dependencias hacia adelante | ✅ | ✅ | ✅ |
| Tablas creadas cuando se necesitan | ✅ | ✅ | ✅ |
| Criterios de aceptación claros | ✅ | ⚠️ Ver Issue #3 | ✅ |
| Trazabilidad a FRs mantenida | ✅ | ✅ | ✅ |
| Proyecto brownfield correctamente tratado | ✅ | ✅ | ✅ |

---

### 🟠 Issue #1 — MAYOR: FK sin política ON DELETE definida para ejercicios en planes (Story 1.2 + Story 2.1)

**Afecta:** Story 1.2 (eliminar ejercicio) + Story 2.1 (FK `exercise_plan_items.exercise_id`)

**Problema:** Story 1.2 permite eliminar ejercicios de la biblioteca. Cuando Epic 2 esté implementado, `exercise_plan_items.exercise_id` es FK a `exercise_library`. Eliminar un ejercicio que está en el plan de un paciente causará:
- Con `ON DELETE CASCADE`: el ítem del plan desaparece silenciosamente (dato clínico perdido sin aviso)
- Con `ON DELETE RESTRICT` (default): error 500 no manejado en la UI
- Sin decisión explícita: comportamiento indefinido

**Recomendación:** En Story 2.1, definir la FK con `ON DELETE RESTRICT`. Actualizar el AC de Story 1.2 para manejar este caso: *"Si el ejercicio está incluido en el plan de al menos un paciente, mostrar error explicativo y no permitir la eliminación."*

---

### 🟠 Issue #2 — MAYOR: Story 2.1 potencialmente sobredimensionada

**Afecta:** Story 2.1

**Problema:** La story cubre en una sola entrega: 2 migraciones SQL + RLS + nuevo tab en PatientProfile + empty state + create plan + add exercise (con buscador) + dosage form + view plan + edit dosage + delete con confirmación. Son 8-10 interacciones de UI distintas más una migración.

**Recomendación:** Considerar split:
- **Story 2.1**: DB migration + Tab "Ejercicios" + Create plan + View plan (flujo básico funcional)
- **Story 2.2** (nueva): Add exercise to existing plan + Edit dosage + Delete exercise from plan
- **Story 2.3** (actual 2.2): Reordenamiento

Esto garantiza que cada story sea completable en una sesión sin comprometer la independencia.

---

### 🟡 Issue #3 — MENOR: AC ambiguo en Story 1.3 para ejercicios sin apartado

**Afecta:** Story 1.3

**Problema:** El AC dice "aparecen bajo un apartado 'Sin apartado' **o** en una vista 'Todos'". El "o" hace que el criterio no sea testeablemente determinístico. El agente de dev tomará una decisión arbitraria.

**Recomendación:** Especificar una sola opción. Sugerencia: apartado "Sin apartado" al final de la lista del panel izquierdo (más consistente con el modelo mental de la UI).

---

### 🟡 Issue #4 — MENOR: Story 3.1 no define si puede haber múltiples links activos simultáneos

**Afecta:** Story 3.1

**Problema:** El patrón `quickdash_tokens` invalida tokens previos antes de crear uno nuevo. Para el plan de ejercicios no está definido: ¿puede el terapeuta tener varios links activos del mismo plan al mismo tiempo (ej: envió a WhatsApp y al email)?

**Recomendación:** Decidir explícitamente. Opciones:
- **A** (como quickdash): Generar un nuevo link invalida los anteriores activos → agrega AC a Story 3.1
- **B** (múltiples activos): Permitir N links activos → simplifica la RPC pero complica la UI de gestión

---

### 🟡 Issue #5 — MENOR: Story 2.1 sin AC de manejo de error de guardado

**Afecta:** Story 2.1

**Problema:** No hay AC para el caso en que el guardado del plan falle (error de red, timeout Supabase). Sin este AC, el agente podría dejar la UI en estado inconsistente.

**Recomendación:** Agregar: *"Given un error al guardar el plan, When el submit falla, Then se muestra un toast de error con `sonner` y el formulario queda editable para reintentar."*

---

### Resumen de hallazgos

| Severidad | Cantidad | Bloqueante para implementación |
|---|---|---|
| 🔴 Crítico | 0 | — |
| 🟠 Mayor | 2 | Recomendado resolver antes de implementar |
| 🟡 Menor | 3 | Resolver antes de ejecutar la story afectada |

---

## Summary and Recommendations

### Overall Readiness Status

### ⚠️ NECESITA AJUSTES MENORES — Listo para implementar después de resolver Issues #1 y #2

No hay problemas críticos. Los 5 issues encontrados son todos resolvibles con ajustes puntuales a `epics.md` antes de arrancar. El proyecto tiene un stack técnico maduro, patrones de referencia explícitos en el codebase, y cobertura del 100% de los 17 FRs.

---

### Acciones recomendadas antes de Sprint Planning

**1. Resolver Issue #1 — Política FK al eliminar ejercicios (Story 1.2 + 2.1)**
Agregar a Story 2.1: `exercise_plan_items.exercise_id` con `ON DELETE RESTRICT`.
Agregar a Story 1.2: AC para el caso de ejercicio en uso → mostrar error explicativo, bloquear eliminación.

**2. Resolver Issue #2 — Dividir Story 2.1 en dos stories**
- Story 2.1: DB migration + Tab "Ejercicios" + Create plan + View plan
- Story 2.2 (nueva): Add exercise to existing plan + Edit dosage + Delete exercise from plan
- Story 2.3 (actual 2.2): Reordenamiento
- Story 2.4 (actual — renumerar si aplica)

**3. Resolver Issue #3 — Clarificar AC de Story 1.3**
Reemplazar "Sin apartado **o** 'Todos'" por una sola opción. Decisión sugerida: apartado "Sin apartado" al pie del panel izquierdo.

**4. Resolver Issue #4 — Definir política de links múltiples activos (Story 3.1)**
Decidir explícitamente: ¿un solo link activo a la vez (como quickdash) o múltiples? Agregar AC correspondiente.

**5. Resolver Issue #5 — AC de error de guardado en Story 2.1**
Agregar: *"Given un error al guardar, Then se muestra toast de error y el formulario queda editable."*

---

### Estado por Epic

| Epic | Estado | Listo para dev |
|---|---|---|
| Epic 1: Biblioteca de Ejercicios | ⚠️ Issues #1 (parcial), #3 | Con ajuste puntual |
| Epic 2: Plan del Paciente | ⚠️ Issues #1, #2, #5 | Requiere ajustes antes |
| Epic 3: Link Compartible | ⚠️ Issue #4 | Con decisión de diseño |

---

### Final Note

Esta evaluación identificó **5 issues** (0 críticos, 2 mayores, 3 menores). Los issues #1 y #2 son los más importantes y deben resolverse antes de comenzar el Sprint Planning. Los demás pueden resolverse al momento de preparar la story específica.

**Reporte generado:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-18.md`
**Evaluador:** BMad Check Implementation Readiness · 2026-05-18
