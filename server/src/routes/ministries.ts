import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, toJson, fromJson, belongsToChurch } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";

const ministrySchema = z.object({
  name: z.string().min(2),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const roleSchema = z.object({ name: z.string().min(1) });

const memberLinkSchema = z.object({
  memberId: z.string(),
  isLeader: z.boolean().default(false),
  roles: z.array(z.string()).default([]),
});

export async function ministryRoutes(app: FastifyInstance) {
  app.get("/ministries", { preHandler: [requireAuth] }, async (req) => {
    const auth = req.user as AuthUser;
    const list = await prisma.ministry.findMany({
      where: auth.churchId ? { churchId: auth.churchId } : undefined,
      include: {
        roles: true,
        members: { include: { member: true } },
      },
      orderBy: { name: "asc" },
    });
    return list.map((m) => ({
      ...m,
      members: m.members.map((mm) => ({ ...mm, roles: fromJson(mm.roles) })),
    }));
  });

  app.post("/ministries", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = ministrySchema.parse(req.body);
    const ministry = await prisma.ministry.create({
      data: { ...body, churchId: auth.churchId },
    });
    return reply.code(201).send(ministry);
  });

  app.put("/ministries/:id", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await belongsToChurch("ministry", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    const body = ministrySchema.partial().parse(req.body);
    try {
      return await prisma.ministry.update({ where: { id }, data: body });
    } catch {
      return reply.code(404).send({ error: "Ministério não encontrado" });
    }
  });

  app.delete("/ministries/:id", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await belongsToChurch("ministry", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    try {
      await prisma.ministry.delete({ where: { id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "Ministério não encontrado" });
    }
  });

  // Funções do ministério
  app.post("/ministries/:id/roles", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await belongsToChurch("ministry", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    const body = roleSchema.parse(req.body);
    const role = await prisma.ministryRole.create({ data: { name: body.name, ministryId: id } });
    return reply.code(201).send(role);
  });

  app.delete("/ministries/:id/roles/:roleId", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id, roleId } = req.params as { id: string; roleId: string };
    if (!(await belongsToChurch("ministry", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    const role = await prisma.ministryRole.findUnique({ where: { id: roleId }, select: { ministryId: true } });
    if (!role || role.ministryId !== id)
      return reply.code(404).send({ error: "Função não encontrada" });
    await prisma.ministryRole.delete({ where: { id: roleId } });
    return reply.code(204).send();
  });

  // Vincular membro ao ministério
  app.post("/ministries/:id/members", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    const body = memberLinkSchema.parse(req.body);
    if (!(await belongsToChurch("ministry", id, auth.churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    if (!(await belongsToChurch("member", body.memberId, auth.churchId)))
      return reply.code(404).send({ error: "Membro não encontrado" });
    const link = await prisma.ministryMember.upsert({
      where: { memberId_ministryId: { memberId: body.memberId, ministryId: id } },
      create: { memberId: body.memberId, ministryId: id, isLeader: body.isLeader, roles: toJson(body.roles) },
      update: { isLeader: body.isLeader, roles: toJson(body.roles) },
    });
    return reply.code(201).send({ ...link, roles: fromJson(link.roles) });
  });

  app.delete("/ministries/:id/members/:memberId", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id, memberId } = req.params as { id: string; memberId: string };
    if (!(await belongsToChurch("ministry", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    try {
      await prisma.ministryMember.delete({
        where: { memberId_ministryId: { memberId, ministryId: id } },
      });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "Vínculo não encontrado" });
    }
  });
}
