import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { usePriorityRules } from "./usePriorityRules";

/**
 * Unit tests con Supabase mockeado (mismo patrón que
 * src/components/patients/diagnoses.test.ts) — el "semáforo de prioridades"
 * (src/lib/priority.ts, ya testeado para el matching puro) nunca tenía
 * cobertura en su capa de acceso a datos: altas/bajas/cambios de nivel y el
 * aislamiento personal-vs-equipo que decide qué filas lee y si el usuario
 * puede editarlas.
 */

const mockFrom = vi.fn();
const mockUseAuth = vi.fn();
const mockUseWorkspace = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/contexts/WorkspaceContext", () => ({ useWorkspace: () => mockUseWorkspace() }));
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => mockToastError(...args) } }));

// Mismo simulador de query builder "thenable" que diagnoses.test.ts.
type QueryResult = { data?: unknown; error?: unknown };
function chain(result: QueryResult) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn(() => c);
  c.insert = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.delete = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.order = vi.fn(() => c);
  c.then = (resolve: (v: QueryResult) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

let fromQueue: QueryResult[] = [];
beforeEach(() => {
  mockFrom.mockReset();
  mockUseAuth.mockReset();
  mockUseWorkspace.mockReset();
  mockToastError.mockReset();
  fromQueue = [];
  mockFrom.mockImplementation(() => chain(fromQueue.shift() ?? { data: null, error: null }));

  mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
  mockUseWorkspace.mockReturnValue({ workspace: { type: "personal" } });
});

describe("usePriorityRules: carga inicial", () => {
  it("workspace personal: lee owner_type='professional'/owner_id=user.id", async () => {
    const rows = [{ id: "r1", code: "S33.5", label: "Esguince lumbar", level: "red" }];
    fromQueue = [{ data: rows, error: null }];

    const { result } = renderHook(() => usePriorityRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rules).toEqual(rows);
    expect(result.current.canEdit).toBe(true);
    const selectChain = mockFrom.mock.results[0].value;
    expect(selectChain.eq).toHaveBeenCalledWith("owner_type", "professional");
    expect(selectChain.eq).toHaveBeenCalledWith("owner_id", "user-1");
  });

  it("workspace de equipo: lee owner_type='team'/owner_id=teamId y respeta canEdit=isAdmin", async () => {
    mockUseWorkspace.mockReturnValue({
      workspace: { type: "team", teamId: "team-1", teamName: "Equipo", isAdmin: false },
    });
    fromQueue = [{ data: [], error: null }];

    const { result } = renderHook(() => usePriorityRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canEdit).toBe(false);
    const selectChain = mockFrom.mock.results[0].value;
    expect(selectChain.eq).toHaveBeenCalledWith("owner_type", "team");
    expect(selectChain.eq).toHaveBeenCalledWith("owner_id", "team-1");
  });

  it("sin usuario logueado en workspace personal: no consulta nada, rules vacío", async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => usePriorityRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rules).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("si la carga falla, avisa con toast y deja rules vacío", async () => {
    fromQueue = [{ data: null, error: { message: "boom" } }];

    const { result } = renderHook(() => usePriorityRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rules).toEqual([]);
    expect(mockToastError).toHaveBeenCalledWith("No se pudo cargar el semáforo de prioridades");
  });
});

describe("usePriorityRules: addRule", () => {
  it("inserta con el owner correcto y recarga la lista", async () => {
    fromQueue = [{ data: [], error: null }]; // carga inicial
    const { result } = renderHook(() => usePriorityRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newRow = { id: "r2", code: "M54", label: "Lumbalgia", level: "yellow" };
    fromQueue = [{ data: null, error: null }, { data: [newRow], error: null }]; // insert + reload

    await act(async () => {
      await result.current.addRule({ code: "M54", label: "Lumbalgia", level: "yellow" });
    });

    const insertChain = mockFrom.mock.results[1].value;
    expect(insertChain.insert).toHaveBeenCalledWith({
      owner_type: "professional",
      owner_id: "user-1",
      code: "M54",
      label: "Lumbalgia",
      level: "yellow",
    });
    await waitFor(() => expect(result.current.rules).toEqual([newRow]));
  });

  it("patología duplicada (23505): mensaje específico, sin recargar", async () => {
    fromQueue = [{ data: [], error: null }]; // carga inicial
    const { result } = renderHook(() => usePriorityRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fromQueue = [{ data: null, error: { code: "23505" } }];
    await act(async () => {
      await result.current.addRule({ code: "M54", label: "Lumbalgia", level: "yellow" });
    });

    expect(mockToastError).toHaveBeenCalledWith("Esa patología ya está en el semáforo");
    expect(mockFrom).toHaveBeenCalledTimes(2); // carga inicial + insert fallido, sin reload
  });

  it("sin permiso de edición (equipo, no admin): no llama a Supabase", async () => {
    mockUseWorkspace.mockReturnValue({
      workspace: { type: "team", teamId: "team-1", teamName: "Equipo", isAdmin: false },
    });
    fromQueue = [{ data: [], error: null }];
    const { result } = renderHook(() => usePriorityRules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFrom.mockClear();
    await act(async () => {
      await result.current.addRule({ code: "M54", label: "Lumbalgia", level: "yellow" });
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("usePriorityRules: setLevel/removeRule", () => {
  async function renderWithOneRule() {
    const row = { id: "r1", code: "S33.5", label: "Esguince lumbar", level: "red" };
    fromQueue = [{ data: [row], error: null }];
    const { result } = renderHook(() => usePriorityRules());
    await waitFor(() => expect(result.current.loading).toBe(false));
    return { result, row };
  }

  it("setLevel actualiza optimistamente y persiste el cambio", async () => {
    const { result } = await renderWithOneRule();
    fromQueue = [{ data: null, error: null }];

    await act(async () => {
      await result.current.setLevel("r1", "green");
    });

    expect(result.current.rules[0].level).toBe("green");
    const updateChain = mockFrom.mock.results[1].value;
    expect(updateChain.update).toHaveBeenCalledWith({ level: "green" });
    expect(updateChain.eq).toHaveBeenCalledWith("id", "r1");
  });

  it("setLevel revierte (recarga) si falla la persistencia", async () => {
    const { result, row } = await renderWithOneRule();
    fromQueue = [{ data: null, error: { message: "boom" } }, { data: [row], error: null }]; // update fallido + reload

    await act(async () => {
      await result.current.setLevel("r1", "green");
    });

    expect(mockToastError).toHaveBeenCalledWith("No se pudo cambiar el nivel: boom");
    await waitFor(() => expect(result.current.rules[0].level).toBe("red")); // reload trae el valor real
  });

  it("removeRule quita optimistamente y persiste el borrado", async () => {
    const { result } = await renderWithOneRule();
    fromQueue = [{ data: null, error: null }];

    await act(async () => {
      await result.current.removeRule("r1");
    });

    expect(result.current.rules).toHaveLength(0);
    const deleteChain = mockFrom.mock.results[1].value;
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith("id", "r1");
  });

  it("removeRule revierte (recarga) si falla el borrado", async () => {
    const { result, row } = await renderWithOneRule();
    fromQueue = [{ data: null, error: { message: "boom" } }, { data: [row], error: null }];

    await act(async () => {
      await result.current.removeRule("r1");
    });

    expect(mockToastError).toHaveBeenCalledWith("No se pudo quitar: boom");
    await waitFor(() => expect(result.current.rules).toHaveLength(1));
  });
});
