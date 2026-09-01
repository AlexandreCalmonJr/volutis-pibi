import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fromJson, prisma, toJson } from "../lib/db.js";
import { requireRole, type AuthUser } from "../middleware/auth.js";
import { countPushSubscriptions, isPushConfigured, sendPushToMember } from "../services/push.service.js";
import { notifyMember } from "../services/notification.service.js";
import { getAuditLogs, logAudit } from "../services/audit.service.js";

const SEED_VOLUNTEER_EMAILS = ["joao@pibi.org.br", "maria@pibi.org.br", "pedro@pibi.org.br"];
const SEED_EVENT_TITLES = ["Culto Domingo Manhã", "Culto Domingo Noite", "Culto de Oração"];
const SEED_SONG_TITLES = ["Grande É o Senhor", "Oceanos (Onde Meus Pés Podem Falhar)", "Bondade de Deus"];
const SEED_MINISTRY_NAMES = ["Louvor", "Mídia/Projeção", "Som/Áudio", "Transmissão", "Recepção", "Infantil/Kids", "Diaconia", "Staff"];

const cleanupSchema = z.object({
  removeVolunteers: z.boolean().default(true),
  removeEvents: z.boolean().default(true),
  removeSongs: z.boolean().default(true),
  removeMinistries: z.boolean().default(false),
});

const directUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(["ADMIN", "MINISTRY_LEADER", "VOLUNTEER", "MEMBER"]).default("VOLUNTEER"),
  phone: z.string().optional(),
  photoUrl: z.string().url().optional(),
  avatarKey: z.enum(["violet", "blue", "emerald", "amber", "rose", "slate"]).optional(),
  instruments: z.array(z.string()).default([]),
  birthDate: z.string().datetime().optional(),
  approvalStatus: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).default("ACTIVE"),
  ministryAssignments: z.array(z.object({
    ministryId: z.string(),
    isLeader: z.boolean().default(false),
    roles: z.array(z.string()).default([]),
  })).default([]),
});

const directUserUpdateSchema = directUserSchema.partial().extend({
  password: z.string().min(6).optional(),
});

const pushTestSchema = z.object({
  memberId: z.string().optional(),
});

function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return undefined;
  if (digits.length === 10) return `55${digits.slice(0, 2)}9${digits.slice(2)}`;
  if (digits.length === 11) return `55${digits}`;
  if (digits.length === 12 && digits.startsWith("55")) return `55${digits.slice(2, 4)}9${digits.slice(4)}`;
  if (digits.length === 13 && digits.startsWith("55")) return digits;
  return digits;
}

function serializeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    member: user.member
      ? {
          ...user.member,
          instruments: fromJson(user.member.instruments),
          ministryMembers: (user.member.ministryMembers ?? []).map((link: any) => ({
            ...link,
            roles: fromJson(link.roles),
          })),
        }
      : null,
  };
}

