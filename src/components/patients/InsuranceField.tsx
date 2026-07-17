import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

// Valor sentinela guardado en patients.insurance cuando el paciente no tiene
// cobertura. Distinto de null (= dato no cargado) para estadísticas futuras.
export const NO_INSURANCE = "No posee";

// ── Campo obra social: autocomplete + checkbox "No posee" ──
export function InsuranceField({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const checkboxId = useId();
  const noInsurance = value === NO_INSURANCE;
  return (
    <div className="space-y-2">
      {noInsurance ? (
        <Input value={NO_INSURANCE} disabled className={className} />
      ) : (
        <ObrasSocialesAutocomplete value={value} onChange={onChange} placeholder={placeholder} className={className} />
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          id={checkboxId}
          checked={noInsurance}
          onCheckedChange={(checked) => onChange(checked ? NO_INSURANCE : "")}
        />
        <Label htmlFor={checkboxId} className="text-xs font-normal text-muted-foreground cursor-pointer">
          No posee obra social
        </Label>
      </div>
    </div>
  );
}

// ── Obras Sociales autocomplete ──
export function ObrasSocialesAutocomplete({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Array<{ name: string; type: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastSelectedRef = useRef<string>("");
  const visibleTypes = Array.from(new Set(results.map((r) => r.type).filter(Boolean)));
  const showTypeGroups = visibleTypes.length > 1;
  const typeLabel = (type: string | null) => {
    if (!type) return "OTRAS";
    const n = type.toLowerCase();
    if (n === "prepaga") return "PREPAGAS";
    if (n === "sindical") return "SINDICALES";
    return type.toUpperCase();
  };

  const updateRect = () => {
    if (wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  };

  useEffect(() => {
    const term = value.trim();
    if (term.length < 1) { setResults([]); setOpen(false); return; }
    if (term === lastSelectedRef.current) { setOpen(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("obras_sociales")
        .select("name, type")
        .eq("is_active", true)
        .ilike("name_search", `%${term.toLowerCase()}%`)
        .limit(10);
      if (cancelled) return;
      setResults((data as Array<{ name: string; type: string | null }>) || []);
      updateRect();
      setOpen(true);
      setLoading(false);
    }, 200);
    return () => { cancelled = true; clearTimeout(t); setLoading(false); };
  }, [value]);

  useEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => { window.removeEventListener("resize", updateRect); window.removeEventListener("scroll", updateRect, true); };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={updateRect}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      {open && results.length > 0 && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: rect.top + rect.height + 4, left: rect.left, width: rect.width, zIndex: 60 }}
          className="max-h-64 overflow-auto rounded-md border bg-popover shadow-md"
        >
          {showTypeGroups
            ? visibleTypes.map((type) => {
                const group = results.filter((r) => r.type === type);
                return (
                  <div key={type}>
                    <p className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">{typeLabel(type)}</p>
                    {group.map((r) => (
                      <button key={r.name} type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { onChange(r.name); lastSelectedRef.current = r.name; setOpen(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                        {r.name}
                      </button>
                    ))}
                  </div>
                );
              })
            : results.map((r) => (
                <div key={r.name}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onChange(r.name); lastSelectedRef.current = r.name; setOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    {r.name}
                  </button>
                </div>
              ))
          }
        </div>,
        document.body
      )}
    </div>
  );
}
