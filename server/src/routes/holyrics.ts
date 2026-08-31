import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireRole, type AuthUser } from "../middleware/auth.js";
import { callHolyrics, isConfigured, HolyricsNotConfiguredError } from "../services/holyrics.service.js";

const configSchema = z.object({
  mode: z.enum(["local", "online"]),
  localIp: z.string().optional(),
  localPort: z.number().int().positive().optional(),
  token: z.string().optional(),
  apiKey: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.mode === "local") {
    if (!value.localIp) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localIp"], message: "Informe o IP local do Holyrics" });
    if (!value.localPort) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localPort"], message: "Informe a porta local do Holyrics" });
    if (!value.token) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["token"], message: "Informe o token local do Holyrics" });
  }
  if (value.mode === "online") {
    if (!value.apiKey) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["apiKey"], message: "Informe a API key do Holyrics" });
    if (!value.token) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["token"], message: "Informe o token do Holyrics" });
  }
});

async function getChurch(auth: AuthUser) {
  if (!auth.churchId) return null;
  return prisma.church.findUnique({ where: { id: auth.churchId } });
}

export async function holyricsRoutes(app: FastifyInstance) {
  // Erros de configuração viram 409 amigável (mantendo o tratamento de Zod)
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HolyricsNotConfiguredError) {
      return reply.code(409).send({ error: err.message, code: "NOT_CONFIGURED" });
    }
    if (err instanceof z.ZodError) {
      return reply.code(400).send({
        error: "Dados inválidos",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const errorObj = err as any;
    return reply.code(errorObj?.statusCode ?? 500).send({ error: errorObj?.message ?? "Erro interno" });
  });

  // ── Configuração ─────────────────────────────────────────
  app.get("/holyrics/config", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const church = await getChurch(req.user as AuthUser);
    if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    return {
      mode: church.holyricsMode,
      localIp: church.holyricsLocalIp,
      localPort: church.holyricsLocalPort,
      hasToken: !!church.holyricsToken,
      hasApiKey: !!church.holyricsApiKey,
      configured: isConfigured(church),
    };
  });

  app.put("/holyrics/config", { preHandler: [requireRole("ADMIN")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = configSchema.parse(req.body);
    const church = await prisma.church.update({
      where: { id: auth.churchId },
      data: {
        holyricsMode: body.mode,
        holyricsLocalIp: body.localIp,
        holyricsLocalPort: body.localPort,
        ...(body.token ? { holyricsToken: body.token } : {}),
        ...(body.apiKey ? { holyricsApiKey: body.apiKey } : {}),
      },
    });
    return { configured: isConfigured(church) };
  });

  // ── Status/conectividade ─────────────────────────────────
  app.get("/holyrics/status", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const church = await getChurch(req.user as AuthUser);
    if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    if (!isConfigured(church)) return { connected: false, configured: false };
    const result = await callHolyrics(church, "GetTokenInfo");
    return {
      configured: true,
      connected: result.status === "ok",
      mode: church.holyricsMode,
      version: result.data?.version ?? null,
      permissions: result.data?.permissions ?? null,
      error: result.error ?? null,
      help: church.holyricsMode === "local"
        ? "No modo local, o Holyrics precisa estar aberto na mesma rede e com o API Server ativado."
        : "No modo online, confirme token e API key válidos no painel do Holyrics.",
    };
  });

  app.post("/holyrics/test", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const church = await getChurch(req.user as AuthUser);
    if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    if (!isConfigured(church)) return reply.code(409).send({ error: "Holyrics não configurado", code: "NOT_CONFIGURED" });
    const result = await callHolyrics(church, "GetTokenInfo");
    if (result.status !== "ok") return reply.code(502).send({ connected: false, error: result.error });
    return { connected: true, version: result.data?.version ?? null, permissions: result.data?.permissions ?? null };
  });

  // ── Importação de músicas ────────────────────────────────
  app.post("/holyrics/import-songs", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const church = await getChurch(req.user as AuthUser);
    if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const result = await callHolyrics<any[]>(church, "GetSongs", { fields: "id,title,artist,key,bpm" });
    if (result.status !== "ok") return reply.code(502).send({ error: result.error });

    let created = 0, updated = 0;
    for (const hs of result.data ?? []) {
      if (!hs.id || !hs.title) continue;
      const existing = await prisma.song.findFirst({
        where: {
          churchId: church.id,
          OR: [
            { holyricsId: String(hs.id) },
            { title: hs.title, artist: hs.artist || null },
          ],
        },
      });
      const data = {
        title: hs.title,
        artist: hs.artist || null,
        originalKey: hs.key || null,
        bpm: hs.bpm ? Math.round(hs.bpm) : null,
        holyricsId: String(hs.id),
      };
      if (existing) {
        await prisma.song.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.song.create({
          data: { ...data, churchId: church.id },
        });
        created++;
      }
    }
    return { imported: created, updated, total: (result.data ?? []).length };
  });

  // ── Envio de setlist para a playlist do Holyrics ─────────
  app.post(
    "/events/:eventId/holyrics/send-setlist",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const { clear = true } = (req.body ?? {}) as { clear?: boolean };
      const church = await getChurch(req.user as AuthUser);
      if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

      const items = await prisma.setlistItem.findMany({
        where: { eventId },
        include: { song: true },
        orderBy: { order: "asc" },
      });
      if (items.length === 0) return reply.code(400).send({ error: "Setlist vazia" });

      const linked = items.filter((i) => i.song.holyricsId);
      const skipped = items.filter((i) => !i.song.holyricsId).map((i) => i.song.title);
      if (linked.length === 0) {
        return reply.code(400).send({
          error: "Nenhuma música da setlist está vinculada ao Holyrics. Importe as músicas primeiro.",
          skipped,
        });
      }

      // Limpa a playlist atual (opcional) e adiciona na ordem
      if (clear) {
        const current = await callHolyrics<any[]>(church, "GetLyricsPlaylist");
        if (current.status === "ok" && (current.data ?? []).length > 0) {
          const indexes = (current.data ?? []).map((_: any, i: number) => i);
          await callHolyrics(church, "RemoveFromLyricsPlaylist", { indexes });
        }
      }

      const add = await callHolyrics(church, "AddLyricsToPlaylist", {
        ids: linked.map((i) => i.song.holyricsId),
      });
      if (add.status !== "ok") return reply.code(502).send({ error: add.error });

      return { sent: linked.length, skipped };
    }
  );

  // ── Projeção remota ──────────────────────────────────────
  app.post("/holyrics/show-verse", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { references, version } = z
      .object({ references: z.string().min(1), version: z.string().optional() })
      .parse(req.body);
    const church = await getChurch(req.user as AuthUser);
    if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const result = await callHolyrics(church, "ShowVerse", { references, ...(version ? { version } : {}) });
    if (result.status !== "ok") return reply.code(502).send({ error: result.error });
    return { ok: true };
  });

  app.post("/holyrics/show-countdown", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { time, textBefore, textAfter } = z
      .object({
        time: z.string().regex(/^\d{1,2}:\d{2}$/, "Formato MM:SS"),
        textBefore: z.string().optional(),
        textAfter: z.string().optional(),
      })
      .parse(req.body);
    const church = await getChurch(req.user as AuthUser);
    if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const result = await callHolyrics(church, "ShowCountdown", {
      time,
      ...(textBefore ? { text_before: textBefore } : {}),
      ...(textAfter ? { text_after: textAfter } : {}),
    });
    if (result.status !== "ok") return reply.code(502).send({ error: result.error });
    return { ok: true };
  });

  app.post("/holyrics/show-text", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { text } = z.object({ text: z.string().min(1) }).parse(req.body);
    const church = await getChurch(req.user as AuthUser);
    if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const result = await callHolyrics(church, "ShowQuickPresentation", { text });
    if (result.status !== "ok") return reply.code(502).send({ error: result.error });
    return { ok: true };
  });

  app.post("/holyrics/panel-text", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { text, show } = z.object({ text: z.string(), show: z.boolean().default(true) }).parse(req.body);
    const church = await getChurch(req.user as AuthUser);
    if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const result = await callHolyrics(church, "SetTextCP", { text, show, display_ahead: true });
    if (result.status !== "ok") return reply.code(502).send({ error: result.error });
    return { ok: true };
  });

  app.post("/holyrics/action", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { action } = z.object({ action: z.enum(["next", "previous", "close"]) }).parse(req.body);
    const church = await getChurch(req.user as AuthUser);
    if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const map = { next: "ActionNext", previous: "ActionPrevious", close: "CloseCurrentPresentation" } as const;
    const result = await callHolyrics(church, map[action]);
    if (result.status !== "ok") return reply.code(502).send({ error: result.error });
    return { ok: true };
  });

  app.get("/holyrics/current", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const church = await getChurch(req.user as AuthUser);
    if (!church) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const result = await callHolyrics(church, "GetCurrentPresentation");
    if (result.status !== "ok") return reply.code(502).send({ error: result.error });
    return { presentation: result.data ?? null };
  });
}
