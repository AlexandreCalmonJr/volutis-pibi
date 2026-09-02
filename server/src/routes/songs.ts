import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, belongsToChurch, itemEventChurch } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";
import { notifyMember } from "../services/notification.service.js";
import { appCache } from "../lib/cache.js";

const songSchema = z.object({
  title: z.string().min(1),
  artist: z.string().optional(),
  originalKey: z.string().optional(),
  bpm: z.number().int().positive().optional(),
  structure: z.string().optional(),
  youtubeUrl: z.string().url().optional(),
  spotifyUrl: z.string().url().optional(),
  cifraClubUrl: z.string().url().optional(),
  lyrics: z.string().optional(),
  chords: z.string().optional(),
});

const setlistAddSchema = z.object({
  songId: z.string(),
  songKey: z.string().optional(),
  notes: z.string().optional(),
});

const reorderSchema = z.object({
  itemIds: z.array(z.string()).min(1), // ordem desejada
});

export async function songRoutes(app: FastifyInstance) {
  // ── Catálogo ─────────────────────────────────────────────
  app.get("/songs", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(403).send({ error: "Acesso negado" });
    const { q } = req.query as { q?: string };

    const cacheKey = `songs:${auth.churchId}`;
    if (!q) {
      const cached = appCache.get<any[]>(cacheKey);
      if (cached) return cached;
    }

    const songs = await prisma.song.findMany({
      where: {
        churchId: auth.churchId,
        ...(q ? { OR: [{ title: { contains: q } }, { artist: { contains: q } }] } : {}),
      },
      orderBy: { title: "asc" },
    });

    if (!q) {
      appCache.set(cacheKey, songs, 120); // 120s TTL
    }

    return songs;
  });

  app.get("/songs/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await belongsToChurch("song", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Música não encontrada" });
    const song = await prisma.song.findUnique({ where: { id } });
    if (!song) return reply.code(404).send({ error: "Música não encontrada" });
    return song;
  });

  app.post("/songs", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = songSchema.parse(req.body);
    const song = await prisma.song.create({ data: { ...body, churchId: auth.churchId } });
    appCache.invalidate(`songs:${auth.churchId}`);
    return reply.code(201).send(song);
  });

  app.put("/songs/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("song", id, auth.churchId)))
      return reply.code(404).send({ error: "Música não encontrada" });
    const body = songSchema.partial().parse(req.body);
    try {
      const updated = await prisma.song.update({ where: { id }, data: body });
      appCache.invalidate(`songs:${auth.churchId}`);
      return updated;
    } catch {
      return reply.code(404).send({ error: "Música não encontrada" });
    }
  });

  app.delete("/songs/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("song", id, auth.churchId)))
      return reply.code(404).send({ error: "Música não encontrada" });
    try {
      await prisma.song.delete({ where: { id } });
      appCache.invalidate(`songs:${auth.churchId}`);
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "Música não encontrada" });
    }
  });

  // ── Setlist por evento ───────────────────────────────────
  app.get("/events/:eventId/setlist", { preHandler: [requireAuth] }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    if (!(await belongsToChurch("event", eventId, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    return prisma.setlistItem.findMany({
      where: { eventId },
      include: { song: true },
      orderBy: { order: "asc" },
    });
  });

  app.post(
    "/events/:eventId/setlist",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const auth = req.user as AuthUser;
      const body = setlistAddSchema.parse(req.body);
      if (!(await belongsToChurch("event", eventId, auth.churchId)))
        return reply.code(404).send({ error: "Evento não encontrado" });
      if (!(await belongsToChurch("song", body.songId, auth.churchId)))
        return reply.code(404).send({ error: "Música não encontrada" });
      const song = await prisma.song.findUnique({ where: { id: body.songId } });
      if (!song) return reply.code(404).send({ error: "Música não encontrada" });

      const last = await prisma.setlistItem.findFirst({
        where: { eventId },
        orderBy: { order: "desc" },
      });
      const item = await prisma.setlistItem.create({
        data: {
          eventId,
          songId: body.songId,
          order: (last?.order ?? 0) + 1,
          songKey: body.songKey ?? song.originalKey,
          notes: body.notes,
        },
        include: { song: true },
      });

      // Notifica os voluntários escalados no evento
      const scheduledVolunteers = await prisma.scheduleItem.findMany({
        where: { eventId, status: { not: "DECLINED" } },
        include: { event: true },
      });
      for (const vol of scheduledVolunteers) {
        if (vol.memberId !== auth.memberId) {
          await notifyMember(vol.memberId, {
            type: "SETLIST_UPDATED",
            title: "Repertório de Louvor Atualizado 🎵",
            body: `"${song.title}" foi adicionada ao repertório do culto "${vol.event.title}". Confira na aba Louvor!`,
            data: { eventId, songId: song.id },
          }).catch(() => {});
        }
      }

      return reply.code(201).send(item);
    }
  );

  // ── Notificar voluntários com o repertório completo ──────────────
  app.post(
    "/events/:eventId/setlist/notify",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const auth = req.user as AuthUser;
      if (!(await belongsToChurch("event", eventId, auth.churchId)))
        return reply.code(404).send({ error: "Evento não encontrado" });

      const [event, setlist, scheduledVolunteers] = await Promise.all([
        prisma.event.findUnique({ where: { id: eventId } }),
        prisma.setlistItem.findMany({ where: { eventId }, include: { song: true }, orderBy: { order: "asc" } }),
        prisma.scheduleItem.findMany({ where: { eventId, status: { not: "DECLINED" } } }),
      ]);
      if (!event) return reply.code(404).send({ error: "Evento não encontrado" });
      if (setlist.length === 0) return reply.code(400).send({ error: "O repertório está vazio" });

      const songListText = setlist.map((s, idx) => `${idx + 1}. ${s.song.title} (${s.songKey || s.song.originalKey || "Tom livre"})`).join("\n");
      let notifiedCount = 0;

      for (const vol of scheduledVolunteers) {
        await notifyMember(vol.memberId, {
          type: "SETLIST_UPDATED",
          title: `Repertório do Culto: ${event.title} 🎵`,
          body: `Músicas definidas para o culto (${setlist.length} músicas):\n${songListText}`,
          data: { eventId },
        }).catch(() => {});
        notifiedCount++;
      }

      return reply.send({ success: true, notifiedCount, songsCount: setlist.length });
    }
  );

  // ── Reordenar Setlist ────────────────────────────────────
  app.put(
    "/events/:eventId/setlist/reorder",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const auth = req.user as AuthUser;
      if (!(await belongsToChurch("event", eventId, auth.churchId)))
        return reply.code(404).send({ error: "Evento não encontrado" });
      const { itemIds } = z.object({ itemIds: z.array(z.string()).min(1) }).parse(req.body);
      const valid = await prisma.setlistItem.findMany({
        where: { id: { in: itemIds }, eventId },
        select: { id: true },
      });
      if (valid.length !== itemIds.length)
        return reply.code(400).send({ error: "Itens não pertencem a este evento" });
      await prisma.$transaction(
        itemIds.map((id, idx) =>
          prisma.setlistItem.update({ where: { id }, data: { order: idx + 1 } })
        )
      );
      return prisma.setlistItem.findMany({
        where: { eventId },
        include: { song: true },
        orderBy: { order: "asc" },
      });
    }
  );

  app.put(
    "/setlist-items/:id",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const church = await itemEventChurch("setlistItem", id);
      if (!church || church !== (req.user as AuthUser).churchId)
        return reply.code(404).send({ error: "Item de setlist não encontrado" });
      const body = z.object({ songKey: z.string().optional(), notes: z.string().optional() }).parse(req.body);
      try {
        return await prisma.setlistItem.update({ where: { id }, data: body, include: { song: true } });
      } catch {
        return reply.code(404).send({ error: "Item de setlist não encontrado" });
      }
    }
  );

  app.delete(
    "/setlist-items/:id",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const church = await itemEventChurch("setlistItem", id);
      if (!church || church !== (req.user as AuthUser).churchId)
        return reply.code(404).send({ error: "Item de setlist não encontrado" });
      try {
        await prisma.setlistItem.delete({ where: { id } });
        return reply.code(204).send();
      } catch {
        return reply.code(404).send({ error: "Item de setlist não encontrado" });
      }
    }
  );
}
