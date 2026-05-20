---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - "user-provided-scope"
  - "_bmad-output/project-context.md"
  - "_bmad-output/planning-artifacts/architecture-quickdash-externo.md"
---

# RehabOT - Epic Breakdown

## Overview

Este documento desglosa los requerimientos del sistema en epics e historias implementables para **RehabOT**. Cubre tres features: rediseño de la biblioteca de ejercicios, plan de ejercicios por paciente, y link compartible del plan.

---

## Requirements Inventory

### Functional Requirements

FR1: El sistema debe permitir crear, editar y eliminar apartados de la biblioteca de ejercicios (`exercise_body_regions`), con nombre configurable por el terapeuta (ej: Muñeca, Hombro).

FR2: La tabla `exercise_library` debe incorporar los campos: `body_region_id` (FK a `exercise_body_regions`), `exercise_type` (enum: `activo` / `activo_asistido` / `fortalecimiento`), `starting_position` (text), `precautions` (text), `equipment` (text), `suggested_sets` (int), `suggested_reps` (int).

FR3: La UI de la biblioteca debe tener un panel izquierdo con la lista de apartados navegables; al seleccionar un apartado, el panel principal muestra los ejercicios de ese apartado.

FR4: Dentro de cada apartado, los ejercicios deben organizarse en 3 tabs: "Activos", "Activos asistidos" y "Fortalecimiento".

FR5: Los ejercicios deben mostrarse como cards con sus datos relevantes (nombre, instrucciones, posición inicial, precauciones, equipamiento, series/reps sugeridas, video).

FR6: El sistema debe permitir crear y editar ejercicios con todos los nuevos campos, incluyendo URL de video. Si la URL corresponde a YouTube, mostrar un thumbnail de preview.

FR7: El sistema debe permitir eliminar ejercicios de la biblioteca.

FR8: La exportación a PDF de ejercicios debe mantenerse funcional con el nuevo esquema.

FR9: El sistema viejo de categorías debe eliminarse de la UI (las tablas subyacentes pueden permanecer en DB).

FR10: El perfil del paciente debe tener un nuevo tab "Ejercicios" que muestre el plan de ejercicios asignado a ese paciente.

FR11: El terapeuta puede crear un plan de ejercicios para un paciente seleccionando ejercicios de la biblioteca y definiendo para cada uno: series, repeticiones, frecuencia (veces/día o veces/semana) y notas adicionales.

FR12: El plan de ejercicios debe permitir reordenar los ejercicios (drag-and-drop o botones de flecha arriba/abajo).

FR13: La vista del plan muestra el listado de ejercicios con su dosificación asignada.

FR14: El terapeuta puede generar un link único (token UUID) para compartir el plan de ejercicios, con fecha de expiración configurable.

FR15: El paciente puede abrir el link sin autenticación y ver su plan: nombre del ejercicio, instrucciones, posición inicial, precauciones, equipamiento, video (si tiene) y dosificación asignada.

FR16: El link puede estar en estado activo o expirado; la página pública muestra el estado correspondiente.

FR17: Desde el perfil del paciente, el terapeuta puede ver todos los links generados y revocarlos individualmente.

---

### NonFunctional Requirements

NFR1: **Seguridad / Multi-tenancy** — RLS en todas las tablas nuevas; ejercicios de la biblioteca, planes y tokens filtrados por `professional_id = auth.uid()`. La ruta pública del plan usa RPCs con `SECURITY DEFINER` (mismo patrón que `quickdash_tokens`) para no exponer la tabla directamente a `anon`.

NFR2: **Privacidad** — la página pública del plan no muestra nombre del paciente ni datos de sesión; solo el contenido clínico del ejercicio y la dosificación.

NFR3: **Sin dependencias nuevas** — usar solo las librerías ya instaladas (Shadcn/Radix, Tailwind, lucide-react, jsPDF + html2canvas para PDF). Para drag-and-drop evaluar si alguna librería ya disponible lo soporta; si no, usar botones de orden como fallback.

