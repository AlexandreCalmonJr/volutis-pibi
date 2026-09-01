# ⛪ Volutis PIBI — Sistema de Gestão Ministerial e Escalas

> 💻 **Desenvolvido por Alexandre Calmon Jr.** com dedicação para a **Primeira Igreja Batista de Itapuã (PIBI)**.

Sistema completo de gestão de escalas inteligentes, ministérios, triagem de membros com QR Code, repertório musical com Holyrics e comunicação em tempo real.

---

## 🛡️ Níveis de Acesso (RBAC)

O sistema possui **4 níveis de permissão** bem definidos:

| Nível / Role | Código no BD | Quem é na Igreja | O que pode acessar e fazer? |
| :--- | :--- | :--- | :--- |
| **👑 Administrador** | `ADMIN` | Pastor Titular, Secretaria ou TI | Acesso irrestrito a todas as abas. Cria ministérios, gerencia usuários, permissões, configurações do sistema, Holyrics e disparo em massa. |
| **🛡️ Líder de Ministério** | `MINISTRY_LEADER` | Líder do Louvor, Mídia, Kids, etc. | Cria e edita escalas dos seus ministérios, aprova inscrições na Triagem, monta repertórios de louvor, notifica a equipe e vê relatórios. |
| **🤝 Membro do Ministério** | `VOLUNTEER` | Membro que serve ativamente | Vê suas escalas, confirma/recusa presença, **solicita trocas de vaga**, participa do chat dos cultos escalados e, se for do Louvor, acessa **tom, BPM, Cifra Club e cifras**. |
| **👤 Membro Geral** | `MEMBER` | Membro geral ou visitante cadastrado | Acompanha eventos e cultos da igreja, vê o repertório de louvor (Letra, YouTube e Spotify) para adorar junto e pode se inscrever em ministérios pelo QR Code. |

---

## 🌟 Principais Funcionalidades

### 1. 📲 Triagem de Membros com QR Code para Telão
- **Link Público de Inscrição**: `/cadastro/:slug` (ex: `https://app.volutis.com.br/cadastro/pibi`).
- **Gerador de QR Code**: Na aba **Triagem**, clique em **`Link da Igreja & QR Code 📲`** para:
  - Projetar o QR Code em alta definição no telão da igreja durante os avisos.
  - Baixar a imagem PNG em alta resolução (600x600) para cartazes, banners e redes sociais.
  - Copiar o link direto com 1 clique para enviar nos grupos de WhatsApp.
- **Aprovação em 1 Clique**: As fichas enviadas caem na tela de Triagem para o líder/pastor revisar, definir papéis (`VOLUNTEER` ou `MEMBER`) e aprovar.

### 2. 📅 Escalas Inteligentes & Troca de Vagas
- **Auto Gerar Escala com IA**: Revezamento justo, respeitando bloqueios de data e indisponibilidades.
- **Confirmação Rápida**: O membro clica em **Confirmar Presença ✅** ou **Recusar ❌** direto no app.
- **Solicitação de Troca de Escala (`🔄 Pedir Troca`)**:
  - O membro clica em "Pedir Troca" na sua vaga e seleciona um substituto elegível.
  - O sistema notifica o **substituto** e os **líderes do ministério**.
  - Ao aceitar, a vaga é transferida automaticamente com status `CONFIRMED`.

### 3. 🎵 Aba Louvor Personalizada por Função
- **Para Músicos / Voluntários do Louvor**:
  - 🎨 **Tom do Culto** em destaque com badge colorido.
  - ⏱️ **BPM & Estrutura** (ex: *Intro | Verso 1 | Refrão | Solo*).
  - 🎸 Link direto para **Cifra Club**.
  - 📺 Link direto para **YouTube**.
  - 🎧 Link direto para **Spotify**.
  - 📄 Botão **"Letra / Cifra"** com cifra de palco e anotações técnicas.
  - 📝 **Observações** deixadas pelo ministro de louvor.
