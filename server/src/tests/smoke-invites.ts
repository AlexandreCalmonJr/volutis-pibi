/**
 * Teste de fumaça — Sistema de Convites (registro fechado)
 */
import { buildServer } from "../server.js";
import { prisma } from "../lib/db.js";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`, extra ?? ""); }
}

const app = await buildServer();
async function api(method: string, url: string, token?: string, payload?: unknown) {
  return app.inject({
    method: method as any, url,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    payload: payload as any,
  });
}

const adminTok = (await api("POST", "/api/auth/login", undefined, { email: "admin@pibi.org.br", password: "pibi2026" })).json().accessToken;
const joaoTok = (await api("POST", "/api/auth/login", undefined, { email: "joao@pibi.org.br", password: "volutis123" })).json().accessToken;

// 1. Registro sem convite → 400 (validação Zod)
const noInvite = await api("POST", "/api/auth/register", undefined, {
  email: "novo@x.com", password: "123456", name: "Novo Membro",
});
check("Registro sem inviteCode → 400", noInvite.statusCode === 400);

// 2. Convite inexistente → 400
const badCode = await api("POST", "/api/auth/register", undefined, {
  email: "novo@x.com", password: "123456", name: "Novo Membro", inviteCode: "FFFFFFFF",
});
check("Convite inexistente → 400", badCode.statusCode === 400 && /inválido/i.test(badCode.json().error));

// 3. Voluntário não gera convite
const volInvite = await api("POST", "/api/invites", joaoTok, { role: "VOLUNTEER" });
check("RBAC: voluntário gerar convite → 403", volInvite.statusCode === 403);

// 4. Admin gera convite de voluntário com link e share
const inv = await api("POST", "/api/invites", adminTok, { role: "VOLUNTEER" });
const invite = inv.json();
check("Convite criado com código 8-hex, URL e wa.me", inv.statusCode === 201 && /^[0-9A-F]{8}$/.test(invite.code) && invite.registerUrl.includes(invite.code) && invite.whatsappShare.startsWith("https://wa.me/?text="), invite.code);

// 5. Registro com convite válido (código em minúsculas p/ testar normalização)
const reg = await api("POST", "/api/auth/register", undefined, {
  email: "convidado@pibi.org.br", password: "123456", name: "Convidado Teste",
  phone: "71988880000", inviteCode: invite.code.toLowerCase(),
});
check("Registro com convite válido → 201 com papel do convite", reg.statusCode === 201 && reg.json().user.role === "VOLUNTEER", reg.body);

// 6. Reuso do convite → 400
const reuse = await api("POST", "/api/auth/register", undefined, {
  email: "outro@x.com", password: "123456", name: "Outro", inviteCode: invite.code,
});
check("Convite de uso único: reuso → 400", reuse.statusCode === 400);

// 7. Convite expirado → 400
const expired = await prisma.invite.create({
  data: { code: "EEEE0001", role: "MEMBER", churchId: (await prisma.church.findUnique({ where: { slug: "pibi" } }))!.id, expiresAt: new Date(Date.now() - 1000) },
});
const expReg = await api("POST", "/api/auth/register", undefined, {
  email: "tarde@x.com", password: "123456", name: "Atrasado", inviteCode: expired.code,
});
check("Convite expirado → 400", expReg.statusCode === 400);

// 8. Líder (não admin) não convida MINISTRY_LEADER — admin pode
//    (João é VOLUNTEER; simulamos promovendo-o? Não — teste direto: admin pode)
const leaderInv = await api("POST", "/api/invites", adminTok, { role: "MINISTRY_LEADER" });
check("Admin pode convidar líder", leaderInv.statusCode === 201);

// 9. Listar e revogar
const list = await api("GET", "/api/invites", adminTok);
check("GET /invites lista os convites da igreja", list.statusCode === 200 && list.json().length >= 2);
const usedOne = list.json().find((i: any) => i.usedAt);
const revokeUsed = await api("DELETE", `/api/invites/${usedOne.id}`, adminTok);
check("Revogar convite já usado → 409", revokeUsed.statusCode === 409);
const pendingOne = list.json().find((i: any) => !i.usedAt);
const revoke = await api("DELETE", `/api/invites/${pendingOne.id}`, adminTok);
check("Revogar convite pendente → 204", revoke.statusCode === 204);

// 10. Novo usuário consegue logar e aparece como membro da PIBI
const loginNew = await api("POST", "/api/auth/login", undefined, { email: "convidado@pibi.org.br", password: "123456" });
check("Convidado loga normalmente", loginNew.statusCode === 200);
const meNew = (await api("GET", "/api/auth/me", loginNew.json().accessToken)).json();
check("Convidado vinculado à igreja com membro criado", meNew.user.member?.name === "Convidado Teste");

// Limpeza
await prisma.invite.deleteMany({ where: { code: { in: ["EEEE0001"] } } });
const u = await prisma.user.findUnique({ where: { email: "convidado@pibi.org.br" }, include: { member: true } });
if (u) {
  await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
  if (u.member) await prisma.member.delete({ where: { id: u.member.id } });
  await prisma.user.delete({ where: { id: u.id } });
}
await prisma.invite.deleteMany({ where: { usedByEmail: "convidado@pibi.org.br" } });

console.log(`\n${passed} passaram, ${failed} falharam`);
await app.close();
await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