NFR4: **PDF** — la exportación a PDF debe seguir el patrón existente (`html2canvas` → `jsPDF`). Los nuevos campos del ejercicio deben incluirse en el PDF exportado.

NFR5: **Notificaciones** — usar exclusivamente `toast` de `sonner` para feedback al usuario.

NFR6: **Compatibilidad** — soporte en desktop y tablet desde 768px.

---

### Additional Requirements

- El sistema de tokens del plan sigue exactamente el patrón de `quickdash_tokens`: tabla con `token` UUID único, `expires_at`, RLS para terapeutas autenticados y RPCs con `SECURITY DEFINER` para acceso anónimo.
- Los tipos TypeScript de las tablas nuevas deben agregarse manualmente a `src/integrations/supabase/types.ts` (Row, Insert, Update) — no hay generación automática.
- Usar `.maybeSingle()` para queries donde el registro puede no existir (plan del paciente si no tiene plan aún).
- Si se usan dropdowns o autocompletes dentro de modales/drawers, aplicar `createPortal` (ver `ObrasSocialesAutocomplete` como referencia).
- El orden de los ejercicios en el plan debe persistir en DB (campo `order_index` o similar).
- La página pública del link se registra en `App.tsx` fuera de `<AppLayout>`, igual que `/q/:token`.

---

### UX Design Requirements

UX-DR1: La biblioteca de ejercicios debe tener layout de dos paneles: panel izquierdo fijo con lista de apartados (resaltando el seleccionado) y panel principal con tabs de tipo de ejercicio. En tablet el panel izquierdo puede colapsar a un selector dropdown.

UX-DR2: Las cards de ejercicio muestran jerarquía visual: nombre prominente, datos de dosificación sugerida secundarios, acciones (editar/eliminar) accesibles pero no dominantes.

UX-DR3: El formulario de creación/edición de ejercicio incluye un campo de URL de video; si la URL es de YouTube, mostrar automáticamente el thumbnail extraído de la URL como preview visual.

UX-DR4: En el tab "Ejercicios" del perfil del paciente, mostrar los ejercicios del plan en un listado ordenado con la dosificación asignada visible de forma clara (series × reps, frecuencia).

UX-DR5: La UI de gestión de links del plan (generar, ver activos, revocar) sigue el patrón visual del `QuickDashTokenManager` ya implementado: selector de vencimiento + URL copiable + estado del link.

UX-DR6: La página pública del plan es mobile-friendly (un paciente podría abrirla desde el teléfono). Sin sidebar ni header de app. Logo de la app centrado arriba, ejercicios en cards verticales.

UX-DR7: Los ejercicios en la página pública con video de YouTube muestran el video embebido (iframe) directamente, no solo un link.

---

### FR Coverage Map

```
FR1  → Epic 1 — CRUD de apartados (exercise_body_regions)
FR2  → Epic 1 — Nuevos campos en exercise_library
FR3  → Epic 1 — Panel izquierdo de apartados navegables
FR4  → Epic 1 — Tabs Activos / Activos asistidos / Fortalecimiento
FR5  → Epic 1 — Cards de ejercicios
FR6  → Epic 1 — Formulario con campos nuevos + preview YouTube
FR7  → Epic 1 — Eliminar ejercicios
FR8  → Epic 1 — Exportación PDF funcional
FR9  → Epic 1 — Eliminar categorías viejas de la UI
FR10 → Epic 2 — Tab "Ejercicios" en perfil del paciente — Story 2.1
FR11 → Epic 2 — Crear plan con dosificación por ejercicio — Story 2.2
FR12 → Epic 2 — Reordenar ejercicios del plan — Story 2.3
FR13 → Epic 2 — Vista del plan con dosificación — Story 2.1
FR14 → Epic 3 — Generar token con expiración configurable
FR15 → Epic 3 — Página pública del plan (sin auth)
FR16 → Epic 3 — Estado activo / expirado del link
FR17 → Epic 3 — Gestión y revocación de links desde el perfil
```

