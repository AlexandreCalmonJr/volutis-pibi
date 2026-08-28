import { setupTestContext, TestReporter } from "../helpers/test-client.js";

export async function runServiceDayFlow(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("FLUXO 04: Dia de Culto (Liturgia, Louvor & Check-in) (E2E)");
  const ctx = await setupTestContext();
  const { app, adminAuth, volunteerAuth, volunteerMemberId } = ctx;

  // Passo 1: Criar Evento do Culto de Hoje
  const now = new Date();
  const eventRes = await app.inject({
    method: "POST",
    url: "/api/events",
    headers: adminAuth,
    payload: {
      title: "Culto de Domingo - Manhã ao Vivo",
      type: "SUNDAY_MORNING",
      date: now.toISOString(),
      startTime: now.toISOString(),
    },
  });
  t.check("1. Evento do dia de culto criado", eventRes.statusCode === 201);
  const event = eventRes.json();

  // Passo 2: Montagem do Repertório (Músicas no Setlist)
  const songRes = await app.inject({
    method: "POST",
    url: "/api/songs",
    headers: adminAuth,
    payload: {
      title: "Porque Ele Vive (Setlist Culto)",
      artist: "Harpa Cristã",
      originalKey: "A",
      bpm: 72,
    },
  });
  const song = songRes.json();

  const setlistRes = await app.inject({
    method: "POST",
    url: `/api/events/${event.id}/setlist`,
    headers: adminAuth,
    payload: {
      songId: song.id,
      songKey: "Bb",
      notes: "Arranjo suave na introdução",
    },
  });
  t.check("2. Repertório adicionado ao Setlist do culto", setlistRes.statusCode === 201);

  // Passo 3: Montagem da Ordem de Culto (Liturgia)
  const liturgyRes = await app.inject({
    method: "POST",
    url: `/api/events/${event.id}/liturgy`,
    headers: adminAuth,
    payload: {
      title: "Ministração da Palavra",
      startTime: "10:30",
      durationMin: 40,
      responsible: "Pr. Titular",
      bibleRef: "Romanos 12:1-2",
    },
  });
  t.check("3. Bloco litúrgico adicionado à ordem de culto", liturgyRes.statusCode === 201);

  // Passo 4: Escalar e Confirmar Voluntário
  const assignRes = await app.inject({
    method: "POST",
    url: `/api/events/${event.id}/schedule`,
    headers: adminAuth,
    payload: { memberId: volunteerMemberId, roleName: "Vocal", force: true },
  });
  const scheduleItem = assignRes.json();

  await app.inject({
    method: "POST",
    url: `/api/schedule-items/${scheduleItem.id}/respond`,
    headers: volunteerAuth,
    payload: { action: "CONFIRM" },
  });
  t.check("4. Voluntário escalado e presença confirmada", assignRes.statusCode === 201);

  // Passo 5: Voluntário chega no culto e realiza Check-in via QR Code
  const checkinRes = await app.inject({
    method: "POST",
    url: `/api/schedule-items/${scheduleItem.id}/checkin`,
    headers: volunteerAuth,
    payload: { method: "qrcode" },
  });
  t.check("5. Check-in por QR Code realizado com sucesso", checkinRes.statusCode === 201);

  // Passo 6: Dashboard reflete dados atualizados
  const dashRes = await app.inject({
    method: "GET",
    url: "/api/dashboard/stats",
    headers: adminAuth,
  });
  t.check("6. Estatísticas do Dashboard consolidadas", dashRes.statusCode === 200 && dashRes.json().eventsThisMonth >= 1);

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("flow-service-day.test.ts")) {
  const summary = await runServiceDayFlow();
  process.exit(summary.failed > 0 ? 1 : 0);
}
