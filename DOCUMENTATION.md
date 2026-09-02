# 📖 Documentação Técnica Completa — Volutis PIBI

**Projeto**: Volutis PIBI — Sistema de Gestão Ministerial, Escalas, Louvor, Mídias e Helpdesk  
**Autor e Idealizador**: Alexandre Calmon Jr.  
**Igreja**: Primeira Igreja Batista de Itapuã (PIBI)  
**Versão Atual**: 2.5.0 (Produção Pronta e Otimizada)  

---

## 1. 🏗️ Arquitetura do Sistema

O Volutis PIBI é estruturado em uma arquitetura monorepo moderna, separando claramente o Frontend SPA (Progressive Web App) do Backend REST API com comunicação em tempo real via WebSocket, Web Push e mensageria WhatsApp.

```
Volutis-PIBI/
├── client/                     # Frontend SPA (React 19 + Vite + Tailwind/Vanilla CSS)
│   ├── src/
│   │   ├── components/         # Componentes reutilizáveis
│   │   │   ├── ScheduleCardModal.tsx # Gerador de Card Visual da Escala para WhatsApp (HTML5 Canvas)
│   │   │   ├── Sidebar.tsx           # Navegação lateral com controle de acesso RBAC
│   │   │   └── ModalPortal.tsx       # Modais acessíveis via React Portal
│   │   └── pages/
│   │       ├── Dashboard.tsx         # Visão geral, métricas e monitoramento
│   │       ├── Escalas.tsx           # Calendário, escalas com detecção de Double Booking e card WhatsApp
│   │       ├── Eventos.tsx           # Gestão de cultos com validação contra horários sobrepostos
│   │       ├── Voluntarios.tsx       # Gestão de membros com isolamento por ministério
│   │       ├── MinistryHubPage.tsx   # Hub da equipe com alternador dinâmico e mural interno
│   │       ├── EventChatPage.tsx     # Chat restrito ao dia do culto e a voluntários escalados
│   │       ├── AjudaPage.tsx         # Central de Ajuda & Helpdesk com FAQ operacional editável
│   │       ├── TriagemPage.tsx       # Triagem pública com isolamento por liderança
│   │       ├── Louvor.tsx            # Repertório musical, setlists, tons e metrônomo
│   │       ├── MinisteriosPage.tsx   # Gestão de ministérios e funções (Admin e Líder)
│   │       ├── ConvitesPage.tsx      # Geração de convites protegida por escopo de ministério
│   │       ├── Perfil.tsx            # Perfil do voluntário, badges e disponibilidades
│   │       └── Relatorios.tsx        # Métricas de presença e relatórios ministeriais
│
├── server/                     # Backend API (Node.js + Fastify + Prisma + PostgreSQL)
│   ├── prisma/
│   │   └── schema.prisma       # Modelagem relacional, índices compostos e soft delete
│   ├── src/
│   │   ├── server.ts           # Fastify, rate-limit granular, graceful shutdown e hooks anti-XSS
│   │   ├── lib/
│   │   │   ├── cache.ts        # Cache em memória ultra-rápido com TTL e invalidação
│   │   │   └── db.ts           # Instância singleton do Prisma Client
│   │   ├── middleware/
│   │   │   ├── auth.ts         # Autenticação JWT e RBAC hierárquico
│   │   │   └── sanitize.ts     # Sanitização universal anti-XSS de payloads
│   │   ├── routes/             # Controladores REST com paginação e cache
│   │   │   ├── auth.ts         # Login e refresh com rate limiting severo
│   │   │   ├── ministries.ts   # CRUD de ministérios com cache de 60s e soft delete
│   │   │   ├── songs.ts        # Catálogo musical com cache de 120s
│   │   │   ├── events.ts       # Validação de eventos sobrepostos no mesmo horário
│   │   │   ├── chat.ts         # Chat dos cultos com paginação segura (take: 50)
│   │   │   └── applications.ts # Triagem com filtro automático para o ministério do líder
│   │   └── services/
│   │       ├── audit.service.ts      # Auditoria de ações persistida na tabela AuditLog
│   │       ├── cleanup.service.ts    # Job automático de limpeza de convites e tokens antigos
│   │       ├── scheduler.service.ts  # Disparo de lembretes automáticos 24h antes do culto
│   │       ├── notification.service.ts # Notificações internas in-app e Web Push
│   │       └── whatsapp.service.ts   # Integração de mensagens interativas de escala
```

