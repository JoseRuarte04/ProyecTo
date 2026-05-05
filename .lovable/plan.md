# Reemplazo de circometría por tabla estructurada

## Alcance

Reemplazar el bloque actual de circometría (reparo + lado + valor + mano global) por una tabla con 14 puntos anatómicos fijos y dos columnas (MS Sano / MS Afectado), cada una con su fecha. Sin cambios de DB: `edema_circummetry` sigue siendo `jsonb`.

## Estructura de datos persistida

```json
{
  "sano":     { "fecha": "YYYY-MM-DD", "antebrazo_15": n, ... "pulgar_f1": n },
  "afectado": { "fecha": "YYYY-MM-DD", "antebrazo_15": n, ... "pulgar_f1": n }
}
```

Filas (en orden):
`antebrazo_15`, `antebrazo_10`, `muneca`, `cuerpo_mtc`, `cabeza_mtc`, `indice_f1`, `indice_f2`, `mayor_f1`, `mayor_f2`, `anular_f1`, `anular_f2`, `menique_f1`, `menique_f2`, `pulgar_f1`.

Reglas:
- Inputs vacíos → no se incluyen en el objeto del lado.
- Si un lado queda sin ningún valor → ese lado se omite.
- Si ambos lados quedan vacíos → guardar `null` en `edema_circummetry`.
- Formato viejo (con `reference`/`side`/`value_cm`/`mano_global`): se ignora al cargar (tabla vacía).

## 1. Componente compartido

Crear `src/components/clinical/EdemaCircometryTable.tsx` reutilizable:

Props:
- `value: { sano?: SideData; afectado?: SideData } | null`
- `onChange: (v) => void`
- `mode: "admission" | "follow_up"`
- `baselineSano?: SideData | null` — datos de admisión (solo lectura) para follow_up/discharge

Comportamiento:
- `mode==="admission"`: dos columnas editables (Sano + Afectado), cada una con su input `<Input type="date">` arriba.
- `mode==="follow_up"`:
  - Si `baselineSano` tiene datos → columna Sano en modo lectura (fondo `bg-muted`, sin input), encabezado con la fecha basal.
  - Si no hay `baselineSano` → ocultar la columna Sano.
  - Columna Afectado editable con su fecha.
- Layout: `<table>` con header sticky de 3 columnas (Punto / MS Sano / MS Afectado), filas con `<Input type="number" step="0.1">` en cada celda.
- Helper interno: `parseLegacy()` que detecta `reference`/`value_cm` y devuelve `{}` para evitar romper la UI.

## 2. Cambios en `src/pages/SessionForm.tsx`

- Quitar estados `circ_reference`, `circ_side`, `circ_value_cm`, `circ_mano_global` (líneas 437–440) y sus setters.
- Agregar `edema_circ` state (objeto `{ sano, afectado }`) y `baselineSano` state.
- En el load (l. 582–588): reemplazar el parseo viejo. Si `ae.edema_circummetry?.sano || .afectado` → poblar `edema_circ`; si no, vaciar.
- En admisiones de seguimiento: hacer un fetch extra del `analytical_evaluations` de la sesión de admisión del episodio actual para obtener `baselineSano` (`edema_circummetry.sano`). Reutilizar el query existente que ya carga clinical records por episodio.
- En el build payload (l. 819–827): construir `edemaCirc` desde `edema_circ`, devolviendo `null` si ambos lados están vacíos.
- En el UI (l. 1573–1607): reemplazar el bloque "Circometría" por `<EdemaCircometryTable mode={isAdmission ? "admission" : "follow_up"} baselineSano={baselineSano} value={edema_circ} onChange={setEdemaCirc} />`.

## 3. Cambios en `src/components/evaluations/AnalyticalEvalForm.tsx`

- Quitar estados `circRef`, `circSide`, `circValueCm`, `circManoGlobal` (l. 68–72).
- Agregar `edemaCirc` state.
- En `handleSave` (l. 107–109): reemplazar `edemaCirc` por el objeto nuevo (null si vacío).
- En el render del form (l. 181–200): reemplazar el bloque por `<EdemaCircometryTable mode="admission" value={edemaCirc} onChange={setEdemaCirc} />`. (Este formulario crea evaluaciones nuevas; tratamos como admission por defecto. No necesita baseline.)
- En el render readonly (l. 444–453): reemplazar por una mini-tabla que liste solo los puntos con valor del/los lado(s) presentes; si viene formato viejo, mostrar el texto legacy como antes (fallback).

## 4. `NewPatientForm.tsx`

No tiene circometría (ya fue reducido a identidad). No se toca.

## 5. Display en `src/pages/PatientProfile.tsx`

Reemplazar el bloque actual (l. 1127–1136) por una tabla de evolución dentro de `SubSection "Edema"`.

Lógica:
- Recolectar todas las evaluaciones (`evaluationsByDate`) ordenadas por fecha asc.
- `sanoBaseline` = primer `edema_circummetry.sano` no vacío (típicamente la admisión).
- `afectadoCols` = lista de evaluaciones con `edema_circummetry.afectado` no vacío, cada una con su fecha.
- Si no hay `sanoBaseline` ni columnas afectadas → no renderizar el bloque circometría.
- Render: tabla con columnas `Punto | MS Sano (fecha) | Afectado dd/MM | Afectado dd/MM | …`. Filas = los 14 puntos en orden; celdas vacías muestran `—`.
- Formato viejo: si la única forma es legacy, conservar el render texto actual como fallback.

## 6. Detalles técnicos

- Helper compartido `EDEMA_POINTS` exportado desde el componente con `[{ key, label }]` para reutilizar en PatientProfile.
- Validación numérica: `step="0.1"`, valores convertidos a `Number()` solo si no vacíos; si `NaN` → omitir.
- Estilos: `Table` de shadcn (`@/components/ui/table`) o `<table className="w-full text-sm">`. Encabezados `field-label`. Celdas readonly con `bg-muted/40 text-muted-foreground`.
- En mobile (sm:), la tabla queda con scroll horizontal (`overflow-x-auto`).

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `src/components/clinical/EdemaCircometryTable.tsx` | Nuevo componente |
| `src/pages/SessionForm.tsx` | Reemplazar estados + UI + load + save + cargar baseline |
| `src/components/evaluations/AnalyticalEvalForm.tsx` | Reemplazar estados + UI form + render readonly |
| `src/pages/PatientProfile.tsx` | Tabla de evolución por sesión |

Sin cambios de DB ni de RLS.
