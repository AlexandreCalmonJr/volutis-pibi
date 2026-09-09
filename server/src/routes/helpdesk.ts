import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";

const updateDelegatesSchema = z.object({
  delegates: z.array(
    z.object({
      memberId: z.string(),
      helpdeskRole: z.string().min(2, "Cargo de suporte deve ter ao menos 2 caracteres").max(100),
    })
  ),
});

export async function helpdeskRoutes(app: FastifyInstance) {
  /**
   * GET /helpdesk/contacts — Retorna a lista de responsáveis delegados da igreja
   * para exibição no diretório de suporte da Central de Ajuda.
   */
  app.get("/helpdesk/contacts", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const contacts = await prisma.member.findMany({
      where: {
        churchId: auth.churchId,
        isHelpdesk: true,
        approvalStatus: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        photoUrl: true,
        bannerUrl: true,
        avatarKey: true,
        helpdeskRole: true,
        ministryMembers: {
          include: { ministry: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return contacts;
  });

  /**
   * PUT /helpdesk/delegates — Delegar múltiplos responsáveis de suporte (Apenas ADMIN)
   */
  app.put("/helpdesk/delegates", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const body = updateDelegatesSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      // 1. Remove delegação anterior de toda a igreja
      await tx.member.updateMany({
        where: { churchId: auth.churchId, isHelpdesk: true },
        data: { isHelpdesk: false, helpdeskRole: null },
      });

      // 2. Aplica novas delegações
      for (const item of body.delegates) {
        await tx.member.update({
          where: { id: item.memberId },
          data: {
            isHelpdesk: true,
            helpdeskRole: item.helpdeskRole.trim(),
          },
        });
      }
    });

    const updatedContacts = await prisma.member.findMany({
      where: { churchId: auth.churchId, isHelpdesk: true },
      select: {
        id: true,
        name: true,
        phone: true,
        photoUrl: true,
        bannerUrl: true,
        avatarKey: true,
        helpdeskRole: true,
      },
    });

    return {
      success: true,
      message: `${body.delegates.length} responsável(is) de suporte delegado(s) com sucesso!`,
      contacts: updatedContacts,
    };
  });
}
