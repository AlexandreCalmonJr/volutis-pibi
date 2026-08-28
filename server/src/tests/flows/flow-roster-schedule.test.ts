import { setupTestContext, TestReporter } from "../helpers/test-client.js";
import { buildScheduleWhatsAppLink } from "../../services/whatsapp.service.js";

export async function runRosterScheduleFlow(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("FLUXO 02: Gestão de Escala, Notificação & Confirmação (E2E)");
  const ctx = await setupTestContext();
  const { app, adminAuth, volunteerAuth, volunteerMemberId } = ctx;

  // Passo 1: Líder cria o Evento de Culto
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 10);
  const eventRes = await app.inject({
    method: "POST",
    url: "/api/events",
    headers: adminAuth,
    payload: {
      title: "Culto de Celebração & Ceia",
      type: "SUNDAY_MORNING",
      date: eventDate.toISOString(),
      startTime: eventDate.toISOString(),
    },
  });
  t.check("1. Líder cria evento na agenda", eventRes.statusCode === 201);
  const event = eventRes.json();

  // Passo 2: Líder consulta ministério de Louvor
  const ministriesRes = await app.inject({ method: "GET", url: "/api/ministries", headers: adminAuth });
  const louvor = ministriesRes.json().find((m: any) => m.name === "Louvor");

  // Passo 3: Líder consulta algoritmo de sugestão inteligente de voluntários
  const sugRes = await app.inject({
    method: "GET",
    url: `/api/events/${event.id}/suggestions?ministryId=${louvor.id}&role=Vocal`,
    headers: adminAuth,
  });
  t.check("2. Sugestão inteligente recomenda voluntários qualificados", sugRes.statusCode === 200 && Array.isArray(sugRes.json()));

  // Passo 4: Líder escala o voluntário
  const assignRes = await app.inject({
    method: "POST",
    url: `/api/events/${event.id}/schedule`,
    headers: adminAuth,
    payload: {
      memberId: volunteerMemberId,
      roleName: "Vocal",
      force: true,
    },
  });
  t.check("3. Voluntário escalado com status PENDING", assignRes.statusCode === 201 && assignRes.json().status === "PENDING");
  const scheduleItem = assignRes.json();

  // Passo 5: Geração de link do WhatsApp para notificação
  const waLink = buildScheduleWhatsAppLink({
    memberName: "João",
    phone: "71988887777",
    eventTitle: event.title,
    eventDate: new Date(event.date),
    roleName: "Vocal",
    confirmUrl: `https://volutis-pibi-client.vercel.app/escala/${scheduleItem.id}`,
  });
  t.check("4. Link formatado wa.me gerado para envio instantâneo", !!waLink && waLink.includes("wa.me/5571988887777"));

  // Passo 6: Voluntário consulta suas escalas pendentes
  const myScheduleRes = await app.inject({
    method: "GET",
    url: "/api/my/schedule",
    headers: volunteerAuth,
  });
  t.check(
    "5. Escala pendente listada no feed pessoal do voluntário",
    myScheduleRes.statusCode === 200 &&
      myScheduleRes.json().items.some((i: any) => i.id === scheduleItem.id && i.status === "PENDING")
  );

  // Passo 7: Voluntário confirma a escala
  const confirmRes = await app.inject({
    method: "POST",
    url: `/api/schedule-items/${scheduleItem.id}/respond`,
    headers: volunteerAuth,
    payload: { action: "CONFIRM" },
  });
  t.check("6. Voluntário confirma presença e status passa para CONFIRMED", confirmRes.statusCode === 200 && confirmRes.json().status === "CONFIRMED");

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("flow-roster-schedule.test.ts")) {
  const summary = await runRosterScheduleFlow();
  process.exit(summary.failed > 0 ? 1 : 0);
}
