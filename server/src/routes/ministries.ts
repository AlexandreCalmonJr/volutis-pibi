import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma, toJson, fromJson, belongsToChurch } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";
import { appCache } from "../lib/cache.js";

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

const transferRequestSchema = z.object({
  memberId: z.string(),
  fromMinistryId: z.string().optional(),
  toMinistryId: z.string(),
  requestedLeader: z.boolean().default(false),
  requestedRoles: z.array(z.string()).default([]),
  mode: z.enum(["TRANSFER", "ADD"]).default("TRANSFER"),
  reason: z.string().max(500).optional(),
});

const transferResponseSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().max(500).optional(),
});

async function userLeadsMinistry(memberId: string | undefined, ministryId: string) {
  if (!memberId) return false;
  const link = await prisma.ministryMember.findFirst({
    where: { memberId, ministryId, isLeader: true },
    select: { id: true },
  });
  return !!link;
}

async function ensureMinistryManagementAccess(auth: AuthUser, ministryId: string) {
  if (auth.role === "ADMIN") return true;
  return userLeadsMinistry(auth.memberId, ministryId);
}

async function ministryHasLeader(ministryId: string) {
  const count = await prisma.ministryMember.count({ where: { ministryId, isLeader: true } });
  return count > 0;
}

function serializeMinistry(m: any) {
  return {
    ...m,
    members: m.members.map((mm: any) => ({ ...mm, roles: fromJson(mm.roles) })),
  };
}

function serializeTransferRequest(item: any) {
  return {
    ...item,
    requestedRoles: fromJson(item.requestedRoles),
  };
}

async function finalizeTransferRequest(tx: Prisma.TransactionClient, requestId: string, approverMemberId?: string | null) {
  const request = await tx.ministryTransferRequest.findUnique({
    where: { id: requestId },
    include: {
      member: true,
      fromMinistry: true,
      toMinistry: true,
    },
  });
  if (!request) throw new Error("TRANSFER_REQUEST_NOT_FOUND");

  await tx.ministryMember.upsert({
    where: {
      memberId_ministryId: {
        memberId: request.memberId,
        ministryId: request.toMinistryId,
      },
    },
    update: {
      isLeader: request.requestedLeader,
      roles: request.requestedRoles,
    },
    create: {
      memberId: request.memberId,
      ministryId: request.toMinistryId,
      isLeader: request.requestedLeader,
      roles: request.requestedRoles,
    },
  });

  if (request.mode === "TRANSFER" && request.fromMinistryId && request.fromMinistryId !== request.toMinistryId) {
    await tx.ministryMember.deleteMany({
      where: {
        memberId: request.memberId,
        ministryId: request.fromMinistryId,
      },
    });
  }

  return tx.ministryTransferRequest.update({
    where: { id: requestId },
    data: {
      status: "APPROVED",
      targetLeaderApprovedAt: new Date(),
      targetLeaderApprovedBy: approverMemberId ?? null,
    },
    include: {
      member: true,
      fromMinistry: true,
      toMinistry: true,
    },
  });
}

