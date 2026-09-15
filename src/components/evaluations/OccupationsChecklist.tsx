import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown } from "lucide-react";
import { IndependenceToggle } from "./IndependenceToggle";
import { OCCUPATIONS_TAXONOMY, itemPath, type IndependenceLevel, type OccupationCategory } from "./occupationsTaxonomy";

type OccupationsItems = Record<string, IndependenceLevel>;

function CategorySection({
  category,
  items,
  onChange,
}: {
  category: OccupationCategory;
  items: OccupationsItems;
  onChange: (items: OccupationsItems) => void;
}) {
  const [open, setOpen] = useState(false);
  const answeredCount = category.items.filter((i) => items[itemPath(category.key, i.key)] != null).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-gray-200 bg-white">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">{category.label}</span>
          {answeredCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {answeredCount}/{category.items.length}
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        {category.items.map((item) => {
          const key = itemPath(category.key, item.key);
          return (
            <IndependenceToggle
              key={key}
              itemKey={key}
              itemLabel={item.label}
              value={items[key]}
              onChange={(value) => onChange({ ...items, [key]: value })}
            />
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function OccupationsChecklist({
  items,
  onChange,
  notes,
  onNotesChange,
}: {
  items: OccupationsItems;
  onChange: (items: OccupationsItems) => void;
  notes: string;
  onNotesChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Para cada actividad, indicar el nivel de independencia del paciente.
      </p>
      {OCCUPATIONS_TAXONOMY.map((category) => (
        <CategorySection key={category.key} category={category} items={items} onChange={onChange} />
      ))}
      <div className="space-y-2 pt-1">
        <Label>Otras observaciones</Label>
        <Textarea rows={3} value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Observaciones adicionales sobre las ocupaciones del paciente…" />
      </div>
    </div>
  );
}
