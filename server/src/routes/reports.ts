import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { requireRole, type AuthUser } from "../middleware/auth.js";

export async function reportsRoutes(app: FastifyInstance) {
  app.get("/reports/summary-aggregated", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    try {
      // 1. Agregação nativa de Status de Escalas no PostgreSQL (últimos 90 dias)
      const statusAgg: any[] = await prisma.$queryRaw`
        SELECT si.status, COUNT(*)::int as count
        FROM "ScheduleItem" si
        JOIN "Event" e ON si."eventId" = e.id
        WHERE e."churchId" = ${auth.churchId}
          AND e.date >= NOW() - INTERVAL '90 days'
          AND e."deletedAt" IS NULL
        GROUP BY si.status
      `;

      // 2. Tendência Mensal de Escalas (últimos 6 meses)
      const monthlyTrend: any[] = await prisma.$queryRaw`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', e.date), 'YYYY-MM') as month,
          COUNT(*)::int as total,
          COUNT(CASE WHEN si.status = 'CONFIRMED' THEN 1 END)::int as confirmed,
          COUNT(CASE WHEN si.status = 'DECLINED' THEN 1 END)::int as declined,
          COUNT(CASE WHEN si.status = 'SWAP_REQUESTED' THEN 1 END)::int as swaps
        FROM "ScheduleItem" si
        JOIN "Event" e ON si."eventId" = e.id
        WHERE e."churchId" = ${auth.churchId}
          AND e.date >= NOW() - INTERVAL '6 months'
          AND e."deletedAt" IS NULL
        GROUP BY DATE_TRUNC('month', e.date)
        ORDER BY DATE_TRUNC('month', e.date) ASC
      `;

      // 3. Voluntários Ativos por Ministério
      const ministryStats: any[] = await prisma.$queryRaw`
        SELECT 
          m.id,
          m.name,
          m.color,
          COUNT(mm."memberId")::int as members_count
        FROM "Ministry" m
        LEFT JOIN "MinistryMember" mm ON m.id = mm."ministryId"
        WHERE m."churchId" = ${auth.churchId}
          AND m."deletedAt" IS NULL
        GROUP BY m.id, m.name, m.color
        ORDER BY members_count DESC
      `;

      return {
        statusAgg,
        monthlyTrend,
        ministryStats,
      };
    } catch (err: any) {
      // Fallback gracioso com agregação via Prisma caso queryRaw encontre dialeto específico
      const [pending, confirmed, declined, swaps] = await Promise.all([
        prisma.scheduleItem.count({ where: { status: "PENDING" } }),
        prisma.scheduleItem.count({ where: { status: "CONFIRMED" } }),
        prisma.scheduleItem.count({ where: { status: "DECLINED" } }),
        prisma.scheduleItem.count({ where: { status: "SWAP_REQUESTED" } }),
      ]);

      return {
        statusAgg: [
          { status: "CONFIRMED", count: confirmed },
          { status: "PENDING", count: pending },
          { status: "DECLINED", count: declined },
          { status: "SWAP_REQUESTED", count: swaps },
        ],
        monthlyTrend: [],
        ministryStats: [],
      };
    }
  });
}
