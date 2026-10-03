import { describe, it, expect, vi, beforeEach } from "vitest";
import { primaryLabel, saveEpisodeDiagnoses, fetchEpisodeDiagnoses, type DiagnosisItem } from "./diagnoses";

/**
 * Unit tests con Supabase mockeado (a diferencia de src/test/rls.test.ts,
 * que pega contra el proyecto real). Cubre diagnoses.ts porque fue el
 * origen del crítico #2 de la auditoría del 2026-10-02 (guardado sin
 * chequeo de error) — el objetivo acá es que una regresión de ese tipo
 * rompa el build, no que alguien la encuentre en producción.
 */

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// Simula el query builder de supabase-js: cada método encadenable devuelve
// el mismo objeto, y el objeto es "thenable" — awaitearlo en cualquier
// punto de la cadena resuelve al resultado configurado. Así se puede hacer
// `await supabase.from(x).delete().eq(...)` o `.select().eq().order()`
// indistintamente, igual que el cliente real.
type QueryResult = { data?: unknown; error?: unknown };
function chain(result: QueryResult) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn(() => c);
  c.delete = vi.fn(() => c);
  c.insert = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.order = vi.fn(() => c);
  c.then = (resolve: (v: QueryResult) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

let fromQueue: QueryResult[] = [];
beforeEach(() => {
  mockFrom.mockReset();
  fromQueue = [];
  mockFrom.mockImplementation(() => chain(fromQueue.shift() ?? { data: null, error: null }));
});

describe("primaryLabel", () => {
  it("devuelve el label del primer diagnóstico, recortado", () => {
    const list: DiagnosisItem[] = [{ code: "S33.5", label: "  Esguince lumbar  " }, { code: "M54", label: "Lumbalgia" }];
    expect(primaryLabel(list)).toBe("Esguince lumbar");
  });

  it("devuelve null para una lista vacía", () => {
    expect(primaryLabel([])).toBeNull();
  });

  it("devuelve null si el label del primero es vacío o solo espacios", () => {
    expect(primaryLabel([{ code: null, label: "   " }])).toBeNull();
  });
});

describe("saveEpisodeDiagnoses", () => {
  const episodeId = "ep-1";
  const patientId = "pt-1";
  const list: DiagnosisItem[] = [
    { code: "S33.5", label: "Esguince lumbar" },
    { code: null, label: "Dolor referido" },
  ];

  it("borra y reinserta en orden cuando todo sale bien", async () => {
    fromQueue = [{ data: null, error: null }, { data: null, error: null }];
    const result = await saveEpisodeDiagnoses(episodeId, patientId, list);
    expect(result.error).toBeNull();

    const deleteChain = mockFrom.mock.results[0].value;
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith("episode_id", episodeId);

    const insertChain = mockFrom.mock.results[1].value;
    expect(insertChain.insert).toHaveBeenCalledWith([
      { episode_id: episodeId, patient_id: patientId, code: "S33.5", label: "Esguince lumbar", position: 0 },
      { episode_id: episodeId, patient_id: patientId, code: null, label: "Dolor referido", position: 1 },
    ]);
  });

  it("si el delete falla, corta ahí y NO llega a insertar", async () => {
    const delErr = { message: "RLS denied" };
    fromQueue = [{ data: null, error: delErr }];
    const result = await saveEpisodeDiagnoses(episodeId, patientId, list);
    expect(result.error).toBe(delErr);
    expect(mockFrom).toHaveBeenCalledTimes(1); // nunca se llamó .from() para el insert
  });

  it("con lista vacía, borra pero no inserta (sin error)", async () => {
    fromQueue = [{ data: null, error: null }];
    const result = await saveEpisodeDiagnoses(episodeId, patientId, []);
    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("si el insert falla, lo propaga en el resultado", async () => {
    const insertErr = { message: "constraint violation" };
    fromQueue = [{ data: null, error: null }, { data: null, error: insertErr }];
    const result = await saveEpisodeDiagnoses(episodeId, patientId, list);
    expect(result.error).toBe(insertErr);
  });
});

describe("fetchEpisodeDiagnoses", () => {
  it("devuelve la lista mapeada (code, label) ordenada por position", async () => {
    fromQueue = [
      { data: [{ code: "S33.5", label: "Esguince lumbar", position: 0 }, { code: null, label: "Dolor referido", position: 1 }], error: null },
    ];
    const result = await fetchEpisodeDiagnoses("ep-1");
    expect(result).toEqual([
      { code: "S33.5", label: "Esguince lumbar" },
      { code: null, label: "Dolor referido" },
    ]);
  });

  it("tira si la query falla, en vez de devolver [] en silencio", async () => {
    const err = { message: "network error" };
    fromQueue = [{ data: null, error: err }];
    await expect(fetchEpisodeDiagnoses("ep-1")).rejects.toBe(err);
  });
});
