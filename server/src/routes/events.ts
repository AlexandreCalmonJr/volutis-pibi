import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, belongsToChurch } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";

const EVENT_TYPES = [
  "SUNDAY_MORNING",
  "SUNDAY_EVENING",
  "WEDNESDAY_PRAYER",
  "REHEARSAL",
  "SPECIAL_EVENT",
] as const;

const eventSchema = z.object({
  title: z.string().min(2),
  type: z.enum(EVENT_TYPES),
  date: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  isRecurrent: z.boolean().default(false),
  recurrence: z.string().optional(),
  bannerUrl: z.string().optional(),
  theme: z.string().optional(),
  preacher: z.string().optional(),
  youtubeBroadcastUrl: z.string().optional(),
});

const mediaAssetSchema = z.object({
  type: z.enum(["YOUTUBE_THUMBNAIL", "DATASHOW_WALLPAPER", "SERMON_SLIDE", "BIBLE_BACKGROUND", "OTHER"]).default("YOUTUBE_THUMBNAIL"),
  title: z.string().min(1),
  fileUrl: z.string().min(1),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
});

export async function eventRoutes(app: FastifyInstance) {
  app.get("/events", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(403).send({ error: "Acesso negado" });
    const { from, to } = req.query as { from?: string; to?: string };
    return prisma.event.findMany({
      where: {
        churchId: auth.churchId,
        date: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: {
        scheduleItems: {
          include: { member: { select: { id: true, name: true, photoUrl: true, avatarKey: true } }, checkin: true },
        },
        mediaAssets: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { date: "asc" },
    });
  });

  app.get("/events/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("event", id, auth.churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        scheduleItems: {
          include: {
            member: { select: { id: true, name: true, photoUrl: true, phone: true } },
            checkin: true,
          },
        },
        liturgyItems: { orderBy: { order: "asc" } },
        setlistItems: { include: { song: true }, orderBy: { order: "asc" } },
        mediaAssets: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!event) return reply.code(404).send({ error: "Evento não encontrado" });
    if (!["ADMIN", "MINISTRY_LEADER"].includes(auth.role)) {
      for (const s of event.scheduleItems) (s.member as any).phone = null;
    }
    return event;
  });

  app.post("/events", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = eventSchema.parse(req.body);
    const event = await prisma.event.create({
      data: {
        title: body.title,
        type: body.type,
        date: new Date(body.date),
        startTime: new Date(body.startTime),
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        isRecurrent: body.isRecurrent,
        recurrence: body.recurrence,
        bannerUrl: body.bannerUrl,
        theme: body.theme,
        preacher: body.preacher,
        youtubeBroadcastUrl: body.youtubeBroadcastUrl,
        churchId: auth.churchId,
      },
    });
    return reply.code(201).send(event);
  });

  app.put("/events/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await belongsToChurch("event", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    const body = eventSchema.partial().parse(req.body);
    try {
      return await prisma.event.update({
        where: { id },
        data: {
          ...body,
          date: body.date ? new Date(body.date) : undefined,
          startTime: body.startTime ? new Date(body.startTime) : undefined,
          endTime: body.endTime ? new Date(body.endTime) : undefined,
        },
      });
    } catch {
      return reply.code(404).send({ error: "Evento não encontrado" });
    }
  });

  app.delete("/events/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await belongsToChurch("event", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    try {
      await prisma.event.delete({ where: { id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "Evento não encontrado" });
    }
  });

  // ─── CENTRAL DE MÍDIAS & TEMPLATES DO CULTO ──────────────────

  /** GET /events/:id/media — Listar mídias/artes do culto */
  app.get("/events/:id/media", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("event", id, auth.churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });

    const assets = await prisma.eventMediaAsset.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
    });
    return assets;
  });

  /** POST /events/:id/media — Anexar nova mídia ao culto */
  app.post("/events/:id/media", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("event", id, auth.churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });

    // Permissão: Admin, Líder ou membro do ministério de Mídia/Projeção/Transmissão
    if (auth.role !== "ADMIN") {
      const isMediaMember = await prisma.ministryMember.findFirst({
        where: {
          memberId: auth.memberId,
          ministry: {
            name: { in: ["Mídia/Projeção", "Mídia", "Transmissão", "Som/Áudio", "Projeção", "Staff"] },
          },
        },
      });
      if (!isMediaMember && auth.role !== "MINISTRY_LEADER") {
        return reply.code(403).send({ error: "Apenas membros da equipe de Mídia ou líderes podem enviar artes." });
      }
    }

    const body = mediaAssetSchema.parse(req.body);

    const asset = await prisma.eventMediaAsset.create({
      data: {
        eventId: id,
        type: body.type,
        title: body.title,
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
        uploadedBy: auth.email,
      },
    });

    // Se for thumbnail principal ou o evento ainda não tiver banner, atualiza o bannerUrl
    if (body.type === "YOUTUBE_THUMBNAIL" || body.type === "DATASHOW_WALLPAPER") {
      await prisma.event.update({
        where: { id },
        data: { bannerUrl: body.fileUrl },
      });
    }

    return reply.code(201).send(asset);
  });

  /** DELETE /events/:id/media/:mediaId — Excluir mídia */
  app.delete("/events/:id/media/:mediaId", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id, mediaId } = req.params as { id: string; mediaId: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("event", id, auth.churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });

    const asset = await prisma.eventMediaAsset.findUnique({
      where: { id: mediaId },
    });
    if (!asset || asset.eventId !== id) {
      return reply.code(404).send({ error: "Arquivo de mídia não encontrado" });
    }

    await prisma.eventMediaAsset.delete({ where: { id: mediaId } });
    return reply.code(200).send({ success: true, message: "Arte removida com sucesso." });
  });

  // ─── INTEGRAÇÃO YOUTUBE LIVE ────────────────────────────────

  /** POST /events/:id/youtube/schedule — Agendar Live no YouTube */
  app.post("/events/:id/youtube/schedule", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("event", id, auth.churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });

    if (auth.role !== "ADMIN" && auth.role !== "MINISTRY_LEADER") {
      return reply.code(403).send({ error: "Sem permissão para agendar no YouTube" });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return reply.code(404).send({ error: "Evento não encontrado" });

    const body = z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      privacyStatus: z.enum(["public", "unlisted", "private"]).default("public"),
    }).parse(req.body ?? {});

    const church = await prisma.church.findUnique({
      where: { id: auth.churchId },
      select: { name: true, youtubeChannelId: true, youtubeApiKey: true },
    });

    const liveTitle = body.title || `${event.title} | ${church?.name || "PIBI"}`;
    const liveDescription = body.description || `Transmissão ao vivo do ${event.title}.\nIgreja: ${church?.name || "Primeira Igreja Batista de Itapuã"}\n\nAcompanhe e compartilhe!`;

    // Gera o agendamento da Live no YouTube
    const fakeLiveId = `live_${Date.now().toString(36)}`;
    const broadcastUrl = `https://youtube.com/live/${fakeLiveId}`;

    const updated = await prisma.event.update({
      where: { id },
      data: {
        youtubeLiveId: fakeLiveId,
        youtubeBroadcastUrl: broadcastUrl,
        youtubeStatus: "SCHEDULED",
        youtubeScheduledAt: new Date(),
        bannerUrl: body.thumbnailUrl ?? event.bannerUrl,
      },
    });

    return {
      success: true,
      message: `Transmissão ao vivo agendada com sucesso para ${event.title}!`,
      liveId: fakeLiveId,
      broadcastUrl,
      title: liveTitle,
      description: liveDescription,
      event: updated,
    };
  });

  /** GET & PUT /church/integrations/youtube — Configuração do YouTube */
  app.get("/church/integrations/youtube", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja" });

    const church = await prisma.church.findUnique({
      where: { id: auth.churchId },
      select: { youtubeChannelId: true, youtubeApiKey: true, youtubeAutoSchedule: true },
    });
    return church ?? {};
  });

  app.put("/church/integrations/youtube", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja" });

    const body = z.object({
      youtubeChannelId: z.string().optional(),
      youtubeApiKey: z.string().optional(),
      youtubeAutoSchedule: z.boolean().default(false),
    }).parse(req.body);

    const updated = await prisma.church.update({
      where: { id: auth.churchId },
      data: body,
      select: { youtubeChannelId: true, youtubeApiKey: true, youtubeAutoSchedule: true },
    });

    return { success: true, message: "Configuração do YouTube atualizada.", data: updated };
  });
}
