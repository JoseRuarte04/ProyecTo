import * as React from "react";

/**
 * Intercepta cualquier acción que cerraría/navegaría fuera de un formulario
 * con cambios sin guardar (`isDirty`), mostrando una confirmación en su lugar.
 * También agrega un `beforeunload` nativo mientras `isDirty` sea true, para
 * cubrir el cierre/recarga de la pestaña.
 *
 * `onDiscard`, si se pasa, corre una sola vez justo cuando se confirma
 * "salir sin guardar" (por cualquier vía: botón interno o atrás del
 * navegador) — para que el caller pueda limpiar el borrador/estado que
 * respaldaba ese formulario antes de irse de verdad.
 */
export function useUnsavedChangesGuard(isDirty: boolean, onDiscard?: () => void) {
  const [pendingAction, setPendingAction] = React.useState<(() => void) | null>(null);
  // true mientras haya un entry de historial "de más" pendiente de consumir
  // (ver el efecto de popstate más abajo).
  const armedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // El botón "atrás" del navegador (o el gesto equivalente) dispara un
  // popstate después de que el browser ya cambió de URL — para cuando este
  // handler corre, ya es tarde para "cancelar" la navegación con un simple
  // preventDefault (popstate no lo soporta). El truco: mientras isDirty,
  // se empuja un entry duplicado de la URL actual, así el primer "atrás" solo
  // consume ese duplicado (misma URL, nada cambia a la vista) y acá se
  // intercepta para mostrar la confirmación antes de dejar salir de verdad.
  React.useEffect(() => {
    if (!isDirty) return;
    window.history.pushState(null, "", window.location.href);
    armedRef.current = true;

    const handlePopState = () => {
      if (!armedRef.current) return;
      armedRef.current = false;
      setPendingAction(() => () => window.history.back());
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      armedRef.current = false;
    };
  }, [isDirty]);

  const guard = React.useCallback(
    (action: () => void) => {
      if (isDirty) {
        setPendingAction(() => action);
      } else {
        action();
      }
    },
    [isDirty],
  );

  const confirmDiscard = React.useCallback(() => {
    onDiscard?.();
    setPendingAction((current) => {
      current?.();
      return null;
    });
  }, [onDiscard]);

  const cancelDiscard = React.useCallback(() => {
    setPendingAction(null);
    if (isDirty) {
      // Se rearma el duplicado: si el cancel vino de un "atrás" real, el
      // próximo intento también tiene que quedar atrapado.
      window.history.pushState(null, "", window.location.href);
      armedRef.current = true;
    }
  }, [isDirty]);

  return { guard, confirmOpen: pendingAction !== null, confirmDiscard, cancelDiscard };
}
