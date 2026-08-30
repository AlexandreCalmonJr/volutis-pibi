import { setupTestContext, TestReporter } from "../helpers/test-client.js";

export async function runSwapRequestFlow(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("FLUXO 03: Solicitação e Aceite de Troca de Escala (E2E)");
  const ctx = await setupTestContext();
  const { app, adminAuth, volunteerAuth, volunteerMemberId } = ctx;

  // Obter segundo voluntário (Maria)
  const mariaLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "maria@pibi.org.br", password: "volutis123" },
  });
  const mariaTok = mariaLogin.json().accessToken;
  const mariaAuth = { authorization: `Bearer ${mariaTok}` };
  const mariaMemberRes = await app.inject({ method: "GET", url: "/api/auth/me", headers: mariaAuth });
  const mariaMemberId = mariaMemberRes.json().user.member.id;

  // Passo 1: Criar Evento em data única e sem conflitos (garantindo idempotência)
  const uniqueOffsetMs = 30 * 86400000 + Math.floor(Math.random() * 100000000);
  const eventDate = new Date(Date.now() + uniqueOffsetMs);
  const eventRes = await app.inject({
    method: "POST",
    url: "/api/events",
    headers: adminAuth,
    payload: {
      title: "Culto Especial de Troca de Escala",
      type: "SPECIAL_EVENT",
      date: eventDate.toISOString(),
      startTime: eventDate.toISOString(),
    },
  });
  const event = eventRes.json();

  // Passo 2: Escalar Voluntário A (João)
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
  t.check("1. Voluntário A escalado no evento", assignRes.statusCode === 201);
  const scheduleItem = assignRes.json();

  // Passo 3: Voluntário A solicita troca com Voluntário B (Maria)
  const swapReqRes = await app.inject({
    method: "POST",
    url: `/api/schedule-items/${scheduleItem.id}/swap`,
    headers: volunteerAuth,
    payload: {
      targetMemberId: mariaMemberId,
      message: "Oi Maria, terei um compromisso familiar. Pode assumir minha vaga de Vocal?",
    },
  });
  t.check("2. Pedido de troca registrado com sucesso (201)", swapReqRes.statusCode === 201, swapReqRes.body);
  const swapRequest = swapReqRes.json();
  const pendingScheduleRes = await app.inject({
    method: "GET",
    url: `/api/events/${event.id}/schedule`,
    headers: adminAuth,
  });
  const pendingItem = pendingScheduleRes.json().find((item: any) => item.id === scheduleItem.id);
  t.check("Status da escala muda para SWAP_REQUESTED", pendingItem?.status === "SWAP_REQUESTED");

  // Passo 4: Voluntário B (Maria) consulta seu feed de convites de troca
  const myScheduleRes = await app.inject({
    method: "GET",
    url: "/api/my/schedule",
    headers: mariaAuth,
  });
  t.check(
    "3. Voluntário B visualiza convite de troca em seu feed",
    myScheduleRes.statusCode === 200 &&
      myScheduleRes.json().swapInvites.some((s: any) => s.id === swapRequest.id)
  );

  // Passo 5: Voluntário B (Maria) aceita a troca
  const respondRes = await app.inject({
    method: "POST",
    url: `/api/swap-requests/${swapRequest.id}/respond`,
    headers: mariaAuth,
    payload: { action: "ACCEPT" },
  });
  t.check("4. Voluntário B aceita a troca", respondRes.statusCode === 200 && respondRes.json().status === "ACCEPTED");

  // Passo 6: Verificar se o item de escala agora pertence ao Voluntário B (Maria) e está CONFIRMED
  const eventScheduleRes = await app.inject({
    method: "GET",
    url: `/api/events/${event.id}/schedule`,
    headers: adminAuth,
  });
  const updatedItem = eventScheduleRes.json().find((item: any) => item.id === scheduleItem.id);
  t.check(
    "5. Escala reatribuída para o Voluntário B com status CONFIRMED",
    updatedItem?.member?.id === mariaMemberId && updatedItem?.status === "CONFIRMED"
  );

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("flow-swap-request.test.ts")) {
  const summary = await runSwapRequestFlow();
  process.exit(summary.failed > 0 ? 1 : 0);
}
