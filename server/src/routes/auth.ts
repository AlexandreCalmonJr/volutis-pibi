import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { rateLimitHit, rateLimitReset } from "../lib/ratelimit.js";
import type { AuthUser } from "../middleware/auth.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  phone: z.string().optional(),
  inviteCode: z.string().min(4),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const REFRESH_DAYS = 30;

async function issueTokens(app: FastifyInstance, payload: AuthUser) {
  const accessToken = app.jwt.sign(payload, { expiresIn: "15m" });
  const raw = crypto.randomBytes(48).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: payload.sub,
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 864e5),
    },
  });
  return { accessToken, refreshToken: raw };
}

function toPayload(user: {
  id: string;
  email: string;
  role: string;
  member: { id: string; churchId: string } | null;
}): AuthUser {
  return {
    sub: user.id,
    email: user.email,
    role: user.role as AuthUser["role"],
    memberId: user.member?.id,
    churchId: user.member?.churchId,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const body = registerSchema.parse(req.body);

    // Proteção contra força bruta de códigos de convite
    const rl = rateLimitHit(`register:${req.ip}`, 8, 15 * 60_000);
    if (!rl.allowed) {
      return reply
        .code(429)
        .header("Retry-After", String(rl.retryAfterSec))
        .send({ error: "Muitas tentativas de cadastro. Tente novamente em alguns minutos." });
    }

    // Cadastro somente com convite válido (uso único, com expiração)
    const invite = await prisma.invite.findUnique({
      where: { code: body.inviteCode.trim().toUpperCase() },
    });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return reply.code(400).send({ error: "Convite inválido, expirado ou já utilizado" });
    }

    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) return reply.code(409).send({ error: "E-mail já cadastrado" });

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: body.email,
          passwordHash: await bcrypt.hash(body.password, 10),
          role: invite.role,
          member: {
            create: { name: body.name, phone: body.phone, churchId: invite.churchId },
          },
        },
        include: { member: true },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), usedByEmail: body.email },
      });
      return created;
    });

    const tokens = await issueTokens(app, toPayload(user));
    return reply.code(201).send({ user: { id: user.id, email: user.email, role: user.role }, ...tokens });
  });

  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);

    // Força bruta: máx. 10 tentativas por IP+e-mail a cada 15 min
    const rlKey = `login:${req.ip}:${body.email.toLowerCase()}`;
    const rl = rateLimitHit(rlKey, 10, 15 * 60_000);
    if (!rl.allowed) {
      return reply
        .code(429)
        .header("Retry-After", String(rl.retryAfterSec))
        .send({ error: "Muitas tentativas de login. Tente novamente em alguns minutos." });
    }

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { member: true },
    });
    // Compare sempre executa (hash dummy) p/ não vazar existência do e-mail via timing
    const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali";
    const valid = await bcrypt.compare(body.password, hash);
    if (!user || !valid) {
      return reply.code(401).send({ error: "Credenciais inválidas" });
    }
    rateLimitReset(rlKey);
    const tokens = await issueTokens(app, toPayload(user));
    return {
      user: { id: user.id, email: user.email, role: user.role, memberId: user.member?.id },
      ...tokens,
    };
  });

  app.post("/auth/refresh", async (req, reply) => {
    const { refreshToken } = z
      .object({ refreshToken: z.string() })
      .parse(req.body);
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { member: true } } },
    });
    if (!stored || stored.expiresAt < new Date()) {
      return reply.code(401).send({ error: "Refresh token inválido ou expirado" });
    }
    // Rotação: invalida o antigo
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const tokens = await issueTokens(app, toPayload(stored.user));
    return tokens;
  });

  app.get("/auth/me", { preHandler: [async (req, r) => { try { await req.jwtVerify(); } catch { return r.code(401).send({ error: "Não autenticado" }); } }] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      include: {
        member: {
          include: {
            ministryMembers: { include: { ministry: true } },
            badges: { orderBy: { earnedAt: "desc" } },
          },
        },
      },
    });
    if (!user) return reply.code(404).send({ error: "Usuário não encontrado" });
    // NUNCA expor o hash de senha
    const { passwordHash: _ph, ...safeUser } = user;
    return { user: safeUser };
  });
}
