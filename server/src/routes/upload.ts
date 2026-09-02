import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { requireAuth, type AuthUser } from "../middleware/auth.js";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

// Garante que os subdiretórios existam
async function ensureUploadDirs() {
  await fs.mkdir(path.join(UPLOADS_ROOT, "avatars"), { recursive: true });
  await fs.mkdir(path.join(UPLOADS_ROOT, "banners"), { recursive: true });
  await fs.mkdir(path.join(UPLOADS_ROOT, "documents"), { recursive: true });
}
ensureUploadDirs().catch(() => {});

const uploadSchema = z.object({
  data: z.string().min(10, "Dados de arquivo inválidos"), // base64 ou data URL
  fileName: z.string().optional(),
  category: z.enum(["avatars", "banners", "documents"]).default("avatars"),
});

export async function uploadRoutes(app: FastifyInstance) {
  app.post("/upload", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const body = uploadSchema.parse(req.body);

    let mimeType = "image/jpeg";
    let base64Data = body.data;

    // Se for Data URL (data:image/png;base64,xxxx)
    const matches = body.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    // Valida extensões permitidas
    const allowedMimes: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "application/pdf": ".pdf",
    };

    const ext = allowedMimes[mimeType] || ".jpg";
    const buffer = Buffer.from(base64Data, "base64");

    // Limite de 5MB por arquivo
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      return reply.code(413).send({ error: "Arquivo muito grande. O limite máximo é de 5MB." });
    }

    const uniqueId = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const filename = `${uniqueId}${ext}`;
    const targetDir = path.join(UPLOADS_ROOT, body.category);
    const targetPath = path.join(targetDir, filename);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, buffer);

    const publicUrl = `/uploads/${body.category}/${filename}`;

    return reply.code(201).send({
      success: true,
      url: publicUrl,
      fileName: filename,
      sizeBytes: buffer.length,
      mimeType,
    });
  });
}
