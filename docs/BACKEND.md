# ⚙️ Documentação do Backend — Volutis PIBI

**Tecnologias**: Node.js 22, Fastify 5, TypeScript, Prisma ORM, WebSocket, Baileys / WAHA  
**Padrão**: API RESTful com WebSockets em tempo real  

---

## 1. Estrutura de Diretórios do Servidor

```
server/src/
├── server.ts           # Inicialização do Fastify, plugins, compressão, rate-limit e rotas
├── lib/
│   ├── db.ts           # Instância singleton do Prisma Client e helpers
│   ├── cache.ts        # Cache em memória ultra-rápido com TTL e invalidação
│   └── ratelimit.ts    # Helpers para rate limiting em memória por chave
├── middleware/
│   ├── auth.ts         # Verificação de token JWT e controle de acesso RBAC
│   └── sanitize.ts     # Sanitização universal anti-XSS de payloads JSON
├── routes/             # Controladores de rotas REST organizados por domínio
│   ├── auth.ts         # Registro, login, refresh, logout e 2FA (WhatsApp e TOTP)
│   ├── events.ts       # Gestão de cultos com bloqueio de eventos sobrepostos
│   ├── schedules.ts    # Escalas manuais, IA automática e trocas de vaga
│   ├── ministries.ts   # Gestão de ministérios e lideranças com cache de 60s
│   ├── songs.ts        # Catálogo musical com cache de 120s e cifras
│   ├── chat.ts         # Mensagens em tempo real com paginação segura (limit: 50)
│   ├── feed.ts         # Mural de publicações e comentários da equipe
│   ├── reports.ts      # Relatórios com agregação nativa em SQL puro ($queryRaw)
│   ├── upload.ts       # Upload local de imagens e mídias com limite de 5MB
│   ├── applications.ts # Triagem pública e aprovação de novos voluntários
│   └── admin.ts        # Backup JSON com 1 clique e gestão de contas
└── services/           # Lógica de negócio, jobs e integrações
    ├── whatsapp.service.ts       # Conexão WhatsApp via Baileys ou WAHA HTTP API
    ├── whatsapp-queue.service.ts # Fila com taxa de 2.5s anti-ban e retry
    ├── scheduler.service.ts      # Agendador de lembretes automáticos de culto (24h)
    ├── cleanup.service.ts        # Job de limpeza periódica de dados obsoletos
    ├── notification.service.ts   # Notificações internas in-app
    ├── push.service.ts           # Web Push VAPID para celulares
    └── audit.service.ts          # Registro de auditoria persistido no banco
```

---

## 2. Autenticação, RBAC & Segurança

### 2.1 Níveis de Acesso (RBAC):
- **`requireAuth`**: Garante que o usuário possua um JWT válido no header `Authorization: Bearer <token>`.
- **`requireRole("MINISTRY_LEADER")`**: Permite acesso apenas a `ADMIN` e `MINISTRY_LEADER`. O sistema valida se o líder possui vínculo de liderança ativa no ministério em questão.
- **`requireRole("ADMIN")`**: Restrito a administradores (Pastor Titular, Secretaria ou TI).

### 2.2 Camadas de Proteção:
1. **Rate Limiting Granular**:
   - `POST /api/auth/login` e `POST /api/auth/forgot-password`: Máximo de **12 tentativas por minuto por IP**.
   - `POST /api/applications/public`: Máximo de **10 cadastros por minuto por IP**.
   - Geral: 300 requisições por minuto por IP.
2. **Sanitização Universal Anti-XSS**:
   - Hook `preValidation` no Fastify que limpa automaticamente scripts, tags iframe e manipuladores de eventos maliciosos em qualquer payload JSON.
3. **Autenticação em Duas Etapas (2FA via WhatsApp)**:
   - Envio de código de segurança de 6 dígitos via mensagem de WhatsApp diretamente para o número cadastrado do líder antes de emitir a sessão administrativa.

---

## 3. Cache em Memória (`appCache`)

Para suportar alta concorrência aos domingos com centenas de voluntários acessando simultaneamente:
- **`GET /api/ministries`**: Armazenado em memória com TTL de 60 segundos por igreja. Invalidado instantaneamente em criações, edições ou exclusões.
- **`GET /api/songs`**: Armazenado em memória com TTL de 120 segundos. Invalidado quando o catálogo de louvor é alterado.
- **Economia**: Reduz em até **70% o consumo de I/O e conexões do PostgreSQL**.

---

## 4. Serviços em Segundo Plano (Background Workers)

| Serviço | Arquivo | Frequência | Ação Realizada |
| :--- | :--- | :--- | :--- |
| **Lembretes de 24h** | `scheduler.service.ts` | A cada 15 min | Busca escalas das próximas 24h e dispara lembretes com botão de confirmação no WhatsApp e Push. |
| **Fila WhatsApp** | `whatsapp-queue.service.ts` | Contínuo (2.5s) | Despacha mensagens enfileiradas com intervalo seguro e até 3 tentativas automáticas. |
| **Limpeza do Banco** | `cleanup.service.ts` | A cada 12 horas | Remove convites expirados (+7 dias), refresh tokens antigos e notificações lidas há mais de 60 dias. |

---

## 5. Endpoints REST Principais

- **`POST /api/auth/login`**: Autenticação com e-mail ou telefone.
- **`POST /api/auth/2fa/request-whatsapp`**: Disparo de código de segurança via WhatsApp.
- **`GET /api/admin/export/backup.json`** e **`GET /api/admin/backup`**: Exportação completa do banco de dados em formato JSON com 1 clique.
- **`GET /api/reports/summary-aggregated`**: Relatórios com agregação SQL em tempo recorde.
- **`POST /api/upload`**: Upload local de imagens e documentos.
- **`GET /health`** e **`GET /api/health`**: Diagnóstico com latência real da query ao banco em milissegundos (`dbLatencyMs`) e métricas de cache.