- **Para Outros Ministérios (Mídia, Som, Recepção, Diaconia, Kids, Membros)**:
  - 🎵 **Nome da música** e Artista.
  - 📺 Link direto para **YouTube**.
  - 🎧 Link direto para **Spotify**.
  - 📄 Botão **"Letra da Música"** (visualização limpa para acompanhar o culto).
  - 📝 **Observações** do ministro.
- **Notificações de Repertório**:
  - Ao adicionar músicas ao setlist, o backend notifica automaticamente todos os voluntários escalados.
  - O líder conta com o botão **`📢 Notificar Equipe`** para avisar todos os músicos de uma só vez.

### 4. 📽️ Integração Holyrics
- **Modo Local (IP/Porta) ou Online (API Key/Token)**.
- Importação do catálogo de músicas do Holyrics para o Volutis.
- Publicação da setlist do culto direto na playlist do Holyrics com 1 clique.

### 5. 🔔 Notificações Push & Comunicação
- Notificações Push no celular (PWA / Web Push) para escalas, trocas, lembretes de culto e repertório.
- Disparo de **Comunicados em Massa** via Push e WhatsApp direto.
- Chat em tempo real separado por evento/culto.

---

## 🏗️ Arquitetura do Sistema

```
Volutis-PIBI/
├── client/                     # Frontend SPA (React 19 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/         # Sidebar, Navbar, Avatar, Modais, etc.
│   │   ├── pages/              # Telas da aplicação
│   │   │   ├── Dashboard.tsx       # Visão geral da igreja e indicadores
│   │   │   ├── Escalas.tsx         # Calendário, escalas e trocas
│   │   │   ├── Eventos.tsx         # Cultos, ensaios e templates
│   │   │   ├── Voluntarios.tsx     # Membros do ministério ativos/inativos
│   │   │   ├── TriagemPage.tsx     # Gestão de candidatos + QR Code Telão
│   │   │   ├── Louvor.tsx          # Repertório, setlists e Holyrics
│   │   │   ├── Comunicacao.tsx     # Chat dos cultos e comunicados em massa
│   │   │   ├── CadastroPage.tsx    # Ficha de inscrição pública (/cadastro/:slug)
│   │   │   ├── ConvitesPage.tsx    # Convites por link
│   │   │   ├── Perfil.tsx          # Perfil, histórico e disponibilidade
│   │   │   └── Relatorios.tsx      # Métricas e jornada do membro
│   │   ├── store.ts            # Zustand (Sessão, Tokens, Auth, Toasts)
│   │   └── api.ts              # Cliente HTTP com refresh token automático
│
├── server/                     # Backend API (Node.js 22 + Fastify 5 + Prisma 6)
│   ├── prisma/
│   │   └── schema.prisma       # Modelos do PostgreSQL
│   ├── src/
│   │   ├── routes/             # Controladores das rotas HTTP
│   │   │   ├── auth.ts             # Login, registro, refresh token, senha
│   │   │   ├── applications.ts     # Inscrições públicas e triagem
│   │   │   ├── events.ts           # Cultos, templates e liturgia
│   │   │   ├── schedules.ts        # Escalas, auto-geração, trocas e respostas
│   │   │   ├── songs.ts            # Catálogo, setlists e notificações de louvor
│   │   │   ├── holyrics.ts         # Integração Holyrics (local e cloud)
│   │   │   ├── members.ts          # Membros, ministérios e disponibilidades
│   │   │   ├── notifications.ts    # Feed de notificações e Web Push
│   │   │   └── chat.ts             # Chat em tempo real dos eventos
│   │   ├── services/           # Lógica de negócio e integrações
│   │   │   ├── notification.service.ts # Disparos Push e In-App
│   │   │   └── push.service.ts         # Web Push VAPID
│   │   └── middleware/
│   │       └── auth.ts         # requireAuth, requireRole (RBAC)
```

---

## 🗄️ Modelos do Banco de Dados (Prisma / PostgreSQL)

