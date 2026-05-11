# Arquitectura: Dashboard Clínico — Tab "Evolución"
_RehabOT · Generado por Winston (System Architect) · 2026-05-11_

---

## 1. Auditoría de datos — Correcciones al brief

> **CORRECCIÓN CRÍTICA**: El brief asume que los datos clínicos están en `therapy_sessions` (jsonb). Esto es incorrecto. `therapy_sessions` solo contiene campos de texto narrativo (notas de evolución, indicaciones). Los datos clínicos cuantitativos están en `analytical_evaluations`, vinculada a sesiones via `session_id`.

### Tabla `therapy_sessions` — Solo texto narrativo
| Campo | Tipo | Nota |
|-------|------|------|
| `session_date` | string | Fecha de la sesión |
| `session_number` | number | Nº de sesión |
| `evolution`, `notes`, `interventions` | string | Texto libre |
| **Sin campos JSONB clínicos** | — | EVA, edema, fuerza NO están aquí |

### Tabla `analytical_evaluations` — Fuente real del dashboard
| Campo | Tipo | Shape |
|-------|------|-------|
| `pain_score` | `number \| null` | Escalar 0–10 (EVA). Directo. |
| `edema_circummetry` | `Json \| null` | Nuevo formato: `{ items: [{reparo: string, msd: number\|null, msi: number\|null}] }`. Helpers: `isCircometriaFormat()`, `normalizeCircometriaValue()` de `EdemaCircometryTable.tsx`. |
| `dynamometer_msd` | `Json \| null` | `{ values: [n1\|null, n2\|null, n3\|null], average: number }` |
| `dynamometer_msi` | `Json \| null` | Mismo shape que msd |
| `goniometry` | `Json \| null` | Ver shape detallado abajo |
| `vancouver_score` | `number \| null` | VSS cicatriz, escalar |
| `evaluation_date` | `string` | ISO date string |
| `session_id` | `string \| null` | FK a `therapy_sessions.id` |

#### Shape de `goniometry` (JSONB)
```json
{
  "arom": {
    "MSD": {
      "pre": [
        { "body_part": "wrist", "values": { "flex": 45, "ext": 30, "dr": 10 } },
        { "body_part": "elbow", "values": { "flex": 120 } }
      ],
      "post": null
    },
    "MSI": { "pre": [...], "post": null }
  },
  "prom": { "MSD": {...}, "MSI": {...} }
}
```
Body parts: `shoulder`, `elbow`, `wrist`, `hand`, `thumb`.
Claves de cada body_part definidas en `GONIO_PARTS` de `SessionForm.tsx` (e.g., wrist: `flex`, `ext`, `dr`, `dc`, `prono`, `supino`).

### Tabla `functional_evaluations` — Escalas funcionales
| Campo | Tipo | Nota |
|-------|------|------|
| `quickdash_score` | `number \| null` | 0–100, escalar directo |
| `barthel_score` | `number \| null` | Escalar |
| `fim_score` | `number \| null` | Escalar |
| `evaluation_date` | `string` | |
| `session_id` | `string \| null` | FK opcional |

### Tabla `treatment_episodes` — Contexto del episodio
| Campo | Uso en dashboard |
|-------|-----------------|
| `affected_side: "MSD" \| "MSI" \| "both" \| null` | **Determina qué dinamómetro es el "afectado" vs. "sano"** |
| `diagnosis` | Mostrar en header del dashboard |
| `admission_date` | Calcular semanas de tratamiento |

---

## 2. Decisión: Frontend vs. RPC

**Decisión: Cálculo 100% en frontend. Sin RPC ni views.**

Razonamiento:
- Los datos ya se fetchean en `PatientProfile.tsx` (`analEvals`, `funcEvals`, `sessions`). El dashboard los recibe como props — cero queries nuevas.
- El volumen es pequeño: 10–50 `analytical_evaluations` por episodio. Calcular en cliente cuesta ~0ms.
- Las alertas son reglas simples (comparaciones numéricas). No ameritan lógica de servidor.
- Agregar una RPC solo para cálculos que el cliente puede hacer introduce un nuevo punto de fallo, complejidad de tipado, y migración SQL.
- **Cuando conviene RPC**: si se necesitaran estadísticas cross-paciente (para análisis de la práctica clínica). Fuera del scope actual.

---

## 3. Cómo calcular cada métrica del dashboard

### EVA — Estado actual y tendencia
```ts
const sorted = analEvals
  .filter(ae => ae.pain_score != null)
  .sort((a, b) => new Date(a.evaluation_date).getTime() - new Date(b.evaluation_date).getTime());

const evaActual = sorted.at(-1)?.pain_score ?? null;
const evaAnterior = sorted.at(-2)?.pain_score ?? null;
const evaTendencia = evaActual != null && evaAnterior != null
  ? evaActual < evaAnterior ? "mejora" : evaActual > evaAnterior ? "empeora" : "estable"
  : null;
```