---

## Epic List

### Epic 1: Biblioteca de Ejercicios Rediseñada
El terapeuta puede organizar su biblioteca en apartados navegables (Muñeca, Hombro, etc.), clasificar ejercicios por tipo de movimiento, registrar todos los datos clínicos (posición inicial, precauciones, equipamiento, video con preview YouTube) y exportar a PDF.
**FRs cubiertos:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9

### Epic 2: Plan de Ejercicios del Paciente
El terapeuta puede crear un plan de ejercicios personalizado por paciente: selecciona ejercicios de la biblioteca, define la dosificación individual (series, reps, frecuencia, notas) y puede reordenarlos. El plan es visible en el perfil del paciente.
**FRs cubiertos:** FR10, FR11, FR12, FR13
**Stories:** 2.1 (estructura + vista base), 2.2 (gestión de ejercicios), 2.3 (reordenamiento)

### Epic 3: Link Compartible del Plan
El terapeuta genera un link con expiración que el paciente abre sin autenticación y ve su plan completo (instrucciones, video, dosificación). El terapeuta gestiona y revoca los links desde el perfil del paciente.
**FRs cubiertos:** FR14, FR15, FR16, FR17

---

## Epic 1: Biblioteca de Ejercicios Rediseñada

El terapeuta puede organizar su biblioteca en apartados navegables, clasificar ejercicios por tipo de movimiento, registrar todos los datos clínicos (posición inicial, precauciones, equipamiento, video con preview YouTube) y exportar a PDF.

### Story 1.1: Gestión de Apartados de la Biblioteca

Como terapeuta,
quiero crear, editar y eliminar apartados en la biblioteca de ejercicios (ej: Muñeca, Hombro, Columna),
para organizar mis ejercicios por región corporal según mi práctica clínica.

**Acceptance Criteria:**

**Given** el terapeuta está en la sección de ejercicios
**When** hace click en "Nuevo apartado"
**Then** aparece un formulario para ingresar el nombre del apartado
**And** al guardar, el nuevo apartado aparece en el panel izquierdo

**Given** un apartado existente en el panel
**When** el terapeuta hace click en editar
**Then** puede renombrarlo y guardar el cambio

**Given** un apartado existente sin ejercicios asociados
**When** el terapeuta lo elimina
**Then** el apartado es removido de la lista sin confirmación adicional

**Given** un apartado que tiene ejercicios asociados
**When** el terapeuta intenta eliminarlo
**Then** aparece un diálogo de confirmación advirtiendo que los ejercicios quedarán sin apartado asignado

**Technical Notes:**
- Crear tabla `exercise_body_regions`: `id` (uuid PK default gen_random_uuid()), `name` (text not null), `professional_id` (uuid FK auth.users), `created_at` (timestamptz default now())
- Agregar columna `body_region_id` (uuid nullable, FK a `exercise_body_regions`) a `exercise_library`
- RLS en `exercise_body_regions`: SELECT/INSERT/UPDATE/DELETE donde `professional_id = auth.uid()`
- Actualizar `src/integrations/supabase/types.ts` manualmente (Row, Insert, Update para `exercise_body_regions` y columna nueva en `exercise_library`)

---

### Story 1.2: Nuevos Campos Clínicos en el Formulario de Ejercicio

Como terapeuta,
quiero crear y editar ejercicios con información clínica completa (tipo de ejercicio, posición inicial, precauciones, equipamiento, dosificación sugerida y video),
para que la biblioteca contenga toda la información necesaria para prescribirlos correctamente.

**Acceptance Criteria:**

**Given** el terapeuta abre el formulario de nuevo o editar ejercicio
**When** completa los campos
**Then** puede ingresar: `exercise_type` (dropdown: Activo / Activo asistido / Fortalecimiento), `starting_position` (textarea), `precautions` (textarea), `equipment` (text), `suggested_sets` (number), `suggested_reps` (number), `video_url` (text)

