/**
 * Teste de fumaça — Fase 4 (músicas, setlist, liturgia, chat)
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

// 1. Criar músicas
const s1 = await api("POST", "/api/songs", adminTok, {
  title: "Grande É o Senhor", artist: "Adhemar de Campos", originalKey: "G", bpm: 72,
  structure: "Intro - V1 - C - V2 - C - Final",
  chords: "[G]Grande é o Se[D]nhor e mui [Em]digno de lou[C]vor",
  lyrics: "Grande é o Senhor e mui digno de louvor",
});
check("POST /songs cria música com cifra", s1.statusCode === 201, s1.body);
const song1 = s1.json();
const s2 = await api("POST", "/api/songs", adminTok, { title: "Música Teste Fase 4", artist: "Artista Teste", originalKey: "D", bpm: 64 });
const song2 = s2.json();

// 2. Voluntário não pode criar música (RBAC)
const forbidden = await api("POST", "/api/songs", joaoTok, { title: "X" });
check("RBAC: voluntário criar música → 403", forbidden.statusCode === 403);

// 3. Busca
const search = await api("GET", "/api/songs?q=teste fase 4".replace(/ /g, "%20"), adminTok);
check("GET /songs?q= busca por título", search.statusCode === 200 && search.json().length === 1 && search.json()[0].title === "Música Teste Fase 4", search.json());

// 4. Setlist: evento de teste
const ev = (await api("POST", "/api/events", adminTok, {
  title: "Culto Teste Fase 4", type: "SPECIAL_EVENT",
  date: "2026-09-06T00:00:00.000Z", startTime: "2026-09-06T12:00:00.000Z",
})).json();

const add1 = await api("POST", `/api/events/${ev.id}/setlist`, adminTok, { songId: song1.id, songKey: "A" });
const add2 = await api("POST", `/api/events/${ev.id}/setlist`, adminTok, { songId: song2.id });
check("POST setlist adiciona com tom do culto (A) e ordem auto", add1.statusCode === 201 && add1.json().songKey === "A" && add1.json().order === 1);
check("Setlist herda tom original quando não informado", add2.json().songKey === "D" && add2.json().order === 2);

// 5. Reordenar
const reordered = await api("PUT", `/api/events/${ev.id}/setlist/reorder`, adminTok, {
  itemIds: [add2.json().id, add1.json().id],
});
const rl = reordered.json();
check("PUT reorder inverte a ordem", rl[0].song.title === "Música Teste Fase 4" && rl[0].order === 1 && rl[1].order === 2);

// 6. Liturgia
const l1 = await api("POST", `/api/events/${ev.id}/liturgy`, adminTok, { title: "Abertura", startTime: "19:00", durationMin: 10, responsible: "Pr. Carlos" });
const l2 = await api("POST", `/api/events/${ev.id}/liturgy`, adminTok, { title: "Palavra", startTime: "19:45", durationMin: 45, bibleRef: "Salmos 23:1-6" });
check("POST liturgy cria itens ordenados", l1.statusCode === 201 && l2.json().order === 2);
const badTime = await api("POST", `/api/events/${ev.id}/liturgy`, adminTok, { title: "X", startTime: "7pm" });
check("Liturgia valida formato HH:MM → 400", badTime.statusCode === 400);
const liturgyList = await api("GET", `/api/events/${ev.id}/liturgy`, joaoTok);
check("Voluntário lê liturgia do evento", liturgyList.statusCode === 200 && liturgyList.json().length === 2);

// 7. Chat
const msg = await api("POST", `/api/events/${ev.id}/chat`, joaoTok, { content: "Chego 18h30 pro ensaio!" });
check("POST chat cria mensagem com nome do autor", msg.statusCode === 201 && msg.json().authorName === "João Silva", msg.body);
const chatList = await api("GET", `/api/events/${ev.id}/chat`, adminTok);
check("GET chat lista mensagens", chatList.statusCode === 200 && chatList.json().length === 1);
const empty = await api("POST", `/api/events/${ev.id}/chat`, joaoTok, { content: "" });
check("Mensagem vazia → 400", empty.statusCode === 400);

// 8. Remover item da setlist
const del = await api("DELETE", `/api/setlist-items/${add1.json().id}`, adminTok);
check("DELETE setlist-item → 204", del.statusCode === 204);

// Limpeza
await prisma.event.delete({ where: { id: ev.id } });
await prisma.song.deleteMany({ where: { id: { in: [song1.id, song2.id] } } });

console.log(`\n${passed} passaram, ${failed} falharam`);
await app.close();
await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
