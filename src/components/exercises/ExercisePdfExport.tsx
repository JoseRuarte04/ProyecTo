import jsPDF from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const EXERCISE_TYPE_LABEL: Record<string, string> = {
  activo: "Activo",
  activo_asistido: "Activo asistido",
  fortalecimiento: "Fortalecimiento",
};

export function exportExercisesPdf(exercises: any[]) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const addPage = () => { doc.addPage(); y = margin; };
  const checkSpace = (needed: number) => { if (y + needed > pageH - margin) addPage(); };

  // Label en negrita en línea propia, valor en normal en líneas siguientes.
  const printBlock = (label: string, text: string) => {
    checkSpace(15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, contentW);
    lines.forEach((line: string) => { checkSpace(5); doc.text(line, margin, y); y += 4; });
    y += 2;
  };

  // Label en negrita + valor en normal en la MISMA línea.
  // Mide el ancho del label MIENTRAS la fuente es bold para posicionar el valor correctamente.
  const printInlineField = (label: string, value: string) => {
    checkSpace(8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const labelText = `${label}: `;
    doc.text(labelText, margin, y);
    const labelW = doc.getTextWidth(labelText); // medir mientras sigue en bold
    doc.setFont("helvetica", "normal");
    const valueLines = doc.splitTextToSize(value, contentW - labelW);
    doc.text(valueLines[0], margin + labelW, y);
    y += 4;
    for (let i = 1; i < valueLines.length; i++) {
      checkSpace(5);
      doc.text(valueLines[i], margin, y);
      y += 4;
    }
    y += 1;
  };

  // ── Encabezado del documento ──
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Biblioteca de Ejercicios — RehabOT", margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${format(new Date(), "dd/MM/yyyy", { locale: es })}`, margin, y);
  y += 4;
  doc.text(`Total: ${exercises.length} ejercicio${exercises.length !== 1 ? "s" : ""}`, margin, y);
  y += 10;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Ejercicios ──
  exercises.forEach((ex, idx) => {
    checkSpace(40);

    // Nombre + tipo
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`${idx + 1}. ${ex.name}`, margin, y);
    const typeLabel = ex.exercise_type ? EXERCISE_TYPE_LABEL[ex.exercise_type] : null;
    if (typeLabel) {
      const nameW = doc.getTextWidth(`${idx + 1}. ${ex.name}`); // medir mientras bold
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`[${typeLabel}]`, margin + nameW + 3, y);
    }
    y += 6;

    // Dosis sugerida
    if (ex.suggested_sets || ex.suggested_reps) {
      const dosage = ex.suggested_sets && ex.suggested_reps
        ? `${ex.suggested_sets} series × ${ex.suggested_reps} reps`
        : ex.suggested_sets ? `${ex.suggested_sets} series` : `${ex.suggested_reps} reps`;
      printInlineField("Dosis sugerida", dosage);
    }

    // Equipamiento
    if (ex.equipment) printInlineField("Equipamiento", ex.equipment);

    // Parámetros de ejecución legacy (sin label, inline)
    const params: string[] = [];
    if (ex.default_repetitions) params.push(`${ex.default_repetitions} rep/serie`);
    if (ex.default_sets) params.push(`${ex.default_sets} series`);
    if (ex.default_duration) params.push(`Pausa: ${ex.default_duration}`);
    if (ex.default_frequency) params.push(`Frecuencia: ${ex.default_frequency}`);
    if (params.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const paramText = doc.splitTextToSize(params.join("  ·  "), contentW);
      paramText.forEach((line: string) => { checkSpace(5); doc.text(line, margin, y); y += 4; });
      y += 1;
    }

    // Descripción
    if (ex.description) printBlock("Descripción:", ex.description);

    // Posición inicial
    if (ex.starting_position) printBlock("Posición inicial:", ex.starting_position);

    // Instrucciones
    if (ex.instructions) printBlock("Instrucciones:", ex.instructions);

    // Precauciones
    if (ex.precautions) printBlock("Precauciones:", ex.precautions);

    // Video
    if (ex.video_url) {
      checkSpace(8);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const labelText = "Video: ";
      doc.text(labelText, margin, y);
      const labelW = doc.getTextWidth(labelText); // medir mientras bold
      doc.setFont("helvetica", "normal");
      // Mostrar URL truncada; el link apunta a la URL completa
      let displayUrl: string;
      try {
        const u = new URL(ex.video_url);
        const full = u.hostname + u.pathname;
        displayUrl = full.length > 55 ? full.slice(0, 52) + "..." : full;
      } catch {
        displayUrl = ex.video_url.length > 55 ? ex.video_url.slice(0, 52) + "..." : ex.video_url;
      }
      doc.textWithLink(displayUrl, margin + labelW, y, { url: ex.video_url });
      y += 5;
    }

    // Separador
    y += 3;
    checkSpace(5);
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
  });

  doc.save(`biblioteca-ejercicios-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
