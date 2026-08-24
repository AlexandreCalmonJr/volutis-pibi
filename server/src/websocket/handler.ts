import type { FastifyInstance } from "fastify";
import { registerClient } from "../services/notification.service.js";
import type { AuthUser } from "../middleware/auth.js";

/**
 * WS: conectar em /ws?token=<accessToken>
 * Recebe notificações JSON: { type, title, body, data, whatsappLink, at }
 */
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
      registerClient(user.memberId, socket);
      socket.send(
        JSON.stringify({ type: "CONNECTED", title: "Conectado", body: "Notificações em tempo real ativas", at: new Date().toISOString() })
      );
    } catch {
      socket.close(4002, "Token inválido");
    }
  });
}
