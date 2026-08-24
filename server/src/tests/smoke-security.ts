/**
 * Teste de fumaça — Revisão de Segurança
 * Prova: sem vazamento de passwordHash, rate limit, PII restrita,
 * isolamento multi-igreja (IDOR), proteção de indisponibilidades e guarda de produção.
 */
import { buildServer } from "../server.js";
import { prisma } from "../lib/db.js";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`, extra ?? ""); }
}

// 0. Guarda de produção: JWT_SECRET fraco deve impedir o boot
{
  const oldEnv = process.env.NODE_ENV, oldSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET = "dev-secret";
  let threw = false;
  try { await buildServer(); } catch { threw = true; }
  check("Produção com JWT_SECRET fraco → boot falha", threw);
  process.env.NODE_ENV = oldEnv;
  process.env.JWT_SECRET = oldSecret;
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
const mariaMember = (await api("GET", "/api/auth/me", (await api("POST", "/api/auth/login", undefined, { email: "maria@pibi.org.br", password: "volutis123" })).json().accessToken)).json().user.member;

// 1. /auth/me não vaza passwordHash
const me = (await api("GET", "/api/auth/me", joaoTok)).json();
check("GET /auth/me sem passwordHash", me.user && !("passwordHash" in me.user), Object.keys(me.user ?? {}));

// 2. Rate limit de login (10 tentativas → 11ª bloqueada)
let last: any;
for (let i = 0; i < 11; i++) {
  last = await api("POST", "/api/auth/login", undefined, { email: "atacante@x.com", password: `errada${i}` });
}
check("11ª tentativa de login → 429 com Retry-After", last.statusCode === 429 && !!last.headers["retry-after"], last.statusCode);
const otherUser = await api("POST", "/api/auth/login", undefined, { email: "joao@pibi.org.br", password: "volutis123" });
check("Rate limit é por IP+e-mail (outro e-mail não afetado)", otherUser.statusCode === 200);

// 3. PII: voluntário não vê telefone; líder vê
const membersAsVol = (await api("GET", "/api/members", joaoTok)).json();
check("Voluntário não vê phone/birthDate em /members", membersAsVol.every((m: any) => !("phone" in m) && !("birthDate" in m)));
const membersAsAdmin = (await api("GET", "/api/members", adminTok)).json();
check("Líder/admin vê phone em /members", membersAsAdmin.some((m: any) => m.phone));

// 4. Indisponibilidade de terceiros bloqueada
const unavailForOther = await api("POST", `/api/members/${mariaMember.id}/unavailabilities`, joaoTok, { date: new Date().toISOString() });
check("Voluntário criar indisponibilidade de OUTRO membro → 403", unavailForOther.statusCode === 403);

// 5. Isolamento multi-igreja (IDOR) — cria segunda igreja com dados
const church2 = await prisma.church.create({ data: { name: "Outra Igreja", slug: "outra-igreja-teste" } });
const member2 = await prisma.member.create({ data: { name: "Membro Externo", phone: "11999990000", churchId: church2.id } });
const ministry2 = await prisma.ministry.create({ data: { name: "Louvor Externo", churchId: church2.id } });
const song2 = await prisma.song.create({ data: { title: "Música Externa", churchId: church2.id } });
const event2 = await prisma.event.create({
  data: { title: "Culto Externo", type: "SPECIAL_EVENT", date: new Date(), startTime: new Date(), churchId: church2.id },
});
const setlist2 = await prisma.setlistItem.create({ data: { eventId: event2.id, songId: song2.id, order: 1 } });

const idorChecks: Array<[string, Promise<any>]> = [
  ["PUT membro de outra igreja → 404", api("PUT", `/api/members/${member2.id}`, adminTok, { name: "Hackeado" })],
  ["DELETE membro de outra igreja → 404", api("DELETE", `/api/members/${member2.id}`, adminTok)],
  ["GET evento de outra igreja → 404", api("GET", `/api/events/${event2.id}`, adminTok)],
  ["PUT evento de outra igreja → 404", api("PUT", `/api/events/${event2.id}`, adminTok, { title: "Hackeado" })],
  ["DELETE evento de outra igreja → 404", api("DELETE", `/api/events/${event2.id}`, adminTok)],
  ["PUT ministério de outra igreja → 404", api("PUT", `/api/ministries/${ministry2.id}`, adminTok, { name: "Hackeado" })],
  ["PUT música de outra igreja → 404", api("PUT", `/api/songs/${song2.id}`, adminTok, { title: "Hackeada" })],
  ["GET música de outra igreja → 404", api("GET", `/api/songs/${song2.id}`, adminTok)],
  ["Chat em evento de outra igreja → 404", api("POST", `/api/events/${event2.id}/chat`, adminTok, { content: "invasão" })],
  ["Setlist de evento de outra igreja → 404", api("GET", `/api/events/${event2.id}/setlist`, adminTok)],
  ["Editar setlist-item de outra igreja → 404", api("PUT", `/api/setlist-items/${setlist2.id}`, adminTok, { songKey: "X" })],
  ["Escalar membro de outra igreja → 404", (async () => {
    const evLocal = await prisma.event.findFirst({ where: { church: { slug: "pibi" } } });
    return api("POST", `/api/events/${evLocal!.id}/schedule`, adminTok, { memberId: member2.id, roleName: "Vocal" });
  })()],
  ["Sugestões com ministério de outra igreja → 404", (async () => {
    const evLocal = await prisma.event.findFirst({ where: { church: { slug: "pibi" } } });
    return api("GET", `/api/events/${evLocal!.id}/suggestions?ministryId=${ministry2.id}&role=Vocal`, adminTok);
  })()],
];
for (const [name, p] of idorChecks) {
  const res = await p;
  check(name, res.statusCode === 404, res.statusCode);
}

// Nada foi alterado na outra igreja
const m2 = await prisma.member.findUnique({ where: { id: member2.id } });
check("Dados da outra igreja intactos", m2?.name === "Membro Externo");

// 6. Telefone oculto p/ voluntário na tela do evento
const evLocal = await prisma.event.findFirst({ where: { church: { slug: "pibi" } }, orderBy: { date: "asc" } });
const evForVol = (await api("GET", `/api/events/${evLocal!.id}`, joaoTok)).json();
check("Voluntário vê phone:null nos escalados do evento", (evForVol.scheduleItems ?? []).every((s: any) => s.member.phone === null));

// Limpeza da igreja de teste
await prisma.setlistItem.deleteMany({ where: { eventId: event2.id } });
await prisma.event.delete({ where: { id: event2.id } });
await prisma.song.delete({ where: { id: song2.id } });
await prisma.ministry.delete({ where: { id: ministry2.id } });
await prisma.member.delete({ where: { id: member2.id } });
await prisma.church.delete({ where: { id: church2.id } });

console.log(`\n${passed} passaram, ${failed} falharam`);
await app.close();
await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
