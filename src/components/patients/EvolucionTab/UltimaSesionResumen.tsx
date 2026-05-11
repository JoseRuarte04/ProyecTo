import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Types ────────────────────────────────────────────────────────────────────

interface UltimaSesionResumenProps {
  lastSession: { session: any; analEval: any | null } | null;
  patientId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try {
    return format(parseISO(iso), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

function sessionTypeLabel(type: string | null) {
  const map: Record<string, string> = {
    admission: "Admisión",
    follow_up: "Seguimiento",
    discharge: "Alta",
    evaluation: "Evaluación",
  };
  return type ? (map[type] ?? type) : null;
}

// ── Value chip ────────────────────────────────────────────────────────────────

function ValueChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-muted min-w-[56px]">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UltimaSesionResumen({ lastSession, patientId }: UltimaSesionResumenProps) {
  const navigate = useNavigate();

  if (!lastSession) {
    return (
      <div className="space-y-3">
        <h2 className="font-serif text-base font-semibold text-foreground">Última sesión</h2>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Sin sesiones registradas aún.
        </div>
      </div>
    );
  }

  const { session, analEval } = lastSession;
  const typeLabel = sessionTypeLabel(session.session_type);
  const evaVal = analEval?.pain_score != null ? `${analEval.pain_score}/10` : null;
  const dynMsd = analEval?.dynamometer_msd?.average != null
    ? `${analEval.dynamometer_msd.average} kg`
    : null;
  const dynMsi = analEval?.dynamometer_msi?.average != null
    ? `${analEval.dynamometer_msi.average} kg`
    : null;
  const hasValues = evaVal || dynMsd || dynMsi;

  return (
    <div className="space-y-3">
      <h2 className="font-serif text-base font-semibold text-foreground">Última sesión</h2>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground capitalize">
                {fmtDate(session.session_date)}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {session.session_number != null && (
                  <span className="text-xs text-muted-foreground">
                    Sesión {session.session_number}
                  </span>
                )}
                {typeLabel && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                    {typeLabel}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7 shrink-0"
            onClick={() => navigate(`/patients/${patientId}/sessions/${session.id}/edit`)}
          >
            Ver sesión completa
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Values */}
        {hasValues && (
          <div className="flex items-center gap-2 flex-wrap">
            {evaVal  && <ValueChip label="EVA"     value={evaVal} />}
            {dynMsd  && <ValueChip label="Din MSD" value={dynMsd} />}
            {dynMsi  && <ValueChip label="Din MSI" value={dynMsi} />}
          </div>
        )}

        {!hasValues && analEval == null && (
          <p className="text-xs text-muted-foreground">
            Esta sesión no tiene evaluación analítica registrada.
          </p>
        )}
      </div>
    </div>
  );
}
