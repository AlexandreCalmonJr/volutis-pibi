import type { FastifyInstance } from "fastify";
import { registerClient } from "../services/notification.service.js";
import type { AuthUser } from "../middleware/auth.js";

const HEARTBEAT_INTERVAL_MS = 30_000;

export async function websocketHandler(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket, req) => {
    const { token } = req.query as { token?: string };
    if (!token) {
      socket.close(4001, "Token ausente");
      return;
    }
    try {
      const user = app.jwt.verify<AuthUser>(token);
      if (!user.memberId) {
        socket.close(4003, "Usuário sem membro vinculado");
        return;
      }

      let alive = true;
      const heartbeat = setInterval(() => {
        if (!alive) {
          clearInterval(heartbeat);
          try { socket.close(4004, "Heartbeat timeout"); } catch { /* ignore */ }
          return;
        }
        alive = false;
        try { socket.ping(); } catch { /* ignore */ }
      }, HEARTBEAT_INTERVAL_MS);

      socket.on("pong", () => { alive = true; });
      socket.on("close", () => clearInterval(heartbeat));

      registerClient(user.memberId, socket);
      socket.send(
        JSON.stringify({ type: "CONNECTED", title: "Conectado", body: "Notificações em tempo real ativas", at: new Date().toISOString() })
      );
    } catch {
      socket.close(4002, "Token inválido");
    }
  });
}
