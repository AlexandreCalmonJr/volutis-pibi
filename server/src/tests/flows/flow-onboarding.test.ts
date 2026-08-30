import { setupTestContext, TestReporter } from "../helpers/test-client.js";

export async function runOnboardingFlow(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("FLUXO 01: Recrutamento, Triagem & Onboarding (E2E)");
  const ctx = await setupTestContext();
  const { app, adminAuth } = ctx;

  // Passo 1: Candidato consulta dados públicos da igreja
  const churchRes = await app.inject({ method: "GET", url: "/api/applications/church/pibi" });
  t.check("1. Consulta dados públicos da igreja pelo slug", churchRes.statusCode === 200);
  const churchData = churchRes.json();
  const targetMinistry = churchData.ministries[0];

  // Passo 2: Candidato submete formulário de inscrição pública
  const candidateEmail = `novo.voluntario.${Date.now()}@teste.com`;
  const candidatePhone = `719${Math.floor(10000000 + Math.random() * 90000000)}`;
  const applyRes = await app.inject({
    method: "POST",
    url: "/api/applications?church=pibi",
    payload: {
      name: "Novo Voluntário Onboarding",
      email: candidateEmail,
      phone: candidatePhone,
      instruments: ["Vocal"],
      ministryIds: [targetMinistry.id],
    },
  });
  t.check("2. Inscrição pública enviada com sucesso (201)", applyRes.statusCode === 201);
  const applicationId = applyRes.json().id;

  // Passo 3: Líder acessa Triagem e visualiza candidato pendente
  const triagemRes = await app.inject({
    method: "GET",
    url: `/api/applications/${applicationId}`,
    headers: adminAuth,
  });
  t.check(
    "3. Líder visualiza detalhes da candidatura na Triagem",
    triagemRes.statusCode === 200 && triagemRes.json().email === candidateEmail
  );

  // Passo 4: Líder registra anotações da entrevista
  const noteRes = await app.inject({
    method: "PUT",
    url: `/api/applications/${applicationId}/notes`,
    headers: adminAuth,
    payload: { notes: "Entrevista realizada. Perfil excelente para a equipe de Louvor." },
  });
  t.check("4. Líder registra feedback da entrevista", noteRes.statusCode === 200);

  // Passo 5: Líder aprova candidato e vincula ao Ministério
  const approveRes = await app.inject({
    method: "POST",
    url: `/api/applications/${applicationId}/approve`,
    headers: adminAuth,
    payload: {
      role: "VOLUNTEER",
      ministryAssignments: [
        {
          ministryId: targetMinistry.id,
          roles: ["Vocal"],
          isLeader: false,
        },
      ],
    },
  });
  t.check("5. Líder aprova candidato e sistema gera token de primeiro acesso", approveRes.statusCode === 200 && approveRes.json().status === "APPROVED");
  const approvedMemberId = approveRes.json().memberId;
  t.check("Membro criado no banco de dados", !!approvedMemberId);
  const setPasswordUrl = approveRes.json().setPasswordUrl as string;
  const token = new URL(setPasswordUrl).searchParams.get("token");
  t.check("Link de primeiro acesso contém token", !!token, setPasswordUrl);

  const setPasswordRes = await app.inject({
    method: "POST",
    url: "/api/applications/set-password",
    payload: {
      token,
      password: "senha123",
      name: "Novo Voluntário Onboarding",
      phone: candidatePhone,
      instruments: ["Vocal"],
    },
  });
  t.check(
    "5.1 Candidato define senha e reutiliza o mesmo membro aprovado",
    setPasswordRes.statusCode === 200 && setPasswordRes.json().user.memberId === approvedMemberId,
    setPasswordRes.body
  );

  // Passo 6: Verificar se o novo membro já aparece na lista ativa de membros
  const membersRes = await app.inject({
    method: "GET",
    url: "/api/members",
    headers: adminAuth,
  });
  t.check(
    "6. Novo membro listado na base de membros da igreja",
    membersRes.statusCode === 200 && membersRes.json().some((m: any) => m.id === approvedMemberId)
  );

  const occurrences = membersRes.statusCode === 200
    ? membersRes.json().filter((m: any) => m.phone === `55${candidatePhone}`).length
    : 0;
  t.check("6.1 Não duplica membro após definir senha", occurrences === 1, membersRes.body);

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("flow-onboarding.test.ts")) {
  const summary = await runOnboardingFlow();
  process.exit(summary.failed > 0 ? 1 : 0);
}
