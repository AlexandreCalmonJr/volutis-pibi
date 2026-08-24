/**
 * Teste de fumaça — Fase 2 (escalas inteligentes, troca, check-in, WebSocket)
 */
import { WebSocket } from "ws";
import { buildServer } from "../server.js";
import { prisma } from "../lib/db.js";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`, extra ?? ""); }
}

const app = await buildServer();
await app.listen({ port: 3399, host: "127.0.0.1" }); // porta real p/ testar WS

async function api(method: string, url: string, token?: string, payload?: unknown) {
  return app.inject({
    method: method as any, url,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    payload: payload as any,
  });
}

// Logins
const adminTok = (await api("POST", "/api/auth/login", undefined, { email: "admin@pibi.org.br", password: "pibi2026" })).json().accessToken;
const joaoLogin = (await api("POST", "/api/auth/login", undefined, { email: "joao@pibi.org.br", password: "volutis123" })).json();
const mariaLogin = (await api("POST", "/api/auth/login", undefined, { email: "maria@pibi.org.br", password: "volutis123" })).json();
const joaoTok = joaoLogin.accessToken, mariaTok = mariaLogin.accessToken;

// IDs de membros
const joaoMember = (await api("GET", "/api/auth/me", joaoTok)).json().user.member;
const mariaMember = (await api("GET", "/api/auth/me", mariaTok)).json().user.member;
const pedroLogin = (await api("POST", "/api/auth/login", undefined, { email: "pedro@pibi.org.br", password: "volutis123" })).json();
const pedroMember = (await api("GET", "/api/auth/me", pedroLogin.accessToken)).json().user.member;

// Ministério Louvor + vínculo dos 3 voluntários
const ministries = (await api("GET", "/api/ministries", adminTok)).json();
const louvor = ministries.find((m: any) => m.name === "Louvor");
for (const [m, roles] of [[joaoMember, ["Violão", "Vocal"]], [mariaMember, ["Teclado"]], [pedroMember, ["Bateria"]]] as any) {
  await api("POST", `/api/ministries/${louvor.id}/members`, adminTok, { memberId: m.id, roles });
}

// Evento de teste começando AGORA (p/ janela de check-in) — via API
const now = new Date();
const testEvent = (await api("POST", "/api/events", adminTok, {
  title: "Culto Teste Fase 2", type: "SPECIAL_EVENT",
  date: now.toISOString(), startTime: now.toISOString(),
})).json();

// 1. Sugestões de voluntários
const sug = await api("GET", `/api/events/${testEvent.id}/suggestions?ministryId=${louvor.id}&role=Vocal`, adminTok);
const sugList = sug.json();
check("Sugestões retornam João (Vocal) e não Maria/Pedro", sug.statusCode === 200 && sugList.some((s: any) => s.memberId === joaoMember.id) && !sugList.some((s: any) => s.memberId === mariaMember.id), sugList);

// 2. WebSocket: conecta João antes da atribuição
const wsMessages: any[] = [];
const ws = new WebSocket(`ws://127.0.0.1:3399/ws?token=${joaoTok}`);
await new Promise<void>((res, rej) => { ws.on("open", () => res()); ws.on("error", rej); });
ws.on("message", (d) => wsMessages.push(JSON.parse(d.toString())));
await new Promise((r) => setTimeout(r, 200));

// 3. Atribuir João como Vocal
const assign = await api("POST", `/api/events/${testEvent.id}/schedule`, adminTok, { memberId: joaoMember.id, roleName: "Vocal" });
const item = assign.json();
check("Atribuição cria item PENDING com link wa.me", assign.statusCode === 201 && item.status === "PENDING" && item.whatsappLink?.startsWith("https://wa.me/55"), item.whatsappLink);

await new Promise((r) => setTimeout(r, 300));
check("WebSocket recebeu SCHEDULE_ASSIGNED em tempo real", wsMessages.some((m) => m.type === "SCHEDULE_ASSIGNED"), wsMessages.map((m) => m.type));

// 4. Conflito: mesmo horário em outro evento
const conflictEvent = (await api("POST", "/api/events", adminTok, {
  title: "Ensaio Simultâneo", type: "REHEARSAL",
  date: now.toISOString(), startTime: now.toISOString(),
})).json();
const conflictTry = await api("POST", `/api/events/${conflictEvent.id}/schedule`, adminTok, { memberId: joaoMember.id, roleName: "Violão" });
check("Conflito de horário bloqueado com 409 + code CONFLICT", conflictTry.statusCode === 409 && conflictTry.json().code === "CONFLICT");
const forced = await api("POST", `/api/events/${conflictEvent.id}/schedule`, adminTok, { memberId: joaoMember.id, roleName: "Violão", force: true });
check("Líder pode forçar com force:true", forced.statusCode === 201);
await api("DELETE", `/api/schedule-items/${forced.json().id}`, adminTok);