**Given** el terapeuta ingresa una URL de YouTube en el campo `video_url`
**When** el campo pierde foco o tras un debounce de ~500ms
**Then** se muestra un thumbnail de preview del video debajo del campo usando `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`

**Given** el terapeuta ingresa una URL que no es de YouTube
**When** el campo pierde foco
**Then** no se muestra thumbnail, pero la URL se acepta sin error

**Given** el terapeuta guarda un ejercicio con los campos completados
**When** envía el formulario
**Then** el ejercicio queda guardado con todos los nuevos campos y aparece en la biblioteca

**Given** un ejercicio en la biblioteca no está incluido en ningún plan de paciente
**When** el terapeuta hace click en eliminar y confirma
**Then** el ejercicio es removido permanentemente

**Given** un ejercicio en la biblioteca está incluido en el plan de al menos un paciente
**When** el terapeuta intenta eliminarlo y confirma
**Then** se muestra un error explicativo ("Este ejercicio está en uso en el plan de uno o más pacientes") y el ejercicio no es eliminado

**Technical Notes:**
- Migración para agregar columnas a `exercise_library`: `exercise_type` (text, check in ('activo','activo_asistido','fortalecimiento')), `starting_position` (text), `precautions` (text), `equipment` (text), `suggested_sets` (integer), `suggested_reps` (integer), `video_url` (text)
- Extracción de YouTube video ID: regex sobre la URL para soportar formatos `youtube.com/watch?v=ID` y `youtu.be/ID`
- Actualizar `types.ts` con las nuevas columnas
- La FK `exercise_plan_items.exercise_id` se define con `ON DELETE RESTRICT` (en Story 2.1) — la detección de "en uso" se implementa con un `SELECT COUNT` previo a la eliminación para dar error de usuario, antes de que la DB lo rechace

---

### Story 1.3: Nueva UI de la Biblioteca con Panel de Apartados y Tabs por Tipo

Como terapeuta,
quiero navegar la biblioteca a través de un panel izquierdo con apartados y tabs por tipo de ejercicio,
para encontrar rápidamente el ejercicio que busco sin recorrer una lista sin estructura.

**Acceptance Criteria:**

**Given** el terapeuta abre la página de la biblioteca de ejercicios
**When** la página carga
**Then** el panel izquierdo muestra la lista de apartados disponibles, con el primero seleccionado por defecto
**And** hay un botón visible para crear un nuevo apartado

**Given** el terapeuta selecciona un apartado en el panel izquierdo
**When** visualiza el panel principal
**Then** se muestran tres tabs: "Activos", "Activos asistidos", "Fortalecimiento"
**And** cada tab muestra únicamente los ejercicios de ese apartado y tipo como cards

**Given** una card de ejercicio
**When** el terapeuta la visualiza
**Then** la card muestra: nombre, instrucciones (line-clamp 2 líneas), dosificación sugerida, y botones de editar/eliminar

**Given** la UI anterior tenía filtros o selectors de categorías
**When** carga la nueva UI
**Then** esos elementos ya no son visibles

**Given** existen ejercicios sin `body_region_id` asignado
**When** el terapeuta visualiza la biblioteca
**Then** aparecen bajo un apartado "Sin apartado" al final de la lista del panel izquierdo, garantizando que no queden inaccesibles

**Technical Notes:**
- Refactorizar la página de biblioteca con layout de dos paneles usando CSS grid o flex
- Estado del apartado seleccionado y tab activo: `useState` local (no en URL)
- En tablet (< 1024px) el panel izquierdo puede ser un `Select` dropdown de Shadcn
- Cards de ejercicio usan componente `Card` de `@/components/ui/card`

---

### Story 1.4: Exportación PDF con Nuevos Campos Clínicos