export async function ministryRoutes(app: FastifyInstance) {
  app.get("/ministries", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(403).send({ error: "Acesso negado" });

    const cacheKey = `ministries:${auth.churchId}`;
    const cached = appCache.get<any[]>(cacheKey);
    if (cached) return cached;

    const list = await prisma.ministry.findMany({
      where: { churchId: auth.churchId, deletedAt: null },
      include: {
        roles: true,
        members: { include: { member: true } },
      },
      orderBy: { name: "asc" },
    });
    const serialized = list.map(serializeMinistry);
    appCache.set(cacheKey, serialized, 60); // 60s TTL
    return serialized;
  });

  app.post("/ministries", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = ministrySchema.parse(req.body);
    const ministry = await prisma.ministry.create({
      data: { ...body, churchId: auth.churchId },
    });
    appCache.invalidate(`ministries:${auth.churchId}`);
    return reply.code(201).send(ministry);
  });

  app.put("/ministries/:id", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("ministry", id, auth.churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    const body = ministrySchema.partial().parse(req.body);
    try {
      const updated = await prisma.ministry.update({ where: { id }, data: body });
      appCache.invalidate(`ministries:${auth.churchId}`);
      return updated;
    } catch {
      return reply.code(404).send({ error: "Ministério não encontrado" });
    }
  });

  app.delete("/ministries/:id", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("ministry", id, auth.churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    try {
      // Soft-delete preserva integridade histórica de escalas
      await prisma.ministry.update({ where: { id }, data: { deletedAt: new Date() } });
      appCache.invalidate(`ministries:${auth.churchId}`);
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
    if (!(await ensureMinistryManagementAccess(req.user as AuthUser, id)))
      return reply.code(403).send({ error: "Sem permissão para gerenciar este ministério" });
    const body = roleSchema.parse(req.body);
    const role = await prisma.ministryRole.create({ data: { name: body.name, ministryId: id } });
    return reply.code(201).send(role);
  });

  app.delete("/ministries/:id/roles/:roleId", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id, roleId } = req.params as { id: string; roleId: string };
    if (!(await belongsToChurch("ministry", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    if (!(await ensureMinistryManagementAccess(req.user as AuthUser, id)))
      return reply.code(403).send({ error: "Sem permissão para gerenciar este ministério" });
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
    if (!(await ensureMinistryManagementAccess(auth, id)))
      return reply.code(403).send({ error: "Sem permissão para gerenciar este ministério" });
    if (!(await belongsToChurch("member", body.memberId, auth.churchId)))
      return reply.code(404).send({ error: "Membro não encontrado" });

    // Apenas Administrador pode promover a Líder
    const isLeader = auth.role === "ADMIN" ? body.isLeader : false;

    const link = await prisma.ministryMember.upsert({
      where: { memberId_ministryId: { memberId: body.memberId, ministryId: id } },
      create: { memberId: body.memberId, ministryId: id, isLeader, roles: toJson(body.roles) },
      update: { ...(auth.role === "ADMIN" ? { isLeader } : {}), roles: toJson(body.roles) },
    });
    return reply.code(201).send({ ...link, roles: fromJson(link.roles) });
  });

  app.delete("/ministries/:id/members/:memberId", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id, memberId } = req.params as { id: string; memberId: string };
    if (!(await belongsToChurch("ministry", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    if (!(await ensureMinistryManagementAccess(req.user as AuthUser, id)))
      return reply.code(403).send({ error: "Sem permissão para gerenciar este ministério" });
    try {
      await prisma.ministryMember.delete({
        where: { memberId_ministryId: { memberId, ministryId: id } },
      });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "Vínculo não encontrado" });
    }
  });

  app.patch("/ministries/:id/members/:memberId", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id, memberId } = req.params as { id: string; memberId: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("ministry", id, auth.churchId)))
      return reply.code(404).send({ error: "Ministério não encontrado" });
    if (!(await ensureMinistryManagementAccess(auth, id)))
      return reply.code(403).send({ error: "Sem permissão para gerenciar este ministério" });
    if (!(await belongsToChurch("member", memberId, auth.churchId)))
      return reply.code(404).send({ error: "Membro não encontrado" });

    const link = await prisma.ministryMember.findUnique({
      where: { memberId_ministryId: { memberId, ministryId: id } },
    });
    if (!link) return reply.code(404).send({ error: "Vínculo não encontrado" });

    const body = memberLinkSchema.partial().parse(req.body);

    if (body.isLeader !== undefined && body.isLeader !== link.isLeader && auth.role !== "ADMIN") {
      return reply.code(403).send({ error: "Apenas o Administrador pode aprovar ou alterar a liderança do ministério." });
    }

    const updated = await prisma.ministryMember.update({
      where: { memberId_ministryId: { memberId, ministryId: id } },
      data: {
        isLeader: auth.role === "ADMIN" ? body.isLeader : undefined,
        roles: body.roles ? toJson(body.roles) : undefined,
      },
    });
    return { ...updated, roles: fromJson(updated.roles) };
  });

  app.get("/transfer-requests", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    let ministryIds: string[] = [];
    if (auth.role !== "ADMIN") {
      const leaderLinks = await prisma.ministryMember.findMany({
        where: { memberId: auth.memberId, isLeader: true },
        select: { ministryId: true },
      });
      ministryIds = leaderLinks.map((item) => item.ministryId);
    }

    const items = await prisma.ministryTransferRequest.findMany({
      where: {
        churchId: auth.churchId,
        ...(auth.role === "ADMIN"
          ? {}
          : {
              OR: [
                { fromMinistryId: { in: ministryIds } },
                { toMinistryId: { in: ministryIds } },
              ],
            }),
      },
      include: {
        member: true,
        fromMinistry: true,
        toMinistry: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return items.map(serializeTransferRequest);
  });

  app.post("/transfer-requests", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = transferRequestSchema.parse(req.body);

    if (!(await belongsToChurch("member", body.memberId, auth.churchId)))
      return reply.code(404).send({ error: "Membro não encontrado" });
    if (!(await belongsToChurch("ministry", body.toMinistryId, auth.churchId)))
      return reply.code(404).send({ error: "Ministério de destino não encontrado" });
    if (body.fromMinistryId && !(await belongsToChurch("ministry", body.fromMinistryId, auth.churchId)))
      return reply.code(404).send({ error: "Ministério de origem não encontrado" });
    if (body.fromMinistryId && body.fromMinistryId === body.toMinistryId && body.mode === "TRANSFER")
      return reply.code(409).send({ error: "Origem e destino não podem ser iguais em uma transferência" });

    if (body.mode === "TRANSFER" && body.fromMinistryId) {
      const exists = await prisma.ministryMember.findUnique({
        where: { memberId_ministryId: { memberId: body.memberId, ministryId: body.fromMinistryId } },
      });
      if (!exists) {
        return reply.code(409).send({ error: "O membro não está vinculado ao ministério de origem" });
      }
    }

    const sourceHasLeader = body.fromMinistryId ? await ministryHasLeader(body.fromMinistryId) : false;
    const targetHasLeader = await ministryHasLeader(body.toMinistryId);
    const initialStatus = body.fromMinistryId && sourceHasLeader ? "PENDING_SOURCE_LEADER" : targetHasLeader ? "PENDING_TARGET_LEADER" : "APPROVED";

    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.ministryTransferRequest.create({
        data: {
          churchId: auth.churchId!,
          memberId: body.memberId,
          fromMinistryId: body.fromMinistryId,
          toMinistryId: body.toMinistryId,
          mode: body.mode,
          requestedRoles: toJson(body.requestedRoles),
          requestedLeader: body.requestedLeader,
          reason: body.reason,
          status: initialStatus,
        },
        include: {
          member: true,
          fromMinistry: true,
          toMinistry: true,
        },
      });

      if (initialStatus === "APPROVED") {
        return finalizeTransferRequest(tx, request.id, auth.memberId);
      }

      return request;
    });

    return reply.code(201).send(serializeTransferRequest(created));
  });

  app.post("/transfer-requests/:id/respond", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = transferResponseSchema.parse(req.body);

    const item = await prisma.ministryTransferRequest.findUnique({
      where: { id },
      include: {
        member: true,
        fromMinistry: true,
        toMinistry: true,
      },
    });
    if (!item || item.churchId !== auth.churchId)
      return reply.code(404).send({ error: "Solicitação não encontrada" });
    if (!["PENDING_SOURCE_LEADER", "PENDING_TARGET_LEADER"].includes(item.status))
      return reply.code(409).send({ error: "Solicitação já finalizada" });

    const canApproveSource = item.status === "PENDING_SOURCE_LEADER" && item.fromMinistryId && (auth.role === "ADMIN" || await userLeadsMinistry(auth.memberId, item.fromMinistryId));
    const canApproveTarget = item.status === "PENDING_TARGET_LEADER" && (auth.role === "ADMIN" || await userLeadsMinistry(auth.memberId, item.toMinistryId));

    if (!canApproveSource && !canApproveTarget)
      return reply.code(403).send({ error: "Sem permissão para responder esta solicitação" });

    const updated = await prisma.$transaction(async (tx) => {
      if (body.action === "REJECT") {
        return tx.ministryTransferRequest.update({
          where: { id },
          data: {
            status: "REJECTED",
            rejectedAt: new Date(),
            rejectedBy: auth.memberId ?? null,
            rejectionReason: body.reason,
          },
          include: {
            member: true,
            fromMinistry: true,
            toMinistry: true,
          },
        });
      }

      if (item.status === "PENDING_SOURCE_LEADER") {
        const needsTargetApproval = await ministryHasLeader(item.toMinistryId);
        if (needsTargetApproval) {
          return tx.ministryTransferRequest.update({
            where: { id },
            data: {
              status: "PENDING_TARGET_LEADER",
              sourceLeaderApprovedAt: new Date(),
              sourceLeaderApprovedBy: auth.memberId ?? null,
            },
            include: {
              member: true,
              fromMinistry: true,
              toMinistry: true,
            },
          });
        }

        await tx.ministryTransferRequest.update({
          where: { id },
          data: {
            sourceLeaderApprovedAt: new Date(),
            sourceLeaderApprovedBy: auth.memberId ?? null,
          },
        });
        return finalizeTransferRequest(tx, id, auth.memberId);
      }

      return finalizeTransferRequest(tx, id, auth.memberId);
    });

    return serializeTransferRequest(updated);
  });
}