---

## 2. 🛡️ Segurança e Níveis de Acesso (RBAC)

Hierarquia de permissões implementada em `server/src/middleware/auth.ts`:

1. **👑 `ADMIN`**: Acesso global irrestrito a todos os ministérios, usuários, auditoria, configurações e reset de produção.
2. **🛡️ `MINISTRY_LEADER`**:
   - Vê e gerencia **apenas** os ministérios e voluntários sob sua liderança ativa.
   - Na **Triagem**, visualiza somente candidatos que marcaram interesse em seus ministérios.
   - Nos **Convites**, gera convites vinculados unicamente ao seu ministério.
   - Na **Central de Ajuda**, pode cadastrar e excluir perguntas e procedimentos operacionais (FAQs).
3. **🤝 `VOLUNTEER`**:
   - Acessa suas próprias escalas, confirma/recusa presença e pede trocas com outros voluntários.
   - Acessa o chat do culto **apenas** nos eventos em que está escalado e **no dia do evento**.
   - No Louvor, acessa repertório, cifras e metrônomo.
4. **👤 `MEMBER`**: Visualiza eventos públicos, repertório e mural geral.

---

## 3. 🗄️ Esquema do Banco de Dados & Otimizações de Performance

### Principais Tabelas:
* **`Church`**: Igreja/organização com configurações de Holyrics e YouTube Live.
* **`User`**: Credenciais de login (`email`, `passwordHash`, `role`).
* **`Member`**: Perfil ministerial (`name`, `phone`, `instruments`, `approvalStatus`).
* **`Ministry`**: Ministérios com suporte a `deletedAt DateTime?` (Soft Delete para preservação de histórico).
* **`Event`**: Cultos e eventos com `deletedAt DateTime?` e índice temporal.
* **`ScheduleItem`**: Vaga na escala com índices compostos de alta velocidade (`[memberId, status]`, `[eventId, status]`, `[reminderSentAt]`).
* **`ChatMessage`**: Mensagens de chat do culto com índice composto `@@index([eventId, createdAt])`.
* **`UserNotification`**: Notificações com índice composto `@@index([memberId, readAt, createdAt])`.
* **`AuditLog`**: Registro persistente de ações administrativas com categorização e rastreamento de IP.
* **`RefreshToken` & `Invite`**: Sessões e convites com limpeza automática por job de background.

---

## 4. ⚡ Otimizações do Servidor Backend

1. **Rate Limiting Granular:**
   - Proteção de força bruta em `/auth/login` e `/auth/forgot-password` limitada a **12 requisições por minuto por IP**.
   - Proteção contra bots no formulário público `/applications/public` limitada a **10 cadastros por minuto por IP**.
2. **Sanitização Universal Anti-XSS (`sanitize.ts`):**
   - Intercepta payloads JSON no hook `preValidation` do Fastify, removendo scripts maliciosos sem alterar textos válidos ou emojis.
3. **Cache em Memória com TTL (`appCache`):**
   - Reduz até 70% das queries ao banco de dados no pico de domingo para rotas de leitura frequente (`GET /ministries` e `GET /songs`).
4. **Job Automático de Limpeza (`cleanup.service.ts`):**
   - Executa a cada 12 horas, removendo convites expirados (+7 dias), tokens de sessão antigos e notificações lidas com mais de 60 dias.
5. **Graceful Shutdown:**
   - Trata sinais `SIGTERM` e `SIGINT` desconectando o Prisma Client e limpando temporizadores antes de desligar.

---

## 5. 🚀 Ferramentas Operacionais de Destaque

* **Gerador de Card Visual da Escala para WhatsApp:** Renderiza imagens PNG estilizadas (1080x1350) com 1 clique para postar em grupos ou stories.
* **Alerta de Conflito de Escala Dupla (Double Booking):** Avisa instantaneamente quando um voluntário já está escalado no mesmo culto em outra função.
* **Prevenção de Eventos Sobrepostos:** Impede dois eventos cadastrados na mesma data e horário.
* **Central de Ajuda & Helpdesk Operacional:** Catálogo de emergências (falha de som, queda de live no OBS, Holyrics travado) com diretório de plantão WhatsApp e FAQs personalizáveis.
