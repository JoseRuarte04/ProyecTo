import { describe, it, expect } from "vitest";
import {
  calcQuickDashScore,
  calcQuickDashPartial,
  emptyQuickDash,
  FIM_ALL,
  emptyFim,
  calcFimTotal,
  calcGroupSubtotal,
} from "./functionalScales";

/**
 * Validado contra la definición oficial de cada escala, no solo contra el
 * comportamiento actual del código (pedido explícito de Jose, 2026-10-29):
 *
 * - QuickDASH: Institute for Work & Health (IWH), instrumento DASH/QuickDASH.
 *   Fórmula: ((suma de respuestas / n) - 1) × 25, con n = ítems respondidos.
 *   Regla oficial de ítems faltantes: el score NO puede calcularse si falta
 *   más del 10% de los ítems — en un cuestionario de 11 ítems, eso es más de
 *   1 ítem faltante. Es decir, el mínimo para poder puntuar es 10 de 11
 *   respondidos. Fuente: guías de puntuación oficiales traducidas del IWH
 *   (ej. https://www.dash.iwh.on.ca/sites/dash/public/translations/Scoring_QuickDASH_Slovak.pdf,
 *   mismo texto en todas las traducciones oficiales) y protocolos de
 *   ensayos clínicos que citan el mismo umbral (ver WebSearch 2026-10-29,
 *   sin una única URL canónica en inglés disponible en esa búsqueda).
 *
 * - FIM (Uniform Data System for Medical Rehabilitation / UDSMR): el manual
 *   CMS IRF-PAI y el protocolo de entrenamiento FIM/FAM de King's College
 *   London coinciden en que NINGÚN ítem debe quedar en blanco — si una
 *   actividad no se puede evaluar (ej. "en riesgo si se testea"), se
 *   registra explícitamente 1, nunca se omite. No existe una regla oficial
 *   de "total parcial" con ítems faltantes porque el protocolo está pensado
 *   para que eso nunca pase. Fuente: CMS IRF-PAI Training Manual
 *   (https://www.cms.gov/Medicare/Medicare-Fee-for-Service-Payment/InpatientRehabFacPPS/downloads/irfpai-manualint.pdf)
 *   y King's College London FIM/FAM training handout (ver WebSearch
 *   2026-10-29). No se encontró el manual UDSMR original (de pago/acceso
 *   restringido) — esto se marca como no verificado contra la fuente
 *   primaria exacta, solo contra fuentes secundarias que la citan.
 */

describe("QuickDASH: calcQuickDashScore/calcQuickDashPartial", () => {
  // Fórmula oficial con los 11 ítems completos: ((suma/11)-1)*25.
  it("los 11 ítems en el valor mínimo (1) da 0/100", () => {
    const items = Array(11).fill(1);
    expect(calcQuickDashScore(items)).toBe(0);
    expect(calcQuickDashPartial(items)).toBe(0);
  });

  it("los 11 ítems en el valor máximo (5) da 100/100", () => {
    const items = Array(11).fill(5);
    expect(calcQuickDashScore(items)).toBe(100);
    expect(calcQuickDashPartial(items)).toBe(100);
  });

  it("los 11 ítems en 3 (punto medio) da 50/100", () => {
    const items = Array(11).fill(3);
    expect(calcQuickDashScore(items)).toBe(50);
    expect(calcQuickDashPartial(items)).toBe(50);
  });

  it("calcQuickDashPartial usa n = ítems respondidos, no 11 fijo (igual que la fórmula oficial)", () => {
    // 3 ítems respondidos en 1 (mínimo): ((3/3)-1)*25 = 0, no ((3/11)-1)*25.
    const items: (number | null)[] = [1, 1, 1, ...Array(8).fill(null)];
    expect(calcQuickDashPartial(items)).toBe(0);
  });

  it("emptyQuickDash da un array de 11 nulls", () => {
    expect(emptyQuickDash()).toEqual(Array(11).fill(null));
  });

  // ── Discrepancias contra la fuente oficial — NO corregidas a propósito,
  // es una decisión de producto que le toca a Jose. Ver docs/TASKS.md.

  it.skip(
    "DISCREPANCIA: oficialmente un score es calculable con 1 ítem faltante (10/11) — " +
      "calcQuickDashScore(FunctionalScales.tsx:29) exige los 11 completos y devuelve null " +
      "si falta cualquiera, más estricto que la regla oficial del IWH (ver fuente arriba). " +
      "Con 10 de 11 respondidos en 1, el score oficial sería ((10/10)-1)*25 = 0, pero " +
      "calcQuickDashScore devuelve null.",
    () => {
      const items: (number | null)[] = [...Array(10).fill(1), null];
      expect(calcQuickDashScore(items)).toBe(0); // fallaría hoy: devuelve null
    },
  );

  it.skip(
    "DISCREPANCIA: oficialmente NO se puede calcular un score con más de 1 ítem faltante " +
      "(menos de 10/11 respondidos) — calcQuickDashPartial(FunctionalScales.tsx:37) no tiene " +
      "ese piso: calcula un score con tan solo 1 de 11 ítems respondidos, más permisivo que " +
      "la regla oficial del IWH. El uso actual (preview en vivo mientras se completa el " +
      "formulario) puede ser intencional, pero el valor mostrado no es un QuickDASH válido " +
      "según la fuente oficial hasta llegar a 10/11.",
    () => {
      const items: (number | null)[] = [1, ...Array(10).fill(null)];
      expect(calcQuickDashPartial(items)).toBeNull(); // fallaría hoy: devuelve 0
    },
  );
});

