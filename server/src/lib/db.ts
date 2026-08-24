import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** Helpers para campos JSON-encoded (portabilidade SQLite) */
export const toJson = (arr: string[] | undefined | null) =>
  JSON.stringify(arr ?? []);
export const fromJson = (s: string | null | undefined): string[] => {
  try {
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
};

/**
 * Isolamento multi-igreja: verifica se a entidade pertence à igreja do usuário.
 * Retorna false para id inexistente ou igreja divergente (tratar como 404).
 */
export async function belongsToChurch(
  entity: "member" | "event" | "ministry" | "song",
  id: string,
  churchId: string | undefined | null
): Promise<boolean> {
  if (!churchId) return false;
  const row = await (prisma as any)[entity].findUnique({
    where: { id },
    select: { churchId: true },
  });
  return !!row && row.churchId === churchId;
}

/** Igreja de um item aninhado (via evento) — scheduleItem/setlistItem/liturgyItem */
export async function itemEventChurch(
  entity: "scheduleItem" | "setlistItem" | "liturgyItem",
  id: string
): Promise<string | null> {
  const row = await (prisma as any)[entity].findUnique({
    where: { id },
    select: { event: { select: { churchId: true } } },
  });
  return row?.event?.churchId ?? null;
}
