import type { FastifyReply, FastifyRequest } from "fastify";

export type Role = "ADMIN" | "MINISTRY_LEADER" | "VOLUNTEER" | "MEMBER";

const HIERARCHY: Record<Role, number> = {
  ADMIN: 4,
  MINISTRY_LEADER: 3,
  VOLUNTEER: 2,
  MEMBER: 1,
};

export interface AuthUser {
  sub: string;
  email: string;
  role: Role;
  churchId?: string;
  memberId?: string;
}

/** Exige autenticação JWT */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Não autenticado" });
  }
}

/** Exige papel mínimo (hierárquico) */
export function requireRole(minRole: Role) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Não autenticado" });
    }
    const user = req.user as AuthUser;
    if (HIERARCHY[user.role] < HIERARCHY[minRole]) {
      return reply
        .code(403)
        .send({ error: "Permissão insuficiente", required: minRole });
    }
  };
}
