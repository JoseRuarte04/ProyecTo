# Deferred Work

Items diferidos durante la sesión de Quick Dev. Retomar en contextos futuros.

---

## Meta 2 — Edición de ficha clínica
Permitir editar los datos de admisión y ficha clínica del paciente (datos clínicos y ocupacionales) desde `PatientProfile`.

## Vista evaluaciones — defers de revisión (2026-05-07)

- **`dash_score` vs `quickdash_score` mismatch**: `NewFuncEvalDialog` guarda `dash_score` pero `FunctionalEvaluationPage` muestra `quickdash_score`. Los datos guardados desde el dialog no aparecen en la página de evaluación funcional. Requiere alinear qué columna se escribe y se lee.
- **Dead code en PatientProfile**: `FunctionalEvalBlock` y `MeasurementsBlock` (y sus helpers) ya no son invocados desde el card de sesión pero siguen definidos en el archivo. Candidatos a eliminar en cleanup.
- **Colores hardcodeados en pruebas específicas**: `AnalyticalEvaluationPage` usa `bg-red-50/text-red-700` y `bg-green-50/text-green-700` para resultados positivos/negativos. Sigue el patrón de PatientProfile pero viola el estándar de tokens semánticos.

## Meta 3 — Bugs pre-producción
Limpiar problemas conocidos antes del deploy a producción. (Detalle de bugs pendiente de relevamiento.)
