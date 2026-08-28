import { setupTestContext, TestReporter } from "../helpers/test-client.js";

export async function runAuthSecuritySuite(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("01. Autenticação, RBAC & Segurança (CORS)");
  const ctx = await setupTestContext();
  const { app, adminAuth, volunteerAuth } = ctx;

  // 1. Health Check
  const healthRes = await app.inject({ method: "GET", url: "/health" });
  t.check("GET /health responde status 200 e db conectado", healthRes.statusCode === 200 && healthRes.json().status === "ok");

  // 2. Login com credenciais válidas
  const validLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@pibi.org.br", password: "pibi2026" },
  });
  t.check("POST /api/auth/login com credenciais corretas retorna 200", validLogin.statusCode === 200);
  const loginBody = validLogin.json();
  t.check("Login retorna accessToken e refreshToken", !!loginBody.accessToken && !!loginBody.refreshToken);

  // 3. Login com senha incorreta
  const badLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@pibi.org.br", password: "senha-errada-123" },
  });
  t.check("POST /api/auth/login com senha incorreta retorna 401", badLogin.statusCode === 401);

  // 4. Login com usuário inexistente
  const notFoundLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "naoexiste@pibi.org.br", password: "qualquercoisa" },
  });
  t.check("POST /api/auth/login com usuário inexistente retorna 401", notFoundLogin.statusCode === 401);

  // 5. Rota autenticada /auth/me
  const meRes = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: adminAuth,
  });
  t.check("GET /api/auth/me retorna dados do usuário e membro", meRes.statusCode === 200 && meRes.json().user.email === "admin@pibi.org.br");

  // 6. Rota protegida sem token -> 401
  const noTokenRes = await app.inject({
    method: "GET",
    url: "/api/members",
  });
  t.check("GET /api/members sem token retorna 401", noTokenRes.statusCode === 401);

  // 7. Refresh token com rotação
  const refreshRes = await app.inject({
    method: "POST",
    url: "/api/auth/refresh",
    payload: { refreshToken: loginBody.refreshToken },
  });
  t.check("POST /api/auth/refresh gera novos tokens", refreshRes.statusCode === 200 && !!refreshRes.json().accessToken);
  const refreshedBody = refreshRes.json();

  // 8. Reutilização de token antigo deve falhar (proteção contra replay / rotação)
  const replayRes = await app.inject({
    method: "POST",
    url: "/api/auth/refresh",
    payload: { refreshToken: loginBody.refreshToken },
  });
  t.check("Reutilização de refresh token antigo rejeitada (401)", replayRes.statusCode === 401);

  // 9. RBAC - Voluntário tentando criar ministério -> 403
  const forbiddenRes = await app.inject({
    method: "POST",
    url: "/api/ministries",
    headers: volunteerAuth,
    payload: { name: "Ministério Não Autorizado" },
  });
  t.check("RBAC: Voluntário tentando criar ministério retorna 403 Forbidden", forbiddenRes.statusCode === 403);

  // 10. CORS - Preflight OPTIONS request da origem Vercel
  const corsPreflightRes = await app.inject({
    method: "OPTIONS",
    url: "/api/applications/stats",
    headers: {
      origin: "https://volutis-pibi-client.vercel.app",
      "access-control-request-method": "GET",
      "access-control-request-headers": "Authorization, Content-Type",
    },
  });
  const allowOriginHeader = corsPreflightRes.headers["access-control-allow-origin"];
  t.check(
    "CORS: Preflight OPTIONS retorna status 204/200 e header Access-Control-Allow-Origin",
    (corsPreflightRes.statusCode === 204 || corsPreflightRes.statusCode === 200) &&
      (allowOriginHeader === "https://volutis-pibi-client.vercel.app" || allowOriginHeader === "*")
  );

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("01-auth-security.test.ts")) {
  const summary = await runAuthSecuritySuite();
  process.exit(summary.failed > 0 ? 1 : 0);
}
