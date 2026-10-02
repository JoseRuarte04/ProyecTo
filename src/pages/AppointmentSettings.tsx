import { useEffect, useState } from "react";
import { Loader2, User, Building2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Cie10AutocompleteInline } from "@/components/patients/Cie10AutocompleteInline";
import { PriorityDot } from "@/components/PriorityDot";
import { usePriorityRules } from "@/hooks/usePriorityRules";
import { PRIORITY_LEVELS, PRIORITY_META, type PriorityLevel } from "@/lib/priority";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAppointmentSettings } from "@/hooks/useAppointmentSettings";

const DEFAULT_LIMIT = 3;

function PrioritySemaphore() {
  const { rules, loading, canEdit, addRule, setLevel, removeRule } = usePriorityRules();
  const [term, setTerm] = useState("");
  const [level, setNewLevel] = useState<PriorityLevel>("red");

  const add = async (r: { code: string | null; label: string }) => {
    await addRule({ code: r.code, label: r.label, level });
    setTerm("");
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-serif text-[15px] font-semibold tracking-tight text-foreground">Semáforo de prioridades</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Marcá patologías con un color. Al dar turno, los pacientes con esa patología se ven con su color.
        </p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
        {canEdit && (
          <div className="px-5 py-4 space-y-3">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Nivel para la patología nueva">
              {PRIORITY_LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={level === l}
                  onClick={() => setNewLevel(l)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    level === l ? PRIORITY_META[l].chip : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <PriorityDot level={l} />
                  {PRIORITY_META[l].label}
                </button>
              ))}
            </div>
            <Cie10AutocompleteInline
              value={term}
              onChange={setTerm}
              placeholder="Buscar patología (nombre o código CIE-10)"
              onSelect={(r) => add({ code: r.code, label: r.description })}
            />
            {term.trim().length >= 2 && (
              <button
                type="button"
                onClick={() => add({ code: null, label: term.trim() })}
                className="text-xs text-primary hover:underline"
              >
                Agregar "{term.trim()}" como texto libre
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rules.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Todavía no marcaste ninguna patología. Buscá una arriba para asignarle un color.
          </p>
        ) : (
          rules.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3">
              <PriorityDot level={r.level} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{r.label}</p>
                {r.code && <p className="text-xs text-muted-foreground">{r.code}</p>}
              </div>
              <select
                aria-label={`Nivel de ${r.label}`}
                value={r.level}
                disabled={!canEdit}
                onChange={(e) => setLevel(r.id, e.target.value as PriorityLevel)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {PRIORITY_LEVELS.map((l) => <option key={l} value={l}>{PRIORITY_META[l].label}</option>)}
              </select>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeRule(r.id)}
                  aria-label={`Quitar ${r.label}`}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function AppointmentSettings() {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const { maxAbsences, loading, canEdit, setMaxAbsences, ownerLabel } = useAppointmentSettings();
  const [enabled, setEnabled] = useState(false);
  const [value, setValue] = useState(String(DEFAULT_LIMIT));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(maxAbsences !== null);
    setValue(String(maxAbsences ?? DEFAULT_LIMIT));
  }, [maxAbsences]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 1;
  const dirty = enabled ? valid && parsed !== maxAbsences : maxAbsences !== null;

  const save = async () => {
    setSaving(true);
    const ok = await setMaxAbsences(enabled ? parsed : null);
    setSaving(false);
    if (ok) toast.success("Configuración guardada");
  };

  const WorkspaceIcon = workspace.type === "team" ? Building2 : User;

  return (
    <div className="space-y-6 max-w-2xl">
      <button
        onClick={() => navigate("/configuraciones")}
        className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Configuraciones
      </button>

      <PageHeader
        title="Turnos"
        subtitle="Avisos por ausencias y prioridades para dar turno."
        actions={
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/60 text-foreground">
            <WorkspaceIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {ownerLabel}
          </span>
        }
      />

      {!canEdit && (
        <p className="text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg px-4 py-3">
          Solo los admins del equipo pueden cambiar esta configuración. Este es el valor actual.
        </p>
      )}

      <div className="border border-border rounded-xl overflow-hidden bg-card divide-y divide-border">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <Label htmlFor="absence-limit-enabled" className="text-sm font-medium text-foreground cursor-pointer">
              Advertir por ausencias
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Al agendar un turno nuevo, se avisa si el paciente ya llegó al máximo.
            </p>
          </div>
          <Switch id="absence-limit-enabled" checked={enabled} disabled={!canEdit} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <div className="px-5 py-4 space-y-2">
            <Label htmlFor="absence-limit" className="text-sm font-normal text-foreground">
              Máximo de ausencias por paciente
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="absence-limit"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={value}
                disabled={!canEdit}
                onChange={(e) => setValue(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">ausencias</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cuentan los turnos marcados como "Ausente". Las ausencias con aviso no suman.
            </p>
            {!valid && <p className="text-xs text-destructive">Ingresá un número entero mayor o igual a 1.</p>}
          </div>
        )}
      </div>

      {canEdit && (
        <Button onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar cambios
        </Button>
      )}

      <PrioritySemaphore />
    </div>
  );
}