Como terapeuta,
quiero exportar ejercicios a PDF incluyendo toda la información clínica nueva,
para poder entregar instrucciones completas e impresas a los pacientes.

**Acceptance Criteria:**

**Given** el terapeuta selecciona uno o más ejercicios para exportar a PDF
**When** se genera el PDF
**Then** cada ejercicio incluye en el PDF: nombre, instrucciones, posición inicial (`starting_position`), precauciones, equipamiento, series y reps sugeridas, y tipo de ejercicio

**Given** un ejercicio exportado tiene `video_url`
**When** se genera el PDF
**Then** la URL del video aparece como texto en el PDF (los videos no pueden embeberse en PDF)

**Given** el terapeuta hace click en el botón de exportar PDF
**When** el proceso completa
**Then** el PDF se descarga sin errores

**Technical Notes:**
- Seguir el patrón existente: `html2canvas` sobre un elemento DOM → `jsPDF` (ver `PlanPdfExport.tsx` / `ExercisePdfExport.tsx`)
- Actualizar el template HTML de captura para incluir los nuevos campos
- Sin instalación de nuevas dependencias

---

## Epic 2: Plan de Ejercicios del Paciente

El terapeuta puede crear un plan de ejercicios personalizado por paciente: selecciona ejercicios de la biblioteca, define la dosificación individual (series, reps, frecuencia, notas) y puede reordenarlos. El plan es visible en el perfil del paciente.

### Story 2.1: Estructura de Datos y Vista Base del Plan

Como terapeuta,
quiero que el perfil del paciente tenga un tab "Ejercicios" donde pueda crear un plan y ver los ejercicios asignados,
para tener un punto central de gestión del programa domiciliario de cada paciente.

**Acceptance Criteria:**

**Given** el terapeuta abre el perfil del paciente
**When** hace click en el tab "Ejercicios"
**Then** si no hay plan, se muestra un mensaje informativo y un botón "Crear plan"
**And** si ya existe un plan, se muestran los ejercicios del plan con su dosificación asignada

**Given** el terapeuta hace click en "Crear plan" en el estado vacío
**When** confirma la creación
**Then** se crea el plan (fila en `exercise_plans`) y el tab pasa al estado de plan existente (vacío, con botón "Agregar ejercicio")

**Given** el plan está siendo visualizado con ejercicios
**When** el terapeuta ve una card de ejercicio del plan
**Then** la card muestra: nombre del ejercicio, dosificación (ej. "3 × 10 — 2 veces/día"), y notas adicionales si las hay

**Given** el terapeuta intenta guardar y ocurre un error (red, timeout)
**When** el submit falla
**Then** se muestra un toast de error con `sonner` y la UI queda editable para reintentar

**Technical Notes:**
- Crear tabla `exercise_plans`: `id` (uuid PK), `patient_id` (uuid FK), `professional_id` (uuid FK), `created_at`, `updated_at`
- Crear tabla `exercise_plan_items`: `id` (uuid PK), `plan_id` (uuid FK), `exercise_id` (uuid FK references `exercise_library` ON DELETE RESTRICT), `sets` (integer), `reps` (integer), `frequency_value` (integer), `frequency_unit` (text: 'day'|'week'), `notes` (text), `order_index` (integer)
- RLS en ambas tablas: `professional_id = auth.uid()`
- Usar `.maybeSingle()` para verificar si existe plan del paciente
- Tab "Ejercicios" en PatientProfile usando el patrón de underline tabs del proyecto

---

### Story 2.2: Gestión de Ejercicios en el Plan

Como terapeuta,
quiero agregar, editar y eliminar ejercicios del plan de un paciente con su dosificación individual,
para personalizar el programa de ejercicios según las necesidades del tratamiento.

**Acceptance Criteria:**

