import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import {
  getScheduleReplyCode,
  respondToScheduleByPhone,
} from "./schedule-response.service.js";

const logger = pino({ level: "silent" });
const SESSION_DIR = path.join(process.cwd(), "data", "whatsapp_session");

let sock: WASocket | null = null;
let currentQrCode: string | null = null;
let connectionStatus: "DISCONNECTED" | "CONNECTING" | "SCAN_QR_CODE" | "CONNECTED" = "DISCONNECTED";
let connectedPhone: string | null = null;
let connectedName: string | null = null;
let isInitializing = false;

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
  scheduleItemId?: string;
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
    timeZone: "America/Sao_Paulo",
  });
  const timeStr = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return { dateStr, timeStr };
}

function formatScheduleCode(scheduleItemId?: string) {
  return scheduleItemId ? getScheduleReplyCode(scheduleItemId) : null;
}

function buildAssignmentFooter(n: ScheduleNotification) {
  const code = formatScheduleCode(n.scheduleItemId);
  const codeBlock = code
    ? `Código da escala: *${code}*\nResponda \`1 ${code}\` para confirmar ou \`2 ${code}\` para recusar.\n\n`
    : "";
  const linkBlock = n.confirmUrl ? `Confirme sua participação: ${n.confirmUrl}\n\n` : "";
  return `${codeBlock}${linkBlock}Deus abençoe! — Volutis PIBI`;
}

function buildWhatsAppResolutionMessage(result: Awaited<ReturnType<typeof respondToScheduleByPhone>>) {
  if (result.ok) return null;
  if (result.code === "MEMBER_NOT_FOUND") {
    return "Não encontrei um voluntário vinculado a este número no Volutis PIBI.";
  }
  if (result.code === "NO_PENDING") {
    return "Você não possui escalas pendentes para confirmar por aqui no momento.";
  }
  if (result.code === "NOT_FOUND") {
    return "Não encontrei uma escala pendente com esse código. Confira o código enviado e tente novamente.";
  }
  if (result.code === "AMBIGUOUS") {
    const items = result.items ?? [];
    const firstItem = items[0];
    const options = items
      .slice(0, 5)
      .map((item) => {
        const { dateStr, timeStr } = formatDate(item.event.startTime);
        return `• ${item.event.title} — ${dateStr} às ${timeStr} · código *${getScheduleReplyCode(item.id)}*`;
      })
      .join("\n");
    const example = firstItem ? getScheduleReplyCode(firstItem.id) : "CODIGO";
    return `Você tem mais de uma escala pendente. Responda com o código informado na mensagem, por exemplo: \`1 ${example}\`.\n\n${options}`;
  }
  return "Não consegui processar sua resposta agora. Tente novamente pelo app ou envie o código da escala.";
}

/**
 * Inicializa o cliente nativo do WhatsApp (Baileys).
 */
export async function initNativeWhatsApp(): Promise<void> {
  if (isInitializing || connectionStatus === "CONNECTED") return;
  isInitializing = true;

  try {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1015901307] as [number, number, number],
    }));

    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: ["Volutis PIBI", "Chrome", "1.0.0"],
      connectTimeoutMs: 30000,
    });

    connectionStatus = "CONNECTING";

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQrCode = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          connectionStatus = "SCAN_QR_CODE";
        } catch {
          currentQrCode = null;
        }
      }

      if (connection === "open") {
        connectionStatus = "CONNECTED";
        currentQrCode = null;
        const userJid = sock?.user?.id || "";
        connectedPhone = userJid.split(":")[0]?.replace(/\D/g, "") || null;
        connectedName = sock?.user?.name || "WhatsApp PIBI";
        console.log(`[WhatsApp Nativo] Conectado com sucesso como +${connectedPhone} (${connectedName})`);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        connectionStatus = "DISCONNECTED";
        currentQrCode = null;

        if (loggedOut) {
          console.log("[WhatsApp Nativo] Sessão desconectada/deslogada pelo usuário.");
          try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
          } catch {}
          sock = null;
        } else {
          console.log("[WhatsApp Nativo] Desconectado. Tentando reconectar em 5 segundos...");
          setTimeout(() => {
            initNativeWhatsApp().catch(() => {});
          }, 5000);
        }
      }
    });

    // Processamento de mensagens recebidas (Confirmação interativa 1/2)
    sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          "";

        const fromJid = msg.key.remoteJid;
        if (!fromJid || !fromJid.endsWith("@s.whatsapp.net")) continue;

        const phone = fromJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;

        const response = parseWhatsAppResponse(text);
        if (response.action === "unknown") continue;
        const result = await respondToScheduleByPhone({
          phone: formattedPhone,
          action: response.action === "confirm" ? "CONFIRM" : "DECLINE",
          scheduleIdentifier: response.scheduleIdentifier,
          reason: response.action === "decline" ? "Recusada via WhatsApp" : undefined,
        });

        if (result.ok) {
          await sendWhatsAppMessage({
            to: formattedPhone,
            text:
              response.action === "confirm"
                ? `✅ Presença confirmada para *${result.scheduleItem.event.title}*!\n\nObrigado e Deus abençoe! — Volutis PIBI`
                : `❌ Presença recusada para *${result.scheduleItem.event.title}*.\n\nSe precisar de ajuda, entre em contato com o líder do ministério.\n\nDeus abençoe! — Volutis PIBI`,
          });
        } else {
          const resolutionMessage = buildWhatsAppResolutionMessage(result);
          if (resolutionMessage) {
            await sendWhatsAppMessage({ to: formattedPhone, text: resolutionMessage });
          }
        }
      }
    });
  } catch (err: any) {
    console.error("[WhatsApp Nativo] Erro na inicialização:", err.message);
    connectionStatus = "DISCONNECTED";
  } finally {
    isInitializing = false;
  }
}

