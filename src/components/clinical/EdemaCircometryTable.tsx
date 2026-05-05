import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

/**
 * Detects whether a value follows the new structured format.
 * Legacy values (with reference/value_cm/side/mano_global) are treated as empty.
 */
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

function sideHasValues(s: EdemaSide | null | undefined): boolean {
  if (!s) return false;
  return EDEMA_POINTS.some(({ key }) => {
    const v = s[key];
    return v !== undefined && v !== null && v !== "" && !Number.isNaN(Number(v));
  });
}

export function buildEdemaPayload(
  sano: EdemaSide,
  afectado: EdemaSide
): EdemaCircValue {
  const cleanSide = (s: EdemaSide): EdemaSide | null => {
    const out: EdemaSide = {};
    if (s.fecha) out.fecha = s.fecha;
    let any = false;
    EDEMA_POINTS.forEach(({ key }) => {
      const raw = s[key];
      if (raw === undefined || raw === null || raw === "") return;
      const n = Number(raw);
      if (Number.isNaN(n)) return;
      out[key] = n;
      any = true;
    });
    return any ? out : null;
  };
  const sanoP = cleanSide(sano);
  const afectadoP = cleanSide(afectado);
  if (!sanoP && !afectadoP) return null;
  const obj: any = {};
  if (sanoP) obj.sano = sanoP;
  if (afectadoP) obj.afectado = afectadoP;
  return obj;
}

interface Props {
  sano: EdemaSide;
  afectado: EdemaSide;
  onChange: (next: { sano: EdemaSide; afectado: EdemaSide }) => void;
  mode: "admission" | "follow_up";
  baselineSano?: EdemaSide | null;
}

export function EdemaCircometryTable({ sano, afectado, onChange, mode, baselineSano }: Props) {
  const isAdmission = mode === "admission";
  const showSano = isAdmission || sideHasValues(baselineSano);
  const readonlySano = !isAdmission && sideHasValues(baselineSano);
  const sanoData = readonlySano ? (baselineSano as EdemaSide) : sano;

  const setSano = (key: string, value: string) => onChange({ sano: { ...sano, [key]: value }, afectado });
  const setAfectado = (key: string, value: string) => onChange({ sano, afectado: { ...afectado, [key]: value } });

  const inputClass = "rounded-md h-9 text-sm";
  const cellClass = "px-2 py-1.5 align-middle";
  const readonlyClass = "px-2 py-1.5 align-middle bg-muted/40 text-muted-foreground text-sm text-center";

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2 w-[40%]">Punto anatómico</th>
              {showSano && (
                <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2">
                  <div className="space-y-1">
                    <div>MS Sano</div>
                    {readonlySano ? (
                      <div className="text-[11px] text-muted-foreground/80 font-normal">
                        {sanoData.fecha ? `Basal: ${sanoData.fecha}` : "Basal"}
                      </div>
                    ) : (
                      <Input
                        type="date"
                        value={sano.fecha || ""}
                        onChange={(e) => onChange({ sano: { ...sano, fecha: e.target.value }, afectado })}
                        className="rounded-md h-8 text-xs"
                        aria-label="Fecha MS Sano"
                      />
                    )}
                  </div>
                </th>
              )}
              <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2">
                <div className="space-y-1">
                  <div>MS Afectado</div>
                  <Input
                    type="date"
                    value={afectado.fecha || ""}
                    onChange={(e) => onChange({ sano, afectado: { ...afectado, fecha: e.target.value } })}
                    className="rounded-md h-8 text-xs"
                    aria-label="Fecha MS Afectado"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {EDEMA_POINTS.map(({ key, label }) => (
              <tr key={key} className="border-b border-border/50">
                <td className="py-1.5 px-2 text-xs text-foreground">{label}</td>
                {showSano && (
                  readonlySano ? (
                    <td className={readonlyClass}>
                      {sanoData[key] != null && sanoData[key] !== "" ? `${sanoData[key]} cm` : "—"}
                    </td>
                  ) : (
                    <td className={cellClass}>
                      <Input
                        type="number"
                        step="0.1"
                        value={sano[key] ?? ""}
                        onChange={(e) => setSano(key, e.target.value)}
                        className={inputClass}
                        placeholder="cm"
                      />
                    </td>
                  )
                )}
                <td className={cellClass}>
                  <Input
                    type="number"
                    step="0.1"
                    value={afectado[key] ?? ""}
                    onChange={(e) => setAfectado(key, e.target.value)}
                    className={inputClass}
                    placeholder="cm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