**Given** existe un plan para el paciente
**When** el terapeuta hace click en "Agregar ejercicio"
**Then** puede buscar y seleccionar un ejercicio de la biblioteca (buscando por nombre)
**And** define la dosificación: series (número), repeticiones (número), frecuencia (valor + unidad "veces/día" o "veces/semana"), y notas adicionales (texto libre)
**And** al guardar, el ejercicio se añade al final del plan

**Given** un ejercicio en el plan existente
**When** el terapeuta hace click en editar ese ítem
**Then** puede modificar las series, repeticiones, frecuencia y notas
**And** al guardar, los cambios se persisten y se reflejan en la vista del plan

**Given** un ejercicio en el plan existente
**When** el terapeuta hace click en eliminar ese ítem
**Then** aparece un diálogo de confirmación
**And** al confirmar, el ejercicio se remueve del plan y el `order_index` de los demás ítems se recalcula

**Given** el terapeuta intenta guardar y ocurre un error
**When** el submit falla
**Then** se muestra un toast de error con `sonner` y la UI queda editable para reintentar

**Technical Notes:**
- Usa las tablas creadas en Story 2.1 (`exercise_plans`, `exercise_plan_items`)
- El buscador de ejercicios filtra sobre `exercise_library` del terapeuta (por `professional_id`)
- UPSERT del ítem editado; DELETE + recalcular `order_index` para el eliminado

---

### Story 2.3: Reordenamiento de Ejercicios en el Plan

Como terapeuta,
quiero reordenar los ejercicios del plan de un paciente,
para que el paciente los vea en el orden que tiene más sentido clínico.

**Acceptance Criteria:**

**Given** el plan tiene 2 o más ejercicios
**When** el terapeuta usa los controles de orden (botones ↑ / ↓)
**Then** el ejercicio se mueve a la nueva posición en la lista de forma inmediata (actualización optimista en UI)

**Given** el terapeuta reordena ejercicios y guarda
**When** se persiste el cambio
**Then** el `order_index` queda actualizado en DB para todos los ítems afectados

**Given** el terapeuta visualiza los controles de orden
**When** el ejercicio está en la primera posición
**Then** el botón ↑ está deshabilitado

**When** el ejercicio está en la última posición
**Then** el botón ↓ está deshabilitado

**Technical Notes:**
- Implementar con botones `ChevronUp` / `ChevronDown` de lucide-react (sin dependencia de drag-and-drop)
- Al guardar: UPSERT de todos los `exercise_plan_items` con sus `order_index` actualizados
- Toast de confirmación al guardar con `toast` de `sonner`

---

## Epic 3: Link Compartible del Plan

El terapeuta genera un link con expiración que el paciente abre sin autenticación y ve su plan completo (instrucciones, video, dosificación). El terapeuta gestiona y revoca los links desde el perfil del paciente.

### Story 3.1: Generación y Gestión de Links del Plan

Como terapeuta,
quiero generar un link único con fecha de expiración para compartir el plan de ejercicios del paciente y poder gestionar los links activos,
para que el paciente acceda a su plan sin necesidad de una cuenta.

**Acceptance Criteria:**

**Given** el terapeuta está en el tab "Ejercicios" de un paciente con plan creado
**When** hace click en "Generar link para paciente"
**Then** aparece un selector de vencimiento: 24hs / 48hs / 72hs / 7 días / fecha personalizada

**Given** el terapeuta selecciona una expiración y confirma
**When** el link es generado
**Then** se muestra una URL copiable en formato `{origin}/plan/:token`
**And** un botón "Copiar" con feedback visual (ícono check por 2 segundos)

**Given** existen links generados para el paciente
**When** el terapeuta visualiza el tab "Ejercicios"
**Then** se muestra un listado de links con: fecha de creación, fecha de expiración, y estado (Activo / Expirado / Revocado)

**Given** un link activo en el listado
**When** el terapeuta hace click en "Revocar"
**Then** aparece un diálogo de confirmación
**And** al confirmar, el link queda invalidado inmediatamente y su estado cambia a "Revocado"

