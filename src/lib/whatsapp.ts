import { format } from "date-fns";
import { es } from "date-fns/locale";

// Mensaje de recordatorio de turno, reusado por el botón manual en el detalle
// del turno y por el panel de Recordatorios (envío asistido del día siguiente).
export function buildReminderMessage(
  appt: { appointment_date: string; modality: string; video_link: string | null },
  firstName: string
): string {
  const date = new Date(appt.appointment_date);
  const dateStr = format(date, "EEEE d 'de' MMMM, yyyy", { locale: es });
  const timeStr = format(date, "HH:mm");
  if (appt.modality === "virtual" && appt.video_link) {
    return `Hola ${firstName}! Te recordamos tu turno virtual de Terapia Ocupacional el ${dateStr} a las ${timeStr} hs. Unite a la videollamada desde este link (conectate 5 minutos antes): ${appt.video_link}`;
  }
  return `Hola ${firstName}! Te recordamos tu turno de Terapia Ocupacional el ${dateStr} a las ${timeStr} hs. ¡Nos vemos!`;
}

// Normaliza un teléfono argentino al formato que espera wa.me (código de país, sin + ni símbolos).
// Heurística: quita todo lo no numérico, saca el 0 de prefijo nacional y antepone 549
// (código de país + 9 de celular) cuando el número viene sin código.
export function whatsappPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("54")) return digits;
  if (digits.length === 10) return `549${digits}`;
  return digits;
}

export function whatsappUrl(phone: string, message: string): string | null {
  const p = whatsappPhone(phone);
  if (!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}
