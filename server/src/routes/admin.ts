import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fromJson, prisma, toJson } from "../lib/db.js";
import { requireRole, type AuthUser } from "../middleware/auth.js";

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
}
