import { useMemo, useState } from "react";
import {
  isCircometriaFormat,
  normalizeCircometriaValue,
} from "@/components/clinical/EdemaCircometryTable";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AromSelector {
  part: string;
  field: string;
}

export interface EvaData {
  current: number | null;
  previous: number | null;
  trend: "mejora" | "empeora" | "estable" | null;
  series: { date: string; value: number }[];
}

export interface EdemaData {
  maxDelta: number | null;
  hasAlert: boolean;
  /** "calculable" = nuevo formato bilateral | "incompatible" = legacy | "no_data" = sin registro */
  format: "calculable" | "incompatible" | "no_data";
}

export interface ForceData {
  affectedAvg: number | null;
  sanaAvg: number | null;
  percent: number | null;
  hasAlert50: boolean;
  hasAlert25: boolean;
  affectedSide: "MSD" | "MSI" | "both" | null;
  seriesMsd: { date: string; value: number }[];
  seriesMsi: { date: string; value: number }[];
}

export interface AromData {
  series: { date: string; value: number }[];
  available: { part: string; field: string; label: string; count: number }[];
}

export interface QuickdashData {
  current: number | null;
  series: { date: string; value: number }[];
}

export interface DashboardAlerts {
  evaHigh: boolean;
  evaPlateau: boolean;
  edema: boolean;
  force50: boolean;
  force25: boolean;
}

export interface PatientDashboardData {
  eva: EvaData;
  edema: EdemaData;
  force: ForceData;
  arom: AromData;
  quickdash: QuickdashData;
  alerts: DashboardAlerts;
  lastSession: { session: any; analEval: any | null } | null;
  sessionCount: number;
  aromSelector: AromSelector;
  setAromSelector: (s: AromSelector) => void;
}

// ── GONIO labels (mirrors GONIO_PARTS in SessionForm.tsx) ─────────────────

const GONIO_LABELS: Record<string, Record<string, string>> = {
  shoulder: {
    flex: "Hombro Flex.", ext: "Hombro Ext.", add: "Hombro Aduc.",
    abd: "Hombro Abd.", rot_ext: "Hombro Rot.Ext.", rot_int: "Hombro Rot.Int.",
  },
  elbow: {
    flex: "Codo Flex.", ext: "Codo Ext.", prono: "Pronación", supino: "Supinación",
  },
  wrist: {
    flex: "Muñeca Flex.", ext: "Muñeca Ext.", dr: "Desv. Radial",
    dc: "Desv. Cubital", prono: "Pronación", supino: "Supinación",
  },
  hand: {
    mcf_flex: "MCF Flex.", mcf_ext: "MCF Ext.", ifp_flex: "IFP Flex.",
    ifp_ext: "IFP Ext.", ifd_flex: "IFD Flex.", ifd_ext: "IFD Ext.",
  },
  thumb: {
    mcf_flex: "Pulgar MCF Flex.", mcf_ext: "Pulgar MCF Ext.",
    if_flex: "Pulgar IF Flex.", if_ext: "Pulgar IF Ext.",
  },
};

// ── Helper ────────────────────────────────────────────────────────────────

