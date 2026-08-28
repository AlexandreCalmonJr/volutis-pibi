import { setupTestContext, TestReporter } from "../helpers/test-client.js";

export async function runEventsSchedulesSuite(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("03. Eventos, Escalas & Sugestões Inteligentes");
  const ctx = await setupTestContext();
  const { app, adminAuth, volunteerAuth, volunteerMemberId } = ctx;

  // 1. Listar eventos
  const eventsRes = await app.inject({
    method: "GET",
    url: "/api/events",
    headers: adminAuth,
  });
  t.check("GET /api/events retorna lista de eventos", eventsRes.statusCode === 200 && Array.isArray(eventsRes.json()));

  // 2. Criar novo evento
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 14); // 2 semanas à frente
  const newEventRes = await app.inject({
    method: "POST",
    url: "/api/events",
    headers: adminAuth,
    payload: {
      title: "Culto Especial de Testes",
      type: "SUNDAY_MORNING",
      date: eventDate.toISOString(),
      startTime: eventDate.toISOString(),
    },
  });
  t.check("POST /api/events cria novo evento com status 201", newEventRes.statusCode === 201);
  const createdEvent = newEventRes.json();

  // 3. Buscar ministério Louvor
  const ministriesRes = await app.inject({
    method: "GET",
    url: "/api/ministries",
    headers: adminAuth,
  });
  const louvor = ministriesRes.json().find((m: any) => m.name === "Louvor");

  // 4. Sugestões inteligentes de voluntários para Vocal
  const sugRes = await app.inject({
    method: "GET",
    url: `/api/events/${createdEvent.id}/suggestions?ministryId=${louvor.id}&role=Vocal`,
    headers: adminAuth,
  });
  t.check("GET /api/events/:id/suggestions retorna lista de sugestões", sugRes.statusCode === 200 && Array.isArray(sugRes.json()));

  // 5. Escalar voluntário para o evento
  const assignRes = await app.inject({
    method: "POST",
    url: `/api/events/${createdEvent.id}/schedule`,
    headers: adminAuth,
    payload: {
      memberId: volunteerMemberId,
      roleName: "Vocal",
      force: true,
    },
  });
  t.check("POST /api/events/:id/schedule atribui voluntário com status 201", assignRes.statusCode === 201);
  const scheduleItem = assignRes.json();
  t.check("Item de escala inicia com status PENDING", scheduleItem.status === "PENDING");

  // 6. Consultar escala do evento
  const scheduleListRes = await app.inject({
    method: "GET",
    url: `/api/events/${createdEvent.id}/schedule`,
    headers: adminAuth,
  });
  t.check(
    "GET /api/events/:id/schedule lista o voluntário escalado",
    scheduleListRes.statusCode === 200 &&
      scheduleListRes.json().some((item: any) => item.id === scheduleItem.id)
  );

  // 7. Voluntário confirma a escala
  const confirmRes = await app.inject({
    method: "POST",
    url: `/api/schedule-items/${scheduleItem.id}/respond`,
    headers: volunteerAuth,
    payload: { action: "CONFIRM" },
  });
  t.check("POST /api/schedule-items/:id/respond confirma escala", confirmRes.statusCode === 200 && confirmRes.json().status === "CONFIRMED");

  // 8. Feed pessoal do voluntário
  const myScheduleRes = await app.inject({
    method: "GET",
    url: "/api/my/schedule",
    headers: volunteerAuth,
  });
  t.check("GET /api/my/schedule retorna escalas e convites do voluntário", myScheduleRes.statusCode === 200 && Array.isArray(myScheduleRes.json().items));

  // 9. Geração automática do mês
  const now = new Date();
  const autoGenRes = await app.inject({
    method: "POST",
    url: "/api/schedules/auto-generate",
    headers: adminAuth,
    payload: {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      ministryId: louvor.id,
      overwrite: false,
    },
  });
  t.check(
    "POST /api/schedules/auto-generate gera escalas do mês com sucesso",
    autoGenRes.statusCode === 200 && typeof autoGenRes.json().eventsProcessed === "number"
  );

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("03-events-schedules.test.ts")) {
  const summary = await runEventsSchedulesSuite();
  process.exit(summary.failed > 0 ? 1 : 0);
}
