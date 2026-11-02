import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "./AuthContext";

/**
 * Unit tests con Supabase mockeado (mismo patrón que
 * src/components/patients/diagnoses.test.ts). Cubre la lógica más sutil de
 * este contexto, usado por toda la app: la reconciliación de email entre
 * `auth.users`/`profiles` (no hay trigger que la propague, ver
 * AuthContext.tsx:56-61) y cuándo re-pedir el perfil tras un evento de
 * `onAuthStateChange` — en particular, por qué TOKEN_REFRESHED con el mismo
 * usuario NO debe re-consultar, pero USER_UPDATED SÍ debe hacerlo siempre.
 */

const mockFrom = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => mockToastError(...args) } }));

type ProfileRow = { id: string; full_name: string; email: string; role: string; specialty: null; license_number: null; avatar_url: null };
type QueryResult = { data?: ProfileRow | null; error?: unknown };

function chain(result: QueryResult) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.single = vi.fn(() => Promise.resolve(result));
  // El UPDATE de reconciliación de email no encadena .single() — se awaitea
  // directo sobre .eq(), así que el chain también tiene que ser thenable.
  c.then = (resolve: (v: QueryResult) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

function makeProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "user-1",
    full_name: "RLS Test A",
    email: "a@example.com",
    role: "professional",
    specialty: null,
    license_number: null,
    avatar_url: null,
    ...overrides,
  };
}

function fakeSession(userId: string, email: string): Session {
  return { user: { id: userId, email } } as unknown as Session;
}

// Captura el callback real que AuthProvider le pasa a onAuthStateChange,
// para poder simular eventos (TOKEN_REFRESHED, USER_UPDATED, SIGNED_OUT...)
// sin depender de Supabase real.
let authStateCallback: ((event: string, session: Session | null) => void) | null = null;

let fromQueue: QueryResult[] = [];
beforeEach(() => {
  mockFrom.mockReset();
  mockGetSession.mockReset();
  mockOnAuthStateChange.mockReset();
  mockSignOut.mockReset();
  mockToastError.mockReset();
  fromQueue = [];
  authStateCallback = null;

  mockFrom.mockImplementation(() => chain(fromQueue.shift() ?? { data: null, error: null }));
  mockOnAuthStateChange.mockImplementation((cb: typeof authStateCallback) => {
    authStateCallback = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockSignOut.mockResolvedValue({ error: null });
});

describe("AuthContext: carga inicial", () => {
  it("sin sesión: user/profile quedan null y loading pasa a false", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it("con sesión existente: pide el perfil y lo deja en el contexto", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession("user-1", "a@example.com") } });
    fromQueue = [{ data: makeProfile(), error: null }];

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    expect(result.current.user?.id).toBe("user-1");
    expect(result.current.profile!.full_name).toBe("RLS Test A");
  });

  it("si falla la carga del perfil, avisa con toast y no rompe", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession("user-1", "a@example.com") } });
    fromQueue = [{ data: null, error: { message: "boom" } }];

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("No se pudo cargar tu perfil", { description: "Probá recargar la página." }));
    expect(result.current.profile).toBeNull();
  });
});

describe("AuthContext: reconciliación de email auth.users → profiles", () => {
  it("si el email de auth difiere del guardado en profiles, lo actualiza y lo refleja en el contexto", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession("user-1", "nuevo@example.com") } });
    // El select trae el email VIEJO (profiles todavía no se actualizó).
    fromQueue = [{ data: makeProfile({ email: "viejo@example.com" }), error: null }, { data: null, error: null }];

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.profile?.email).toBe("nuevo@example.com"));
    // 2 llamadas a .from("profiles"): el select y el update de reconciliación.
    expect(mockFrom).toHaveBeenCalledTimes(2);
    const updateChain = mockFrom.mock.results[1].value;
    expect(updateChain.update).toHaveBeenCalledWith({ email: "nuevo@example.com" });
    expect(updateChain.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("si el email ya coincide, no dispara ningún update", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession("user-1", "a@example.com") } });
    fromQueue = [{ data: makeProfile({ email: "a@example.com" }), error: null }];

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.profile).not.toBeNull());
    expect(mockFrom).toHaveBeenCalledTimes(1); // solo el select, sin update
  });
});

describe("AuthContext: eventos de onAuthStateChange", () => {
  it("TOKEN_REFRESHED con el mismo usuario NO vuelve a pedir el perfil", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession("user-1", "a@example.com") } });
    fromQueue = [{ data: makeProfile(), error: null }];

    renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));

    act(() => {
      authStateCallback?.("TOKEN_REFRESHED", fakeSession("user-1", "a@example.com"));
    });

    // Si volviera a pedir el perfil, mockFrom se llamaría una 2da vez — se
    // espera un rato prudencial (el fetch real usa setTimeout(0)) y se
    // confirma que se quedó en 1.
    await new Promise((r) => setTimeout(r, 20));
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("USER_UPDATED con el mismo usuario SÍ vuelve a pedir el perfil (cambio de email/password confirmado)", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession("user-1", "a@example.com") } });
    fromQueue = [{ data: makeProfile(), error: null }, { data: makeProfile({ full_name: "Nombre actualizado" }), error: null }];

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));

    act(() => {
      authStateCallback?.("USER_UPDATED", fakeSession("user-1", "a@example.com"));
    });

    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.profile!.full_name).toBe("Nombre actualizado"));
  });

  it("cambiar a OTRO usuario vuelve a pedir el perfil", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession("user-1", "a@example.com") } });
    fromQueue = [
      { data: makeProfile(), error: null },
      { data: makeProfile({ id: "user-2", full_name: "RLS Test B", email: "b@example.com" }), error: null },
    ];

    renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));

    act(() => {
      authStateCallback?.("SIGNED_IN", fakeSession("user-2", "b@example.com"));
    });

    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(2));
  });

  it("sesión cerrada (sin user en el evento): limpia profile y deja de recordar el último userId", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession("user-1", "a@example.com") } });
    fromQueue = [{ data: makeProfile(), error: null }];

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.profile).not.toBeNull());

    act(() => {
      authStateCallback?.("SIGNED_OUT", null);
    });

    await waitFor(() => expect(result.current.profile).toBeNull());
    expect(result.current.user).toBeNull();
  });
});

describe("AuthContext: signOut/refreshProfile", () => {
  it("signOut llama a supabase.auth.signOut() y limpia session/profile", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession("user-1", "a@example.com") } });
    fromQueue = [{ data: makeProfile(), error: null }];

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.profile).not.toBeNull());

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it("refreshProfile vuelve a pedir el perfil del usuario actual", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession("user-1", "a@example.com") } });
    fromQueue = [{ data: makeProfile(), error: null }, { data: makeProfile({ full_name: "Refrescado" }), error: null }];

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.profile).not.toBeNull());

    await act(async () => {
      await result.current.refreshProfile();
    });

    expect(result.current.profile!.full_name).toBe("Refrescado");
  });

  it("refreshProfile sin sesión activa no llama a Supabase", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFrom.mockClear();
    await act(async () => {
      await result.current.refreshProfile();
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
