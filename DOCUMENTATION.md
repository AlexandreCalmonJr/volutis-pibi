# 📖 Documentação Técnica Completa — Volutis PIBI

**Projeto**: Volutis PIBI — Sistema de Gestão Ministerial, Escalas, Louvor e Mídias  
**Autor e Idealizador**: Alexandre Calmon Jr.  
**Igreja**: Primeira Igreja Batista de Itapuã (PIBI)  
**Versão Atual**: 2.0.0 (Produção Pronta)  

---

## 1. 🏗️ Arquitetura do Sistema

O Volutis PIBI é estruturado em uma arquitetura monorepo moderna, separando claramente o Frontend SPA (Progressive Web App) do Backend REST API com comunicação em tempo real via WebSocket e Web Push.

```
Volutis-PIBI/
├── client/                     # Frontend SPA (PWA)
│   ├── index.html              # HTML base + manifesto PWA
│   ├── src/
│   │   ├── main.tsx            # Ponto de entrada do React 19
│   │   ├── App.tsx             # Roteamento e layouts protegidos por RBAC
│   │   ├── store.ts            # Zustand (Sessão, Tokens, Auth, Toasts)
│   │   ├── api.ts              # Cliente HTTP com interceptor e refresh token
│   │   ├── components/         # Componentes reutilizáveis (Sidebar, Avatar, Modais, etc.)
│   │   └── pages/              # Páginas e fluxos de negócio
│   │       ├── Dashboard.tsx       # Visão geral, estatísticas e limpeza de banco
│   │       ├── Escalas.tsx         # Calendário de escalas, IA e trocas
│   │       ├── Eventos.tsx         # Cultos, ensaios e liturgia
│   │       ├── Voluntarios.tsx     # Gestão de membros do ministério
│   │       ├── TriagemPage.tsx     # Triagem pública, aprovações e QR Code telão
│   │       ├── Louvor.tsx          # Repertório, setlists, tons, Holyrics e push
│   │       ├── MinisteriosPage.tsx # Gestão de ministérios e lideranças
│   │       ├── Comunicacao.tsx     # Chat por culto e comunicados em massa
│   │       ├── CadastroPage.tsx    # Ficha de inscrição pública (/cadastro/:slug)
│   │       ├── ConvitesPage.tsx    # Geração de convites por link
│   │       ├── Perfil.tsx          # Perfil, histórico e disponibilidade
│   │       └── Relatorios.tsx      # Métricas de presença e engajamento
│
├── server/                     # Backend API (Node.js + Fastify + Prisma)
│   ├── prisma/
│   │   └── schema.prisma       # Modelagem relacional do PostgreSQL
│   ├── src/
│   │   ├── server.ts           # Inicialização do Fastify, CORS e WebSockets
│   │   ├── middleware/
│   │   │   └── auth.ts         # Autenticação JWT e RBAC hierárquico
│   │   ├── routes/             # Controladores REST
│   │   │   ├── auth.ts             # Login, registro e rotação de tokens
│   │   │   ├── applications.ts     # Triagem, aprovação e limpeza de testes
│   │   │   ├── events.ts           # Cultos, liturgia e roteiros
│   │   │   ├── schedules.ts        # Escalas, sugestão inteligente e trocas
│   │   │   ├── songs.ts            # Catálogo musical e notificações de louvor
│   │   │   ├── ministries.ts       # Ministérios e controle de lideranças
│   │   │   ├── members.ts          # Perfil ministerial e disponibilidades
│   │   │   ├── holyrics.ts         # Integração Holyrics local/cloud
│   │   │   ├── admin.ts            # Reset de produção e gestão de usuários
│   │   │   └── chat.ts             # Mensagens em tempo real
│   │   └── services/
│   │       ├── notification.service.ts # Disparos In-App e Push
│   │       ├── push.service.ts         # Web Push VAPID para celulares
│   │       └── whatsapp.service.ts     # Integração WhatsApp / Avisos
```

---

## 2. 🛡️ Segurança e Níveis de Acesso (RBAC)

Hierarquia de permissões implementada em `server/src/middleware/auth.ts`:

1. **👑 `ADMIN` (Nível 4)**: Acesso completo. Apenas ele cria ministérios, promove membros para líderes de ministério e executa limpeza de banco de dados para produção.
2. **🛡️ `MINISTRY_LEADER` (Nível 3)**: Acesso restrito aos ministérios em que é líder ativo. Gera escalas de sua equipe, aprova novos membros na Triagem, monta repertórios de louvor e envia avisos para a equipe.
3. **🤝 `VOLUNTEER` (Nível 2 — Membro do Ministério)**: Acessa suas próprias escalas, confirma/recusa presença, solicita trocas com outros membros, participa do chat dos cultos escalados e, no Louvor, acessa cifras, tons e anotações musicais.
4. **👤 `MEMBER` (Nível 1 — Membro Geral)**: Vê o calendário dos cultos, repertório das músicas (com links para YouTube/Spotify/Letra) e acessa o formulário de inscrição via QR Code.

---

## 3. 🗄️ Esquema do Banco de Dados (PostgreSQL + Prisma)

### Principais Tabelas:
* **`Church`**: Organização/igreja dona dos dados (`slug` público para formulários).
* **`User`**: Credenciais de login (`email`, `passwordHash`, `role`).
* **`Member`**: Perfil ministerial (`name`, `phone`, `instruments`, `points`, `approvalStatus`).
* **`Ministry` & `MinistryRole`**: Ministérios cadastrados e suas funções específicas (ex: *Louvor → Vocal, Bateria, Violão*).
* **`MinistryMember`**: Tabela de junção Membro <-> Ministério, com a flag `isLeader: boolean`.
* **`Event`**: Cultos e ensaios com data, horário e tipo.
* **`ScheduleItem`**: Vaga na escala vinculando Evento, Membro e Função (`PENDING`, `CONFIRMED`, `DECLINED`, `SWAP_REQUESTED`).
* **`SwapRequest`**: Pedido de troca de vaga com histórico de aprovação.
* **`Song` & `SetlistItem`**: Catálogo de louvor (Tom, BPM, Letra, Cifra, Links YouTube/Spotify/CifraClub).
* **`Application` & `ApplicationPreference`**: Fichas de inscrição recebidas via QR Code do Telão.
* **`Notification` & `PushSubscription`**: Feed de notificações e chaves de Web Push nos navegadores/smartphones.

---

## 4. 🔄 Ciclo de Vida e Fluxos de Produção

### Como colocar em Produção e Limpar Dados de Teste:
1. No **Dashboard**, clique em **`Limpeza de dados para Produção`**.
2. O sistema aciona `POST /api/admin/production-reset`, removendo escalas, eventos ou membros de teste, preservando o usuário do Administrador e a estrutura de ministérios.
3. Na **Triagem**, use o botão **`🧹 Limpar Inscrições de Teste`** para limpar testes residuais.

---

## 5. 🚀 Guia de Atualizações e Melhorias Futuras

Ao criar novas funcionalidades ou módulos no sistema:
1. **Modelos no Banco**: Edite `server/prisma/schema.prisma` e execute `npm run prisma:generate -w server` e `npx prisma migrate dev --name nome_da_migracao`.
2. **Rotas da API**: Crie o arquivo em `server/src/routes/` e registre no `server/src/server.ts`.
3. **Páginas no Frontend**: Crie a tela em `client/src/pages/` e adicione a rota em `client/src/App.tsx`.
4. **Permissões**: Use `requireRole("ADMIN")` ou `requireRole("MINISTRY_LEADER")` nos endpoints críticos.
