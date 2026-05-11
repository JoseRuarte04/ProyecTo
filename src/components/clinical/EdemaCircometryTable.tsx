import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

// ── New format ──────────────────────────────────────────────────────────────

export interface CircometriaItem {
  id: string;
  reparo: string;
  msd: string;
  msi: string;
}

export function isCircometriaFormat(v: any): boolean {
  return v != null && typeof v === "object" && Array.isArray(v.items);
}

export function normalizeCircometriaValue(v: any): CircometriaItem[] {
  if (!isCircometriaFormat(v)) return [];
  return (v.items as any[]).map((item: any, i: number) => ({
    id: item.id ?? String(i),
    reparo: item.reparo ?? "",
    msd: item.msd != null ? String(item.msd) : "",
    msi: item.msi != null ? String(item.msi) : "",
  }));
}

export function buildCircometriaPayload(items: CircometriaItem[]): any {
  const cleaned = items.filter(it => it.reparo.trim() || it.msd || it.msi);
  if (cleaned.length === 0) return null;
  return {
    items: cleaned.map(({ reparo, msd, msi }) => ({
      reparo: reparo.trim(),
      msd: msd !== "" ? Number(msd) : null,
      msi: msi !== "" ? Number(msi) : null,
    })),
  };
}

// ── Legacy format (kept for rendering historical records) ───────────────────

export const EDEMA_POINTS: { key: string; label: string }[] = [
  { key: "antebrazo_15", label: "Antebrazo a 15 cm" },
  { key: "antebrazo_10", label: "Antebrazo a 10 cm" },
  { key: "muneca", label: "Muñeca" },
  { key: "cuerpo_mtc", label: "Cuerpo MTC" },
  { key: "cabeza_mtc", label: "Cabeza MTC" },
  { key: "indice_f1", label: "Índice F1" },
  { key: "indice_f2", label: "Índice F2" },
  { key: "mayor_f1", label: "Mayor F1" },
  { key: "mayor_f2", label: "Mayor F2" },
  { key: "anular_f1", label: "Anular F1" },
  { key: "anular_f2", label: "Anular F2" },
  { key: "menique_f1", label: "Meñique F1" },
  { key: "menique_f2", label: "Meñique F2" },
  { key: "pulgar_f1", label: "Pulgar F1" },
];

export type EdemaSide = { fecha?: string | null; [key: string]: any };
export type EdemaCircValue = { sano?: EdemaSide | null; afectado?: EdemaSide | null } | null;

export function isNewEdemaFormat(v: any): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  return "sano" in v || "afectado" in v;
}

export function normalizeEdemaValue(v: any): { sano: EdemaSide; afectado: EdemaSide } {
  if (!isNewEdemaFormat(v)) return { sano: {}, afectado: {} };
  return {
    sano: (v.sano && typeof v.sano === "object" && !Array.isArray(v.sano)) ? v.sano : {},
    afectado: (v.afectado && typeof v.afectado === "object" && !Array.isArray(v.afectado)) ? v.afectado : {},
  };
}

// ── Component ───────────────────────────────────────────────────────────────

function calcDif(msd: string, msi: string): string {
  const d = parseFloat(msd);
  const s = parseFloat(msi);
  if (isNaN(d) || isNaN(s)) return "—";
  const diff = s - d;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}`;
}

function newItem(): CircometriaItem {
  return { id: crypto.randomUUID(), reparo: "", msd: "", msi: "" };
}

interface Props {
  items: CircometriaItem[];
  onChange: (items: CircometriaItem[]) => void;
}

export function EdemaCircometryTable({ items, onChange }: Props) {
  const add = () => onChange([...items, newItem()]);
  const update = (id: string, field: keyof Omit<CircometriaItem, "id">, value: string) =>
    onChange(items.map(it => it.id === id ? { ...it, [field]: value } : it));
  const remove = (id: string) => onChange(items.filter(it => it.id !== id));

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2">Reparo anatómico</th>
                <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2 w-24">MSD (cm)</th>
                <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2 w-24">MSI (cm)</th>
                <th className="text-center text-xs font-medium text-muted-foreground py-2 px-2 w-24">Diferencia</th>
                <th className="py-2 px-1 w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="px-2 py-1.5">
                    <Input
                      value={item.reparo}
                      onChange={e => update(item.id, "reparo", e.target.value)}
                      placeholder="Ej: Codo epicóndilo"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={item.msd}
                      onChange={e => update(item.id, "msd", e.target.value)}
                      placeholder="cm"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={item.msi}
                      onChange={e => update(item.id, "msi", e.target.value)}
                      placeholder="cm"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-sm text-center whitespace-nowrap text-muted-foreground font-medium">
                    {calcDif(item.msd, item.msi)}
                  </td>
                  <td className="px-1 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={add} className="h-8 text-xs gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Agregar reparo anatómico
      </Button>
    </div>
  );
}
