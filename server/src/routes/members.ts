import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, toJson, fromJson, belongsToChurch } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";

const LEADER_ROLES = ["ADMIN", "MINISTRY_LEADER"];

/** Telefone/nascimento visíveis apenas para líderes (minimização de dados) */
function stripPII(m: any, role: string) {
  if (LEADER_ROLES.includes(role)) return m;
  const { phone: _p, birthDate: _b, ...rest } = m;
  return rest;
}

const memberSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  photoUrl: z.string().url().optional(),
  avatarKey: z.enum(["violet", "blue", "emerald", "amber", "rose", "slate"]).optional(),
  instruments: z.array(z.string()).default([]),
  birthDate: z.string().datetime().optional(),
});

const unavailabilitySchema = z.object({
  date: z.string().datetime(),
  reason: z.string().optional(),
  recurring: z.boolean().default(false),
});

const memberStatusSchema = z.object({
  approvalStatus: z.enum(["ACTIVE", "PENDING", "INACTIVE"]),
});

function serialize(m: any) {
  return { ...m, instruments: fromJson(m.instruments) };
}

function normalizeOptionalString(value?: string | null) {
  if (typeof value !== "string") return value ?? undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function memberRoutes(app: FastifyInstance) {
  app.get("/my/profile", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });
    const member = await prisma.member.findUnique({
      where: { id: auth.memberId },
      include: {
        ministryMembers: { include: { ministry: true } },
        unavailabilities: true,
        badges: { orderBy: { earnedAt: "desc" } },
      },
    });
    if (!member) return reply.code(404).send({ error: "Membro não encontrado" });
    return serialize(member);
  });

  app.put("/my/profile", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });

    const body = memberSchema.partial().parse(req.body);
    const member = await prisma.member.findUnique({ where: { id: auth.memberId } });
    if (!member || member.churchId !== auth.churchId) {
      return reply.code(404).send({ error: "Membro não encontrado" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextPhone = normalizeOptionalString(body.phone);
      const nextPhotoUrl = normalizeOptionalString(body.photoUrl);
      const nextName = normalizeOptionalString(body.name);

      const savedMember = await tx.member.update({
        where: { id: auth.memberId },
        data: {
          name: nextName ?? undefined,
          phone: nextPhone,
          photoUrl: nextPhotoUrl,
          avatarKey: body.avatarKey,
          instruments: body.instruments ? toJson(body.instruments) : undefined,
          birthDate: body.birthDate ? new Date(body.birthDate) : body.birthDate === null ? null : undefined,
        },
        include: {
          ministryMembers: { include: { ministry: true } },
          unavailabilities: true,
          badges: { orderBy: { earnedAt: "desc" } },
        },
      });

      if (member.userId) {
        await tx.user.update({
          where: { id: member.userId },
          data: { phone: nextPhone },
        });
      }

      return savedMember;
    });

    return serialize(updated);
  });

  app.get("/members", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const members = await prisma.member.findMany({
      where: { churchId: auth.churchId },
      include: { ministryMembers: { include: { ministry: true } } },
      orderBy: { name: "asc" },
    });
    return members.map((m) => stripPII(serialize(m), auth.role));
  });

  app.get("/members/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("member", id, auth.churchId)))
      return reply.code(404).send({ error: "Membro não encontrado" });
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        ministryMembers: { include: { ministry: true } },
        unavailabilities: true,
        badges: true,
      },
    });
    if (!member) return reply.code(404).send({ error: "Membro não encontrado" });
    // O próprio membro vê seus dados completos; demais seguem a regra de PII
    const full = auth.memberId === id || LEADER_ROLES.includes(auth.role);
    return full ? serialize(member) : stripPII(serialize(member), auth.role);
  });

  app.post("/members", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    const body = memberSchema.parse(req.body);
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const member = await prisma.member.create({
      data: {
        name: body.name,
        phone: body.phone,
        photoUrl: body.photoUrl,
        avatarKey: body.avatarKey,
        instruments: toJson(body.instruments),
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
        churchId: auth.churchId,
      },
    });
    return reply.code(201).send(serialize(member));
  });

  app.put("/members/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("member", id, auth.churchId)))
      return reply.code(404).send({ error: "Membro não encontrado" });
    const body = memberSchema.partial().parse(req.body);
    try {
      const member = await prisma.member.update({
        where: { id },
        data: {
          ...body,
          instruments: body.instruments ? toJson(body.instruments) : undefined,
          birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
        },
      });
      return serialize(member);
    } catch {
      return reply.code(404).send({ error: "Membro não encontrado" });
    }
  });

  app.delete("/members/:id", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("member", id, auth.churchId)))
      return reply.code(404).send({ error: "Membro não encontrado" });
    try {
      await prisma.member.delete({ where: { id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "Membro não encontrado" });
    }
  });

  app.patch("/members/:id/status", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("member", id, auth.churchId))) {
      return reply.code(404).send({ error: "Membro não encontrado" });
    }

    const body = memberStatusSchema.parse(req.body);
    const updated = await prisma.member.update({
      where: { id },
      data: {
        approvalStatus: body.approvalStatus,
        approvedAt: body.approvalStatus === "ACTIVE" ? new Date() : null,
        approvedBy: body.approvalStatus === "ACTIVE" ? auth.memberId ?? undefined : null,
      },
    });

    return serialize(updated);
  });

  // Indisponibilidades — apenas o próprio voluntário ou um líder da mesma igreja
  app.post("/members/:id/unavailabilities", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    const isSelf = auth.memberId === id;
    const isLeader = LEADER_ROLES.includes(auth.role);
    if (!isSelf && !isLeader)
      return reply.code(403).send({ error: "Sem permissão para alterar indisponibilidade de outro membro" });
    if (!(await belongsToChurch("member", id, auth.churchId)))
      return reply.code(404).send({ error: "Membro não encontrado" });
    const body = unavailabilitySchema.parse(req.body);
    const item = await prisma.unavailability.create({
      data: { memberId: id, date: new Date(body.date), reason: body.reason, recurring: body.recurring },
    });
    return reply.code(201).send(item);
  });

  app.delete("/members/:id/unavailabilities/:uid", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id, uid } = req.params as { id: string; uid: string };
    const auth = req.user as AuthUser;
    const isSelf = auth.memberId === id;
    const isLeader = LEADER_ROLES.includes(auth.role);
    if (!isSelf && !isLeader)
      return reply.code(403).send({ error: "Sem permissão" });
    const item = await prisma.unavailability.findUnique({ where: { id: uid }, select: { memberId: true } });
    if (!item || item.memberId !== id || !(await belongsToChurch("member", id, auth.churchId)))
      return reply.code(404).send({ error: "Indisponibilidade não encontrada" });
    await prisma.unavailability.delete({ where: { id: uid } });
    return reply.code(204).send();
  });
}