/**
 * Desconecta e limpa a sessão do WhatsApp.
 */
export async function disconnectNativeWhatsApp(): Promise<void> {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
      sock = null;
    }
  } finally {
    connectionStatus = "DISCONNECTED";
    currentQrCode = null;
    connectedPhone = null;
    connectedName = null;
    try {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Envia mensagem automática de texto (Prioriza Baileys Nativo, fallback para WAHA).
 */
export async function sendWhatsAppMessage({
  to,
  text,
}: {
  to: string | null | undefined;
  text: string;
}): Promise<boolean> {
  if (!to) return false;
  const normalized = normalizePhone(to);
  if (!normalized) return false;

  // 1. Envio direto via Baileys Nativo (se conectado)
  if (sock && connectionStatus === "CONNECTED") {
    try {
      const jid = `${normalized}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text });
      return true;
    } catch (err: any) {
      console.warn(`[WhatsApp Nativo] Falha no envio para ${normalized}: ${err.message}`);
    }
  }

  // 2. Fallback: Envio via WAHA HTTP API (se configurado)
  const apiUrl = process.env.WHATSAPP_API_URL;
  if (apiUrl) {
    const session = process.env.WHATSAPP_SESSION || "default";
    const apiKey = process.env.WHATSAPP_API_KEY;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
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

      return res.ok;
    } catch (err: any) {
      console.warn(`[WhatsApp API] Erro ao conectar com o serviço WhatsApp: ${err.message}`);
    }
  }

  return false;
}

/**
 * Consulta o status da conexão do WhatsApp.
 */
export async function getWhatsAppStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  status: string;
  qrCode?: string | null;
  phone?: string;
  name?: string;
  session?: string;
  error?: string;
}> {
  // Se Baileys nativo estiver ativo/iniciado
  if (sock || connectionStatus !== "DISCONNECTED" || fs.existsSync(SESSION_DIR)) {
    return {
      configured: true,
      connected: connectionStatus === "CONNECTED",
      status: connectionStatus,
      qrCode: currentQrCode,
      phone: connectedPhone || undefined,
      name: connectedName || undefined,
      session: "native",
    };
  }

  // Se houver servidor WAHA configurado
  const apiUrl = process.env.WHATSAPP_API_URL;
  if (apiUrl) {
    const session = process.env.WHATSAPP_SESSION || "default";
    const apiKey = process.env.WHATSAPP_API_KEY;

    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["X-Api-Key"] = apiKey;
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/sessions/${session}`, {
        headers,
      });

      if (res.ok) {
        const data: any = await res.json();
        return {
          configured: true,
          connected: data.status === "WORKING",
          status: data.status || "UNKNOWN",
          phone: data.me?.id ? String(data.me.id).replace("@c.us", "") : undefined,
          name: data.me?.pushName,
          session,
        };
      }
    } catch {}
  }

  return {
    configured: true,
    connected: false,
    status: connectionStatus,
    qrCode: currentQrCode,
    session: "native",
  };
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
    buildAssignmentFooter(n);

  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * Envia notificação imediata de escala pelo WhatsApp.
 */
export async function sendScheduleAssignedWhatsApp(n: ScheduleNotification): Promise<boolean> {
  if (!n.phone) return false;
  const { dateStr, timeStr } = formatDate(n.eventDate);

  const message =
    `Olá, ${n.memberName}! 🙌\n\n` +
    `Você foi escalado(a) para *${n.eventTitle}* — ${dateStr} às ${timeStr}.\n` +
    `Função: *${n.roleName}*\n\n` +
    buildAssignmentFooter(n);

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
    buildAssignmentFooter(n).replace("Deus abençoe!", "Contamos com você! 🙏");

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
    `*1 ${getScheduleReplyCode(n.scheduleItemId)}* — Confirmar presença ✅\n` +
    `*2 ${getScheduleReplyCode(n.scheduleItemId)}* — Recusar ❌\n\n` +
    `Código da escala: *${getScheduleReplyCode(n.scheduleItemId)}*\n` +
    `Ou acesse o app: ${n.confirmUrl ?? ""}\n\n` +
    `Contamos com você! 🙏 — Volutis PIBI`;

  return sendWhatsAppMessage({ to: n.phone, text: message });
}

/**
 * Processa resposta interativa do WhatsApp (1=confirmar, 2=recusar).
 */
export function parseWhatsAppResponse(message: string): { action: "confirm" | "decline" | "unknown"; scheduleIdentifier?: string } {
  const trimmed = message.trim();
  const codeMatch = trimmed.match(/(?:^|\s)([A-Za-z0-9]{6,32})$/);
  const scheduleIdentifier = codeMatch?.[1]?.toLowerCase();
  if (/^1(?:\s+[A-Za-z0-9]{6,32})?$/i.test(trimmed)) return { action: "confirm", scheduleIdentifier };
  if (/^2(?:\s+[A-Za-z0-9]{6,32})?$/i.test(trimmed)) return { action: "decline", scheduleIdentifier };
  if (/^(sim|ok|confirmo|confirmar|s)(?:\s+[A-Za-z0-9]{6,32})?$/i.test(trimmed)) return { action: "confirm", scheduleIdentifier };
  if (/^(não|nao|recuso|recusar|n)(?:\s+[A-Za-z0-9]{6,32})?$/i.test(trimmed)) return { action: "decline", scheduleIdentifier };
  return { action: "unknown" };
}
