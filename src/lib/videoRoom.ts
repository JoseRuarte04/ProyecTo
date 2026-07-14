// Genera el link de una sala de Jitsi Meet para un turno virtual.
// Las salas de Jitsi son efímeras: se crean cuando entra el primer participante
// y desaparecen al salir el último, así que basta un nombre único no adivinable.
export function createVideoRoom(): string {
  const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `https://meet.jit.si/ProyectiTO-turno-${slug}`;
}
