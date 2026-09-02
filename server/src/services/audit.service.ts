import { prisma } from "../lib/db.js";

export interface AuditLogEntry {
  id: string;
  action: string;
  category: "SCHEDULE" | "MEMBER" | "EVENT" | "SONG" | "SECURITY" | "ADMIN";
  details?: string | null;
  actorId?: string | null;
  actorName: string;
  actorRole?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

// In-memory fallback buffer in case database table is pending migration
const memoryAuditLogs: AuditLogEntry[] = [];

export async function logAudit(params: {
  action: string;
  category: "SCHEDULE" | "MEMBER" | "EVENT" | "SONG" | "SECURITY" | "ADMIN";
  details?: Record<string, any> | string;
  actorId?: string | null;
  actorName: string;
  actorRole?: string | null;
  ipAddress?: string | null;
  churchId: string;
}) {
  const detailsStr = typeof params.details === "object" ? JSON.stringify(params.details) : params.details || null;
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    action: params.action,
    category: params.category,
    details: detailsStr,
    actorId: params.actorId || null,
    actorName: params.actorName,
    actorRole: params.actorRole || null,
    ipAddress: params.ipAddress || null,
    createdAt: new Date().toISOString(),
  };

  memoryAuditLogs.unshift(entry);
  if (memoryAuditLogs.length > 200) {
    memoryAuditLogs.pop();
  }

  try {
    if (prisma.auditLog) {
      await prisma.auditLog.create({
        data: {
          action: params.action,
          category: params.category,
          details: detailsStr,
          actorId: params.actorId || null,
          actorName: params.actorName,
          actorRole: params.actorRole || null,
          ipAddress: params.ipAddress || null,
          churchId: params.churchId,
        },
      });
    }
  } catch {
    // Graceful fallback to in-memory buffer
  }
}

export async function getAuditLogs(churchId: string, limit = 50): Promise<AuditLogEntry[]> {
  try {
    if (prisma.auditLog) {
      const logs = await prisma.auditLog.findMany({
        where: { churchId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      if (logs && logs.length > 0) {
        return logs.map((l) => ({
          ...l,
          category: l.category as AuditLogEntry["category"],
          createdAt: l.createdAt.toISOString ? l.createdAt.toISOString() : String(l.createdAt),
        }));
      }
    }
  } catch {
    // Fallback to memory
  }

  return memoryAuditLogs.slice(0, limit);
}
