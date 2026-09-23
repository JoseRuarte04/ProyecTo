import { Loader2, User, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useEvaluationSettings } from "@/hooks/useEvaluationSettings";
import { EVALUATION_GROUPS, EVALUATION_LABELS } from "@/lib/evaluationSettings";

export default function EvaluationSettings() {
  const { workspace } = useWorkspace();
  const { settings, loading, canEdit, setEnabled, ownerLabel } = useEvaluationSettings();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const WorkspaceIcon = workspace.type === "team" ? Building2 : User;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Evaluaciones"
        subtitle="Elegí qué escalas ves al crear una sesión nueva."
        actions={
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/60 text-foreground">
            <WorkspaceIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {ownerLabel}
          </span>
        }
      />

      {!canEdit && (
        <p className="text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg px-4 py-3">
          Solo los admins del equipo pueden cambiar esta configuración. Estos son los valores actuales.
        </p>
      )}

      <div className="space-y-6">
        {EVALUATION_GROUPS.map((group) => {
          const enabledCount = group.keys.filter((k) => settings[k]).length;
          return (
            <div key={group.step} className="border border-border rounded-xl overflow-hidden bg-card">
              <div className="px-5 py-3.5 bg-muted/30 border-b border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <group.icon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-serif text-[15px] font-semibold tracking-tight text-foreground">{group.step}</h2>
                </div>
                <span className="text-xs text-muted-foreground bg-background border border-border px-2 py-1 rounded-full">
                  {enabledCount} / {group.keys.length} habilitadas
                </span>
              </div>
              <div className="divide-y divide-border">
                {group.keys.map((key) => (
                  <div key={key} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <Label htmlFor={`eval-${key}`} className="font-normal text-sm text-foreground cursor-pointer">
                      {EVALUATION_LABELS[key]}
                    </Label>
                    <Switch
                      id={`eval-${key}`}
                      checked={settings[key]}
                      disabled={!canEdit}
                      onCheckedChange={(v) => setEnabled(key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Una evaluación deshabilitada no aparece al crear una sesión nueva. Si una sesión ya guardada tiene datos
        cargados en esa evaluación, se sigue mostrando igual al editarla.
      </p>
    </div>
  );
}