describe("FIM: calcFimTotal/calcGroupSubtotal", () => {
  it("FIM_ALL tiene los 18 ítems del estándar (13 motor + 5 cognitivo)", () => {
    expect(FIM_ALL).toHaveLength(18);
  });

  it("emptyFim da un objeto con los 18 ítems en null", () => {
    const empty = emptyFim();
    expect(Object.keys(empty)).toHaveLength(18);
    expect(Object.values(empty).every((v) => v === null)).toBe(true);
  });

  it("los 18 ítems en el mínimo (1) da el total mínimo (18)", () => {
    const items = Object.fromEntries(FIM_ALL.map((i) => [i.key, 1]));
    expect(calcFimTotal(items)).toBe(18);
  });

  it("los 18 ítems en el máximo (7) da el total máximo (126)", () => {
    const items = Object.fromEntries(FIM_ALL.map((i) => [i.key, 7]));
    expect(calcFimTotal(items)).toBe(126);
  });

  it("calcGroupSubtotal suma solo los ítems del grupo, ignorando los demás", () => {
    const group = { items: [{ key: "a" }, { key: "b" }] };
    expect(calcGroupSubtotal({ a: 3, b: 4, c: 999 }, group)).toBe(7);
  });

  it("calcGroupSubtotal da null si ningún ítem del grupo está respondido", () => {
    const group = { items: [{ key: "a" }, { key: "b" }] };
    expect(calcGroupSubtotal({ a: null, b: null }, group)).toBeNull();
  });

  it.skip(
    "DISCREPANCIA: el protocolo oficial de FIM (UDSMR/CMS IRF-PAI) no contempla ítems " +
      "faltantes — todo ítem no testeable se registra explícitamente como 1, nunca se omite " +
      "(ver fuente arriba). calcFimTotal(FunctionalScales.tsx:197) suma solo los ítems " +
      "respondidos y no distingue un total de 18/18 ítems de uno parcial: con solo 1 de 18 " +
      "respondido en 7 ya devuelve 7, no null ni ningún aviso de incompletitud. Además, " +
      "FimSection (FunctionalScales.tsx) muestra ese total en un badge 'FIM: {total}/126' sin " +
      "el indicador '(parcial)' que sí tiene el badge de QuickDASH — un total incompleto se ve " +
      "idéntico a uno completo en la UI.",
    () => {
      const items = emptyFim();
      items[FIM_ALL[0].key] = 7;
      expect(calcFimTotal(items)).toBeNull(); // fallaría hoy: devuelve 7
    },
  );
});
