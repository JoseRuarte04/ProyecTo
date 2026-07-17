import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ArrowUp, Plus } from "lucide-react";
import { Cie10AutocompleteInline } from "./Cie10AutocompleteInline";
import type { DiagnosisItem } from "./diagnoses";

export function DiagnosisListEditor({ value, onChange, placeholder }: {
  value: DiagnosisItem[];
  onChange: (v: DiagnosisItem[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = (item: DiagnosisItem) => {
    const label = item.label.trim();
    if (!label || value.some((d) => d.label === label)) { setDraft(""); return; }
    onChange([...value, { ...item, label }]);
    setDraft("");
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const promote = (idx: number) => onChange([value[idx], ...value.filter((_, i) => i !== idx)]);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((d, i) => (
            <div key={`${d.label}-${i}`} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5">
              <span className="flex-1 text-sm text-foreground">{d.label}</span>
              {i === 0 ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">Principal</Badge>
              ) : (
                <button type="button" onClick={() => promote(i)} title="Marcar como principal"
                  className="text-muted-foreground hover:text-foreground shrink-0">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              )}
              <button type="button" onClick={() => remove(i)} title="Quitar"
                className="text-muted-foreground hover:text-destructive shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        className="flex items-start gap-2"
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) { e.preventDefault(); add({ code: null, label: draft }); }
        }}
      >
        <div className="flex-1">
          <Cie10AutocompleteInline
            value={draft}
            onChange={setDraft}
            placeholder={placeholder || (value.length === 0 ? "Buscar por código o nombre CIE-10…" : "Agregar otro diagnóstico…")}
            onSelect={(r) => add({ code: r.code, label: `${r.code} — ${r.description}` })}
          />
        </div>
        <Button type="button" variant="outline" size="icon" className="shrink-0"
          disabled={!draft.trim()} onClick={() => add({ code: null, label: draft })} title="Agregar como texto libre">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
