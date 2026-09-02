import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import compress from "@fastify/compress";
import { ZodError } from "zod";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { prisma } from "./lib/db.js";
import { authRoutes } from "./routes/auth.js";
import { memberRoutes } from "./routes/members.js";
import { ministryRoutes } from "./routes/ministries.js";
import { eventRoutes } from "./routes/events.js";
import { scheduleRoutes } from "./routes/schedules.js";
import { checkinRoutes } from "./routes/checkin.js";
import { songRoutes } from "./routes/songs.js";
import { liturgyRoutes } from "./routes/liturgy.js";
import { chatRoutes } from "./routes/chat.js";
import { feedRoutes } from "./routes/feed.js";
import { holyricsRoutes } from "./routes/holyrics.js";
import { inviteRoutes } from "./routes/invites.js";
import { applicationRoutes } from "./routes/applications.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { adminRoutes } from "./routes/admin.js";
import { notificationRoutes } from "./routes/notifications.js";
import { pushRoutes } from "./routes/push.js";
import { whatsappWebhookRoutes } from "./routes/whatsapp-webhook.js";
import { devotionalRoutes } from "./routes/devotional.js";
import { reportsRoutes } from "./routes/reports.js";
import { uploadRoutes } from "./routes/upload.js";
import { websocketHandler } from "./websocket/handler.js";
import { startReminderScheduler } from "./services/scheduler.service.js";
import { startDatabaseCleanupScheduler } from "./services/cleanup.service.js";
import { initNativeWhatsApp } from "./services/whatsapp.service.js";
import { sanitizePayload } from "./middleware/sanitize.js";
import { appCache } from "./lib/cache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function buildServer() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });

  const isProd = process.env.NODE_ENV === "production";

  const jwtSecret = process.env.JWT_SECRET;
  if (isProd && (!jwtSecret || jwtSecret.length < 32 || jwtSecret.includes("dev"))) {
    throw new Error("JWT_SECRET ausente ou fraco em produção. Gere um com: openssl rand -hex 32");
  }

  // Security headers with Helmet
  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // Disabled to allow media/iframes (YouTube, Spotify, etc.) and PWA service workers
  });

  // Response compression (gzip/brotli)
  await app.register(compress, {
    global: true,
    threshold: 1024, // Compress responses larger than 1KB
  });

  // API Rate Limiting granular
  await app.register(rateLimit, {
    max: (req) => {
      const url = req.url.toLowerCase();
      // Proteção severa contra ataques de força bruta em autenticação
      if (url.includes("/auth/login") || url.includes("/auth/forgot-password")) {
        return 12; // máx 12 tentativas por minuto por IP
      }
      // Proteção contra spam de cadastros públicos
      if (url.includes("/applications/public")) {
        return 10; // máx 10 inscrições por minuto por IP
      }
      return 300; // Padrão geral de 300 req/min
    },
    timeWindow: "1 minute",
    allowList: (req) =>
      req.url.startsWith("/health") ||
      req.url.startsWith("/api/health") ||
      req.url.startsWith("/ws"),
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Limite de requisições excedido para esta operação. Tente novamente em 1 minuto.",
    }),
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    exposedHeaders: ["*"],
  });
  await app.register(jwt, {
    secret: jwtSecret ?? "dev-secret",
  });

  // Sanitização automática anti-XSS de payloads JSON recebidos
  app.addHook("preValidation", async (req) => {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizePayload(req.body);
    }
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "Dados inválidos",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    app.log.error(err);
    const errorObj = err as any;
    const status = errorObj?.statusCode ?? 500;
    const message = status >= 500 && isProd ? "Erro interno do servidor" : (errorObj?.message ?? "Erro interno");
    return reply.code(status).send({ error: message });
  });

  app.addHook("onRequest", async (req) => {
    req.log.info({ method: req.method, url: req.url }, "incoming request");
  });

  app.addHook("onResponse", async (req, reply) => {
    req.log.info({ method: req.method, url: req.url, statusCode: reply.statusCode }, "request completed");
  });

  const getHealthStatus = async () => {
    const memory = process.memoryUsage();
    const start = performance.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const dbLatencyMs = Math.round(performance.now() - start);
      return {
        status: "ok",
        service: "volut-pibi-api",
        db: "connected",
        dbLatencyMs,
        cache: appCache.stats(),
        uptimeSec: Math.round(process.uptime()),
        memory: {
          rssMb: Math.round(memory.rss / 1024 / 1024),
          heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        },
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || "0.1.0",
      };
    } catch {
      return {
        status: "degraded",
        service: "volut-pibi-api",
        db: "disconnected",
        dbLatencyMs: -1,
        cache: appCache.stats(),
        uptimeSec: Math.round(process.uptime()),
        memory: {
          rssMb: Math.round(memory.rss / 1024 / 1024),
          heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        },
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || "0.1.0",
      };
    }
  };

  app.get("/health", getHealthStatus);
  app.get("/api/health", getHealthStatus);

  await app.register(websocket);
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(memberRoutes, { prefix: "/api" });
  await app.register(ministryRoutes, { prefix: "/api" });
  await app.register(eventRoutes, { prefix: "/api" });
  await app.register(scheduleRoutes, { prefix: "/api" });
  await app.register(checkinRoutes, { prefix: "/api" });
  await app.register(songRoutes, { prefix: "/api" });
  await app.register(liturgyRoutes, { prefix: "/api" });
  await app.register(chatRoutes, { prefix: "/api" });
  await app.register(feedRoutes, { prefix: "/api" });
  await app.register(holyricsRoutes, { prefix: "/api" });
  await app.register(inviteRoutes, { prefix: "/api" });
  await app.register(applicationRoutes, { prefix: "/api" });
  await app.register(dashboardRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api" });
  await app.register(notificationRoutes, { prefix: "/api" });
  await app.register(pushRoutes, { prefix: "/api" });
  await app.register(whatsappWebhookRoutes, { prefix: "/api" });
  await app.register(devotionalRoutes, { prefix: "/api" });
  await app.register(reportsRoutes, { prefix: "/api" });
  await app.register(uploadRoutes, { prefix: "/api" });
  await app.register(websocketHandler);

  // Servir uploads de mídias e avatares
  const uploadsDir = join(process.cwd(), "uploads");
  if (existsSync(uploadsDir)) {
    await app.register(fastifyStatic, {
      root: uploadsDir,
      prefix: "/uploads/",
      decorateReply: false,
    });
  }

  const clientDist = existsSync(join(process.cwd(), "client", "dist"))
    ? join(process.cwd(), "client", "dist")
    : join(__dirname, "..", "..", "client", "dist");

  if (isProd && existsSync(clientDist)) {
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: "/",
      decorateReply: false,
    });

    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith("/api") || req.url.startsWith("/ws") || req.url === "/health") {
        return reply.code(404).send({ error: "Rota não encontrada" });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}

const isTest =
  process.env.NODE_ENV === "test" ||
  process.argv[1]?.includes("smoke") ||
  process.argv[1]?.includes("test");

if (!isTest) {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3333);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`🚀 Volut PIBI API rodando em http://localhost:${port}`);

  const schedulerInterval = startReminderScheduler();
  const cleanupInterval = startDatabaseCleanupScheduler();
  initNativeWhatsApp().catch(() => {});

  const shutdown = async () => {
    console.log("\n🛑 Encerrando servidor e finalizando conexões ativas...");
    clearInterval(schedulerInterval);
    clearInterval(cleanupInterval);
    appCache.clear();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
