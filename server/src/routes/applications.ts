import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma, fromJson, belongsToChurch } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";
import { rateLimitHit } from "../lib/ratelimit.js";
import { sendWhatsAppMessage, sendApplicationConfirmation, sendApprovalNotification, sendRejectionNotification } from "../services/whatsapp.service.js";
import { notifyMember } from "../services/notification.service.js";

const INVITE_DAYS = 7;

function getAppUrl(req: any): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  return host ? `${proto}://${host}` : "https://volutis-pibi.vercel.app";
}

function newCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

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

/** Formulário público — sem autenticação */
const publicApplicationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido").optional(),
  phone: z.string().optional(),
  photoUrl: z.string().url("URL inválida").optional(),
  avatarKey: z.enum(["violet", "blue", "emerald", "amber", "rose", "slate"]).optional(),
  instruments: z.array(z.string()).default([]),
  availability: z.record(z.array(z.string())).optional(),
  ministryIds: z.array(z.string()).min(1, "Selecione pelo menos um ministério"),
});

/** Formulário admin — com autenticação */
const adminApplicationSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  photoUrl: z.string().url().optional(),
  avatarKey: z.enum(["violet", "blue", "emerald", "amber", "rose", "slate"]).optional(),
  instruments: z.array(z.string()).default([]),
  availability: z.record(z.array(z.string())).optional(),
  notes: z.string().optional(),
  ministryIds: z.array(z.string()).min(1),
});

const reviewSchema = z.object({
  notes: z.string().optional(),
  role: z.enum(["VOLUNTEER", "MEMBER"]).default("VOLUNTEER"),
  ministryAssignments: z.array(z.object({
    ministryId: z.string(),
    roles: z.array(z.string()).default([]),
    isLeader: z.boolean().default(false),
  })).optional(),
});

const noteSchema = z.object({
  notes: z.string(),
});

