/**
 * Teste de fumaça — Fase 6 (badges automáticos + fluxo do painel do líder)
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
const pedroLogin = (await api("POST", "/api/auth/login", undefined, { email: "pedro@pibi.org.br", password: "volutis123" })).json();
const pedroTok = pedroLogin.accessToken;
const pedroMember = (await api("GET", "/api/auth/me", pedroTok)).json().user.member;

// Limpa estado do Pedro p/ teste determinístico
await prisma.badge.deleteMany({ where: { memberId: pedroMember.id } });
await prisma.checkIn.deleteMany({ where: { memberId: pedroMember.id } });
await prisma.scheduleItem.deleteMany({ where: { memberId: pedroMember.id } });
await prisma.unavailability.deleteMany({ where: { memberId: pedroMember.id } });

// Evento agora (p/ janela de check-in)
const now = new Date();
const ev = (await api("POST", "/api/events", adminTok, {
  title: "Culto Teste Fase 6", type: "SPECIAL_EVENT",
  date: now.toISOString(), startTime: now.toISOString(),
})).json();

// 1. Fluxo do líder: sugestões → atribuição
const ministries = (await api("GET", "/api/ministries", adminTok)).json();
const louvor = ministries.find((m: any) => m.name === "Louvor");
const sug = (await api("GET", `/api/events/${ev.id}/suggestions?ministryId=${louvor.id}&role=Bateria`, adminTok)).json();
check("Sugestões p/ Bateria incluem Pedro com score e histórico", sug.some((s: any) => s.memberId === pedroMember.id && typeof s.score === "number" && "timesServedLast90d" in s), sug);

const assign = await api("POST", `/api/events/${ev.id}/schedule`, adminTok, { memberId: pedroMember.id, roleName: "Bateria" });
const item = assign.json();
check("Atribuição do líder com whatsappLink", assign.statusCode === 201 && !!item.whatsappLink);

// 2. Confirmar → badge de confirmação ainda não (precisa 5), mas sem erro
const confirm = await api("POST", `/api/schedule-items/${item.id}/respond`, pedroTok, { action: "CONFIRM" });
check("Confirmação ok", confirm.statusCode === 200);

// 3. Check-in → badge "Primeiro Check-in" automático
const checkin = await api("POST", `/api/schedule-items/${item.id}/checkin`, pedroTok, { method: "qrcode" });
const cj = checkin.json();
check("Check-in retorna newBadges com 'Primeiro Check-in'", checkin.statusCode === 201 && cj.newBadges?.includes("Primeiro Check-in"), cj);

const badges = await prisma.badge.findMany({ where: { memberId: pedroMember.id } });
check("Badge persistido no banco", badges.some((b) => b.name === "Primeiro Check-in" && b.icon === "🎉"));

// 4. Badge não duplica em novo check-in
const ev2 = (await api("POST", "/api/events", adminTok, {
  title: "Culto Teste Fase 6b", type: "SPECIAL_EVENT",
  date: now.toISOString(), startTime: now.toISOString(),
})).json();
const assign2 = (await api("POST", `/api/events/${ev2.id}/schedule`, adminTok, { memberId: pedroMember.id, roleName: "Bateria", force: true })).json();
await api("POST", `/api/schedule-items/${assign2.id}/respond`, pedroTok, { action: "CONFIRM" });
const checkin2 = (await api("POST", `/api/schedule-items/${assign2.id}/checkin`, pedroTok, { method: "manual" })).json();
check("Segundo check-in não repete o badge", !(checkin2.newBadges ?? []).includes("Primeiro Check-in"), checkin2.newBadges);
const count = await prisma.badge.count({ where: { memberId: pedroMember.id, name: "Primeiro Check-in" } });
check("Badge único no banco", count === 1);

// 5. /auth/me expõe badges
const me = (await api("GET", "/api/auth/me", pedroTok)).json();
check("GET /auth/me inclui badges do membro", Array.isArray(me.user.member.badges) && me.user.member.badges.length >= 1);

// 6. Badge por pontos (Centurião aos 100 pts)
await prisma.member.update({ where: { id: pedroMember.id }, data: { points: 100 } });
const ev3 = (await api("POST", "/api/events", adminTok, {
  title: "Culto Teste Fase 6c", type: "SPECIAL_EVENT",
  date: now.toISOString(), startTime: now.toISOString(),
})).json();
const assign3 = (await api("POST", `/api/events/${ev3.id}/schedule`, adminTok, { memberId: pedroMember.id, roleName: "Bateria", force: true })).json();
const confirm3 = await api("POST", `/api/schedule-items/${assign3.id}/respond`, pedroTok, { action: "CONFIRM" });
check("Confirmação com 100+ pts premia Centurião", confirm3.statusCode === 200 && (await prisma.badge.count({ where: { memberId: pedroMember.id, name: "Centurião" } })) === 1);

// Limpeza
await prisma.event.deleteMany({ where: { title: { in: ["Culto Teste Fase 6", "Culto Teste Fase 6b", "Culto Teste Fase 6c"] } } });
await prisma.badge.deleteMany({ where: { memberId: pedroMember.id } });
await prisma.member.update({ where: { id: pedroMember.id }, data: { points: 0 } });

console.log(`\n${passed} passaram, ${failed} falharam`);
await app.close();
await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
