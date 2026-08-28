import type { FastifyInstance } from "fastify";
import { buildServer } from "../../server.js";
import { prisma } from "../../lib/db.js";

export interface TestContext {
  app: FastifyInstance;
  churchId: string;
  adminToken: string;
  leaderToken: string;
  volunteerToken: string;
  memberToken: string;
  adminAuth: { authorization: string };
  leaderAuth: { authorization: string };
  volunteerAuth: { authorization: string };
  memberAuth: { authorization: string };
  adminMemberId?: string;
  volunteerMemberId?: string;
}

export class TestReporter {
  passed = 0;
  failed = 0;
  private suiteName: string;
  private startTime = Date.now();

  constructor(suiteName: string) {
    this.suiteName = suiteName;
    console.log(`\n\x1b[36m━━━ [SUITE] ${suiteName} ━━━\x1b[0m`);
  }

  check(name: string, cond: boolean, extra?: unknown) {
    if (cond) {
      this.passed++;
      console.log(`  \x1b[32m✅ ${name}\x1b[0m`);
    } else {
      this.failed++;
      console.error(`  \x1b[31m❌ ${name}\x1b[0m`, extra !== undefined ? extra : "");
    }
  }

  summary(): { passed: number; failed: number; durationMs: number } {
    const durationMs = Date.now() - this.startTime;
    const color = this.failed === 0 ? "\x1b[32m" : "\x1b[31m";
    console.log(
      `${color}▶ ${this.suiteName}: ${this.passed} passaram, ${this.failed} falharam (${durationMs}ms)\x1b[0m\n`
    );
    return { passed: this.passed, failed: this.failed, durationMs };
  }
}

let cachedApp: FastifyInstance | null = null;

export async function getTestApp(): Promise<FastifyInstance> {
  if (!cachedApp) {
    cachedApp = await buildServer();
  }
  return cachedApp;
}

export async function setupTestContext(): Promise<TestContext> {
  const app = await getTestApp();

  // Obter church do seed
  const church = await prisma.church.findFirst();
  if (!church) {
    throw new Error("Banco sem seed. Execute npm run seed antes dos testes.");
  }

  // Obter usuários existentes do seed ou autenticar
  const adminRes = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@pibi.org.br", password: "pibi2026" },
  });

  const joaoRes = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "joao@pibi.org.br", password: "volutis123" },
  });

  const mariaRes = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "maria@pibi.org.br", password: "volutis123" },
  });

  const adminData = adminRes.json();
  const joaoData = joaoRes.json();
  const mariaData = mariaRes.json();

  const adminToken = adminData.accessToken;
  const volunteerToken = joaoData.accessToken;
  const leaderToken = mariaData.accessToken || adminToken;
  const memberToken = volunteerToken;

  const adminMe = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const adminMemberId = adminMe.json()?.user?.member?.id;

  const joaoMe = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${volunteerToken}` },
  });
  const volunteerMemberId = joaoMe.json()?.user?.member?.id;

  return {
    app,
    churchId: church.id,
    adminToken,
    leaderToken,
    volunteerToken,
    memberToken,
    adminAuth: { authorization: `Bearer ${adminToken}` },
    leaderAuth: { authorization: `Bearer ${leaderToken}` },
    volunteerAuth: { authorization: `Bearer ${volunteerToken}` },
    memberAuth: { authorization: `Bearer ${memberToken}` },
    adminMemberId,
    volunteerMemberId,
  };
}
