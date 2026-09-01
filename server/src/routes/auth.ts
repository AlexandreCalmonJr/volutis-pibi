import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { fromJson, prisma } from "../lib/db.js";
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
  email: z.string(),
  password: z.string(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
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

function serializeAuthMember(member: any) {
  if (!member) return null;
  return {
    ...member,
    instruments: fromJson(member.instruments),
    ministryMembers: member.ministryMembers?.map((mm: any) => ({
      ...mm,
      roles: fromJson(mm.roles),
    })) ?? [],
  };
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

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const normalizedPhone = normalizePhone(body.phone);

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
          phone: normalizedPhone,
          passwordHash: await bcrypt.hash(body.password, 10),
          role: invite.role,
          member: {
            create: { name: body.name, phone: normalizedPhone, churchId: invite.churchId },
          },
        },
        include: { member: true },
      });

      // Auto-vincular ao ministério do convite
      if (invite.ministryId && created.member) {
        await tx.ministryMember.create({
          data: {
            memberId: created.member.id,
            ministryId: invite.ministryId,
            isLeader: invite.role === "MINISTRY_LEADER",
            roles: "[]",
          },
        });
      }

      await tx.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), usedByEmail: body.email },
      });
      return created;
    });

    const tokens = await issueTokens(app, toPayload(user));
    return reply.code(201).send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        memberId: user.member?.id,
        memberName: user.member?.name,
        avatarKey: user.member?.avatarKey,
        photoUrl: user.member?.photoUrl,
        phone: user.phone,
      },
      ...tokens,
    });
  });

  /** GET /auth/validate-invite/:code — valida código e retorna dados do convite */
  app.get("/auth/validate-invite/:code", async (req, reply) => {
    // Rate limit: 20 tentativas por IP a cada 15 min
    const rl = rateLimitHit(`validate-invite:${req.ip}`, 20, 15 * 60_000);
    if (!rl.allowed) {
      return reply
        .code(429)
        .header("Retry-After", String(rl.retryAfterSec))
        .send({ error: "Muitas tentativas. Tente novamente em alguns minutos." });
    }

    const { code } = req.params as { code: string };
    const invite = await prisma.invite.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { ministry: true },
    });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return reply.code(404).send({ error: "Convite inválido ou expirado" });
    }
    return {
      code: invite.code,
      role: invite.role,
      ministry: invite.ministry
        ? { id: invite.ministry.id, name: invite.ministry.name, icon: invite.ministry.icon, color: invite.ministry.color }
        : null,
    };
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

    // Buscar por email OU por telefone
    const input = body.email.trim();
    const isPhone = /^\d{10,11}$/.test(input.replace(/\D/g, ""));
    const normalizedPhone = isPhone ? input.replace(/\D/g, "").replace(/^(\d{2})(\d)/g, "$19$2") : undefined;

    const user = await prisma.user.findFirst({
      where: isPhone
        ? { phone: normalizedPhone }
        : { email: input },
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
      user: { id: user.id, email: user.email, role: user.role, memberId: user.member?.id, memberName: user.member?.name, avatarKey: user.member?.avatarKey, photoUrl: user.member?.photoUrl },
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

  /** POST /auth/logout — invalida todos os refresh tokens do usuário */
  app.post("/auth/logout", { preHandler: [async (req, r) => { try { await req.jwtVerify(); } catch { return r.code(401).send({ error: "Não autenticado" }); } }] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    await prisma.refreshToken.deleteMany({ where: { userId: auth.sub } });
    return { ok: true };
  });

  app.post("/auth/change-password", { preHandler: [async (req, r) => { try { await req.jwtVerify(); } catch { return r.code(401).send({ error: "Não autenticado" }); } }] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    const body = changePasswordSchema.parse(req.body);

    if (body.currentPassword === body.newPassword) {
      return reply.code(400).send({ error: "A nova senha deve ser diferente da senha atual" });
    }

    const user = await prisma.user.findUnique({ where: { id: auth.sub } });
    if (!user) return reply.code(404).send({ error: "Usuário não encontrado" });

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Senha atual incorreta" });
    }

    const nextHash = await bcrypt.hash(body.newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: auth.sub },
        data: {
          passwordHash: nextHash,
          firstLogin: false,
          lastPasswordReset: new Date(),
        },
      }),
      prisma.refreshToken.deleteMany({ where: { userId: auth.sub } }),
    ]);

    const refreshedUser = await prisma.user.findUnique({
      where: { id: auth.sub },
      include: { member: true },
    });
    if (!refreshedUser) return reply.code(404).send({ error: "Usuário não encontrado" });

    const tokens = await issueTokens(app, toPayload(refreshedUser));
    return { ok: true, ...tokens };
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
    return { user: { ...safeUser, member: serializeAuthMember(user.member), memberName: user.member?.name } };
  });

  // ── Concluir Onboarding ─────────────────────────────────────
  app.post("/auth/complete-onboarding", { preHandler: [async (req, r) => { try { await req.jwtVerify(); } catch { return r.code(401).send({ error: "Não autenticado" }); } }] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    await prisma.user.update({
      where: { id: auth.sub },
      data: { firstLogin: false },
    }).catch(() => {});
    return reply.send({ success: true });
  });

  // ── 2FA / MFA (Dois Fatores) ─────────────────────────────────
  const pending2faSecrets = new Map<string, string>();

  function generateBase32Secret(length = 20): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const bytes = crypto.randomBytes(length);
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % 32];
    }
    return result;
  }

  function base32ToBuffer(base32: string): Buffer {
    const cleaned = base32.toUpperCase().replace(/=+$/, "");
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const idx = chars.indexOf(cleaned[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }

  function verifyTotpCode(secretBase32: string, token: string, windowSteps = 1): boolean {
    if (!/^\d{6}$/.test(token)) return false;
    const key = base32ToBuffer(secretBase32);
    const currentTimeStep = Math.floor(Date.now() / 30000);

    for (let i = -windowSteps; i <= windowSteps; i++) {
      const step = currentTimeStep + i;
      const timeBuffer = Buffer.alloc(8);
      timeBuffer.writeBigInt64BE(BigInt(step), 0);

      const hmac = crypto.createHmac("sha1", key).update(timeBuffer).digest();
      const offset = hmac[hmac.length - 1] & 0x0f;
      const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
      const generatedCode = String(binary % 1000000).padStart(6, "0");

      if (generatedCode === token) return true;
    }
    return false;
  }

  app.post("/auth/2fa/setup", { preHandler: [async (req, r) => { try { await req.jwtVerify(); } catch { return r.code(401).send({ error: "Não autenticado" }); } }] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    const secret = generateBase32Secret();
    pending2faSecrets.set(auth.sub, secret);

    const otpauthUrl = `otpauth://totp/Volutis%20PIBI:${encodeURIComponent(auth.email || "usuario")}?secret=${secret}&issuer=Volutis%20PIBI`;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return reply.send({ secret, qrCodeDataUrl });
  });

  app.post("/auth/2fa/verify", { preHandler: [async (req, r) => { try { await req.jwtVerify(); } catch { return r.code(401).send({ error: "Não autenticado" }); } }] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    const body = z.object({ code: z.string().min(6).max(6) }).parse(req.body);
    const secret = pending2faSecrets.get(auth.sub);

    if (!secret) {
      return reply.code(400).send({ error: "Nenhuma configuração de 2FA em andamento. Inicie novamente." });
    }

    const isValid = verifyTotpCode(secret, body.code);
    if (!isValid) {
      return reply.code(400).send({ error: "Código de 6 dígitos inválido ou expirado." });
    }

    pending2faSecrets.delete(auth.sub);
    return reply.send({ success: true, message: "Autenticação em duas etapas (2FA) ativada com sucesso!" });
  });
}
