## Flujo de trabajo del proyecto

Al arrancar CUALQUIER sesión: leer `docs/PROJECT_STATE.md` ANTES de tocar
código o proponer nada. Si hay algo en "En progreso", asumir que seguimos
con eso salvo que se diga explícitamente lo contrario.

Si se pide algo que no es continuación de lo que está "En progreso":
preguntar si hay que pausar lo actual (con motivo) o cargar el pedido nuevo
en `docs/TASKS.md` para después. No arrancar un frente nuevo sin esa
confirmación.

Regla de worktree: toda sesión nueva de Claude Code arranca en su propio
`git worktree` (`.claude/worktrees/<nombre-de-la-tarea>`) ANTES de tocar
cualquier archivo o crear una rama — no solo cuando a mitad de camino se
detecta que hay otra sesión activa en el mismo checkout. Esto ya pasó varias
veces (ver `DECISIONS.md` 2026-09-23, y la auditoría de seguridad del
2026-10-02 corriendo en paralelo con otra sesión que mergeó 3 PRs sin que
ninguna de las dos se enterara de la otra). El checkout principal del repo
queda libre para que el usuario lo use directamente si quiere, sin que una
sesión de Claude Code le pise el dev server, una rama a medio armar, o un
archivo sin commitear.

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
