import * as React from "react";

/**
 * Intercepta cualquier acción que cerraría/navegaría fuera de un formulario
 * con cambios sin guardar (`isDirty`), mostrando una confirmación en su lugar.
 * También agrega un `beforeunload` nativo mientras `isDirty` sea true, para
 * cubrir el cierre/recarga de la pestaña.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const [pendingAction, setPendingAction] = React.useState<(() => void) | null>(null);

  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
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
    setPendingAction((current) => {
      current?.();
      return null;
    });
  }, []);

  const cancelDiscard = React.useCallback(() => setPendingAction(null), []);

  return { guard, confirmOpen: pendingAction !== null, confirmDiscard, cancelDiscard };
}
