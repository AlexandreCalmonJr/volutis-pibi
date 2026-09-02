import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth, type AuthUser } from "../middleware/auth.js";
import { notifyMember } from "../services/notification.service.js";

const postSchema = z.object({
  content: z.string().max(2000).optional(),
  mediaType: z.enum(["IMAGE", "AUDIO", "LINK"]).optional(),
  mediaUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
}).superRefine((value, ctx) => {
  if (!value.content?.trim() && !value.mediaUrl && !value.linkUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe um texto ou anexe uma mídia/link" });
  }
});

const commentSchema = z.object({ content: z.string().min(1).max(1000) });

export async function feedRoutes(app: FastifyInstance) {
  app.get("/feed/posts", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const posts = await prisma.feedPost.findMany({
      where: { churchId: auth.churchId },
      include: {
        member: { select: { id: true, name: true, photoUrl: true, avatarKey: true } },
        comments: {
          include: { member: { select: { id: true, name: true, photoUrl: true, avatarKey: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return posts;
  });

  app.post("/feed/posts", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId || !auth.churchId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });
    const body = postSchema.parse(req.body ?? {});
    const member = await prisma.member.findUnique({ where: { id: auth.memberId } });
    if (!member || member.churchId !== auth.churchId) return reply.code(404).send({ error: "Membro não encontrado" });

    const post = await prisma.feedPost.create({
      data: {
        content: body.content?.trim() || null,
        mediaType: body.mediaType || (body.linkUrl ? "LINK" : body.mediaUrl ? "IMAGE" : null),
        mediaUrl: body.mediaUrl,
        linkUrl: body.linkUrl,
        memberId: auth.memberId,
        churchId: auth.churchId,
        authorName: member.name,
      },
      include: {
        member: { select: { id: true, name: true, photoUrl: true, avatarKey: true } },
        comments: true,
      },
    });

    // Disparar notificação para voluntários da igreja
    prisma.member.findMany({
      where: { churchId: auth.churchId, id: { not: auth.memberId } },
      select: { id: true },
      take: 150,
    }).then(async (recipients) => {
      const preview = body.content?.slice(0, 120) || "Nova foto ou material de estudo compartilhado no mural.";
      for (const r of recipients) {
        await notifyMember(r.id, {
          type: "FEED_POST",
          title: `📢 ${member.name} postou no Mural`,
          body: preview,
          data: { postId: post.id },
        }).catch(() => {});
      }
    }).catch(() => {});

    return reply.code(201).send(post);
  });

  app.post("/feed/posts/:id/comments", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!auth.memberId || !auth.churchId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });
    const body = commentSchema.parse(req.body ?? {});
    const [member, post] = await Promise.all([
      prisma.member.findUnique({ where: { id: auth.memberId } }),
      prisma.feedPost.findUnique({ where: { id }, include: { member: true } }),
    ]);
    if (!member || member.churchId !== auth.churchId) return reply.code(404).send({ error: "Membro não encontrado" });
    if (!post || post.churchId !== auth.churchId) return reply.code(404).send({ error: "Publicação não encontrada" });

    const comment = await prisma.feedComment.create({
      data: {
        postId: id,
        churchId: auth.churchId,
        memberId: auth.memberId,
        authorName: member.name,
        content: body.content.trim(),
      },
      include: {
        member: { select: { id: true, name: true, photoUrl: true, avatarKey: true } },
      },
    });

    // Notificar autor da publicação original
    if (post.memberId !== auth.memberId) {
      await notifyMember(post.memberId, {
        type: "FEED_COMMENT",
        title: `💬 ${member.name} comentou no seu post`,
        body: body.content.slice(0, 100),
        data: { postId: post.id },
      }).catch(() => {});
    }

    return reply.code(201).send(comment);
  });
}
