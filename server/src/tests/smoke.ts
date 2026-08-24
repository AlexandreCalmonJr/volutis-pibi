/**
 * Teste de fumaça — sobe o app via inject (sem porta) e valida os fluxos da Fase 1.
 */
import { buildServer } from "../server.js";
import { buildScheduleWhatsAppLink } from "../services/whatsapp.service.js";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`, extra ?? ""); }
}

const app = await buildServer();

// 1. Health
const health = await app.inject({ method: "GET", url: "/health" });
check("GET /health responde ok", health.statusCode === 200);

// 2. Login admin (do seed)
const login = await app.inject({
  method: "POST", url: "/api/auth/login",
  payload: { email: "admin@pibi.org.br", password: "pibi2026" },
});
check("POST /auth/login admin", login.statusCode === 200, login.body);
const { accessToken, refreshToken } = login.json();
const auth = { authorization: `Bearer ${accessToken}` };

// 3. Rota protegida sem token
const noAuth = await app.inject({ method: "GET", url: "/api/members" });
check("GET /members sem token → 401", noAuth.statusCode === 401);

// 4. Listar ministérios
const ministries = await app.inject({ method: "GET", url: "/api/ministries", headers: auth });
const mList = ministries.json();
check("GET /ministries retorna 7 ministérios do seed", ministries.statusCode === 200 && mList.length === 7, mList.length);

// 5. Criar membro
const newMember = await app.inject({
  method: "POST", url: "/api/members", headers: auth,
  payload: { name: "Ana Costa", phone: "71988887777", instruments: ["Vocal"] },
});
check("POST /members cria membro", newMember.statusCode === 201, newMember.body);
const member = newMember.json();
check("instruments desserializado como array", Array.isArray(member.instruments));

// 6. Vincular membro ao ministério de Louvor
const louvor = mList.find((m: any) => m.name === "Louvor");
const link = await app.inject({
  method: "POST", url: `/api/ministries/${louvor.id}/members`, headers: auth,
  payload: { memberId: member.id, roles: ["Vocal"] },
});
check("POST vincula membro ao Louvor", link.statusCode === 201, link.body);

// 7. Listar eventos
const events = await app.inject({ method: "GET", url: "/api/events", headers: auth });
check("GET /events retorna eventos do seed", events.statusCode === 200 && events.json().length >= 12, events.json().length);

// 8. Criar evento
const newEvent = await app.inject({
  method: "POST", url: "/api/events", headers: auth,
  payload: {
    title: "Vigília de Ano Novo", type: "SPECIAL_EVENT",
    date: "2026-12-31T00:00:00.000Z", startTime: "2026-12-31T22:00:00.000Z",
  },
});
check("POST /events cria evento especial", newEvent.statusCode === 201, newEvent.body);

// 9. Validação Zod
const badEvent = await app.inject({
  method: "POST", url: "/api/events", headers: auth,
  payload: { title: "X", type: "INVALIDO", date: "ontem" },
});
check("POST /events inválido → 400 com issues Zod", badEvent.statusCode === 400 && !!badEvent.json().issues);

// 10. RBAC — voluntário não pode criar ministério
const volLogin = await app.inject({
  method: "POST", url: "/api/auth/login",
  payload: { email: "joao@pibi.org.br", password: "volutis123" },
});
const volAuth = { authorization: `Bearer ${volLogin.json().accessToken}` };
const forbidden = await app.inject({
  method: "POST", url: "/api/ministries", headers: volAuth,
  payload: { name: "Teste" },
});
check("RBAC: voluntário criar ministério → 403", forbidden.statusCode === 403);

// 11. Refresh token com rotação
const refresh = await app.inject({ method: "POST", url: "/api/auth/refresh", payload: { refreshToken } });
check("POST /auth/refresh emite novos tokens", refresh.statusCode === 200 && !!refresh.json().accessToken);
const reuse = await app.inject({ method: "POST", url: "/api/auth/refresh", payload: { refreshToken } });
check("Refresh token antigo invalidado (rotação)", reuse.statusCode === 401);

// 12. Link WhatsApp
const waLink = buildScheduleWhatsAppLink({
  memberName: "Ana", phone: "71988887777",
  eventTitle: "Culto Domingo Manhã", eventDate: new Date("2026-08-30T12:00:00Z"),
  roleName: "Vocal", confirmUrl: "https://volutis-pibi.vercel.app/escala/abc",
});
check("Link wa.me gerado com telefone normalizado (+55)", !!waLink && waLink.startsWith("https://wa.me/5571988887777?text="));

console.log(`\n${passed} passaram, ${failed} falharam`);
await app.close();
process.exit(failed > 0 ? 1 : 0);
