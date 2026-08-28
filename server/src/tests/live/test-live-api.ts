/**
 * Suíte de Testes da API em Produção (Northflank) & CORS (Vercel)
 * Executa testes HTTP reais e WebSocket contra o servidor no ar.
 *
 * Uso:
 *   API_URL=https://p01--volutis-pibi--v4k9pfqbhfw5.code.run tsx src/tests/live/test-live-api.ts
 */

import { WebSocket } from "ws";

const BASE_URL = (
  process.env.API_URL ||
  process.env.VITE_API_URL ||
  "https://p01--volutis-pibi--v4k9pfqbhfw5.code.run"
).replace(/\/+$/, "");

const VERCEL_ORIGIN =
  process.env.CLIENT_URL || "https://volutis-pibi-client.vercel.app";

console.log("\x1b[1m\x1b[35m");
console.log("===============================================================");
console.log(" 🌐 TESTE DE API REMOTA / PRODUÇÃO (NORTHFLANK + VERCEL) ");
console.log(` 🎯 Alvo: ${BASE_URL}`);
console.log(` 🌍 Origem CORS: ${VERCEL_ORIGIN}`);
console.log("===============================================================");
console.log("\x1b[0m");

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✅ ${name}\x1b[0m`);
  } else {
    failed++;
    console.error(`  \x1b[31m❌ ${name}\x1b[0m`, extra !== undefined ? extra : "");
  }
}

async function request(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    origin?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<{
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  data: any;
  error?: string;
}> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.origin ? { Origin: options.origin } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const status = res.status;
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      resHeaders[key.toLowerCase()] = val;
    });
    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { ok: res.ok, status, headers: resHeaders, data };
  } catch (err: any) {
    return { ok: false, status: 0, headers: {}, data: null, error: err?.message };
  }
}

async function main() {
  const startTime = Date.now();

  // 1. Health Check
  const health = await request("/health");
  check(
    "1. GET /health responde status 200 e status do banco",
    health.status === 200,
    health.data || health.error
  );

  // 2. Preflight CORS para /api/applications/stats
  const corsPreflight = await request("/api/applications/stats", {
    method: "OPTIONS",
    origin: VERCEL_ORIGIN,
    headers: {
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization, content-type",
    },
  });
  const allowOrigin =
    corsPreflight.headers["access-control-allow-origin"];
  check(
    "2. CORS Preflight OPTIONS retorna cabeçalho Access-Control-Allow-Origin",
    (corsPreflight.status === 204 || corsPreflight.status === 200) &&
      (allowOrigin === VERCEL_ORIGIN || allowOrigin === "*"),
    { status: corsPreflight.status, allowOrigin }
  );

  // 3. Consulta pública de dados da Igreja
  const churchRes = await request("/api/applications/church/pibi", {
    origin: VERCEL_ORIGIN,
  });
  check(
    "3. GET /api/applications/church/pibi retorna dados da igreja",
    churchRes.status === 200 && !!churchRes.data?.name,
    churchRes.data
  );

  // 4. Teste de Login com conta Admin
  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    origin: VERCEL_ORIGIN,
    body: { email: "admin@pibi.org.br", password: "pibi2026" },
  });
  check(
    "4. POST /api/auth/login (admin@pibi.org.br / pibi2026)",
    adminLogin.status === 200 && !!adminLogin.data?.accessToken,
    adminLogin.data
  );

  const token = adminLogin.data?.accessToken;

  if (!token) {
    console.log(
      "\n\x1b[33m⚠️ Não foi possível obter o token JWT com admin@pibi.org.br. Os demais testes autenticados dependem do seed no banco do Northflank.\x1b[0m\n"
    );
  } else {
    // 5. GET /api/auth/me
    const meRes = await request("/api/auth/me", { token, origin: VERCEL_ORIGIN });
    check(
      "5. GET /api/auth/me retorna dados do perfil autenticado",
      meRes.status === 200 && !!meRes.data?.user,
      meRes.data
    );

    // 6. GET /api/dashboard/stats
    const dashRes = await request("/api/dashboard/stats", {
      token,
      origin: VERCEL_ORIGIN,
    });
    check(
      "6. GET /api/dashboard/stats retorna estatísticas do dashboard",
      dashRes.status === 200,
      dashRes.data
    );

    // 7. GET /api/members
    const membersRes = await request("/api/members", {
      token,
      origin: VERCEL_ORIGIN,
    });
    check(
      "7. GET /api/members retorna lista de voluntários/membros",
      membersRes.status === 200 && Array.isArray(membersRes.data),
      membersRes.data
    );

    // 8. GET /api/ministries
    const ministriesRes = await request("/api/ministries", {
      token,
      origin: VERCEL_ORIGIN,
    });
    check(
      "8. GET /api/ministries lista ministérios cadastrados",
      ministriesRes.status === 200 && Array.isArray(ministriesRes.data),
      ministriesRes.data
    );

    // 9. GET /api/events
    const eventsRes = await request("/api/events", {
      token,
      origin: VERCEL_ORIGIN,
    });
    check(
      "9. GET /api/events lista eventos e escalas",
      eventsRes.status === 200 && Array.isArray(eventsRes.data),
      eventsRes.data
    );

    // 10. GET /api/applications/stats
    const appStatsRes = await request("/api/applications/stats", {
      token,
      origin: VERCEL_ORIGIN,
    });
    check(
      "10. GET /api/applications/stats retorna contadores de triagem",
      appStatsRes.status === 200,
      appStatsRes.data
    );

    // 11. WebSocket em tempo real
    const wsUrl = BASE_URL.replace(/^http/, "ws") + `/ws?token=${token}`;
    try {
      const wsConnected = await new Promise<boolean>((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.on("open", () => {
          clearTimeout(timer);
          ws.close();
          resolve(true);
        });

        ws.on("error", () => {
          clearTimeout(timer);
          resolve(false);
        });
      });

      check(
        `11. WebSocket (wss://${BASE_URL.replace(/^https?:\/\//, "")}/ws?token=...) conecta com sucesso`,
        wsConnected
      );
    } catch (err) {
      check("11. WebSocket conecta com sucesso", false, err);
    }
  }

  // 12. Submissão de Candidatura Pública (Triagem)
  const ts = Date.now().toString();
  const candidateEmail = `teste.live.${ts}@volutis.local`;
  const candidatePhone = `719${ts.slice(-8)}`;
  const applyRes = await request("/api/applications?church=pibi", {
    method: "POST",
    origin: VERCEL_ORIGIN,
    body: {
      name: "Voluntário Teste Nuvem",
      email: candidateEmail,
      phone: candidatePhone,
      instruments: ["Vocal"],
      ministryIds: churchRes.data?.ministries?.[0]?.id
        ? [churchRes.data.ministries[0].id]
        : [],
    },
  });
  check(
    "12. POST /api/applications submete candidatura pública na nuvem",
    applyRes.status === 201 || (applyRes.status === 400 && !churchRes.data?.ministries?.length),
    applyRes.data
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\x1b[1m\x1b[35m");
  console.log("===============================================================");
  console.log("             📊 RESULTADO DO TESTE EM PRODUÇÃO                 ");
  console.log("===============================================================");
  console.log(` \x1b[32m✔ Sucessos:\x1b[0m ${passed}`);
  if (failed > 0) {
    console.log(` \x1b[31m✖ Falhas:\x1b[0m ${failed}`);
  } else {
    console.log(` \x1b[32m✖ Falhas:\x1b[0m 0`);
  }
  console.log(` ⏱  Tempo total: ${duration}s`);
  console.log("===============================================================\x1b[0m\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro fatal no teste de produção:", err);
  process.exit(1);
});
