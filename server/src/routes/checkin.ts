import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth, type AuthUser } from "../middleware/auth.js";
import { notifyMember } from "../services/notification.service.js";
import { checkAndAwardBadges, POINTS } from "../services/gamification.service.js";

const checkinSchema = z.object({
  method: z.enum(["qrcode", "manual"]).default("manual"),
});

const CHECKIN_POINTS = POINTS.CHECKIN;
/** Janela: check-in permitido de 3h antes até 3h depois do início do evento */
const WINDOW_MS = 3 * 60 * 60 * 1000;

export async function checkinRoutes(app: FastifyInstance) {
  app.post("/schedule-items/:id/checkin", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    const body = checkinSchema.parse(req.body ?? {});

    const item = await prisma.scheduleItem.findUnique({
      where: { id },
      include: { event: true, checkin: true },
    });
    if (!item) return reply.code(404).send({ error: "Item de escala não encontrado" });
    const isSelf = auth.memberId === item.memberId;
    const isAdminSameChurch = auth.role === "ADMIN" && item.event.churchId === auth.churchId;
    if (!isSelf && !isAdminSameChurch)
      return reply.code(403).send({ error: "Só o próprio voluntário pode fazer check-in" });
    if (item.checkin) return reply.code(409).send({ error: "Check-in já realizado" });
    if (item.status !== "CONFIRMED")
      return reply.code(409).send({ error: "Confirme a escala antes do check-in" });

    const now = Date.now();
    const start = item.event.startTime.getTime();
    if (Math.abs(now - start) > WINDOW_MS) {
      return reply.code(409).send({
        error: "Fora da janela de check-in (3h antes até 3h depois do culto)",
        code: "OUT_OF_WINDOW",
      });
    }

    const [checkin] = await prisma.$transaction([
      prisma.checkIn.create({
        data: { memberId: item.memberId, scheduleItemId: id, method: body.method },
      }),
      prisma.member.update({
        where: { id: item.memberId },
        data: { points: { increment: CHECKIN_POINTS } },
      }),
    ]);

    notifyMember(item.memberId, {
      type: "CHECKIN_DONE",
      title: "Check-in realizado ✅",
      body: `${item.event.title} — +${CHECKIN_POINTS} pontos!`,
      data: { checkinId: checkin.id },
    });

    const newBadges = await checkAndAwardBadges(item.memberId);
    return reply.code(201).send({ ...checkin, newBadges });
  });

  // Ranking simples (gamificação básica — completa na Fase 6)
  app.get("/gamification/ranking", { preHandler: [requireAuth] }, async (req) => {
    const auth = req.user as AuthUser;
    return prisma.member.findMany({
      where: { churchId: auth.churchId ?? undefined },
      select: { id: true, name: true, photoUrl: true, points: true },
      orderBy: { points: "desc" },
      take: 20,
    });
  });
}