function extractAromValue(ae: any, side: string, part: string, field: string): number | null {
  const pre = ae.goniometry?.arom?.[side]?.pre;
  if (!Array.isArray(pre)) return null;
  const entry = pre.find((g: any) => g?.body_part === part);
  const val = entry?.values?.[field];
  return typeof val === "number" ? val : null;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function usePatientDashboard(
  analEvals: any[],
  funcEvals: any[],
  sessions: any[],
  episode: any | null,
  quickdashTokens: any[] = [],
): PatientDashboardData {
  const [aromSelector, setAromSelector] = useState<AromSelector>({ part: "wrist", field: "ext" });

  // Sort once — reused by all derived memos
  const sorted = useMemo(
    () =>
      [...analEvals].sort(
        (a, b) => new Date(a.evaluation_date).getTime() - new Date(b.evaluation_date).getTime()
      ),
    [analEvals]
  );

  const sortedSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => !s.is_deleted)
        .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()),
    [sessions]
  );

  const sortedFuncEvals = useMemo(
    () =>
      [...funcEvals].sort(
        (a, b) => new Date(a.evaluation_date).getTime() - new Date(b.evaluation_date).getTime()
      ),
    [funcEvals]
  );

  // ── EVA ──────────────────────────────────────────────────────────────────

  const evaData = useMemo((): EvaData => {
    const withEva = sorted.filter((ae) => ae.pain_score != null);
    const current: number | null = withEva.at(-1)?.pain_score ?? null;
    const previous: number | null = withEva.at(-2)?.pain_score ?? null;
    const trend =
      current != null && previous != null
        ? current < previous
          ? "mejora"
          : current > previous
          ? "empeora"
          : "estable"
        : null;
    return {
      current,
      previous,
      trend,
      series: withEva.map((ae) => ({ date: ae.evaluation_date, value: ae.pain_score as number })),
    };
  }, [sorted]);

  // ── Edema ─────────────────────────────────────────────────────────────────

  const edemaData = useMemo((): EdemaData => {
    const last = [...sorted].reverse().find((ae) => ae.edema_circummetry != null);
    if (!last) return { maxDelta: null, hasAlert: false, format: "no_data" };

    if (isCircometriaFormat(last.edema_circummetry)) {
      const items = normalizeCircometriaValue(last.edema_circummetry);
      const diffs = items
        .filter((it) => it.msd !== "" && it.msi !== "")
        .map((it) => Math.abs(parseFloat(it.msd) - parseFloat(it.msi)));
      const maxDelta = diffs.length > 0 ? Math.max(...diffs) : null;
      return { maxDelta, hasAlert: maxDelta != null && maxDelta >= 5, format: "calculable" };
    }

    return { maxDelta: null, hasAlert: false, format: "incompatible" };
  }, [sorted]);

  // ── Force ─────────────────────────────────────────────────────────────────

  const affectedSide = (episode?.affected_side as "MSD" | "MSI" | "both" | null) ?? null;

  const forceData = useMemo((): ForceData => {
    const withForce = sorted.filter(
      (ae) => ae.dynamometer_msd?.average != null || ae.dynamometer_msi?.average != null
    );
    const last = withForce.at(-1);

    let affectedAvg: number | null = null;
    let sanaAvg: number | null = null;
    let percent: number | null = null;

    if (last && (affectedSide === "MSD" || affectedSide === "MSI")) {
      affectedAvg =
        affectedSide === "MSD"
          ? (last.dynamometer_msd?.average ?? null)
          : (last.dynamometer_msi?.average ?? null);
      sanaAvg =
        affectedSide === "MSD"
          ? (last.dynamometer_msi?.average ?? null)
          : (last.dynamometer_msd?.average ?? null);
      if (affectedAvg != null && sanaAvg != null && sanaAvg > 0) {
        percent = Math.round((affectedAvg / sanaAvg) * 100);
      }
    }

    return {
      affectedAvg,
      sanaAvg,
      percent,
      hasAlert50: percent != null && percent < 50,
      hasAlert25: percent != null && percent < 25,
      affectedSide,
      seriesMsd: withForce
        .filter((ae) => ae.dynamometer_msd?.average != null)
        .map((ae) => ({ date: ae.evaluation_date, value: ae.dynamometer_msd.average as number })),
      seriesMsi: withForce
        .filter((ae) => ae.dynamometer_msi?.average != null)
        .map((ae) => ({ date: ae.evaluation_date, value: ae.dynamometer_msi.average as number })),
    };
  }, [sorted, affectedSide]);

  // ── AROM — available combos ───────────────────────────────────────────────

  const aromAvailable = useMemo(() => {
    const withArom = sorted.filter((ae) => ae.goniometry?.arom != null);
    const comboCounts: Record<string, number> = {};

    for (const ae of withArom) {
      for (const side of ["MSD", "MSI"]) {
        const pre = ae.goniometry?.arom?.[side]?.pre;
        if (!Array.isArray(pre)) continue;
        for (const entry of pre) {
          if (!entry?.body_part || !entry?.values) continue;
          for (const field of Object.keys(entry.values)) {
            const key = `${entry.body_part}|${field}`;
            comboCounts[key] = (comboCounts[key] ?? 0) + 1;
          }
        }
      }
    }

    return Object.entries(comboCounts)
      .map(([key, count]) => {
        const [part, field] = key.split("|");
        const label = GONIO_LABELS[part]?.[field] ?? `${part} ${field}`;
        return { part, field, label, count };
      })
      .sort((a, b) => b.count - a.count);
  }, [sorted]);

  // If the selected combo has no data, fall back to the most available one
  const effectiveAromSelector = useMemo((): AromSelector => {
    if (aromAvailable.length === 0) return aromSelector;
    const hasData = aromAvailable.some(
      (a) => a.part === aromSelector.part && a.field === aromSelector.field
    );
    return hasData ? aromSelector : { part: aromAvailable[0].part, field: aromAvailable[0].field };
  }, [aromAvailable, aromSelector]);

  // ── AROM — series for selected combo ─────────────────────────────────────

  const aromSeries = useMemo(() => {
    const withArom = sorted.filter((ae) => ae.goniometry?.arom != null);
    const { part, field } = effectiveAromSelector;
    // Primary side = affected side (MSD default). Fall back to the other side if no data.
    const primary = affectedSide === "MSI" ? "MSI" : "MSD";
    const fallback = primary === "MSD" ? "MSI" : "MSD";

    return withArom
      .map((ae) => {
        const val =
          extractAromValue(ae, primary, part, field) ??
          extractAromValue(ae, fallback, part, field);
        return val != null ? { date: ae.evaluation_date, value: val } : null;
      })
      .filter(Boolean) as { date: string; value: number }[];
  }, [sorted, effectiveAromSelector, affectedSide]);

  // ── QuickDASH — lee de quickdash_tokens (episode-scoped) ─────────────────

  const quickdashData = useMemo((): QuickdashData => {
    const sorted = [...quickdashTokens]
      .filter((t) => t.result?.score != null)
      .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
    return {
      current: sorted.at(-1)?.result.score ?? null,
      series: sorted.map((t) => ({ date: t.completed_at.slice(0, 10), value: t.result.score as number })),
    };
  }, [quickdashTokens]);

  // ── Alerts ────────────────────────────────────────────────────────────────

  const alerts = useMemo((): DashboardAlerts => {
    const withEva = sorted.filter((ae) => ae.pain_score != null);
    const last3 = withEva.slice(-3).map((ae) => ae.pain_score as number);
    const evaPlateau =
      last3.length === 3 && last3[1] >= last3[0] && last3[2] >= last3[1];

    return {
      evaHigh: evaData.current != null && evaData.current >= 7,
      evaPlateau,
      edema: edemaData.hasAlert,
      force50: forceData.hasAlert50,
      force25: forceData.hasAlert25,
    };
  }, [sorted, evaData, edemaData, forceData]);

  // ── Last session ──────────────────────────────────────────────────────────

  const lastSession = useMemo(() => {
    if (sortedSessions.length === 0) return null;
    const session = sortedSessions.at(-1)!;
    const analEval = [...sorted].reverse().find((ae) => ae.session_id === session.id) ?? null;
    return { session, analEval };
  }, [sortedSessions, sorted]);

  // ── Output ────────────────────────────────────────────────────────────────

  return {
    eva: evaData,
    edema: edemaData,
    force: forceData,
    arom: { series: aromSeries, available: aromAvailable },
    quickdash: quickdashData,
    alerts,
    lastSession,
    sessionCount: sortedSessions.length,
    aromSelector: effectiveAromSelector,
    setAromSelector,
  };
}
