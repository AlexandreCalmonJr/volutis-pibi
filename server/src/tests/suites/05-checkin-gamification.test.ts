import { setupTestContext, TestReporter } from "../helpers/test-client.js";

export async function runCheckinGamificationSuite(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("05. Check-in, Tolerância de Horário & Gamificação");
  const ctx = await setupTestContext();
  const { app, adminAuth, volunteerAuth, volunteerMemberId } = ctx;

  // 1. Evento acontecendo AGORA (dentro da janela de tolerância de 3h)
  const now = new Date();
  const currentEventRes = await app.inject({
    method: "POST",
    url: "/api/events",
    headers: adminAuth,
    payload: {
      title: "Culto ao Vivo Check-in Teste",
      type: "SUNDAY_MORNING",
      date: now.toISOString(),
      startTime: now.toISOString(),
    },
  });
  t.check("POST /api/events cria evento para o momento atual", currentEventRes.statusCode === 201);
  const currentEvent = currentEventRes.json();

  // 2. Escalar voluntário
  const scheduleRes = await app.inject({
    method: "POST",
    url: `/api/events/${currentEvent.id}/schedule`,
    headers: adminAuth,
    payload: {
      memberId: volunteerMemberId,
      roleName: "Vocal",
      force: true,
    },
  });
  t.check("POST /api/events/:id/schedule escala voluntário", scheduleRes.statusCode === 201);
  const scheduleItem = scheduleRes.json();

  // 3. Tentar check-in antes de confirmar a escala -> 409
  const unconfirmedCheckinRes = await app.inject({
    method: "POST",
    url: `/api/schedule-items/${scheduleItem.id}/checkin`,
    headers: volunteerAuth,
    payload: { method: "manual" },
  });
  t.check("Check-in em escala não confirmada retorna 409", unconfirmedCheckinRes.statusCode === 409);

  // 4. Voluntário confirma escala
  await app.inject({
    method: "POST",
    url: `/api/schedule-items/${scheduleItem.id}/respond`,
    headers: volunteerAuth,
    payload: { action: "CONFIRM" },
  });

  // 5. Realizar check-in com sucesso (dentro da janela)
  const validCheckinRes = await app.inject({
    method: "POST",
    url: `/api/schedule-items/${scheduleItem.id}/checkin`,
    headers: volunteerAuth,
    payload: { method: "qrcode" },
  });
  t.check("POST /api/schedule-items/:id/checkin realiza check-in com status 201", validCheckinRes.statusCode === 201);
  t.check("Check-in retorna dados com método qrcode", validCheckinRes.json().method === "qrcode");

  // 6. Tentar check-in duplicado -> 409
  const duplicateCheckinRes = await app.inject({
    method: "POST",
    url: `/api/schedule-items/${scheduleItem.id}/checkin`,
    headers: volunteerAuth,
    payload: { method: "manual" },
  });
  t.check("Check-in duplicado retorna 409", duplicateCheckinRes.statusCode === 409);

  // 7. Evento futuro fora da janela (ex: 5 dias à frente)
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);
  const futureEventRes = await app.inject({
    method: "POST",
    url: "/api/events",
    headers: adminAuth,
    payload: {
      title: "Culto Futuro Fora da Janela",
      type: "SUNDAY_MORNING",
      date: futureDate.toISOString(),
      startTime: futureDate.toISOString(),
    },
  });
  const futureSchedule = (await app.inject({
    method: "POST",
    url: `/api/events/${futureEventRes.json().id}/schedule`,
    headers: adminAuth,
    payload: { memberId: volunteerMemberId, roleName: "Vocal", force: true },
  })).json();
  await app.inject({
    method: "POST",
    url: `/api/schedule-items/${futureSchedule.id}/respond`,
    headers: volunteerAuth,
    payload: { action: "CONFIRM" },
  });

  const outOfWindowCheckinRes = await app.inject({
    method: "POST",
    url: `/api/schedule-items/${futureSchedule.id}/checkin`,
    headers: volunteerAuth,
    payload: { method: "manual" },
  });
  t.check("Check-in fora da janela de 3h retorna 409 OUT_OF_WINDOW", outOfWindowCheckinRes.statusCode === 409 && outOfWindowCheckinRes.json().code === "OUT_OF_WINDOW");

  // 8. Ranking de Gamificação
  const rankingRes = await app.inject({
    method: "GET",
    url: "/api/gamification/ranking",
    headers: volunteerAuth,
  });
  t.check("GET /api/gamification/ranking retorna ranking de voluntários", rankingRes.statusCode === 200 && Array.isArray(rankingRes.json()));

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("05-checkin-gamification.test.ts")) {
  const summary = await runCheckinGamificationSuite();
  process.exit(summary.failed > 0 ? 1 : 0);
}
