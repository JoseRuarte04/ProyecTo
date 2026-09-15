import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { IndependenceLevel } from "./occupationsTaxonomy";

const OPTIONS: Array<{ value: IndependenceLevel; label: string }> = [
  { value: "independent", label: "Independiente" },
  { value: "assistance", label: "Requiere asistencia" },
  { value: "dependent", label: "Dependiente" },
];

export function IndependenceToggle({
  itemKey,
  itemLabel,
  value,
  onChange,
}: {
  itemKey: string;
  itemLabel: string;
  value: IndependenceLevel | undefined;
  onChange: (value: IndependenceLevel) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-2 border-b border-gray-100 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="text-xs text-gray-700 sm:flex-1 sm:min-w-0 sm:pr-2">{itemLabel}</span>
      <RadioGroup
        value={value ?? ""}
        onValueChange={(v) => onChange(v as IndependenceLevel)}
        className="grid grid-cols-3 gap-1.5 sm:w-80 sm:flex-shrink-0"
      >
        {OPTIONS.map((opt) => {
          const id = `occ-${itemKey}-${opt.value}`;
          return (
            <Label
              key={opt.value}
              htmlFor={id}
              className={`flex items-center justify-center gap-1 cursor-pointer rounded-md border px-1.5 py-1 text-[11px] leading-tight text-center transition-colors ${
                value === opt.value
                  ? "border-teal-500 bg-teal-50 text-teal-800"
                  : "border-gray-200 bg-white hover:border-teal-200"
              }`}
            >
              <RadioGroupItem value={opt.value} id={id} className="h-3 w-3" />
              {opt.label}
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
