import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const statusMap: Record<string, string> = {
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
};

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildPlanHtml(plan: any, patient: any, exercises: any[]): string {
  const today = format(new Date(), "dd/MM/yyyy", { locale: es });
  const patientName = `${patient.last_name}, ${patient.first_name}`;

  const details: string[] = [];
  details.push(`DNI: ${patient.dni}`);
  if (patient.birth_date) {
    const age = differenceInYears(new Date(), new Date(patient.birth_date));
    details.push(`${age} años`);
  }
  if (patient.insurance) details.push(`OS: ${patient.insurance}`);
  details.push(`Admisión: ${format(new Date(patient.admission_date), "dd/MM/yyyy")}`);

  const fields: [string, string | null | undefined][] = [
    ["Objetivo", plan.objective],
    ["Indicaciones generales", plan.indications],
    ["Cuidado de piel", plan.skin_care],
    ["Pautas de protección articular", plan.joint_protection_guidelines],
    ["Recomendaciones para el hogar", plan.home_item_recommendations],
    ["Notas", plan.notes],
  ];

  const fieldBlocks = fields
    .filter(([, v]) => v)
    .map(
      ([label, value]) => `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">${label}</div>
        <div style="font-size:13px;color:#1a1a1a;white-space:pre-wrap">${value}</div>
      </div>`
    )
    .join("");

  // Status/date pills
  const pills: string[] = [];
  if (plan.status) pills.push(statusMap[plan.status] || plan.status);
  if (plan.start_date) pills.push(`Inicio: ${format(new Date(plan.start_date), "dd/MM/yyyy")}`);
  if (plan.end_date) pills.push(`Fin: ${format(new Date(plan.end_date), "dd/MM/yyyy")}`);

  const pillsHtml = pills
    .map(
      (p) =>
        `<span style="background:#f0fdf4;color:#166534;border-radius:9999px;padding:4px 12px;font-size:12px;display:inline-block;margin-right:6px">${p}</span>`
    )
    .join("");

  const exerciseCards = exercises
    .map((ex) => {
      const lib = ex.exercise_library;
      const name = lib?.name || "Ejercicio";
      const regionName = lib?.exercise_body_regions?.name;
      const region = regionName
        ? `<span style="background:#ccfbf1;color:#0f766e;font-size:11px;border-radius:4px;padding:2px 8px;margin-left:8px;display:inline-block">${regionName}</span>`
        : "";
      const description = lib?.description
        ? `<div style="font-size:12px;color:#374151;margin:6px 0;white-space:pre-wrap">${lib.description}</div>`
        : "";
      const instructions = lib?.instructions
        ? `<div style="margin:6px 0">
            <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Instrucciones</div>
            <div style="font-size:12px;color:#374151;white-space:pre-wrap">${lib.instructions}</div>
          </div>`
        : "";

      const params: string[] = [];
      const rep = ex.repetitions ?? lib?.suggested_reps;
      const sets = ex.sets ?? lib?.suggested_sets;
      const freq = ex.frequency;
      const dur = ex.duration;
      if (rep) params.push(`${rep} rep`);
      if (sets) params.push(`${sets} series`);
      if (freq) params.push(`Frec: ${freq}`);
      if (dur) params.push(`Dur: ${dur}`);

      const paramPills = params
        .map(
          (p) =>
            `<span style="background:#e5e7eb;border-radius:9999px;padding:3px 10px;font-size:11px;display:inline-block;margin-right:4px">${p}</span>`
        )
        .join("");

      const note = ex.notes
        ? `<div style="font-style:italic;color:#6b7280;font-size:11px;margin-top:6px">Nota: ${ex.notes}</div>`
        : "";

      const video = lib?.video_url
        ? `<div style="font-size:11px;color:#6b7280;margin-top:6px">▶ Video: <span style="color:#0d9488">${lib.video_url}</span></div>`
        : "";

      return `
        <div style="background:#f9fafb;border-radius:8px;padding:14px 16px;margin-bottom:10px">
          <div style="display:flex;align-items:center;flex-wrap:wrap">
            <span style="font-weight:600;font-size:13px">${name}</span>${region}
          </div>
          ${description}
          ${instructions}
          ${paramPills ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${paramPills}</div>` : ""}
          ${note}
          ${video}
        </div>`;
    })
    .join("");

  const exercisesSection =
    exercises.length > 0
      ? `
      <div style="margin-top:24px">
        <div style="font-size:15px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e5e7eb">Ejercicios asignados</div>
        ${exerciseCards}
      </div>`
      : "";

  return `
    <div style="width:794px;background:#fff;font-family:'Helvetica',sans-serif;color:#1a1a1a">
      <div style="background:#0d9488;padding:16px 40px;display:flex;justify-content:space-between;align-items:center">
        <span style="color:#fff;font-weight:700;font-size:20px">RehabOT</span>
        <span style="color:#fff;font-size:12px">${today}</span>
      </div>
      <div style="padding:32px 40px 0">
        <div style="font-size:26px;font-weight:700">${patientName}</div>
        <div style="color:#6b7280;font-size:13px;margin-top:4px">${details.join("  ·  ")}</div>
        <div style="border-bottom:2px solid #0d9488;margin:16px 0"></div>
      </div>
      <div style="padding:0 40px">
        <div style="font-size:18px;font-weight:700;color:#0d9488;margin-bottom:20px">${plan.title}</div>
        ${fieldBlocks}
        ${pillsHtml ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${pillsHtml}</div>` : ""}
        ${exercisesSection}
      </div>
      <div style="height:40px"></div>
    </div>`;
}

export async function exportPlanPdf(plan: any, patient: any) {
  const { data: exercises } = await supabase
    .from("treatment_plan_exercises")
    .select(`
      order_index, repetitions, sets, frequency, duration, notes,
      exercise_library (
        name, description, instructions,
        suggested_sets, suggested_reps, video_url,
        exercise_body_regions (name)
      )
    `)
    .eq("treatment_plan_id", plan.id)
    .order("order_index");

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.innerHTML = buildPlanHtml(plan, patient, exercises || []);
  document.body.appendChild(container);

  const element = container.firstElementChild as HTMLElement;

  try {
    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    const imgW = pdfW;
    const imgH = (canvas.height * pdfW) / canvas.width;

    let position = 0;
    let page = 0;

    while (position < imgH) {
      if (page > 0) pdf.addPage();

      // Use negative y offset to show the correct slice
      pdf.addImage(imgData, "PNG", 0, -position, imgW, imgH);
      position += pdfH;
      page++;
    }

    const fileName = `plan-${slugify(patient.last_name)}-${slugify(plan.title)}.pdf`;
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}
