/**
 * Teste de fumaça — Fase 5 (integração Holyrics)
 * Sobe um mock do Holyrics em http://127.0.0.1:3398/api/{action}?token=xxx
 * e valida o fluxo completo contra ele.
 */
import http from "node:http";
import { buildServer } from "../server.js";
import { prisma } from "../lib/db.js";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`, extra ?? ""); }
}

// ── Mock Holyrics ──────────────────────────────────────────
const MOCK_TOKEN = "tok-igreja-123";
const received: { action: string; body: any }[] = [];
let mockPlaylist: any[] = [{ id: "h-old", title: "Antiga" }];

const mock = http.createServer((req, res) => {
  const url = new URL(req.url!, "http://x");
  const action = url.pathname.replace("/api/", "");
  const token = url.searchParams.get("token");
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    res.setHeader("Content-Type", "application/json");
    if (token !== MOCK_TOKEN) {
      res.end(JSON.stringify({ status: "error", error: "invalid token" }));
      return;
    }
    received.push({ action, body });
    switch (action) {
      case "GetTokenInfo":
        res.end(JSON.stringify({ status: "ok", data: { version: "2.27.0", permissions: "GetSongs,ShowVerse" } }));
        break;
      case "GetSongs":
        res.end(JSON.stringify({
          status: "ok",
          data: [
            { id: "h-1", title: "Quão Grande É o Meu Deus", artist: "Soraya Moraes", key: "A", bpm: 74.0 },
            { id: "h-2", title: "Oceanos (Onde Meus Pés Podem Falhar)", artist: "Hillsong United", key: "D", bpm: 64.0 },
            { id: "h-3", title: "Lugar Secreto", artist: "Gabriela Rocha", key: "G", bpm: 70.0 },
          ],
        }));
        break;
      case "GetLyricsPlaylist":
        res.end(JSON.stringify({ status: "ok", data: mockPlaylist }));
        break;
      case "RemoveFromLyricsPlaylist":
        mockPlaylist = [];
        res.end(JSON.stringify({ status: "ok" }));
        break;
      case "AddLyricsToPlaylist":
        mockPlaylist.push(...(body.ids ?? []).map((id: string) => ({ id })));
        res.end(JSON.stringify({ status: "ok" }));
        break;
      case "GetCurrentPresentation":
        res.end(JSON.stringify({ status: "ok", data: { id: "h-1", type: "song", name: "Quão Grande É o Meu Deus", slide_number: 2, total_slides: 6 } }));
        break;
      case "ShowVerse":
      case "ShowCountdown":
      case "ShowQuickPresentation":
      case "SetTextCP":
      case "ActionNext":
      case "ActionPrevious":
      case "CloseCurrentPresentation":
        res.end(JSON.stringify({ status: "ok" }));
        break;
      default:
        res.end(JSON.stringify({ status: "error", error: `ação desconhecida: ${action}` }));
    }
  });
});
await new Promise<void>((r) => mock.listen(3398, "127.0.0.1", r));

// ── App ────────────────────────────────────────────────────
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

// 1. Sem configuração → status desconectado / ações bloqueadas com 409
await prisma.church.update({ where: { slug: "pibi" }, data: { holyricsMode: null, holyricsToken: null } });
const st0 = await api("GET", "/api/holyrics/status", adminTok);
check("Status sem config → configured:false", st0.json().configured === false);
const blocked = await api("POST", "/api/holyrics/show-verse", adminTok, { references: "Sl 23:1" });
check("Ação sem config → 409 NOT_CONFIGURED", blocked.statusCode === 409 && blocked.json().code === "NOT_CONFIGURED", blocked.body);

// 2. Configurar via API (ADMIN)
const cfg = await api("PUT", "/api/holyrics/config", adminTok, {
  mode: "local", localIp: "127.0.0.1", localPort: 3398, token: MOCK_TOKEN,
});
check("PUT /holyrics/config configura modo local", cfg.statusCode === 200 && cfg.json().configured === true, cfg.body);

// RBAC: voluntário não configura nem controla
const rbac1 = await api("PUT", "/api/holyrics/config", joaoTok, { mode: "local" });
check("RBAC: voluntário configurar → 403", rbac1.statusCode === 403);
const rbac2 = await api("POST", "/api/holyrics/action", joaoTok, { action: "next" });
check("RBAC: voluntário controlar slides → 403", rbac2.statusCode === 403);

// 3. Status conectado
const st1 = await api("GET", "/api/holyrics/status", adminTok);
check("Status conectado com versão do Holyrics", st1.json().connected === true && st1.json().version === "2.27.0", st1.body);

// 4. Importar músicas
const imp = await api("POST", "/api/holyrics/import-songs", adminTok);
check("Import cria 3 músicas do Holyrics", imp.statusCode === 200 && imp.json().imported === 3, imp.body);
const imp2 = await api("POST", "/api/holyrics/import-songs", adminTok);
check("Re-import atualiza em vez de duplicar", imp2.json().imported === 0 && imp2.json().updated === 3, imp2.body);
const songs = (await api("GET", "/api/songs?q=lugar%20secreto", adminTok)).json();
check("Música importada com tom e BPM", songs.length === 1 && songs[0].originalKey === "G" && songs[0].bpm === 70 && songs[0].holyricsId === "h-3");

// 5. Setlist → Holyrics
const ev = (await api("POST", "/api/events", adminTok, {
  title: "Culto Teste Fase 5", type: "SPECIAL_EVENT",
  date: "2026-09-13T00:00:00.000Z", startTime: "2026-09-13T12:00:00.000Z",
})).json();
const all = (await api("GET", "/api/songs", adminTok)).json();
const h1 = all.find((s: any) => s.holyricsId === "h-1");
const h2 = all.find((s: any) => s.holyricsId === "h-2");
const local = all.find((s: any) => !s.holyricsId); // música só local (do seed)
await api("POST", `/api/events/${ev.id}/setlist`, adminTok, { songId: h1.id });
await api("POST", `/api/events/${ev.id}/setlist`, adminTok, { songId: h2.id });
if (local) await api("POST", `/api/events/${ev.id}/setlist`, adminTok, { songId: local.id });

const send = await api("POST", `/api/events/${ev.id}/holyrics/send-setlist`, adminTok, { clear: true });
const sendJson = send.json();
check("Send-setlist envia 2 vinculadas e reporta não vinculadas", send.statusCode === 200 && sendJson.sent === 2 && (local ? sendJson.skipped.length === 1 : true), sendJson);
check("Playlist do mock foi limpa e recebeu ids na ordem", JSON.stringify(mockPlaylist.map((p: any) => p.id)) === JSON.stringify(["h-1", "h-2"]), mockPlaylist);

// 6. Projeção remota
const verse = await api("POST", "/api/holyrics/show-verse", adminTok, { references: "Sl 23:1-6 Jo 3:16" });
check("ShowVerse projetado", verse.statusCode === 200);
const cd = await api("POST", "/api/holyrics/show-countdown", adminTok, { time: "05:00", textBefore: "Começamos em" });
check("ShowCountdown 05:00 enviado", cd.statusCode === 200);
const badCd = await api("POST", "/api/holyrics/show-countdown", adminTok, { time: "5 minutos" });
check("Countdown com formato inválido → 400", badCd.statusCode === 400);
const txt = await api("POST", "/api/holyrics/show-text", adminTok, { text: "Bem-vindos à PIBI!" });
check("ShowQuickPresentation enviado", txt.statusCode === 200);
const panel = await api("POST", "/api/holyrics/panel-text", adminTok, { text: "5 min restantes", show: true });
check("SetTextCP (painel do pregador) enviado", panel.statusCode === 200);
const nxt = await api("POST", "/api/holyrics/action", adminTok, { action: "next" });
check("ActionNext enviado", nxt.statusCode === 200);
const cur = await api("GET", "/api/holyrics/current", adminTok);
check("GetCurrentPresentation retorna slide 2/6", cur.json().presentation?.slide_number === 2 && cur.json().presentation?.total_slides === 6);

// 7. Verifica payloads corretos recebidos pelo mock
const verseCall = received.find((r) => r.action === "ShowVerse");
check("Payload ShowVerse com references", verseCall?.body?.references === "Sl 23:1-6 Jo 3:16");
const cdCall = received.find((r) => r.action === "ShowCountdown");
check("Payload ShowCountdown com text_before", cdCall?.body?.time === "05:00" && cdCall?.body?.text_before === "Começamos em");

// 8. Token errado → erro amigável
await prisma.church.update({ where: { slug: "pibi" }, data: { holyricsToken: "token-errado" } });
const badTok = await api("GET", "/api/holyrics/status", adminTok);
check("Token inválido → connected:false com erro do Holyrics", badTok.json().connected === false && /invalid token/.test(badTok.json().error ?? ""), badTok.body);

// Restaura config boa e limpa
await prisma.church.update({ where: { slug: "pibi" }, data: { holyricsToken: MOCK_TOKEN } });
await prisma.event.delete({ where: { id: ev.id } });
await prisma.song.deleteMany({ where: { holyricsId: { in: ["h-1", "h-2", "h-3"] } } });

console.log(`\n${passed} passaram, ${failed} falharam`);
mock.close();
await app.close();
await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