async function getSeedPreview(churchId: string) {
  const [volunteers, events, songs, ministries] = await Promise.all([
    prisma.user.findMany({
      where: {
        email: { in: SEED_VOLUNTEER_EMAILS },
        member: { churchId },
      },
      include: { member: true },
      orderBy: { email: "asc" },
    }),
    prisma.event.findMany({
      where: { churchId, title: { in: SEED_EVENT_TITLES } },
      orderBy: [{ date: "asc" }, { title: "asc" }],
    }),
    prisma.song.findMany({
      where: { churchId, title: { in: SEED_SONG_TITLES } },
      orderBy: { title: "asc" },
    }),
    prisma.ministry.findMany({
      where: { churchId, name: { in: SEED_MINISTRY_NAMES } },
      include: {
        _count: {
          select: {
            members: true,
            roles: true,
            applicationPreferences: true,
            invites: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    counts: {
      volunteers: volunteers.length,
      events: events.length,
      songs: songs.length,
      ministries: ministries.length,
      removableMinistries: ministries.filter((item) => item._count.members === 0).length,
    },
    volunteers: volunteers.map((user) => ({
      id: user.id,
      email: user.email,
      memberId: user.member?.id ?? null,
      memberName: user.member?.name ?? null,
    })),
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      isRecurrent: event.isRecurrent,
    })),
    songs: songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
    })),
    ministries: ministries.map((ministry) => ({
      id: ministry.id,
      name: ministry.name,
      membersCount: ministry._count.members,
      rolesCount: ministry._count.roles,
      canDelete: ministry._count.members === 0,
    })),
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/users", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const churchId = auth.churchId;

    const users = await prisma.user.findMany({
      where: { member: { churchId } },
      include: {
        member: {
          include: {
            ministryMembers: { include: { ministry: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return users.map(serializeUser);
  });

  app.post("/admin/users", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const churchId = auth.churchId;
    const body = directUserSchema.parse(req.body);

    const email = body.email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return reply.code(409).send({ error: "Já existe um usuário com este e-mail" });

    for (const assignment of body.ministryAssignments) {
      const ministry = await prisma.ministry.findUnique({ where: { id: assignment.ministryId }, select: { churchId: true } });
      if (!ministry || ministry.churchId !== churchId) {
        return reply.code(404).send({ error: "Ministério informado não pertence à igreja" });
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const normalizedPhone = normalizePhone(body.phone);
      const createdUser = await tx.user.create({
        data: {
          email,
          phone: normalizedPhone,
          passwordHash: await bcrypt.hash(body.password, 10),
          role: body.role,
          firstLogin: false,
        },
      });

      const createdMember = await tx.member.create({
        data: {
          userId: createdUser.id,
          name: body.name,
          phone: normalizedPhone,
          photoUrl: body.photoUrl,
          avatarKey: body.avatarKey,
          instruments: toJson(body.instruments),
          birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
          approvalStatus: body.approvalStatus,
          approvedAt: body.approvalStatus === "ACTIVE" ? new Date() : undefined,
          approvedBy: auth.memberId,
          churchId,
        },
      });

      if (body.ministryAssignments.length > 0) {
        for (const assignment of body.ministryAssignments) {
          await tx.ministryMember.create({
            data: {
              memberId: createdMember.id,
              ministryId: assignment.ministryId,
              isLeader: assignment.isLeader,
              roles: toJson(assignment.roles),
            },
          });
        }
      }

      return tx.user.findUnique({
        where: { id: createdUser.id },
        include: {
          member: {
            include: { ministryMembers: { include: { ministry: true } } },
          },
        },
      });
    });

    return reply.code(201).send(serializeUser(user));
  });

  app.put("/admin/users/:id", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const churchId = auth.churchId;
    const body = directUserUpdateSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { member: { include: { ministryMembers: true } } },
    });
    if (!existing || existing.member?.churchId !== churchId) {
      return reply.code(404).send({ error: "Usuário não encontrado" });
    }

    if (body.email && body.email.trim().toLowerCase() !== existing.email) {
      const collision = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
      if (collision && collision.id !== id) return reply.code(409).send({ error: "Já existe um usuário com este e-mail" });
    }

    for (const assignment of body.ministryAssignments ?? []) {
      const ministry = await prisma.ministry.findUnique({ where: { id: assignment.ministryId }, select: { churchId: true } });
      if (!ministry || ministry.churchId !== churchId) {
        return reply.code(404).send({ error: "Ministério informado não pertence à igreja" });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          email: body.email ? body.email.trim().toLowerCase() : undefined,
          phone: body.phone !== undefined ? normalizePhone(body.phone) : undefined,
          role: body.role,
          passwordHash: body.password ? await bcrypt.hash(body.password, 10) : undefined,
          lastPasswordReset: body.password ? new Date() : undefined,
        },
      });

      if (existing.member) {
        await tx.member.update({
          where: { id: existing.member.id },
          data: {
            name: body.name,
            phone: body.phone !== undefined ? normalizePhone(body.phone) : undefined,
            photoUrl: body.photoUrl,
            avatarKey: body.avatarKey,
            instruments: body.instruments ? toJson(body.instruments) : undefined,
            birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
            approvalStatus: body.approvalStatus,
            approvedAt: body.approvalStatus === "ACTIVE" ? new Date() : body.approvalStatus === "INACTIVE" ? null : undefined,
            approvedBy: body.approvalStatus === "ACTIVE" ? auth.memberId : body.approvalStatus === "INACTIVE" ? null : undefined,
          },
        });

        if (body.ministryAssignments) {
          await tx.ministryMember.deleteMany({ where: { memberId: existing.member.id } });
          for (const assignment of body.ministryAssignments) {
            await tx.ministryMember.create({
              data: {
                memberId: existing.member.id,
                ministryId: assignment.ministryId,
                isLeader: assignment.isLeader,
                roles: toJson(assignment.roles),
              },
            });
          }
        }
      }

      return tx.user.findUnique({
        where: { id },
        include: { member: { include: { ministryMembers: { include: { ministry: true } } } } },
      });
    });

    return serializeUser(updated);
  });

  app.delete("/admin/users/:id", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    const churchId = auth.churchId;
    if (id === auth.sub) return reply.code(409).send({ error: "Você não pode excluir o próprio usuário por esta tela" });

    const user = await prisma.user.findUnique({ where: { id }, include: { member: true } });
    if (!churchId || !user || user.member?.churchId !== churchId) return reply.code(404).send({ error: "Usuário não encontrado" });

    await prisma.$transaction(async (tx) => {
      if (user.member) {
        await tx.member.delete({ where: { id: user.member.id } });
      }
      await tx.user.delete({ where: { id } });
    });
    return reply.code(204).send();
  });

  app.post("/admin/push-test", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    const body = pushTestSchema.parse(req.body ?? {});
    const targetMemberId = body.memberId ?? auth.memberId;

    if (!targetMemberId) {
      return reply.code(400).send({ error: "Nenhum membro alvo disponível para o teste" });
    }

    const member = await prisma.member.findUnique({ where: { id: targetMemberId } });
    if (!member || member.churchId !== auth.churchId) {
      return reply.code(404).send({ error: "Membro não encontrado para o teste" });
    }

    if (!isPushConfigured()) {
      return reply.code(409).send({ error: "Push notifications não configuradas no servidor. Defina as chaves VAPID primeiro." });
    }

    const subscriptions = await countPushSubscriptions(targetMemberId);
    if (subscriptions === 0) {
      return reply.code(409).send({ error: "Nenhum dispositivo registrado para este usuário. Abra o app no celular e ative as notificações primeiro." });
    }

    const created = await prisma.userNotification.create({
      data: {
        memberId: targetMemberId,
        type: "ANNOUNCEMENT",
        title: "Teste de notificação no celular 📲",
        body: `Olá, ${member.name}! Este é um teste manual do administrador para validar o push do aplicativo.`,
        data: JSON.stringify({ source: "admin-push-test", targetMemberId }),
      },
    });

    const result = await sendPushToMember(targetMemberId, {
      id: created.id,
      type: "ANNOUNCEMENT",
      title: created.title,
      body: created.body,
      data: { source: "admin-push-test", targetMemberId },
      at: created.createdAt.toISOString(),
      readAt: null,
      whatsappLink: null,
    });

    return {
      ok: result.sent > 0,
      sent: result.sent,
      subscriptions,
      message: subscriptions === 0
        ? `⚠️ Atenção: ${member.name} NÃO possui nenhum celular/dispositivo cadastrado para notificações push.`
        : result.sent > 0
        ? `✅ Notificação entregue com sucesso para ${result.sent} de ${subscriptions} dispositivo(s) cadastrado(s) de ${member.name}.`
        : `⚠️ Falha ao entregar para os ${subscriptions} dispositivo(s) de ${member.name}. O token pode ter expirado.`,
    };
  });

  // Lista membros com status de push (para selecionar destinatários)
  app.get("/admin/members-push", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const members = await prisma.member.findMany({
      where: { churchId: auth.churchId, approvalStatus: "ACTIVE" },
      include: { user: true },
      orderBy: { name: "asc" },
    });

    const result = await Promise.all(
      members.map(async (m) => {
        const pushDevices = await countPushSubscriptions(m.id);
        return {
          id: m.id,
          name: m.name,
          email: m.user?.email ?? null,
          pushDevices,
        };
      })
    );

    return {
      pushConfigured: isPushConfigured(),
      members: result,
    };
  });

  // Envia notificação para TODOS os membros da igreja
  const broadcastSchema = z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(1000),
  });

  app.post("/admin/broadcast", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const { title, body } = broadcastSchema.parse(req.body);

    const members = await prisma.member.findMany({
      where: { churchId: auth.churchId, approvalStatus: "ACTIVE" },
      select: { id: true, name: true },
    });

    if (!members.length) {
      return reply.code(409).send({ error: "Nenhum membro ativo na igreja" });
    }

    let sent = 0;
    let failed = 0;
    for (const member of members) {
      try {
        await notifyMember(member.id, {
          type: "ANNOUNCEMENT",
          title,
          body,
          data: { source: "admin-broadcast" },
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return {
      ok: sent > 0,
      sent,
      failed,
      total: members.length,
      message: `Notificação enviada para ${sent} de ${members.length} membro(s).${failed > 0 ? ` ${failed} falha(s).` : ""}`,
    };
  });

  app.get("/admin/seed-data/preview", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    return getSeedPreview(auth.churchId);
  });

  app.post("/admin/seed-data/cleanup", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = cleanupSchema.parse(req.body ?? {});

    const result = await prisma.$transaction(async (tx) => {
      const summary = {
        removedVolunteers: 0,
        removedEvents: 0,
        removedSongs: 0,
        removedMinistries: 0,
        skippedMinistries: 0,
      };

      if (body.removeVolunteers) {
        const users = await tx.user.findMany({
          where: {
            email: { in: SEED_VOLUNTEER_EMAILS },
            member: { churchId: auth.churchId },
          },
          include: { member: true },
        });
        const memberIds = users.map((item) => item.member?.id).filter(Boolean) as string[];
        if (memberIds.length > 0) {
          await tx.member.deleteMany({ where: { id: { in: memberIds } } });
        }
        if (users.length > 0) {
          await tx.user.deleteMany({ where: { id: { in: users.map((item) => item.id) } } });
        }
        summary.removedVolunteers = users.length;
      }

      if (body.removeEvents) {
        const deleted = await tx.event.deleteMany({
          where: { churchId: auth.churchId, title: { in: SEED_EVENT_TITLES } },
        });
        summary.removedEvents = deleted.count;
      }

      if (body.removeSongs) {
        const deleted = await tx.song.deleteMany({
          where: { churchId: auth.churchId, title: { in: SEED_SONG_TITLES } },
        });
        summary.removedSongs = deleted.count;
      }

      if (body.removeMinistries) {
        const ministries = await tx.ministry.findMany({
          where: { churchId: auth.churchId, name: { in: SEED_MINISTRY_NAMES } },
          include: { _count: { select: { members: true } } },
        });
        const removableIds = ministries.filter((item) => item._count.members === 0).map((item) => item.id);
        const deleted = removableIds.length > 0
          ? await tx.ministry.deleteMany({ where: { id: { in: removableIds } } })
          : { count: 0 };
        summary.removedMinistries = deleted.count;
        summary.skippedMinistries = ministries.length - removableIds.length;
      }

      return summary;
    });

    const preview = await getSeedPreview(auth.churchId);
    return {
      message: "Limpeza de seed executada.",
      ...result,
      preview,
    };
  });

  // ── Limpeza Completa para Produção ──────────────────────────────
  app.post("/admin/production-reset", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const body = z.object({
      clearSchedules: z.boolean().default(true),
      clearEvents: z.boolean().default(false),
      clearSongs: z.boolean().default(false),
      clearApplications: z.boolean().default(true),
      clearChat: z.boolean().default(true),
      clearMembers: z.boolean().default(false),
    }).parse(req.body ?? {});

    const churchId = auth.churchId;

    const result = await prisma.$transaction(async (tx) => {
      const summary: Record<string, number> = {};

      if (body.clearChat) {
        const deleted = await tx.chatMessage.deleteMany({
          where: { event: { churchId } },
        });
        summary.chatMessages = deleted.count;
      }

      if (body.clearSchedules) {
        await tx.swapRequest.deleteMany({
          where: { scheduleItem: { event: { churchId } } },
        });
        await tx.checkIn.deleteMany({
          where: { scheduleItem: { event: { churchId } } },
        });
        const deleted = await tx.scheduleItem.deleteMany({
          where: { event: { churchId } },
        });
        summary.schedules = deleted.count;
      }

      if (body.clearApplications) {
        const deleted = await tx.application.deleteMany({
          where: { churchId },
        });
        summary.applications = deleted.count;
      }

      if (body.clearEvents) {
        const deleted = await tx.event.deleteMany({
          where: { churchId },
        });
        summary.events = deleted.count;
      }

      if (body.clearSongs) {
        const deleted = await tx.song.deleteMany({
          where: { churchId },
        });
        summary.songs = deleted.count;
      }

      if (body.clearMembers) {
        // Exclui membros que NÃO sejam o administrador logado
        const nonAdminUsers = await tx.user.findMany({
          where: {
            id: { not: auth.sub },
            member: { churchId },
            role: { not: "ADMIN" },
          },
          select: { id: true, member: { select: { id: true } } },
        });
        const memberIds = nonAdminUsers.map((u) => u.member?.id).filter(Boolean) as string[];
        const userIds = nonAdminUsers.map((u) => u.id);

        if (memberIds.length > 0) {
          await tx.member.deleteMany({ where: { id: { in: memberIds } } });
        }
        if (userIds.length > 0) {
          await tx.user.deleteMany({ where: { id: { in: userIds } } });
        }
        summary.members = memberIds.length;
      }

      return summary;
    });

    return {
      success: true,
      message: "Banco de dados limpo para produção com sucesso.",
      summary: result,
    };
  });

  // ── Histórico de Auditoria (Audit Logs) ──────────────────────
  app.get("/admin/audit-logs", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const logs = await getAuditLogs(auth.churchId, 100);
    return reply.send({ logs });
  });

  // ── Backup Completo da Igreja (JSON) ────────────────────────
  app.get("/admin/export/backup.json", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const churchId = auth.churchId;

    const [church, members, ministries, events, songs, invites, applications] = await Promise.all([
      prisma.church.findUnique({ where: { id: churchId } }),
      prisma.member.findMany({
        where: { churchId },
        include: { ministryMembers: true, badges: true },
      }),
      prisma.ministry.findMany({
        where: { churchId },
        include: { roles: true },
      }),
      prisma.event.findMany({
        where: { churchId },
        include: { scheduleItems: true, liturgyItems: true, setlistItems: true },
      }),
      prisma.song.findMany({ where: { churchId } }),
      prisma.invite.findMany({ where: { churchId } }),
      prisma.application.findMany({ where: { churchId } }),
    ]);

    await logAudit({
      action: "BACKUP_EXPORTED",
      category: "ADMIN",
      actorId: auth.memberId,
      actorName: auth.email || "Admin",
      actorRole: auth.role,
      churchId,
      details: {
        membersCount: members.length,
        eventsCount: events.length,
        songsCount: songs.length,
      },
    });

    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      church,
      members,
      ministries,
      events,
      songs,
      invites,
      applications,
    };

    const fileName = `backup-volutis-${church?.slug || "pibi"}-${new Date().toISOString().split("T")[0]}.json`;
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
    return reply.send(backupData);
  });
}
