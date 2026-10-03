import { describe, it, expect } from "vitest";
import { priorityForDiagnoses, type PriorityRule, type DiagnosisLike } from "./priority";

/**
 * priorityForDiagnoses es la lógica real detrás del semáforo de prioridades
 * (PR #28, docs/AUDIT_2026-10-02.md): "un paciente toma el nivel más alto
 * entre los diagnósticos de sus episodios activos". Es función pura, sin
 * Supabase — unit test directo, sin mocks.
 */

describe("priorityForDiagnoses", () => {
  it("matchea por código CIE-10, ignorando mayúsculas/espacios", () => {
    const diagnoses: DiagnosisLike[] = [{ code: " s33.5 ", label: "Esguince lumbar" }];
    const rules: PriorityRule[] = [{ code: "S33.5", label: "Otra cosa", level: "red" }];
    expect(priorityForDiagnoses(diagnoses, rules)).toBe("red");
  });

  it("matchea por nombre cuando el código no coincide o es null", () => {
    const diagnoses: DiagnosisLike[] = [{ code: null, label: "  Lumbalgia  " }];
    const rules: PriorityRule[] = [{ code: "M54.5", label: "lumbalgia", level: "yellow" }];
    expect(priorityForDiagnoses(diagnoses, rules)).toBe("yellow");
  });

  it("con varias reglas que matchean, gana la más urgente (red > yellow > green)", () => {
    const diagnoses: DiagnosisLike[] = [
      { code: "A1", label: "Dx A" },
      { code: "B1", label: "Dx B" },
    ];
    const rules: PriorityRule[] = [
      { code: "A1", label: "Dx A", level: "yellow" },
      { code: "B1", label: "Dx B", level: "red" },
    ];
    expect(priorityForDiagnoses(diagnoses, rules)).toBe("red");
  });

  it("el orden de las reglas no cambia el resultado (rojo encontrado primero o después)", () => {
    const diagnoses: DiagnosisLike[] = [{ code: "A1", label: "Dx A" }];
    const reglasRojoPrimero: PriorityRule[] = [
      { code: "A1", label: "Dx A", level: "red" },
      { code: "A1", label: "Dx A", level: "green" },
    ];
    const reglasRojoDespues: PriorityRule[] = [
      { code: "A1", label: "Dx A", level: "green" },
      { code: "A1", label: "Dx A", level: "red" },
    ];
    expect(priorityForDiagnoses(diagnoses, reglasRojoPrimero)).toBe("red");
    expect(priorityForDiagnoses(diagnoses, reglasRojoDespues)).toBe("red");
  });

  it("devuelve null si ningún diagnóstico matchea ninguna regla", () => {
    const diagnoses: DiagnosisLike[] = [{ code: "Z99", label: "Sin relación" }];
    const rules: PriorityRule[] = [{ code: "S33.5", label: "Esguince lumbar", level: "red" }];
    expect(priorityForDiagnoses(diagnoses, rules)).toBeNull();
  });

  it("devuelve null con listas vacías", () => {
    expect(priorityForDiagnoses([], [])).toBeNull();
    expect(priorityForDiagnoses([{ code: "A1", label: "Dx A" }], [])).toBeNull();
    expect(priorityForDiagnoses([], [{ code: "A1", label: "Dx A", level: "red" }])).toBeNull();
  });

  it("no matchea por código si uno de los dos lados es null (exige nombre igual)", () => {
    const diagnoses: DiagnosisLike[] = [{ code: null, label: "Otro nombre" }];
    const rules: PriorityRule[] = [{ code: "S33.5", label: "Esguince lumbar", level: "red" }];
    expect(priorityForDiagnoses(diagnoses, rules)).toBeNull();
  });
});
