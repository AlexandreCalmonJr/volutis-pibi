import { setupTestContext, TestReporter } from "../helpers/test-client.js";

export async function runApplicationsTriagemSuite(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("04. Triagem, Candidaturas & Estatísticas");
  const ctx = await setupTestContext();
  const { app, adminAuth, volunteerAuth } = ctx;

  // 1. Dados públicos da igreja pelo slug
  const churchInfoRes = await app.inject({
    method: "GET",
    url: "/api/applications/church/pibi",
  });
  t.check("GET /api/applications/church/:slug retorna dados públicos da igreja", churchInfoRes.statusCode === 200 && !!churchInfoRes.json().name);
  const churchInfo = churchInfoRes.json();
  const ministryId = churchInfo.ministries[0]?.id;

  // 2. Submissão pública de candidatura
  const uniqueEmail = `candidato-${Date.now()}@teste.com`;
  const uniquePhone = `719${Math.floor(10000000 + Math.random() * 90000000)}`;
  const applyRes = await app.inject({
    method: "POST",
    url: "/api/applications?church=pibi",
    payload: {
      name: "Candidato Teste Triagem",
      email: uniqueEmail,
      phone: uniquePhone,
      instruments: ["Vocal", "Violão"],
      ministryIds: [ministryId],
    },
  });
  t.check("POST /api/applications público registra candidatura com status 201", applyRes.statusCode === 201);
  const appliedData = applyRes.json();
  t.check("Candidatura criada com status PENDING", appliedData.status === "PENDING");

  // 3. Detecção de e-mail duplicado em candidatura pendente -> 409
  const dupRes = await app.inject({
    method: "POST",
    url: "/api/applications?church=pibi",
    payload: {
      name: "Candidato Duplicado",
      email: uniqueEmail,
      ministryIds: [ministryId],
    },
  });
  t.check("POST /api/applications com e-mail duplicado retorna 409 Conflict", dupRes.statusCode === 409);

  // 4. Estatísticas de candidaturas para o Dashboard da Triagem
  const statsRes = await app.inject({
    method: "GET",
    url: "/api/applications/stats",
    headers: adminAuth,
  });
  t.check(
    "GET /api/applications/stats retorna contadores de pending, approved e rejected",
    statsRes.statusCode === 200 &&
      typeof statsRes.json().pending === "number" &&
      typeof statsRes.json().approved === "number"
  );

  // 5. Listar candidaturas com filtro
  const listRes = await app.inject({
    method: "GET",
    url: "/api/applications?status=PENDING",
    headers: adminAuth,
  });
  t.check("GET /api/applications?status=PENDING lista candidaturas pendentes", listRes.statusCode === 200 && Array.isArray(listRes.json()));

  // 6. Atualizar notas internas do candidato
  const noteRes = await app.inject({
    method: "PUT",
    url: `/api/applications/${appliedData.id}/notes`,
    headers: adminAuth,
    payload: { notes: "Entrevista realizada com feedback muito positivo." },
  });
  t.check("PUT /api/applications/:id/notes salva observações internas", noteRes.statusCode === 200 && noteRes.json().notes.includes("feedback"));

  // 7. Aprovar candidato com vinculação a ministério
  const approveRes = await app.inject({
    method: "POST",
    url: `/api/applications/${appliedData.id}/approve`,
    headers: adminAuth,
    payload: {
      role: "VOLUNTEER",
      ministryAssignments: [{ ministryId, roles: ["Vocal"], isLeader: false }],
    },
  });
  t.check("POST /api/applications/:id/approve aprova candidato e gera token de acesso", approveRes.statusCode === 200 && approveRes.json().status === "APPROVED");
  t.check("Aprovação retorna setPasswordUrl com token de primeiro acesso", !!approveRes.json().setPasswordUrl);

  // 8. Tentar aprovar candidato já revisado -> 400
  const reApproveRes = await app.inject({
    method: "POST",
    url: `/api/applications/${appliedData.id}/approve`,
    headers: adminAuth,
  });
  t.check("Tentativa de aprovação duplicada retorna 400", reApproveRes.statusCode === 400);

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("04-applications-triagem.test.ts")) {
  const summary = await runApplicationsTriagemSuite();
  process.exit(summary.failed > 0 ? 1 : 0);
}
