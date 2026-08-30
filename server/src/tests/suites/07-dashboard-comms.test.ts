import { setupTestContext, TestReporter } from "../helpers/test-client.js";
import { getScheduleReplyCode } from "../../services/schedule-response.service.js";

export async function runDashboardCommsSuite(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("07. Dashboard Stats, Chat & Webhooks WhatsApp");
  const ctx = await setupTestContext();
  const { app, adminAuth, volunteerAuth, volunteerMemberId } = ctx;

  // 1. Dashboard Stats
  const statsRes = await app.inject({
    method: "GET",
    url: "/api/dashboard/stats",
    headers: adminAuth,
  });
  t.check("GET /api/dashboard/stats responde 200", statsRes.statusCode === 200);
  const stats = statsRes.json();
  t.check(
    "Dashboard stats contém totalVolunteers, pendingApprovals e eventsThisMonth",
    typeof stats.totalVolunteers === "number" &&
      typeof stats.pendingApprovals === "number" &&
      typeof stats.eventsThisMonth === "number"
  );

  // 2. Criar evento para teste de chat
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 3);
  const eventRes = await app.inject({
    method: "POST",
    url: "/api/events",
    headers: adminAuth,
    payload: {
      title: "Reunião de Líderes e Voluntários",
      type: "SPECIAL_EVENT",
      date: eventDate.toISOString(),
      startTime: eventDate.toISOString(),
    },
  });
  const event = eventRes.json();

  const scheduleRes = await app.inject({
    method: "POST",
    url: `/api/events/${event.id}/schedule`,
    headers: adminAuth,
    payload: {
      memberId: volunteerMemberId,
      roleName: "Vocal",
      force: true,
    },
  });
  t.check("POST /api/events/:id/schedule cria item pendente para notificações", scheduleRes.statusCode === 201);
  const scheduleItem = scheduleRes.json();

  // 3. Postar mensagem no chat do evento
  const postMsgRes = await app.inject({
    method: "POST",
    url: `/api/events/${event.id}/chat`,
    headers: adminAuth,
    payload: { content: "Lembrete: chegar 30 minutos antes para o alinhamento." },
  });
  t.check("POST /api/events/:id/chat posta mensagem no canal do evento", postMsgRes.statusCode === 201);
  const msg = postMsgRes.json();
  t.check("Mensagem salva com autor e conteúdo", !!msg.authorName && msg.content.includes("alinhamento"));

  // 4. Listar mensagens do chat
  const getChatRes = await app.inject({
    method: "GET",
    url: `/api/events/${event.id}/chat`,
    headers: adminAuth,
  });
  t.check("GET /api/events/:id/chat lista mensagens do evento", getChatRes.statusCode === 200 && getChatRes.json().length > 0);

  // 5. WhatsApp Webhook Health
  const webhookGetRes = await app.inject({
    method: "GET",
    url: "/api/whatsapp/webhook",
  });
  t.check("GET /api/whatsapp/webhook responde status ok", webhookGetRes.statusCode === 200 && webhookGetRes.json().status === "ok");

  // 6. WhatsApp Webhook POST (resposta de confirmação)
  const webhookPostRes = await app.inject({
    method: "POST",
    url: "/api/whatsapp/webhook",
    payload: {
      event: "message",
      payload: {
        from: "5571999990001@c.us",
        body: `1 ${getScheduleReplyCode(scheduleItem.id)}`,
      },
    },
  });
  t.check("POST /api/whatsapp/webhook processa mensagem interativa com { ok: true }", webhookPostRes.statusCode === 200 && webhookPostRes.json().ok === true);

  const notificationsRes = await app.inject({
    method: "GET",
    url: "/api/my/notifications?limit=10",
    headers: volunteerAuth,
  });
  t.check(
    "GET /api/my/notifications retorna notificações persistidas do voluntário",
    notificationsRes.statusCode === 200 &&
      notificationsRes.json().items.some((item: any) => ["SCHEDULE_ASSIGNED", "SCHEDULE_CONFIRMED"].includes(item.type))
  );

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("07-dashboard-comms.test.ts")) {
  const summary = await runDashboardCommsSuite();
  process.exit(summary.failed > 0 ? 1 : 0);
}
