import { cn } from "@/lib/utils";

interface CatalogRegionPanelProps {
  regions: readonly string[];
  counts: Record<string, number>;
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
}

// Sidebar de solo lectura para navegar el catálogo global de ejercicios por
// región — a diferencia de ApartadosPanel, esta taxonomía es fija (viene del
// catálogo HEP2go) y no se puede crear/renombrar/borrar.
export default function CatalogRegionPanel({ regions, counts, selectedRegion, onSelectRegion }: CatalogRegionPanelProps) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-1">
      <button
        className={cn(
          "text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between gap-2",
          selectedRegion === null
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted/60 text-foreground"
        )}
        onClick={() => onSelectRegion(null)}
      >
        <span>Todas</span>
        <span className="text-xs text-muted-foreground tabular-nums">{total}</span>
      </button>
      {regions.map((region) => (
        <button
          key={region}
          className={cn(
            "text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between gap-2",
            selectedRegion === region
              ? "bg-primary/10 text-primary font-medium"
              : "hover:bg-muted/60 text-foreground"
          )}
          onClick={() => onSelectRegion(region)}
        >
          <span className="truncate">{region}</span>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">{counts[region] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
