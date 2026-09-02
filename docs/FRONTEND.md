# 🖥️ Documentação do Frontend — Volutis PIBI

**Tecnologias**: React 19, TypeScript, Vite 6, Tailwind CSS, Zustand, Vitest  
**Formato**: Single Page Application (SPA) & Progressive Web App (PWA)  

---

## 1. Estrutura de Diretórios

```
client/src/
├── api.ts              # Cliente HTTP com interceptor para renovação automática de JWT
├── store.ts            # Store Zustand (Sessão, Tokens, Usuário, Tema Escuro/Claro)
├── main.tsx            # Ponto de entrada React com montagem no DOM
├── App.tsx             # Roteamento central com guardas de acesso RBAC
├── index.css           # Design System, variáveis CSS, tokens, dark mode e utilitários
│
├── components/         # Componentes reutilizáveis
│   ├── Sidebar.tsx           # Menu lateral com controle de permissão por perfil
│   ├── Navbar.tsx            # Cabeçalho com notificações, tema e perfil
│   ├── Avatar.tsx            # Avatar com iniciais, cores ministeriais e fotos
│   ├── ModalPortal.tsx       # Modais acessíveis via React Portal (evita cortes de z-index)
│   ├── ScheduleCardModal.tsx # Gerador visual de card da escala para WhatsApp (Canvas)
│   ├── Metronome.tsx         # Metrônomo sonoro e visual para o Ministério de Louvor
│   ├── ChordViewer.tsx       # Transpositor e formatador de cifras musicais
│   └── ui/                   # Componentes atômicos (ActionMenu, EmptyState, Skeleton)
│
└── pages/              # Páginas e fluxos de tela
    ├── Dashboard.tsx         # Visão geral da igreja, estatísticas e atalhos rápidos
    ├── Escalas.tsx           # Grade de escalas mensal, anti-conflito e exportação
    ├── Eventos.tsx           # Cultos, liturgia e validação de horários sobrepostos
    ├── Voluntarios.tsx       # Catálogo de voluntários com filtro por liderança
    ├── MinistryHubPage.tsx   # Hub da equipe, mural de estudos e alternador de equipes
    ├── EventChatPage.tsx     # Chat restrito ao dia do culto e a voluntários escalados
    ├── AjudaPage.tsx         # Central de Ajuda & Helpdesk com FAQ editável por líderes
    ├── TriagemPage.tsx       # Triagem de novos membros e projeção de QR Code
    ├── Louvor.tsx            # Repertório musical, setlists, cifras e Holyrics
    ├── MinisteriosPage.tsx   # Gestão de ministérios, líderes e funções
    ├── ConvitesPage.tsx      # Geração de links de convite por ministério
    ├── Perfil.tsx            # Perfil pessoal, indisponibilidades e badges
    └── Relatorios.tsx        # Métricas de frequência, engajamento e histórico
```

---

## 2. Design System & Identidade Visual

O Volutis utiliza uma paleta elegante, profissional e moderna inspirada na estética do macOS e Tailwind, com suporte a **Dark Mode** total através de variáveis CSS customizadas:

### 2.1 Tokens de Cores (`index.css`):
- `--color-primary`: `#7c3aed` (Violeta vibrante de marca).
- `--color-primary-light`: `#f5f3ff` (Violeta suave para badges e seleção).
- `--color-surface`: Fundo principal dos cartões (`#ffffff` no claro / `#13111c` no escuro).
- `--color-surface-2`: Superfície secundária para inputs e divisões (`#f8f7fe` no claro / `#1b1828` no escuro).
- `--color-border`: Linhas e bordas (`#e5e0f8` no claro / `#2d2745` no escuro).
- `--color-ink`: Cor do texto principal (`#1e1b4b` no claro / `#f5f3ff` no escuro).

### 2.2 Tipografia:
- **Títulos e Destaques**: `Fraunces, serif` — confere sofisticação e identidade visual eclesiástica premium.
- **Corpo e Interface**: `Inter, system-ui, -apple-system, sans-serif` — alta legibilidade em qualquer tamanho de tela.

---

## 3. Gerenciamento de Estado (Zustand)

O arquivo [store.ts](file:///c:/Users/alexandre/Documents/Volutis-PIBI/client/src/store.ts) orquestra o estado global através da store `useAuth`:

```ts
interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: AuthUser, access: string, refreshTok: string) => void;
  setTokens: (access: string, refreshTok: string) => void;
  logout: () => void;
}
```

- **Persistência**: Dados de sessão são armazenados com a chave `volut-auth` no `localStorage`.
- **Renovação Transparente**: O interceptor em [api.ts](file:///c:/Users/alexandre/Documents/Volutis-PIBI/client/src/api.ts) captura respostas `401 Unauthorized` e dispara `POST /api/auth/refresh` silenciosamente sem derrubar o usuário.

---

## 4. Recursos de Destaque do Frontend

1. **Gerador de Card da Escala para WhatsApp ([ScheduleCardModal.tsx](file:///c:/Users/alexandre/Documents/Volutis-PIBI/client/src/components/ScheduleCardModal.tsx)):**
   - Renderiza em canvas nativo (1080x1350px) com degradê escuro, título do culto, data e lista de voluntários por ministério.
   - Permite **Baixar PNG**, **Copiar Imagem** para a área de transferência (`navigator.clipboard.write`) e **Copiar Texto Formatado**.
2. **Alerta de Conflito de Escala Dupla:**
   - Detecta em tempo real se o voluntário escolhido já está escalado em outra função naquele mesmo dia/culto, exibindo um alerta âmbar proativo antes da confirmação.
3. **Trava Operacional no Chat do Culto:**
   - O chat fica visível apenas para voluntários escalados no culto correspondente e a digitação é bloqueada até o dia do evento.
4. **Hub de Múltiplos Ministérios Fluido:**
   - Voluntários vinculados a mais de uma equipe alternam entre ministérios sem scrollbars nativas indesejadas, utilizando botões adaptativos com `flex-wrap`.