### Edema — Delta bilateral (máxima diferencia entre MSD y MSI)
```ts
// Usar la última evaluación con circometría
const lastWithEdema = sorted.findLast(ae => isCircometriaFormat(ae.edema_circummetry));
if (lastWithEdema) {
  const items = normalizeCircometriaValue(lastWithEdema.edema_circummetry);
  const diffs = items
    .filter(it => it.msd !== "" && it.msi !== "")
    .map(it => Math.abs(parseFloat(it.msd) - parseFloat(it.msi)));
  const maxDelta = diffs.length > 0 ? Math.max(...diffs) : null; // mm
  const edemaAlert = maxDelta != null && maxDelta >= 5;
}
```

### Fuerza — % bilateral
```ts
const lastWithStrength = sorted.findLast(
  ae => ae.dynamometer_msd?.average != null || ae.dynamometer_msi?.average != null
);
if (lastWithStrength && episode.affected_side) {
  const affectedAvg = episode.affected_side === "MSD"
    ? lastWithStrength.dynamometer_msd?.average
    : lastWithStrength.dynamometer_msi?.average;
  const sanaAvg = episode.affected_side === "MSD"
    ? lastWithStrength.dynamometer_msi?.average
    : lastWithStrength.dynamometer_msd?.average;
  const forcePercent = sanaAvg > 0 ? Math.round((affectedAvg / sanaAvg) * 100) : null;
}
```

### AROM — Gráfico por movimiento seleccionado
```ts
// El usuario elige body_part + field en un selector en el dashboard.
// Estado local: useState<{part: GonioPartKey, field: string}>({ part: "wrist", field: "ext" })
// Default: muñeca > extensión (movimiento más frecuentemente limitado en patologías de mano).

function extractArom(ae: any, side: "MSD"|"MSI", part: string, field: string): number | null {
  const sideData = ae.goniometry?.arom?.[side];
  if (!sideData?.pre) return null;
  const bodyPart = sideData.pre.find((g: any) => g.body_part === part);
  return bodyPart?.values?.[field] ?? null;
}
```

### Alertas automáticas
```ts
// EVA ≥ 7 → alerta roja
const alertEvaHigh = evaActual != null && evaActual >= 7;

// EVA sin bajar en 3 sesiones consecutivas (comparando últimas 3 con pain_score)
const last3Eva = sorted.slice(-3).map(ae => ae.pain_score).filter(v => v != null);
const alertEvaPlateau = last3Eva.length === 3
  && last3Eva[0] !== null && last3Eva[1] !== null && last3Eva[2] !== null
  && last3Eva[1] >= last3Eva[0] && last3Eva[2] >= last3Eva[1];

// Edema ≥ 5mm → alerta
const alertEdema = maxDelta != null && maxDelta >= 5;

// Fuerza < 50% → alerta funcional; < 25% → restricción laboral
const alertForce50 = forcePercent != null && forcePercent < 50;
const alertForce25 = forcePercent != null && forcePercent < 25;
```

---

## 4. Plan de fases

### Fase 1 — Hook de datos (sin UI)
Crear `usePatientDashboard(analEvals, funcEvals, sessions, episode)`.
Exporta: `{ evaData, edemaData, forceData, aromData, quickdashData, alerts, lastSession }`.
Sin efectos secundarios, sin queries. Solo transformación de arrays ya disponibles.
**Testeable de forma aislada.**

### Fase 2 — Bloque 1: Estado Actual
Componente `EstadoActualCard` con las 4 métricas del brief.
Props puras, sin lógica propia — recibe output del hook.

### Fase 3 — Bloque 2: Gráficos de evolución
Componente `GraficosEvolucion` con 3 `<LineChart>` de Recharts (ya instalado: v2.15.4).
Selector de movimiento para AROM (body_part + field).

### Fase 4 — Bloques 3 y 4: Última sesión + Alertas
`UltimaSesionResumen` y `AlertasClinicas`. Ambos son render puro sobre datos del hook.

### Fase 5 — Integración en PatientProfile
Agregar tab "Evolución" entre "Evaluaciones" y "Archivos".
Pasar `analEvals`, `funcEvals`, `sessions`, `activeEpisode` como props.
**Sin tocar ningún otro tab ni flujo de sesiones.**

---

## 5. Archivos a crear y modificar

### Crear (nuevos)
```
src/
  components/
    patients/
      EvolucionTab/
        index.tsx                  ← Entry point: compone los 4 bloques
        EstadoActualCard.tsx       ← Bloque 1: estado actual + métricas
        GraficosEvolucion.tsx      ← Bloque 2: 3 gráficos Recharts
        UltimaSesionResumen.tsx    ← Bloque 3: resumen última sesión
        AlertasClinicas.tsx        ← Bloque 4: alertas automáticas
  hooks/
    usePatientDashboard.ts         ← Toda la lógica de cálculo
```

