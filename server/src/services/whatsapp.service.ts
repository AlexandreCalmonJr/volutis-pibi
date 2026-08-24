/**
 * Geração de links wa.me para notificar voluntários escalados.
 * Decisão do projeto: além do push PWA, avisos vão por WhatsApp via link direto.
 */

export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Assume Brasil se não tiver código do país
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export interface ScheduleNotification {
  memberName: string;
  phone: string | null;
  eventTitle: string;
  eventDate: Date;
  roleName: string;
  confirmUrl?: string;
}

export function buildScheduleWhatsAppLink(n: ScheduleNotification): string | null {
  if (!n.phone) return null;
  const normalized = normalizePhone(n.phone);
  if (!normalized) return null;

  const dateStr = n.eventDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Bahia",
  });
  const timeStr = n.eventDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bahia",
  });

  const message =
    `Olá, ${n.memberName}! 🙌\n\n` +
    `Você foi escalado(a) para *${n.eventTitle}* — ${dateStr} às ${timeStr}.\n` +
    `Função: *${n.roleName}*\n\n` +
    (n.confirmUrl ? `Confirme sua participação: ${n.confirmUrl}\n\n` : "") +
    `Deus abençoe! — Volutis PIBI`;

  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
