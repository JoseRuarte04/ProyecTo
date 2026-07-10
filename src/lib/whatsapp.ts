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
