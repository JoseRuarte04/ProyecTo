# DECISIONS — RehabOT

> Registro de decisiones de arquitectura/producto. La idea NO es documentar todo
> el código (para eso está el código y los comentarios) sino el "por qué"
> detrás de decisiones que en 2 meses vas a olvidar y vas a querer revertir
> sin saber que ya las probaste.

Formato: copiar el bloque de abajo por cada decisión. 5 minutos, no más.

---

## [2026-XX-XX] Título corto de la decisión

**Contexto:** ¿Qué problema había que resolver?

**Opciones consideradas:**
1. ...
2. ...

**Decisión:** ¿Qué se eligió?

**Por qué:** Razón concreta (no "porque sí" ni "porque Claude lo sugirió" — el
motivo real de negocio/técnico).

**Consecuencias / trade-offs aceptados:**

**Quién lo decidió:** (vos solo / con Maia / con Javier)

---

<!-- Ejemplo ya cargado para que veas el formato -->

## [2026-06-XX] Offline-first para centros con conectividad inestable

**Contexto:** Algunos centros de rehabilitación no tienen internet estable
durante la sesión clínica.

**Opciones consideradas:**
1. Requerir conexión siempre (más simple, pero rompe en consultorios sin wifi)
2. Offline-first con sync posterior (más complejo, más robusto)

**Decisión:** Explorar arquitectura offline-first (pendiente de definir alcance)

**Por qué:** Sin esto, el producto no sirve para el segmento de centros chicos/rurales,
que es parte del mercado objetivo.

**Consecuencias:** Suma complejidad de sync y manejo de conflictos en Supabase.

**Quién lo decidió:** Jose (a validar con Maia el impacto clínico real)
