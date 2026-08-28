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
 * Consulta o status da conexão do WhatsApp (WAHA).
 */
export async function getWhatsAppStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  status: string;
  phone?: string;
  name?: string;
  session?: string;
  error?: string;
}> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const session = process.env.WHATSAPP_SESSION || "default";
  const apiKey = process.env.WHATSAPP_API_KEY;

  if (!apiUrl) {
    return {
      configured: false,
      connected: false,
      status: "NOT_CONFIGURED",
      session,
    };
  }

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/sessions/${session}`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const resAll = await fetch(`${apiUrl.replace(/\/$/, "")}/api/sessions`, {
        headers,
      }).catch(() => null);

      if (resAll && resAll.ok) {
        const sessions: any = await resAll.json();
        const found = Array.isArray(sessions) ? sessions.find((s: any) => s.name === session) : null;
        if (found) {
          return {
            configured: true,
            connected: found.status === "WORKING",
            status: found.status || "UNKNOWN",
            phone: found.me?.id ? String(found.me.id).replace("@c.us", "") : undefined,
            name: found.me?.pushName,
            session,
          };
        }
      }

      return {
        configured: true,
        connected: false,
        status: `HTTP_${res.status}`,
        session,
      };
    }

    const data: any = await res.json();
    return {
      configured: true,
      connected: data.status === "WORKING",
      status: data.status || "UNKNOWN",
      phone: data.me?.id ? String(data.me.id).replace("@c.us", "") : undefined,
      name: data.me?.pushName,
      session,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      status: "OFFLINE",
      session,
      error: err?.message || "Inacessível",
    };
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

// ─── Novas funções para Captação e Aprovação ─────────────────────

export interface ApplicationConfirmation {
  name: string;
  phone: string;
  churchName: string;
}

export interface ApprovalNotification {
  name: string;
  phone: string;
  churchName: string;
  setPasswordUrl: string;
}

export interface RejectionNotification {
  name: string;
  phone: string;
  churchName: string;
  reason?: string | null;
}

/**
 * Envia confirmação imediata de cadastro via WhatsApp.
 */
export async function sendApplicationConfirmation(n: ApplicationConfirmation): Promise<boolean> {
  const message =
    `Olá, ${n.name}! 🙌\n\n` +
    `Seu cadastro como voluntário(a) na *${n.churchName}* foi realizado com sucesso!\n\n` +
    `📋 Seu pedido está sendo analisado pelo líder do ministério.\n` +
    `Assim que for aprovado(a), você receberá um link para criar sua senha e acessar o app.\n\n` +
    `Obrigado pelo seu interesse em servir! 🙏 — Volutis PIBI`;

  return sendWhatsAppMessage({ to: n.phone, text: message });
}

/**
 * Envia notificação de aprovação com link para definir senha.
 */
export async function sendApprovalNotification(n: ApprovalNotification): Promise<boolean> {
  const message =
    `Parabéns, ${n.name}! 🎉\n\n` +
    `Seu cadastro como voluntário(a) na *${n.churchName}* foi *APROVADO*!\n\n` +
    `Acesse o link abaixo para criar sua senha e acessar o app:\n` +
    `${n.setPasswordUrl}\n\n` +
    `⏰ O link expira em 48 horas.\n\n` +
    `Bem-vindo(a) à equipe! 🙏 — Volutis PIBI`;

  return sendWhatsAppMessage({ to: n.phone, text: message });
}

/**
 * Envia notificação de rejeição.
 */
export async function sendRejectionNotification(n: RejectionNotification): Promise<boolean> {
  const message =
    `Olá, ${n.name}.\n\n` +
    `Infelizmente seu cadastro como voluntário(a) na *${n.churchName}* não foi aprovado(a) neste momento.\n` +
    (n.reason ? `\n📝 Motivo: ${n.reason}\n` : "") +
    `\nCaso tenha dúvidas, entre em contato com o líder do ministério.\n\n` +
    `Deus abençoe! — Volutis PIBI`;

  return sendWhatsAppMessage({ to: n.phone, text: message });
}

export interface InteractiveScheduleNotification {
  memberName: string;
  phone: string | null;
  eventTitle: string;
  eventDate: Date;
  roleName: string;
  scheduleItemId: string;
  confirmUrl?: string;
}

/**
 * Envia lembrete interativo de escala — voluntário responde 1 (confirmar) ou 2 (recusar).
 */
export async function sendInteractiveScheduleReminder(n: InteractiveScheduleNotification): Promise<boolean> {
  if (!n.phone) return false;
  const { dateStr, timeStr } = formatDate(n.eventDate);

  const message =
    `Olá, ${n.memberName}! ⏰ *Lembrete de Escala*\n\n` +
    `Lembrando que você está escalado(a) para *${n.eventTitle}* — ${dateStr} às ${timeStr}.\n` +
    `Função: *${n.roleName}*\n\n` +
    `Para confirmar ou recusar, responda:\n` +
    `*1* — Confirmar presença ✅\n` +
    `*2* — Recusar ❌\n\n` +
    `Ou acesse o app: ${n.confirmUrl ?? ""}\n\n` +
    `Contamos com você! 🙏 — Volutis PIBI`;

  return sendWhatsAppMessage({ to: n.phone, text: message });
}

/**
 * Processa resposta interativa do WhatsApp (1=confirmar, 2=recusar).
 * Retorna a ação e o scheduleItemId para processamento.
 */
export function parseWhatsAppResponse(message: string): { action: "confirm" | "decline" | "unknown"; scheduleItemId?: string } {
  const trimmed = message.trim();
  if (trimmed === "1") return { action: "confirm" };
  if (trimmed === "2") return { action: "decline" };
  // Suporte a variações
  if (/^(sim|ok|confirmo|confirmar|s)$/i.test(trimmed)) return { action: "confirm" };
  if (/^(não|nao|recuso|recusar|n)$/i.test(trimmed)) return { action: "decline" };
  return { action: "unknown" };
}
