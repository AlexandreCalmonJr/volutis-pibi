/**
 * Integração de WhatsApp (WAHA - WhatsApp HTTP API & Links wa.me).
 * Suporta envio 100% automático quando WHATSAPP_API_URL estiver configurado,
 * além do fallback de link direto wa.me.
 */

export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Assume Brasil (+55) se não tiver código do país
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

export interface DeclineAlertNotification {
  leaderName: string;
  leaderPhone: string | null;
  memberName: string;
  eventTitle: string;
  roleName: string;
  reason?: string | null;
}

function formatDate(date: Date): { dateStr: string; timeStr: string } {
  const dateStr = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Bahia",
  });
  const timeStr = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bahia",
  });
  return { dateStr, timeStr };
}

/**
 * Envia mensagem automática de texto via WAHA (WhatsApp HTTP API).
 */
export async function sendWhatsAppMessage({
  to,
  text,
}: {
  to: string | null | undefined;
  text: string;
}): Promise<boolean> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  if (!apiUrl || !to) return false;

  const normalized = normalizePhone(to);
  if (!normalized) return false;

  const session = process.env.WHATSAPP_SESSION || "default";
  const apiKey = process.env.WHATSAPP_API_KEY;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/sendText`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        session,
        chatId: `${normalized}@c.us`,
        text,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[WhatsApp API] Falha no envio para ${normalized}: HTTP ${res.status} - ${errText}`);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn(`[WhatsApp API] Erro ao conectar com o serviço WhatsApp: ${err.message}`);
    return false;
  }
}

/**
 * Gera link direto wa.me com mensagem pré-formatada.
 */
export function buildScheduleWhatsAppLink(n: ScheduleNotification): string | null {
  if (!n.phone) return null;
  const normalized = normalizePhone(n.phone);
  if (!normalized) return null;

  const { dateStr, timeStr } = formatDate(n.eventDate);

  const message =
    `Olá, ${n.memberName}! 🙌\n\n` +
    `Você foi escalado(a) para *${n.eventTitle}* — ${dateStr} às ${timeStr}.\n` +
    `Função: *${n.roleName}*\n\n` +
    (n.confirmUrl ? `Confirme sua participação: ${n.confirmUrl}\n\n` : "") +
    `Deus abençoe! — Volutis PIBI`;

  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * Envia notificação imediata de escala pelo WhatsApp (se a API estiver ativa).
 */
export async function sendScheduleAssignedWhatsApp(n: ScheduleNotification): Promise<boolean> {
  if (!n.phone) return false;
  const { dateStr, timeStr } = formatDate(n.eventDate);

  const message =
    `Olá, ${n.memberName}! 🙌\n\n` +
    `Você foi escalado(a) para *${n.eventTitle}* — ${dateStr} às ${timeStr}.\n` +
    `Função: *${n.roleName}*\n\n` +
    (n.confirmUrl ? `Confirme sua participação: ${n.confirmUrl}\n\n` : "") +
    `Deus abençoe! — Volutis PIBI`;

  return sendWhatsAppMessage({ to: n.phone, text: message });
}

/**
 * Envia lembrete de escala 24h antes do culto/evento.
 */
export async function sendScheduleReminderWhatsApp(n: ScheduleNotification): Promise<boolean> {
  if (!n.phone) return false;
  const { dateStr, timeStr } = formatDate(n.eventDate);

  const message =
    `Olá, ${n.memberName}! ⏰ *Lembrete de Escala*\n\n` +
    `Lembrando que você está escalado(a) para *${n.eventTitle}* — ${dateStr} às ${timeStr}.\n` +
    `Função: *${n.roleName}*\n\n` +
    (n.confirmUrl ? `Confirme ou visualize a escala no app: ${n.confirmUrl}\n\n` : "") +
    `Contamos com você! 🙏 — Volutis PIBI`;

  return sendWhatsAppMessage({ to: n.phone, text: message });
}

/**
 * Alerta o líder do ministério quando um voluntário recusa a escala.
 */
export async function sendDeclineAlertToLeader(n: DeclineAlertNotification): Promise<boolean> {
  if (!n.leaderPhone) return false;

  const message =
    `⚠️ *Alerta: Escala Recusada*\n\n` +
    `Olá, ${n.leaderName}! O voluntário *${n.memberName}* não poderá comparecer ao evento *${n.eventTitle}* na função *${n.roleName}*.\n` +
    (n.reason ? `Motivo: "${n.reason}"\n\n` : "\n") +
    `Por favor, acerte a escala no aplicativo Volutis PIBI.`;

  return sendWhatsAppMessage({ to: n.leaderPhone, text: message });
}
