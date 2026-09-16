import * as React from "react";

/**
 * Marca `isDirty` apenas cambia cualquiera de las `deps` dadas, después del
 * mount/reset inicial. Pensado para formularios cuyo estado ya vive en un
 * objeto único (ej. `[form]`) o en un puñado de `useState` individuales.
 *
 * Importante: llamar `reset()` en el mismo efecto que inicializa/repuebla los
 * campos (al abrir el diálogo, o al cambiar de registro a editar), no solo al
 * cancelar — así no arrastra un `isDirty` viejo de un uso anterior.
 */
export function useDirtyDeps(deps: React.DependencyList): [boolean, () => void] {
  const [dirty, setDirty] = React.useState(false);
  const skip = React.useRef(true);

  React.useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    setDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reset = React.useCallback(() => {
    setDirty(false);
    skip.current = true;
  }, []);

  return [dirty, reset];
}
