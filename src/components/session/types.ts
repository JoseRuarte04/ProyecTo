export type GonioPartKey = "shoulder" | "elbow" | "wrist" | "hand" | "thumb";
export type GonioBySide = Record<"MSD" | "MSI", Record<GonioPartKey, Record<string, string>>>;
export type TestResult = "positive" | "negative" | null;
export type PainTipo = "reposo" | "actividad" | "reposo_y_actividad" | "";
export type PainEntry = {
  id: number;
  localizacion: string;
  eva: number;
  evaTouched: boolean;
  tipo: PainTipo;
  aparicion: string;
  irradia: "no" | "si" | "";
  irradia_hacia: string;
  caracteristicas: string;
  agravantes: string;
  observaciones: string;
};
