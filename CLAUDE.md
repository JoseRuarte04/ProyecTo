## Flujo de trabajo del proyecto

Al arrancar CUALQUIER sesión: leer `docs/PROJECT_STATE.md` ANTES de tocar
código o proponer nada. Si hay algo en "En progreso", asumir que seguimos
con eso salvo que se diga explícitamente lo contrario.

Si se pide algo que no es continuación de lo que está "En progreso":
preguntar si hay que pausar lo actual (con motivo) o cargar el pedido nuevo
en `docs/TASKS.md` para después. No arrancar un frente nuevo sin esa
confirmación.

Regla de WIP: máximo 1 tarea en estado "En progreso" a la vez en
`docs/PROJECT_STATE.md`.

Durante la sesión: si surge una idea/bug/mejora que no es parte de la tarea
actual, no resolverla al toque — anotarla como candidata para
`docs/TASKS.md` y mencionarla al final, sin interrumpir el hilo en curso.

Commits chicos y frecuentes con mensajes descriptivos (qué y por qué, no
"fix" genérico).

Al cerrar CUALQUIER sesión, proponer activamente (sin esperar que se pida):
- Resumen de 3-5 líneas de lo hecho
- Actualización sugerida para `docs/PROJECT_STATE.md` (qué pasa a Cerrado, qué
  queda En progreso o Pausado y por qué)
- Si hubo una decisión de arquitectura/producto no trivial, sugerir entrada
  para `docs/DECISIONS.md`
- Una línea para `docs/CHANGELOG.md`
