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

  // Chequea el cambio: solo corre cuando cambia alguna dep. Si `skip` está
  // prendido (mount, o justo después de un reset()), no marca dirty.
  React.useEffect(() => {
    if (skip.current) return;
    setDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Apaga `skip` después de CADA commit (sin deps), no solo cuando el efecto
  // de arriba llega a correr. Si no se separan los dos, un reset() que no
  // cambia ninguna dep (ej. se llama desde un efecto de "abrir sin prefill")
  // deja `skip` prendido para siempre y se traga el primer cambio real del
  // usuario como si fuera parte del reset.
  React.useEffect(() => {
    skip.current = false;
  });

  const reset = React.useCallback(() => {
    setDirty(false);
    skip.current = true;
  }, []);

  return [dirty, reset];
}
