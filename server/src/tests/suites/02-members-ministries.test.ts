import { setupTestContext, TestReporter } from "../helpers/test-client.js";

export async function runMembersMinistriesSuite(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("02. Membros & Ministérios");
  const ctx = await setupTestContext();
  const { app, adminAuth, volunteerAuth } = ctx;

  // 1. Listar membros
  const membersRes = await app.inject({
    method: "GET",
    url: "/api/members",
    headers: adminAuth,
  });
  t.check("GET /api/members retorna 200 com lista de membros", membersRes.statusCode === 200 && Array.isArray(membersRes.json()));

  // 2. Criar novo membro
  const newMemberRes = await app.inject({
    method: "POST",
    url: "/api/members",
    headers: adminAuth,
    payload: {
      name: "Membro Teste Suíte 02",
      phone: "71999990001",
      instruments: ["Bateria", "Vocal"],
    },
  });
  t.check("POST /api/members cria membro com status 201", newMemberRes.statusCode === 201);
  const createdMember = newMemberRes.json();
  t.check("Membro criado possui instruments como array", Array.isArray(createdMember.instruments) && createdMember.instruments.includes("Bateria"));

  // 3. Atualizar membro
  const updateMemberRes = await app.inject({
    method: "PUT",
    url: `/api/members/${createdMember.id}`,
    headers: adminAuth,
    payload: {
      name: "Membro Teste Atualizado",
      instruments: ["Bateria", "Teclado"],
    },
  });
  t.check("PUT /api/members/:id atualiza dados do membro", updateMemberRes.statusCode === 200 && updateMemberRes.json().name === "Membro Teste Atualizado");

  // 4. Cadastrar indisponibilidade para o membro
  const nextSunday = new Date();
  nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7 || 7));
  const unavailRes = await app.inject({
    method: "POST",
    url: `/api/members/${createdMember.id}/unavailabilities`,
    headers: adminAuth,
    payload: {
      date: nextSunday.toISOString(),
      reason: "Viagem de família",
    },
  });
  t.check("POST /api/members/:id/unavailabilities registra bloqueio de data", unavailRes.statusCode === 201);

  // 5. Listar ministérios
  const ministriesRes = await app.inject({
    method: "GET",
    url: "/api/ministries",
    headers: adminAuth,
  });
  t.check("GET /api/ministries lista os ministérios existentes", ministriesRes.statusCode === 200 && ministriesRes.json().length > 0);
  const ministries = ministriesRes.json();
  const louvor = ministries.find((m: any) => m.name === "Louvor") || ministries[0];

  // 6. Vincular membro ao ministério com papéis específicos
  const linkRes = await app.inject({
    method: "POST",
    url: `/api/ministries/${louvor.id}/members`,
    headers: adminAuth,
    payload: {
      memberId: createdMember.id,
      roles: ["Bateria"],
      isLeader: false,
    },
  });
  t.check("POST /api/ministries/:id/members vincula membro com funções", linkRes.statusCode === 201);

  // 7. Obter lista de ministérios e conferir membros vinculados
  const updatedMinistriesRes = await app.inject({
    method: "GET",
    url: "/api/ministries",
    headers: adminAuth,
  });
  const updatedLouvor = updatedMinistriesRes.json().find((m: any) => m.id === louvor.id);
  t.check(
    "GET /api/ministries retorna ministério com membro vinculado",
    updatedMinistriesRes.statusCode === 200 &&
      updatedLouvor?.members?.some((m: any) => m.memberId === createdMember.id)
  );

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("02-members-ministries.test.ts")) {
  const summary = await runMembersMinistriesSuite();
  process.exit(summary.failed > 0 ? 1 : 0);
}