* **`Church`**: Dados da igreja, slug público (ex: `pibi`) e configurações.
* **`User`**: Contas de acesso, email, hash de senha e papel (`ADMIN`, `MINISTRY_LEADER`, `VOLUNTEER`, `MEMBER`).
* **`Member`**: Perfil ministerial, telefone, instrumentos, pontos de gamificação e status (`ACTIVE`, `PENDING`, `INACTIVE`).
* **`Ministry` & `MinistryRole`**: Ministérios da igreja (Louvor, Mídia, etc.) e funções (Vocal, Bateria, Câmera 1).
* **`MinistryMember`**: Relação membro <-> ministério (indica se é líder do ministério).
* **`Event`**: Cultos, eventos especiais e ensaios com data, horário e tipo.
* **`ScheduleItem`**: Vaga na escala vinculando Evento, Membro e Função (`status`: `PENDING`, `CONFIRMED`, `DECLINED`, `SWAP_REQUESTED`).
* **`SwapRequest`**: Solicitação de troca de escala entre membros com histórico de resposta.
* **`Song` & `SetlistItem`**: Músicas do repertório (tom, BPM, letra, cifra, links) e setlists dos cultos.
* **`Application`**: Fichas de inscrição preenchidas no QR Code da Triagem.
* **`Notification` & `PushSubscription`**: Histórico de avisos in-app e tokens de Web Push dos celulares.

---

## 🔌 Principais Endpoints da API

### Autenticação & Usuários
* `POST /api/auth/login` — Login com email e senha (retorna JWT e Refresh Token).
* `POST /api/auth/refresh` — Rotação de tokens.
* `GET /api/auth/me` — Dados do usuário logado.

### Triagem & Inscrição Pública
* `POST /api/applications/public` — Envio da ficha pelo QR Code do telão (pública).
* `GET /api/applications` — Lista de candidatos para revisão do líder (`MINISTRY_LEADER` / `ADMIN`).
* `POST /api/applications/:id/review` — Aprovação ou recusa do candidato.

### Escalas & Trocas
* `GET /api/my/schedule` — Escalas ativas do membro logado.
* `POST /api/schedule-items/:id/respond` — Confirmação (`CONFIRMED`) ou recusa (`DECLINED`) pelo membro.
* `POST /api/schedule-items/:id/swap` — Cria solicitação de troca com outro membro.
* `POST /api/swap-requests/:id/respond` — Aceite ou recusa da troca pelo voluntário convidado.
* `POST /api/events/:eventId/auto-schedule` — Geração automática inteligente de escala.

### Louvor & Setlists
* `GET /api/songs` — Catálogo de músicas da igreja.
* `GET /api/events/:eventId/setlist` — Músicas do setlist do culto.
* `POST /api/events/:eventId/setlist` — Adiciona música ao culto e notifica voluntários escalados.
* `POST /api/events/:eventId/setlist/notify` — Dispara notificação push em lote com o repertório completo.
* `POST /api/events/:eventId/holyrics/send-setlist` — Publica setlist no Holyrics.

---

## 🚀 Como Rodar Localmente

### 1. Pré-requisitos
- Node.js 20+ ou 22
- PostgreSQL rodando localmente ou via Docker

### 2. Instalação e Inicialização
```bash
# 1. Configurar variáveis de ambiente do backend
cp server/.env.example server/.env

# 2. Instalar dependências de todo o monorepo
npm install

# 3. Gerar cliente do Prisma e rodar migrações
npm run prisma:generate -w server
npx prisma migrate deploy --schema server/prisma/schema.prisma

# 4. Popular banco com dados iniciais (Seed)
npm run seed -w server

# 5. Iniciar Backend (Porta 3333)
npm run dev:server

# 6. Em outro terminal, iniciar Frontend (Porta 5173)
npm run dev:client
```

### 🔑 Credenciais Padrão do Seed:
* **Administrador**: `admin@pibi.org.br` | Senha: `pibi2026`
* **Líder de Louvor**: `joao@pibi.org.br` | Senha: `volutis123`
* **Membros do Ministério**: `maria@pibi.org.br` ou `pedro@pibi.org.br` | Senha: `volutis123`

---

## 👨‍💻 Desenvolvedor & Autor

* **Alexandre Calmon Jr.** — Idealizador e Desenvolvedor do Volutis PIBI.
* Desenvolvido especialmente para abençoar a liderança, ministérios e membros da **Primeira Igreja Batista de Itapuã (PIBI)**.

