import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireRole, type AuthUser } from "../middleware/auth.js";

const INVITE_DAYS = 7;

function getAppUrl(req: any): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  return host ? `${proto}://${host}` : "http://localhost:5173";
}

const createSchema = z.object({
  role: z.enum(["MEMBER", "VOLUNTEER", "MINISTRY_LEADER"]),
  inviteeName: z.string().optional(),
  ministryId: z.string().optional(),
});

/** Gera código com iniciais do ministério + random */
function newCode(ministryName?: string | null): string {
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  if (!ministryName) return random;
  const initials = ministryName
    .split(/[\s\/]+/)
    .filter((w) => w.length > 1)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
  return `${initials}-${random}`;
}

export async function inviteRoutes(app: FastifyInstance) {
  /** Criar convite */
  app.post("/invites", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = createSchema.parse(req.body ?? {});

    // Convite de líder só pode ser emitido por ADMIN
    if (body.role === "MINISTRY_LEADER" && auth.role !== "ADMIN") {
      return reply.code(403).send({ error: "Apenas o administrador pode convidar líderes" });
    }

    // Líder não-admin só pode criar convites para o próprio ministério
    let ministryId = body.ministryId || null;
    if (auth.role !== "ADMIN") {
      const leaderMemberships = auth.memberId
        ? await prisma.ministryMember.findMany({
            where: { memberId: auth.memberId, isLeader: true },
            select: { ministryId: true },
          })
        : [];
      const leaderMinistryIds = leaderMemberships.map((item) => item.ministryId);
      if (leaderMinistryIds.length === 0) {
        return reply.code(403).send({ error: "Você não é líder de nenhum ministério" });
      }

      if (ministryId && !leaderMinistryIds.includes(ministryId)) {
        return reply.code(403).send({ error: "Você só pode criar convites para os ministérios que lidera" });
      }

      if (!ministryId) {
        if (leaderMinistryIds.length === 1) {
          ministryId = leaderMinistryIds[0];
        } else {
          return reply.code(400).send({ error: "Selecione para qual ministério o convite deve ser criado" });
        }
      }
    } else if (ministryId) {
      const ministry = await prisma.ministry.findUnique({ where: { id: ministryId }, select: { churchId: true } });
      if (!ministry || ministry.churchId !== auth.churchId) {
        return reply.code(404).send({ error: "Ministério não encontrado" });
      }
    }

    // Buscar nome do ministério para o código
    let ministryName: string | null = null;
    if (ministryId) {
      const ministry = await prisma.ministry.findUnique({ where: { id: ministryId }, select: { name: true } });
      ministryName = ministry?.name ?? null;
    }

    const creator = auth.memberId
      ? await prisma.member.findUnique({ where: { id: auth.memberId }, select: { name: true } })
      : null;

    const invite = await prisma.invite.create({
      data: {
        code: newCode(ministryName),
        role: body.role,
        churchId: auth.churchId,
        ministryId,
        createdByName: creator?.name ?? auth.email,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5),
      },
      include: { ministry: { select: { id: true, name: true, icon: true, color: true } } },
    });

    const appUrl = getAppUrl(req);
    const registerUrl = `${appUrl}/register?convite=${invite.code}`;
    const ministryInfo = invite.ministry ? ` — Ministério: *${invite.ministry.name}*` : "";
    const waText =
      `Olá${body.inviteeName ? `, ${body.inviteeName}` : ""}! 🙌\n\n` +
      `Você foi convidado(a) para o app *Volut PIBI* (escalas e ministérios da igreja).${ministryInfo}\n\n` +
      `Cadastre-se aqui: ${registerUrl}\n` +
      `Código do convite: *${invite.code}* (válido por ${INVITE_DAYS} dias)`;

    return reply.code(201).send({
      ...invite,
      registerUrl,
      whatsappShare: `https://wa.me/?text=${encodeURIComponent(waText)}`,
    });
  });

  /** Listar convites */
  app.get("/invites", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    // Líder não-admin só vê convites do próprio ministério
    const where: any = { churchId: auth.churchId };
    if (auth.role !== "ADMIN") {
      const leaderMemberships = auth.memberId
        ? await prisma.ministryMember.findMany({
            where: { memberId: auth.memberId, isLeader: true },
            select: { ministryId: true },
          })
        : [];
      const leaderMinistryIds = leaderMemberships.map((item) => item.ministryId);
      if (leaderMinistryIds.length > 0) {
        where.ministryId = { in: leaderMinistryIds };
      } else {
        return [];
      }
    }

    return prisma.invite.findMany({
      where,
      include: { ministry: { select: { id: true, name: true, icon: true, color: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  /** Deletar convite */
  app.delete("/invites/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    const invite = await prisma.invite.findUnique({ where: { id }, select: { churchId: true, ministryId: true } });
    const fullInvite = await prisma.invite.findUnique({ where: { id } });
    if (!invite || !fullInvite || invite.churchId !== auth.churchId)
      return reply.code(404).send({ error: "Convite não encontrado" });

    if (fullInvite.usedAt) {
      return reply.code(409).send({ error: "Convites já utilizados não podem ser revogados" });
    }

    // Líder não-admin só pode deletar convites do próprio ministério
    if (auth.role !== "ADMIN") {
      const leaderMemberships = auth.memberId
        ? await prisma.ministryMember.findMany({
            where: { memberId: auth.memberId, isLeader: true },
            select: { ministryId: true },
          })
        : [];
      const leaderMinistryIds = leaderMemberships.map((item) => item.ministryId);
      if (!leaderMinistryIds.includes(invite.ministryId ?? "")) {
        return reply.code(403).send({ error: "Sem permissão para excluir este convite" });
      }
    }

    await prisma.invite.delete({ where: { id } });
    return reply.code(204).send();
  });

  /** Listar ministérios disponíveis (para o seletor) */
  app.get("/invites/ministries", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    // ADMIN vê todos, líder vê apenas o próprio
    if (auth.role === "ADMIN") {
      return prisma.ministry.findMany({
        where: { churchId: auth.churchId },
        select: { id: true, name: true, icon: true, color: true },
        orderBy: { name: "asc" },
      });
    }

    // Líder vê apenas o ministério que lidera
    if (!auth.memberId) return [];
    const leaderMinistries = await prisma.ministryMember.findMany({
      where: { memberId: auth.memberId, isLeader: true },
      include: { ministry: { select: { id: true, name: true, icon: true, color: true } } },
    });
    return leaderMinistries.map((lm) => lm.ministry);
  });
}