### Modificar (solo un archivo existente)
```
src/pages/PatientProfile.tsx
  → Agregar <TabsTrigger value="evolucion"> entre "evaluaciones" y "archivos"
  → Agregar <TabsContent value="evolucion"> con <EvolucionTab props />
  → Agregar import de EvolucionTab
```

### Sin tocar
- `SessionForm.tsx` — ni un carácter
- Ningún otro tab de PatientProfile
- Ningún componente de evaluaciones existente
- Schema de Supabase (sin migración)

---

## 6. Interfaz del componente principal

```tsx
// src/components/patients/EvolucionTab/index.tsx
interface EvolucionTabProps {
  analEvals: any[];          // analytical_evaluations del episodio, orden cualquiera
  funcEvals: any[];          // functional_evaluations del episodio
  sessions: any[];           // therapy_sessions del episodio
  episode: any;              // treatment_episode activo (para affected_side, diagnosis)
  patientId: string;         // para links de navegación a sesión completa
}
```

El hook recibe los mismos datos y hace toda la normalización internamente.

---

## 7. Sugerencias del Architect

### Mejoras clínicas que agregaría (no pedidas)

**a) QuickDASH en gráfico, no solo en texto**
`functional_evaluations.quickdash_score` es escalar y tiene fecha. Sumarlo como cuarto gráfico de evolución es trivial con Recharts. El QuickDASH es el indicador de alta por excelencia — verlo evolucionar en el tiempo tiene alto valor clínico. No agregarlo en el dashboard es desperdiciar el dato más importante de `functional_evaluations`.

**b) VSS (cicatriz Vancouver) ya existe como escalar**
`analytical_evaluations.vancouver_score` es un número directo (suma de 4 subescalas: pigmentación, vascularización, flexibilidad, altura). Para pacientes post-quirúrgicos con cicatriz, agregar un chip de "Vancouver: X/13" en el estado actual cuesta 0 esfuerzo de UI y da información clinicamente relevante.

**c) Indicator de sesiones sin registro clínico**
`therapy_sessions` tiene `session_id` pero no toda sesión tiene `analytical_evaluation` asociada. Mostrar en "Última sesión resumida" si la sesión tiene evaluación o es solo nota de evolución ayuda al terapeuta a detectar sesiones donde olvidó registrar datos objetivos.

### Datos ya en DB que no contemplaste

| Campo | Tabla | Valor para el dashboard |
|-------|-------|------------------------|
| `quickdash_score` | `functional_evaluations` | **Muy recomendado**: gráfico de QuickDASH por episodio |
| `vancouver_score` | `analytical_evaluations` | Chip en Estado Actual si > 0 |
| `week_at_session` | `therapy_sessions` | Eje X alternativo al número de sesión (semana de tratamiento) |
| `session_type` | `therapy_sessions` | Distinguir sesiones de evaluación vs. tratamiento en el gráfico |
| `affected_side` | `treatment_episodes` | **Crítico**: sin esto, el % de fuerza bilateral no es posible |
| `admission_date` | `treatment_episodes` | Mostrar "X semanas de tratamiento" en el header del dashboard |

### Riesgos anticipados

**Riesgo 1: `affected_side = "both"` o null**
El % de fuerza bilateral requiere que `affected_side` sea `"MSD"` o `"MSI"`. Si es `"both"` o `null`, el cálculo no aplica. El hook debe devolver `null` para `forcePercent` en ese caso y el UI debe manejar el estado vacío graciosamente (texto: "Comparativa bilateral no aplica").

**Riesgo 2: Formato legacy de edema**
`edema_circummetry` tiene DOS formatos: el nuevo (con `items[]`) y el legado (con keys `sano`/`afectado`). Solo el nuevo permite calcular delta MSD/MSI por punto. Con el formato legacy, la única opción es mostrar "Sin datos comparables". El hook debe detectarlo con `isCircometriaFormat()` y manejar ambos casos.

**Riesgo 3: Sin evaluaciones analíticas en sesiones tempranas**
Un paciente nuevo puede tener solo `therapy_sessions` sin ninguna `analytical_evaluation`. El dashboard debe tener un estado vacío claro ("Aún no hay evaluaciones registradas") y no crashear al intentar calcular métricas sobre arrays vacíos.

**Riesgo 4: AROM — movimiento no registrado en el selector**
Si el usuario selecciona "Muñeca > Extensión" pero solo hay datos de "Codo > Flexión" en las sesiones, el gráfico va a estar vacío. Solución: detectar qué combinaciones body_part+field tienen datos reales y preseleccionar automáticamente la combinación con más puntos. Esto evita la experiencia de "gráfico vacío sin explicación".

**Riesgo 5: PatientProfile.tsx es el archivo más grande del proyecto**
A ~3000 líneas, editar este archivo es el mayor riesgo de regresión. La modificación es mínima (3 líneas: import + TabsTrigger + TabsContent), pero requiere cuidado con la indentación y el orden de los tabs.

---

_Arquitectura lista para implementación. Sin dependencias nuevas (Recharts ya instalado). Sin migración SQL. Sin cambios al flujo de sesiones existente._
