import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
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
