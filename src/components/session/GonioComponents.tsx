import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GONIO_PARTS } from "./constants";
import { FieldLabel, inputClass, numFieldErr } from "./shared";
import type { GonioPartKey } from "./types";

export function GonioGrid({
  partKey,
  values,
  setValues,
}: {
  partKey: GonioPartKey;
  values: Record<string, string>;
  setValues: (v: Record<string, string>) => void;
}) {
  const fields = GONIO_PARTS[partKey].fields;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {fields.map((f) => {
        const raw = values[f.key] || "";
        const err = numFieldErr(raw, 0, 360, "°");
        return (
          <div key={f.key}>
            <FieldLabel>{f.label} °</FieldLabel>
            <Input
              type="number"
              min={0}
              max={360}
              placeholder={f.norm}
              value={raw}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className={cn(inputClass, err ? "border-destructive ring-1 ring-destructive" : "")}
            />
            {err && <p className="text-xs text-destructive mt-1">{err}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function GonioPartSelector({
  value,
  onChange,
  allValues,
}: {
  value: GonioPartKey;
  onChange: (v: GonioPartKey) => void;
  allValues?: Record<GonioPartKey, Record<string, string>>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {(Object.keys(GONIO_PARTS) as GonioPartKey[]).map((k) => {
        const fields = GONIO_PARTS[k].fields;
        const filled = allValues ? fields.filter(f => !!allValues[k]?.[f.key]).length : 0;
        const total = fields.length;
        const hasSome = filled > 0;
        const isActive = value === k;
        return (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={isActive ? "default" : "outline"}
            className={cn(
              "h-8 text-xs rounded-full gap-1.5",
              isActive ? "bg-primary hover:bg-primary/85" : "border-border"
            )}
            onClick={() => onChange(k)}
          >
            {GONIO_PARTS[k].label}
            {allValues && hasSome && (
              <span className={cn(
                "text-[10px] font-semibold leading-none px-1 py-0.5 rounded-full",
                isActive ? "bg-white/25 text-white" : "bg-primary/15 text-primary"
              )}>
                {filled}/{total}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