**Given** el terapeuta intenta generar un link pero el paciente no tiene plan creado
**When** visualiza el tab "Ejercicios"
**Then** el botón "Generar link" está deshabilitado o no visible hasta que exista un plan

**Given** el terapeuta genera un nuevo link para un paciente que ya tiene un link activo
**When** se confirma la generación
**Then** el link activo anterior queda invalidado automáticamente (`revoked_at = now()`)
**And** solo el nuevo link queda activo (mismo patrón que `quickdash_tokens`)

**Technical Notes:**
- Crear tabla `exercise_plan_tokens`: `id` (uuid PK), `token` (uuid unique default gen_random_uuid()), `plan_id` (uuid FK), `patient_id` (uuid FK), `professional_id` (uuid FK), `created_at` (timestamptz), `expires_at` (timestamptz), `revoked_at` (timestamptz nullable)
- RLS: `professional_id = auth.uid()` para SELECT/INSERT/UPDATE
- RPC `get_exercise_plan_token(p_token uuid)` con SECURITY DEFINER + GRANT TO anon: retorna `{status: 'valid'|'expired'|'revoked'|'not_found', expires_at}`
- RPC `get_exercise_plan_public(p_token uuid)` con SECURITY DEFINER + GRANT TO anon: retorna ítems del plan + datos del ejercicio solo si token es válido — sin exponer patient_id ni professional_id
- RPC `create_exercise_plan_token(p_plan_id, p_patient_id, p_expires_at)` con SECURITY DEFINER: invalida tokens activos previos del mismo plan antes de crear el nuevo (mismo patrón que `create_quickdash_token`)
- Actualizar `src/integrations/supabase/types.ts` manualmente
- Seguir patrón visual de `QuickDashTokenManager.tsx`

---

### Story 3.2: Página Pública del Plan de Ejercicios

Como paciente,
quiero abrir un link y ver mi plan de ejercicios completo sin necesidad de iniciar sesión,
para poder seguir mis ejercicios domiciliarios desde cualquier dispositivo.

**Acceptance Criteria:**

**Given** el paciente abre un link válido (`/plan/:token`)
**When** la página carga
**Then** los ejercicios se muestran en orden, cada uno con: nombre, instrucciones, posición inicial, precauciones, equipamiento, y dosificación asignada (series × reps, frecuencia)

**Given** un ejercicio tiene `video_url` de YouTube
**When** el paciente lo visualiza
**Then** se muestra un iframe embebido del video (no solo un link de texto)

**Given** un ejercicio tiene `video_url` que no es de YouTube
**When** el paciente lo visualiza
**Then** se muestra un link de texto clicable

**Given** el paciente abre un link expirado
**When** la página carga
**Then** se muestra el mensaje "Este link ha expirado" sin exponer datos clínicos

**Given** el paciente abre un link revocado
**When** la página carga
**Then** se muestra el mensaje "Este link fue revocado" sin exponer datos clínicos

**Given** el paciente abre un link con token no encontrado
**When** la página carga
**Then** se muestra el mensaje "Link no válido"

**Given** el paciente abre la página en un dispositivo móvil
**When** visualiza los ejercicios
**Then** el layout es de una columna, el texto es legible, y los videos escalan al ancho de la pantalla (aspect-ratio 16:9)

**Technical Notes:**
- Ruta `/plan/:token` registrada en `App.tsx` fuera de `<AppLayout>` (sin autenticación), antes del catch-all `*`
- La página llama a RPC `get_exercise_plan_public(p_token)` para obtener datos
- No se muestra nombre del paciente ni datos de sesión en la página pública
- iframe YouTube: `https://www.youtube.com/embed/{videoId}` con `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"`
- Layout mobile-first: columna única, cards apiladas, iframe con `aspect-ratio: 16/9` y `width: 100%`
- Seguir estructura de `QuickDashPublicPage.tsx` como referencia de patrón
