import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EvaData, ForceData, AromData, QuickdashData, AromSelector } from "@/hooks/usePatientDashboard";

// ── Design tokens for Recharts (SVG can't use CSS vars directly) ─────────────
const COLOR_PRIMARY    = "hsl(192, 35%, 30%)";
const COLOR_MSD        = "hsl(192, 35%, 30%)";
const COLOR_MSI        = "hsl(38, 85%, 50%)";
const COLOR_MUTED      = "hsl(220, 8%, 85%)";
const COLOR_DANGER_REF = "hsl(0, 72%, 60%)";
const COLOR_WARN_REF   = "hsl(38, 85%, 55%)";

// ── Shared helpers ────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "dd/MM", { locale: es }); }
  catch { return iso; }
}

function fmtTooltipDate(iso: string) {
  try { return format(parseISO(iso), "d 'de' MMMM", { locale: es }); }
  catch { return iso; }
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      {message}
    </div>
  );
}

const sharedCartesianGrid = <CartesianGrid strokeDasharray="3 3" stroke={COLOR_MUTED} vertical={false} />;

const sharedXAxis = (
  <XAxis
    dataKey="date"
    tickFormatter={fmtDate}
    tick={{ fontSize: 11, fill: "hsl(220, 8%, 52%)" }}
    axisLine={false}
    tickLine={false}
    dy={6}
  />
);

function SharedTooltip({ payload, label, unit }: any) {
  if (!payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-none">
      <p className="text-muted-foreground mb-1">{fmtTooltipDate(label)}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}{unit}
        </p>
      ))}
    </div>
  );
}

// ── Chart card wrapper ────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function ChartCard({ title, action, children, className }: ChartCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="h-[180px]">{children}</div>
    </div>
  );
}

// ── EVA chart ─────────────────────────────────────────────────────────────────

