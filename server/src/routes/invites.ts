import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireRole, type AuthUser } from "../middleware/auth.js";

const INVITE_DAYS = 7;
const APP_URL = process.env.APP_URL ?? "https://volutis-pibi.vercel.app";

const createSchema = z.object({
  role: z.enum(["MEMBER", "VOLUNTEER", "MINISTRY_LEADER"]).default("VOLUNTEER"),
  inviteeName: z.string().optional(), // só para exibição/controle do líder
});

function newCode() {
  // 8 hex maiúsculos — legível e fácil de ditar (ex: 3F9A2C71)
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function inviteRoutes(app: FastifyInstance) {
  app.post("/invites", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = createSchema.parse(req.body ?? {});

    // Convite de líder só pode ser emitido por ADMIN
    if (body.role === "MINISTRY_LEADER" && auth.role !== "ADMIN") {
      return reply.code(403).send({ error: "Apenas o administrador pode convidar líderes" });
    }

    const creator = auth.memberId
      ? await prisma.member.findUnique({ where: { id: auth.memberId }, select: { name: true } })
      : null;

    const invite = await prisma.invite.create({
      data: {
        code: newCode(),
        role: body.role,
        churchId: auth.churchId,
        createdByName: creator?.name ?? auth.email,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5),
      },
    });

    const registerUrl = `${APP_URL}/login?convite=${invite.code}`;
    const waText =
      `Olá${body.inviteeName ? `, ${body.inviteeName}` : ""}! 🙌\n\n` +
      `Você foi convidado(a) para o app *Volutis PIBI* (escalas e ministérios da igreja).\n\n` +
      `Cadastre-se aqui: ${registerUrl}\n` +
      `Código do convite: *${invite.code}* (válido por ${INVITE_DAYS} dias)`;

    return reply.code(201).send({
      ...invite,
      registerUrl,
      whatsappShare: `https://wa.me/?text=${encodeURIComponent(waText)}`,
    });
  });

  app.get("/invites", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    return prisma.invite.findMany({
      where: { churchId: auth.churchId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  app.delete("/invites/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    const invite = await prisma.invite.findUnique({ where: { id }, select: { churchId: true, usedAt: true } });
    if (!invite || invite.churchId !== auth.churchId)
      return reply.code(404).send({ error: "Convite não encontrado" });
    if (invite.usedAt) return reply.code(409).send({ error: "Convite já utilizado — não pode ser revogado" });
    await prisma.invite.delete({ where: { id } });
    return reply.code(204).send();
  });
}
