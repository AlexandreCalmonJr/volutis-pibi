# ⛪ Volutis PIBI — Sistema de Gestão Ministerial e Escalas

> 💻 **Desenvolvido por Alexandre Calmon Jr.** com dedicação para a **Primeira Igreja Batista de Itapuã (PIBI)**.

Sistema completo de gestão de escalas inteligentes, ministérios, triagem de membros com QR Code, repertório musical com Holyrics, comunicação em tempo real e helpdesk operacional.

---

## 🛡️ Níveis de Acesso (RBAC)

O sistema possui **4 níveis de permissão** bem definidos:

| Nível / Role | Código no BD | Quem é na Igreja | O que pode acessar e fazer? |
| :--- | :--- | :--- | :--- |
| **👑 Administrador** | `ADMIN` | Pastor Titular, Secretaria ou TI | Acesso irrestrito a todas as abas. Cria ministérios, gerencia usuários, permissões, configurações do sistema, auditoria, Holyrics e disparo em massa. |
| **🛡️ Líder de Ministério** | `MINISTRY_LEADER` | Líder do Louvor, Mídia, Diaconia, Kids, etc. | Cria e edita escalas dos seus ministérios, aprova inscrições na Triagem de suas equipes, monta repertórios de louvor, cadastra FAQs e notifica voluntários. |
| **🤝 Membro do Ministério** | `VOLUNTEER` | Membro que serve ativamente | Vê suas escalas, confirma/recusa presença, **solicita trocas de vaga**, participa do chat dos cultos escalados no dia do evento e acessa materiais de estudo e cifras. |
| **👤 Membro Geral** | `MEMBER` | Membro geral ou visitante cadastrado | Acompanha eventos e cultos da igreja, vê o repertório de louvor (Letra, YouTube e Spotify) para adorar junto e pode se inscrever em ministérios pelo QR Code. |

---

## 🌟 Principais Funcionalidades

### 1. 📲 Triagem de Membros com QR Code para Telão
- **Link Público de Inscrição**: `/cadastro/:slug` (ex: `https://app.volutis.com.br/cadastro/pibi`).
- **Gerador de QR Code**: Na aba **Triagem**, clique em **`Link da Igreja & QR Code 📲`** para:
  - Projetar o QR Code em alta definição no telão da igreja durante os avisos.
  - Baixar a imagem PNG em alta resolução (600x600) para cartazes, banners e redes sociais.
  - Copiar o link direto com 1 clique para enviar nos grupos de WhatsApp.
- **Aprovação Isolada por Liderança**: Cada líder visualiza apenas os voluntários interessados em sua área ministerial.

### 2. 📅 Escalas Inteligentes, Anti-Conflito e Card para WhatsApp
- **Alerta de Conflito de Escala Dupla (Double Booking)**: O sistema detecta e bloqueia automaticamente se um voluntário for escalado em dois ministérios ou funções no mesmo culto.
- **Prevenção de Eventos Sobrepostos**: Impede o cadastro de dois cultos no mesmo dia e horário.
- **Gerador de Card Visual da Escala para WhatsApp**: Gera instantaneamente via HTML5 Canvas uma imagem em alta resolução (1080x1350) com logo da igreja, data, horário e voluntários por função, com botões para **Baixar PNG**, **Copiar Imagem** e **Copiar Texto**.
- **Solicitação de Troca de Escala (`🔄 Pedir Troca`)**: O voluntário solicita substituição e o sistema notifica o voluntário escolhido e a liderança.

### 3. 💬 Comunicação & Chats Operacionais
- **Chat por Culto Protegido**: Salas de chat liberadas apenas no dia do evento e visíveis unicamente para voluntários escalados naquele culto.
- **Mural & Feed da Equipe**: Espaço dedicado para o ministério compartilhar estudos, avisos, materiais e comentários.
- **Alternador Rápido de Equipes**: Voluntários com mais de um ministério alternam entre suas equipes com 1 clique direto no topo do hub.

### 4. 🆘 Central de Ajuda & Helpdesk Operacional (`/ajuda`)
- **Procedimentos Rápidos de Emergência**:
  - *Holyrics / Telão travado ou sem sinal HDMI*.
  - *Microfone sem som, pilhas ou mute na mesa Behringer*.
  - *Transmissão ao vivo no YouTube caída no OBS Studio*.
  - *Imprevisto no dia do culto / Solicitação de substituto de emergência*.
- **Diretório de Contatos de Plantão**: Botões diretos para o WhatsApp dos responsáveis de TI, Mídia, Louvor e Diaconia.
- **FAQ Editável por Líderes**: Líderes e Administradores podem adicionar e remover orientações operacionais a qualquer momento.

### 5. 🎵 Aba Louvor Personalizada por Função
- **Para Músicos / Voluntários do Louvor**:
  - Tom do Culto em destaque com badge colorido.
  - BPM, Metrônomo interativo e Estrutura musical.
  - Links diretos para Cifra Club, YouTube e Spotify.
  - Visualizador de Cifras e notas técnicas.
- **Integração Holyrics**: Envio da setlist do culto para a playlist do Holyrics com 1 clique.

---

## 🏗️ Arquitetura & Otimizações de Backend e Banco de Dados

- **Fastify 5 + Node.js 22**: Servidor HTTP moderno com suporte a WebSockets e Server-Sent Events.
- **Prisma 6 + PostgreSQL**: Modelagem relacional otimizada com índices compostos em `ScheduleItem`, `ChatMessage`, `UserNotification` e `FeedPost`.
- **Soft Delete (`deletedAt`)**: Em `Event` e `Ministry` para proteger o histórico de serviço contra exclusões em cascata acidentais.
- **Auditoria Persistente (`AuditLog`)**: Rastreamento completo de aprovações, edições e exclusões com IP e agente.
- **Rate-Limiting Granular**: Proteção contra ataques de força bruta no Login (12 req/min) e spam na Triagem Pública (10 req/min).
- **Sanitização Anti-XSS Universal**: Limpeza automática de payloads JSON no hook `preValidation`.
- **Cache em Memória com TTL (`appCache`)**: Cache em memória de 60s para `/ministries` e 120s para `/songs`, reduzindo até 70% da carga do PostgreSQL nos horários de pico.
- **Rotinas Automáticas em Segundo Plano (`cleanup.service.ts`)**: Limpeza periódica de convites, tokens de sessão expirados e notificações antigas.
