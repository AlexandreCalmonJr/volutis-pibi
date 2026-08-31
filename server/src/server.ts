import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
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
import { websocketHandler } from "./websocket/handler.js";
import { startReminderScheduler } from "./services/scheduler.service.js";
import { initNativeWhatsApp } from "./services/whatsapp.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function buildServer() {
  const app = Fastify({ logger: { level: "warn" } });

  const isProd = process.env.NODE_ENV === "production";

  const jwtSecret = process.env.JWT_SECRET;
  if (isProd && (!jwtSecret || jwtSecret.length < 32 || jwtSecret.includes("dev"))) {
    throw new Error("JWT_SECRET ausente ou fraco em produção. Gere um com: openssl rand -hex 32");
  }

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

  app.get("/health", async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", service: "volutis-pibi-api", db: "connected" };
    } catch {
      return { status: "degraded", service: "volutis-pibi-api", db: "disconnected" };
    }
  });

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
  await app.register(websocketHandler);

  const clientDist = existsSync(join(process.cwd(), "client", "dist"))
    ? join(process.cwd(), "client", "dist")
    : join(__dirname, "..", "..", "client", "dist");

  if (isProd && existsSync(clientDist)) {
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: "/",
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
  console.log(`🚀 Volutis PIBI API rodando em http://localhost:${port}`);

  const schedulerInterval = startReminderScheduler();
  initNativeWhatsApp().catch(() => {});

  const shutdown = async () => {
    console.log("\n🛑 Encerrando servidor...");
    clearInterval(schedulerInterval);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
