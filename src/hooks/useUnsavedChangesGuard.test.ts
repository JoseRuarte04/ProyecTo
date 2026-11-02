import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

/**
 * Este hook ya tuvo un bug real en producción (PR #79, 2026-10-11): el
 * botón "atrás" del navegador no quedaba interceptado porque popstate
 * dispara después de que el browser ya cambió de URL. El fix fue el truco
 * de historial que se testea en el describe "botón atrás del navegador"
 * de abajo — es la parte más frágil y menos obvia del hook.
 */
describe("useUnsavedChangesGuard: guard/confirmDiscard/cancelDiscard", () => {
  it("sin cambios sin guardar, guard ejecuta la acción de inmediato", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(false));
    const action = vi.fn();

    act(() => result.current.guard(action));

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.confirmOpen).toBe(false);
  });

  it("con cambios sin guardar, guard abre la confirmación sin ejecutar la acción todavía", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    const action = vi.fn();

    act(() => result.current.guard(action));

    expect(action).not.toHaveBeenCalled();
    expect(result.current.confirmOpen).toBe(true);
  });

  it("confirmDiscard ejecuta la acción pendiente y llama a onDiscard una sola vez", () => {
    const onDiscard = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true, onDiscard));
    const action = vi.fn();

    act(() => result.current.guard(action));
    act(() => result.current.confirmDiscard());

    expect(action).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(result.current.confirmOpen).toBe(false);
  });

  it("cancelDiscard cierra la confirmación sin ejecutar la acción ni llamar a onDiscard", () => {
    const onDiscard = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true, onDiscard));
    const action = vi.fn();

    act(() => result.current.guard(action));
    act(() => result.current.cancelDiscard());

    expect(action).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
    expect(result.current.confirmOpen).toBe(false);
  });

  it("onDiscard es opcional: confirmDiscard no rompe si no se pasa", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    const action = vi.fn();

    act(() => result.current.guard(action));
    expect(() => act(() => result.current.confirmDiscard())).not.toThrow();
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("useUnsavedChangesGuard: botón atrás del navegador (popstate)", () => {
  let backSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Evita que el hook navegue de verdad al confirmar "salir sin guardar"
    // vía atrás — solo interesa confirmar que SE LLAMA a history.back(),
    // no ejercitar la navegación real de jsdom.
    backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });

  afterEach(() => {
    backSpy.mockRestore();
  });

  it("con cambios sin guardar, un popstate (atrás del navegador) abre la confirmación en vez de dejar navegar", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.confirmOpen).toBe(true);

    // La acción pendiente que armó el popstate es volver atrás de verdad.
    act(() => result.current.confirmDiscard());
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("sin cambios sin guardar, un popstate no activa ninguna confirmación (no hay listener armado)", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(false));

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.confirmOpen).toBe(false);
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("cancelDiscard rearma el intercept: un segundo popstate vuelve a abrir la confirmación", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));

    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(result.current.confirmOpen).toBe(true);

    act(() => result.current.cancelDiscard());
    expect(result.current.confirmOpen).toBe(false);

    // Este es el escenario exacto del bug del PR #79: sin el rearm, el
    // segundo "atrás" navegaría de largo sin avisar.
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(result.current.confirmOpen).toBe(true);
  });
});

describe("useUnsavedChangesGuard: beforeunload (cerrar/recargar la pestaña)", () => {
  it("con cambios sin guardar, beforeunload se cancela (preventDefault)", () => {
    renderHook(() => useUnsavedChangesGuard(true));

    // jsdom no implementa BeforeUnloadEvent (returnValue ahí es un booleano
    // derivado de preventDefault, no el string que setea el hook) — se
    // verifica el intercept real por preventDefault, no por returnValue.
    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("sin cambios sin guardar, beforeunload no se intercepta", () => {
    renderHook(() => useUnsavedChangesGuard(false));

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
