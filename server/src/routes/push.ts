import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, type AuthUser } from "../middleware/auth.js";
import { getPushPublicConfig, removePushSubscription, upsertPushSubscription } from "../services/push.service.js";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function pushRoutes(app: FastifyInstance) {
  app.get("/push/config", { preHandler: [requireAuth] }, async () => getPushPublicConfig());

  app.post("/push/subscriptions", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });
    const body = subscriptionSchema.parse(req.body);
    await upsertPushSubscription(auth.memberId, body, req.headers["user-agent"]);
    return { ok: true };
  });

  app.delete("/push/subscriptions", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });
    const body = z.object({ endpoint: z.string().url() }).parse(req.body);
    await removePushSubscription(auth.memberId, body.endpoint);
    return reply.code(204).send();
  });
}
