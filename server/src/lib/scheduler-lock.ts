import { prisma } from "./db.js";

const ownerId = `${process.env.HOSTNAME || "local"}:${process.pid}`;

export async function acquireSchedulerLease(key: string, ttlMs: number) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const existing = await prisma.schedulerLease.findUnique({ where: { key } });
  if (!existing) {
    await prisma.schedulerLease.create({ data: { key, ownerId, expiresAt } });
    return true;
  }

  if (existing.expiresAt <= now || existing.ownerId === ownerId) {
    await prisma.schedulerLease.update({ where: { key }, data: { ownerId, expiresAt } });
    return true;
  }

  return false;
}