function EvaChart({ eva }: { eva: EvaData }) {
  const data = eva.series.map((p) => ({ date: p.date, value: p.value }));

  return (
    <ChartCard title="Dolor — EVA">
      {data.length === 0 ? (
        <EmptyChart message="Sin registros de dolor aún" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            {sharedCartesianGrid}
            {sharedXAxis}
            <YAxis
              domain={[0, 10]}
              ticks={[0, 3, 7, 10]}
              tick={{ fontSize: 11, fill: "hsl(220, 8%, 52%)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<SharedTooltip unit="/10" />} />
            <ReferenceLine y={7} stroke={COLOR_DANGER_REF} strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "7", fontSize: 10, fill: COLOR_DANGER_REF, position: "right" }} />
            <ReferenceLine y={3} stroke={COLOR_WARN_REF}   strokeDasharray="4 3" strokeWidth={1}   label={{ value: "3", fontSize: 10, fill: COLOR_WARN_REF,   position: "right" }} />
            <Line
              type="monotone"
              dataKey="value"
              name="EVA"
              stroke={COLOR_PRIMARY}
              strokeWidth={2}
              dot={{ r: 4, fill: COLOR_PRIMARY, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ── AROM chart ────────────────────────────────────────────────────────────────

interface AromChartProps {
  arom: AromData;
  aromSelector: AromSelector;
  setAromSelector: (s: AromSelector) => void;
}

function AromChart({ arom, aromSelector, setAromSelector }: AromChartProps) {
  const data = arom.series.map((p) => ({ date: p.date, value: p.value }));
  const currentLabel =
    arom.available.find(
      (a) => a.part === aromSelector.part && a.field === aromSelector.field
    )?.label ?? "Movimiento";

  const selectorEl = arom.available.length > 1 ? (
    <Select
      value={`${aromSelector.part}|${aromSelector.field}`}
      onValueChange={(v) => {
        const [part, field] = v.split("|");
        setAromSelector({ part, field });
      }}
    >
      <SelectTrigger className="h-6 text-[11px] w-auto min-w-[130px] border-border bg-transparent px-2 py-0">
        <SelectValue>{currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {arom.available.map((a) => (
          <SelectItem key={`${a.part}|${a.field}`} value={`${a.part}|${a.field}`} className="text-xs">
            {a.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null;

  return (
    <ChartCard title="AROM — Rango de movimiento" action={selectorEl}>
      {data.length === 0 ? (
        <EmptyChart message={
          arom.available.length === 0
            ? "Sin registros de goniometría aún"
            : "Sin datos para el movimiento seleccionado"
        } />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            {sharedCartesianGrid}
            {sharedXAxis}
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 11, fill: "hsl(220, 8%, 52%)" }}
              axisLine={false}
              tickLine={false}
              unit="°"
            />
            <Tooltip content={<SharedTooltip unit="°" />} />
            <Line
              type="monotone"
              dataKey="value"
              name={currentLabel}
              stroke={COLOR_PRIMARY}
              strokeWidth={2}
              dot={{ r: 4, fill: COLOR_PRIMARY, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ── Force chart ───────────────────────────────────────────────────────────────

function ForceChart({ force }: { force: ForceData }) {
  const dates = Array.from(
    new Set([
      ...force.seriesMsd.map((p) => p.date),
      ...force.seriesMsi.map((p) => p.date),
    ])
  ).sort();

  const msdMap = Object.fromEntries(force.seriesMsd.map((p) => [p.date, p.value]));
  const msiMap = Object.fromEntries(force.seriesMsi.map((p) => [p.date, p.value]));

  const data = dates.map((date) => ({
    date,
    MSD: msdMap[date] ?? null,
    MSI: msiMap[date] ?? null,
  }));

  const hasData = data.length > 0;

  return (
    <ChartCard title="Fuerza — Dinamometría (kgf)">
      {!hasData ? (
        <EmptyChart message="Sin registros de dinamometría aún" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            {sharedCartesianGrid}
            {sharedXAxis}
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 11, fill: "hsl(220, 8%, 52%)" }}
              axisLine={false}
              tickLine={false}
              unit=" kg"
            />
            <Tooltip content={<SharedTooltip unit=" kgf" />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            />
            <Line
              type="monotone"
              dataKey="MSD"
              name="MSD"
              stroke={COLOR_MSD}
              strokeWidth={2}
              dot={{ r: 3, fill: COLOR_MSD, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="MSI"
              name="MSI"
              stroke={COLOR_MSI}
              strokeWidth={2}
              dot={{ r: 3, fill: COLOR_MSI, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ── QuickDASH chart ───────────────────────────────────────────────────────────

function QuickdashChart({ quickdash }: { quickdash: QuickdashData }) {
  const data = quickdash.series.map((p) => ({ date: p.date, value: p.value }));

  return (
    <ChartCard title="QuickDASH — Función percibida">
      {data.length === 0 ? (
        <EmptyChart message="Sin evaluaciones QuickDASH aún" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            {sharedCartesianGrid}
            {sharedXAxis}
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 11, fill: "hsl(220, 8%, 52%)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<SharedTooltip unit="/100" />} />
            <ReferenceLine
              y={50}
              stroke={COLOR_WARN_REF}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: "Moderado", fontSize: 10, fill: COLOR_WARN_REF, position: "right" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="QuickDASH"
              stroke={COLOR_PRIMARY}
              strokeWidth={2}
              dot={{ r: 4, fill: COLOR_PRIMARY, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ── Exported component ────────────────────────────────────────────────────────

interface GraficosEvolucionProps {
  eva: EvaData;
  arom: AromData;
  force: ForceData;
  quickdash: QuickdashData;
  aromSelector: AromSelector;
  setAromSelector: (s: AromSelector) => void;
}

export function GraficosEvolucion({
  eva,
  arom,
  force,
  quickdash,
  aromSelector,
  setAromSelector,
}: GraficosEvolucionProps) {
  return (
    <div className="space-y-3">
      <h2 className="font-serif text-base font-semibold text-foreground">Evolución</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <EvaChart eva={eva} />
        <AromChart arom={arom} aromSelector={aromSelector} setAromSelector={setAromSelector} />
        <ForceChart force={force} />
        <QuickdashChart quickdash={quickdash} />
      </div>
    </div>
  );
}