// 5. Indisponibilidade bloqueia atribuição
await api("POST", `/api/members/${pedroMember.id}/unavailabilities`, adminTok, { date: now.toISOString() });
const unavailTry = await api("POST", `/api/events/${testEvent.id}/schedule`, adminTok, { memberId: pedroMember.id, roleName: "Bateria" });
check("Indisponibilidade bloqueada com 409 + code UNAVAILABLE", unavailTry.statusCode === 409 && unavailTry.json().code === "UNAVAILABLE");

// 6. Voluntário errado não pode responder
const wrongRespond = await api("POST", `/api/schedule-items/${item.id}/respond`, mariaTok, { action: "CONFIRM" });
check("Outro voluntário responder → 403", wrongRespond.statusCode === 403);

// 7. Recusa exige motivo
const noReason = await api("POST", `/api/schedule-items/${item.id}/respond`, joaoTok, { action: "DECLINE" });
check("Recusa sem motivo → 400", noReason.statusCode === 400);

// 8. João pede troca com Maria
const swap = await api("POST", `/api/schedule-items/${item.id}/swap`, joaoTok, { targetMemberId: mariaMember.id, message: "Vou viajar" });
check("Pedido de troca criado", swap.statusCode === 201, swap.body);
const itemAfterSwap = await prisma.scheduleItem.findUnique({ where: { id: item.id } });
check("Item marcado SWAP_REQUESTED", itemAfterSwap?.status === "SWAP_REQUESTED");

// 9. Maria aceita a troca → vaga passa p/ ela, CONFIRMED
const swapAccept = await api("POST", `/api/swap-requests/${swap.json().id}/respond`, mariaTok, { action: "ACCEPT" });
check("Troca aceita", swapAccept.statusCode === 200, swapAccept.body);
const itemFinal = await prisma.scheduleItem.findUnique({ where: { id: item.id } });
check("Vaga reatribuída a Maria e CONFIRMED", itemFinal?.memberId === mariaMember.id && itemFinal?.status === "CONFIRMED");

// 10. Check-in de Maria (evento começou agora → dentro da janela)
const mariaPointsBefore = (await api("GET", `/api/members/${mariaMember.id}`, adminTok)).json().points;
const checkin = await api("POST", `/api/schedule-items/${item.id}/checkin`, mariaTok, { method: "qrcode" });
check("Check-in dentro da janela → 201", checkin.statusCode === 201, checkin.body);
const dup = await api("POST", `/api/schedule-items/${item.id}/checkin`, mariaTok, { method: "manual" });
check("Check-in duplicado → 409", dup.statusCode === 409);
const mariaPointsAfter = (await api("GET", `/api/members/${mariaMember.id}`, adminTok)).json().points;
check("Pontos de gamificação creditados (+10 check-in)", mariaPointsAfter === mariaPointsBefore + 10, { antes: mariaPointsBefore, depois: mariaPointsAfter });

// 11. Feed pessoal
const feed = await api("GET", "/api/my/schedule", mariaTok);
check("GET /my/schedule retorna itens do voluntário", feed.statusCode === 200 && feed.json().items.some((i: any) => i.id === item.id));

// 12. Ranking
const ranking = await api("GET", "/api/gamification/ranking", adminTok);
check("Ranking ordenado por pontos", ranking.statusCode === 200 && ranking.json()[0].points >= (ranking.json()[1]?.points ?? 0));

// 13. WS com token inválido é rejeitado
const badWs = new WebSocket(`ws://127.0.0.1:3399/ws?token=invalido`);
const badCode = await new Promise<number>((res) => { badWs.on("close", (code) => res(code)); badWs.on("error", () => {}); });
check("WebSocket rejeita token inválido (4002)", badCode === 4002, badCode);

ws.close();

// Limpeza dos dados de teste
await prisma.event.deleteMany({ where: { title: { in: ["Culto Teste Fase 2", "Ensaio Simultâneo"] } } });
await prisma.unavailability.deleteMany({ where: { memberId: pedroMember.id } });

console.log(`\n${passed} passaram, ${failed} falharam`);
await app.close();
await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