export async function applicationRoutes(app: FastifyInstance) {
  // ─── ROTAS PÚBLICAS (sem autenticação) ──────────────────────────

  /** GET /applications/church/:slug — dados da igreja para o formulário público */
  app.get("/applications/church/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const church = await prisma.church.findUnique({
      where: { slug },
      include: {
        ministries: {
          include: { roles: true },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!church) return reply.code(404).send({ error: "Igreja não encontrada" });
    return {
      id: church.id,
      name: church.name,
      slug: church.slug,
      ministries: church.ministries.map((m) => ({
        id: m.id,
        name: m.name,
        icon: m.icon,
        color: m.color,
        roles: m.roles.map((r) => ({ id: r.id, name: r.name })),
      })),
    };
  });

  /** POST /applications — formulário público de cadastro */
  app.post("/applications", async (req, reply) => {
    // Rate limit: 5 submissões por IP a cada 15 min
    const rl = rateLimitHit(`app:${req.ip}`, 5, 15 * 60_000);
    if (!rl.allowed) {
      return reply
        .code(429)
        .header("Retry-After", String(rl.retryAfterSec))
        .send({ error: "Muitas tentativas. Tente novamente em alguns minutos." });
    }

    const body = publicApplicationSchema.parse(req.body);
    const normalizedPhone = normalizePhone(body.phone);

    // Precisa do slug da igreja via query param ou header
    const churchSlug = (req.query as any)?.church || req.headers["x-church-slug"];
    if (!churchSlug) {
      return reply.code(400).send({ error: "Informe a igreja (query ?church= ou header x-church-slug)" });
    }

    const church = await prisma.church.findUnique({ where: { slug: churchSlug } });
    if (!church) return reply.code(404).send({ error: "Igreja não encontrada" });

    // Verificar se já existe cadastro com mesmo email ou telefone
    if (body.email) {
      const existing = await prisma.application.findFirst({
        where: { churchId: church.id, email: body.email, status: { not: "REJECTED" } },
      });
      if (existing) {
        return reply.code(409).send({ error: "Já existe um cadastro ativo com este e-mail" });
      }
    }
    if (body.phone) {
      const existing = await prisma.application.findFirst({
        where: { churchId: church.id, phone: normalizedPhone, status: { not: "REJECTED" } },
      });
      if (existing) {
        return reply.code(409).send({ error: "Já existe um cadastro ativo com este telefone" });
      }
    }

    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          name: body.name,
          email: body.email,
          phone: normalizedPhone,
          photoUrl: body.photoUrl,
          avatarKey: body.avatarKey,
          instruments: JSON.stringify(body.instruments),
          availability: body.availability ? JSON.stringify(body.availability) : undefined,
          source: "PUBLIC",
          churchId: church.id,
        },
      });

      // Vincular ministérios de interesse
      for (const ministryId of body.ministryIds) {
        await tx.applicationPreference.create({
          data: { applicationId: app.id, ministryId },
        });
      }

      return app;
    });

    // Enviar confirmação por WhatsApp
    if (application.phone) {
      await sendApplicationConfirmation({
        name: application.name,
        phone: application.phone,
        churchName: church.name,
      });
    }

    return reply.code(201).send({
      id: application.id,
      status: application.status,
      message: "Cadastro realizado com sucesso! Aguardando aprovação do líder.",
    });
  });

  // ─── ROTAS ADMIN (autenticadas) ─────────────────────────────────

  /** GET /applications — listar candidatos (admin) */
  app.get("/applications", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const { status, search } = req.query as { status?: string; search?: string };

    const where: any = { churchId: auth.churchId };
    if (status && status !== "ALL") where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        preferences: { include: { ministry: true } },
        member: true,
      },
      orderBy: { appliedAt: "desc" },
      take: 100,
    });

    return applications.map((a) => ({
      ...a,
      instruments: fromJson(a.instruments),
      availability: a.availability ? JSON.parse(a.availability) : null,
      preferences: a.preferences.map((p) => ({
        id: p.id,
        ministry: { id: p.ministry.id, name: p.ministry.name, icon: p.ministry.icon, color: p.ministry.color },
      })),
    }));
  });

  /** GET /applications/stats — estatísticas para o dashboard */
  app.get("/applications/stats", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const [pending, approved, rejected, total] = await Promise.all([
      prisma.application.count({ where: { churchId: auth.churchId, status: "PENDING" } }),
      prisma.application.count({ where: { churchId: auth.churchId, status: "APPROVED" } }),
      prisma.application.count({ where: { churchId: auth.churchId, status: "REJECTED" } }),
      prisma.application.count({ where: { churchId: auth.churchId } }),
    ]);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const approvedThisMonth = await prisma.application.count({
      where: { churchId: auth.churchId, status: "APPROVED", reviewedAt: { gte: thisMonth } },
    });

    return { pending, approved, rejected, total, approvedThisMonth };
  });

  /** GET /applications/:id — detalhe do candidato */
  app.get("/applications/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        preferences: { include: { ministry: { include: { roles: true } } } },
        member: true,
      },
    });

    if (!application || application.churchId !== auth.churchId) {
      return reply.code(404).send({ error: "Candidato não encontrado" });
    }

    return {
      ...application,
      instruments: fromJson(application.instruments),
      availability: application.availability ? JSON.parse(application.availability) : null,
      preferences: application.preferences.map((p) => ({
        id: p.id,
        ministry: {
          id: p.ministry.id,
          name: p.ministry.name,
          icon: p.ministry.icon,
          color: p.ministry.color,
          roles: p.ministry.roles.map((r) => ({ id: r.id, name: r.name })),
        },
      })),
    };
  });

  /** PUT /applications/:id/notes — adicionar notas internas */
  app.put("/applications/:id/notes", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const application = await prisma.application.findUnique({ where: { id }, select: { churchId: true } });
    if (!application || application.churchId !== auth.churchId) {
      return reply.code(404).send({ error: "Candidato não encontrado" });
    }

    const body = noteSchema.parse(req.body);
    const updated = await prisma.application.update({
      where: { id },
      data: { notes: body.notes },
    });

    return { id: updated.id, notes: updated.notes };
  });

  /** POST /applications/:id/approve — aprovar candidato */
  app.post("/applications/:id/approve", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const application = await prisma.application.findUnique({
      where: { id },
      include: { preferences: true, church: true },
    });

    if (!application || application.churchId !== auth.churchId) {
      return reply.code(404).send({ error: "Candidato não encontrado" });
    }
    if (application.status !== "PENDING") {
      return reply.code(400).send({ error: "Candidato já foi revisado" });
    }

    const body = reviewSchema.parse(req.body ?? {});
    const appUrl = getAppUrl(req);

    const result = await prisma.$transaction(async (tx) => {
      // Criar PendingToken para o candidato definir sua senha
      const pendingToken = await tx.pendingToken.create({
        data: {
          email: application.email || `pending-${id}@volutis.local`,
          phone: application.phone,
          name: application.name,
          token: newCode() + newCode(), // 16 chars
          role: body.role,
          churchId: auth.churchId!,
          expiresAt: new Date(Date.now() + 48 * 3600_000), // 48h
        },
      });

      // Atualizar status da aplicação
      await tx.application.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedBy: auth.memberId,
        },
      });

      // Se há vinculações a ministérios, criar membro e vincular
      let member = null;
      if (body.ministryAssignments && body.ministryAssignments.length > 0) {
        member = await tx.member.create({
          data: {
            name: application.name,
            phone: application.phone,
            photoUrl: application.photoUrl,
            avatarKey: application.avatarKey,
            instruments: application.instruments,
            churchId: auth.churchId!,
            approvalStatus: "PENDING",
          },
        });

        // Vincular a ministérios
        for (const assignment of body.ministryAssignments) {
          await tx.ministryMember.create({
            data: {
              memberId: member.id,
              ministryId: assignment.ministryId,
              isLeader: assignment.isLeader,
              roles: JSON.stringify(assignment.roles),
            },
          });
        }

        // Vincular o membro à aplicação
        await tx.application.update({
          where: { id },
          data: { memberId: member.id },
        });
      }

      return { pendingToken, member };
    });

    // Enviar WhatsApp com link para definir senha
    const setPasswordUrl = `${appUrl}/definir-senha?token=${result.pendingToken.token}`;
    if (application.phone) {
      await sendApprovalNotification({
        name: application.name,
        phone: application.phone,
        churchName: application.church.name,
        setPasswordUrl,
      });
    }

    // Notificar via WebSocket se o líder estiver online
    if (auth.memberId) {
      await notifyMember(auth.memberId, {
        type: "SCHEDULE_ASSIGNED",
        title: "Candidato aprovado",
        body: `${application.name} foi aprovado(a) e recebeu link de cadastro.`,
      });
    }

    return {
      id: application.id,
      status: "APPROVED",
      memberId: result.member?.id,
      setPasswordUrl,
      message: "Candidato aprovado com sucesso!",
    };
  });

  /** POST /applications/:id/reject — rejeitar candidato */
  app.post("/applications/:id/reject", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const application = await prisma.application.findUnique({
      where: { id },
      include: { church: true },
    });

    if (!application || application.churchId !== auth.churchId) {
      return reply.code(404).send({ error: "Candidato não encontrado" });
    }
    if (application.status !== "PENDING") {
      return reply.code(400).send({ error: "Candidato já foi revisado" });
    }

    const body = noteSchema.parse(req.body ?? {});

    await prisma.application.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedBy: auth.memberId,
        notes: body.notes || application.notes,
      },
    });

    // Enviar WhatsApp de rejeição
    if (application.phone) {
      await sendRejectionNotification({
        name: application.name,
        phone: application.phone,
        churchName: application.church.name,
        reason: body.notes,
      });
    }

    return {
      id: application.id,
      status: "REJECTED",
      message: "Candidato rejeitado",
    };
  });

  /** DELETE /applications/:id — remover candidato (apenas pendentes) */
  app.delete("/applications/:id", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const application = await prisma.application.findUnique({ where: { id }, select: { churchId: true, status: true } });
    if (!application || application.churchId !== auth.churchId) {
      return reply.code(404).send({ error: "Candidato não encontrado" });
    }
    if (application.status === "APPROVED") {
      return reply.code(409).send({ error: "Não é possível excluir candidato já aprovado" });
    }

    await prisma.applicationPreference.deleteMany({ where: { applicationId: id } });
    await prisma.application.delete({ where: { id } });
    return reply.code(204).send();
  });

  // ─── ROTAS PARA DEFINIR SENHA (sem autenticação) ────────────────

  /** GET /applications/pending-token/:token — validar token de primeiro acesso */
  app.get("/applications/pending-token/:token", async (req, reply) => {
    const { token } = req.params as { token: string };

    const pendingToken = await prisma.pendingToken.findUnique({
      where: { token },
      include: { church: { select: { name: true, slug: true } } },
    });

    if (!pendingToken) {
      return reply.code(404).send({ error: "Token inválido" });
    }
    if (pendingToken.usedAt) {
      return reply.code(400).send({ error: "Token já utilizado" });
    }
    if (pendingToken.expiresAt < new Date()) {
      return reply.code(400).send({ error: "Token expirado. Solicite um novo link ao líder." });
    }

    return {
      valid: true,
      name: pendingToken.name,
      email: pendingToken.email,
      churchName: pendingToken.church.name,
      expiresAt: pendingToken.expiresAt,
    };
  });

  /** POST /applications/set-password — definir senha com token */
  app.post("/applications/set-password", async (req, reply) => {
    const body = z.object({
      token: z.string(),
      password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
      instruments: z.array(z.string()).optional(),
    }).parse(req.body);

    const pendingToken = await prisma.pendingToken.findUnique({
      where: { token: body.token },
      include: { church: true },
    });

    if (!pendingToken) {
      return reply.code(404).send({ error: "Token inválido" });
    }
    if (pendingToken.usedAt) {
      return reply.code(400).send({ error: "Token já utilizado" });
    }
    if (pendingToken.expiresAt < new Date()) {
      return reply.code(400).send({ error: "Token expirado" });
    }

    const normalizedPhone = normalizePhone(body.phone ?? pendingToken.phone);
    const applicationLookupOr = [
      ...(pendingToken.email && !pendingToken.email.startsWith("pending-") ? [{ email: pendingToken.email }] : []),
      ...(pendingToken.phone ? [{ phone: pendingToken.phone }] : []),
    ];

    const relatedApplication = applicationLookupOr.length > 0
      ? await prisma.application.findFirst({
          where: {
            churchId: pendingToken.churchId,
            status: { in: ["PENDING", "APPROVED"] },
            OR: applicationLookupOr,
          },
          include: {
            preferences: true,
            member: {
              include: {
                ministryMembers: true,
              },
            },
          },
          orderBy: { appliedAt: "desc" },
        })
      : null;

    // Verificar se já existe usuário com esse email
    const existingUser = await prisma.user.findUnique({ where: { email: pendingToken.email } });
    if (existingUser) {
      return reply.code(409).send({ error: "E-mail já possui conta ativa" });
    }

    const bcrypt = await import("bcryptjs");

    const result = await prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(body.password, 10);

      // Criar usuário sem duplicar Member provisório já criado na aprovação
      const user = await tx.user.create({
        data: {
          email: pendingToken.email,
          passwordHash,
          role: pendingToken.role,
          phone: normalizedPhone,
          firstLogin: false,
        },
      });

      let memberId = relatedApplication?.memberId ?? null;

      if (memberId) {
        await tx.member.update({
          where: { id: memberId },
          data: {
            userId: user.id,
            name: body.name || pendingToken.name,
            phone: normalizedPhone,
            photoUrl: relatedApplication?.photoUrl,
            avatarKey: relatedApplication?.avatarKey ?? "violet",
            instruments: JSON.stringify(body.instruments ?? fromJson(relatedApplication?.instruments ?? "[]")),
            churchId: pendingToken.churchId,
            approvalStatus: "ACTIVE",
            approvedAt: new Date(),
          },
        });
      } else {
        const createdMember = await tx.member.create({
          data: {
            userId: user.id,
            name: body.name || pendingToken.name,
            phone: normalizedPhone,
            photoUrl: relatedApplication?.photoUrl,
            avatarKey: relatedApplication?.avatarKey ?? "violet",
            instruments: JSON.stringify(body.instruments ?? fromJson(relatedApplication?.instruments ?? "[]")),
            churchId: pendingToken.churchId,
            approvalStatus: "ACTIVE",
            approvedAt: new Date(),
          },
        });
        memberId = createdMember.id;
      }

      // Marcar token como usado
      await tx.pendingToken.update({
        where: { id: pendingToken.id },
        data: { usedAt: new Date() },
      });

      // Se havia aplicação pendente, vincular ao membro
      if (relatedApplication) {
        await tx.application.update({
          where: { id: relatedApplication.id },
          data: {
            status: "APPROVED",
            memberId,
            reviewedAt: new Date(),
          },
        });

        // Se o membro ainda não existia na aprovação, preserva vínculos mínimos com os ministérios de interesse
        if (!relatedApplication.memberId) {
          for (const pref of relatedApplication.preferences) {
            await tx.ministryMember.upsert({
              where: {
                memberId_ministryId: {
                  memberId,
                  ministryId: pref.ministryId,
                },
              },
              update: {},
              create: {
                memberId,
                ministryId: pref.ministryId,
                roles: "[]",
              },
            });
          }
        }
      }

      return tx.user.findUnique({
        where: { id: user.id },
        include: { member: true },
      });
    });

    if (!result) {
      return reply.code(500).send({ error: "Não foi possível concluir o primeiro acesso" });
    }

    // Gerar tokens de acesso
    const accessToken = app.jwt.sign({
      sub: result.id,
      email: result.email,
      role: result.role,
      memberId: result.member?.id,
      churchId: pendingToken.churchId,
    }, { expiresIn: "15m" });

    const crypto2 = await import("node:crypto");
    const raw = crypto2.randomBytes(48).toString("hex");
    const tokenHash = crypto2.createHash("sha256").update(raw).digest("hex");
    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: result.id,
        expiresAt: new Date(Date.now() + 30 * 864e5),
      },
    });

    return {
      user: {
        id: result.id,
        email: result.email,
        role: result.role,
        memberId: result.member?.id,
        memberName: result.member?.name,
        avatarKey: result.member?.avatarKey,
        photoUrl: result.member?.photoUrl,
      },
      accessToken,
      refreshToken: raw,
      message: "Conta criada com sucesso!",
    };
  });
}
