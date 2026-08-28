import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { requireRole } from "../middleware/auth.js";
import type { AuthUser } from "../middleware/auth.js";

export async function dashboardRoutes(app: FastifyInstance) {
  /** GET /dashboard/stats — dados reais para o Dashboard */
  app.get("/dashboard/stats", { preHandler: [requireRole("MEMBER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [totalVolunteers, pendingApprovals, eventsThisMonth] = await Promise.all([
      prisma.member.count({
        where: {
          churchId: auth.churchId,
          user: { role: { in: ["VOLUNTEER", "MINISTRY_LEADER"] } },
        },
      }),
      prisma.application.count({
        where: { churchId: auth.churchId, status: "PENDING" },
      }),
      prisma.event.findMany({
        where: {
          churchId: auth.churchId,
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        include: { _count: { select: { scheduleItems: true } } },
        orderBy: { date: "asc" },
      }),
    ]);

    return {
      totalVolunteers,
      pendingApprovals,
      eventsThisMonth: eventsThisMonth.length,
      events: eventsThisMonth.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date.toISOString(),
        type: e.type,
        scheduleCount: e._count.scheduleItems,
      })),
    };
  });
}
