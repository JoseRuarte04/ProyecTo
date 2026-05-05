## Cambios a aplicar en los tres formularios

Archivos:
- `src/pages/SessionForm.tsx`
- `src/components/patients/NewPatientForm.tsx`
- `src/components/evaluations/AnalyticalEvalForm.tsx`

---

### 1) Bug goniometría — pérdida de datos al cambiar MSD/MSI

**Diagnóstico**

El estado ya es por lado (`{ MSD: {...}, MSI: {...} }`) en los tres formularios, así que la estructura es correcta. El bug está en cómo el input lee/escribe:

- `SessionForm` y `NewPatientForm` usan un componente `GonioGrid` que renderiza inputs con `defaultValue + onBlur` (no controlados), con un `key` que incluye el valor. Cuando el usuario tipea un valor en MSD y cambia de tab a MSI **sin desenfocar el input**, el `onBlur` nunca se dispara → el valor escrito jamás se guarda en estado y se pierde al cambiar de lado.
- `AnalyticalEvalForm` ya usa inputs controlados (`value` + `onChange`) → no tiene el bug, solo aplica el cambio #2.

**Fix**

En `GonioGrid` (ambos archivos `SessionForm.tsx` línea 962 y `NewPatientForm.tsx` línea 1029):
- Quitar el truco `key={...}` y `defaultValue` + `onBlur`.
- Convertir a input controlado: `value={values[f.key] || ""}` + `onChange={e => setValues({ ...values, [f.key]: e.target.value })}`.

Esto hace que cada keystroke se guarde inmediatamente en `gonioState[lado][parte][movimiento]`, y como el cambio de tab solo modifica `gonio_side` (no toca el estado de gonio), todos los datos del lado anterior quedan intactos.

La compatibilidad de lectura (formato nuevo `{MSD,MSI}` vs viejo `{pre,post}`) ya existe en SessionForm (líneas 472–483) y NewPatientForm; no requiere cambios. El guardado en jsonb por ambos lados también ya está implementado.

---

### 2) Dinamómetro — campo "Promedio" inline en grilla de 4 columnas

En los tres formularios, en la sección Fuerza muscular / Dinamómetro MSD y MSI:

- Cambiar el contenedor de las 3 mediciones de `grid-cols-3` a `grid-cols-4`.
- Agregar como 4ª celda un `<Input readOnly>` con:
  - `value` = promedio calculado en tiempo real con 1 decimal (cadena vacía si no hay valores numéricos).
  - `placeholder="Promedio"` y label encima `Promedio (kgf)` o sufijo visible "kgf".
  - Clases para diferenciarlo visualmente: `bg-muted text-muted-foreground cursor-not-allowed`.
- Eliminar la línea actual `<p>Promedio: X.X kgf</p>` que aparecía debajo (ya no es necesaria, vive inline).

Cálculo (idéntico al actual):
```
const nums = vals.map(v => v.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));
const avg = nums.length ? (nums.reduce((a,b)=>a+b,0) / nums.length).toFixed(1) : "";
```

Persistencia sin cambios: se sigue guardando `{ values: [a,b,c], average: X.X }` en `dynamometer_msd` / `dynamometer_msi` (helper `buildDyn` ya existente).

---

### Resumen de archivos tocados

| Archivo | Cambio gonio | Cambio dinamómetro |
|---|---|---|
| `SessionForm.tsx` | Sí (controlar `GonioGrid`) | Sí (grid-cols-4 + readonly avg) |
| `NewPatientForm.tsx` | Sí (controlar `GonioGrid`) | Sí (grid-cols-4 + readonly avg) |
| `AnalyticalEvalForm.tsx` | No (ya controlado) | Sí (grid-cols-4 + readonly avg) |

Sin cambios en base de datos ni en RLS.
