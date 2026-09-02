# 🧪 Análise de Qualidade, Testes & Homologação — Volutis PIBI

**Estratégia**: Pirâmide de Testes (Unitários, Integração e Smoke Tests)  
**Frameworks**: Vitest (Frontend), TSX Runners (Backend), TypeScript Strict Mode  

---

## 1. Estratégia de Qualidade de Software

Para garantir estabilidade crítica nos cultos semanais da igreja, o projeto adota múltiplos filtros de garantia de qualidade:

```
                  /\
                 /  \     Smoke / E2E Tests (Fluxos críticos de escala)
                /----\
               /      \   Testes de Integração (API + Prisma + Autenticação)
              /--------\
             /          \ Testes Unitários (Componentes, Metrônomo, Schemas Zod)
            /------------\
           / Tipagem TypeScript Estrita em 100% do Monorepo \
```

---

## 2. Execução dos Testes Automatizados

### 2.1 Testes Unitários no Frontend (Vitest)
Executados na pasta `client/`:
```bash
cd client
npm run test
```
* Validações de componentes de feedback visual (`Skeleton.test.tsx`).
* Validação de sincronismo rítmico do metrônomo musical (`Metronome.test.tsx`).

### 2.2 Verificação de Tipagem Estrita (TypeScript)
Garante ausência de erros em tempo de compilação:
```bash
# Validar backend
cd server && npm run build

# Validar frontend
cd client && npm run build
```

---

## 3. Matriz de Segurança & Conformidade (OWASP Top 10)

| Risco OWASP | Medida Implementada no Volutis PIBI |
| :--- | :--- |
| **A01: Quebra de Controle de Acesso** | Middleware RBAC rígido (`requireRole`) validando se o usuário possui liderança ativa no ministério em questão. |
| **A02: Falhas Criptográficas** | Senhas com hash `bcrypt` (10 rounds com salt dinâmico), tokens JWT assinados com HS256 e segredo em variável de ambiente. |
| **A03: Injeção de Código / XSS** | Queries 100% parametrizadas via Prisma ORM (sem SQL injection) e middleware de sanitização anti-XSS stripping de tags perigosas em payloads. |
| **A04: Design Inseguro** | Fila de envio WhatsApp com taxa controlada de 2.5s para proteção contra banimento e detecção de Double Booking para prevenir sobrecarga humana. |
| **A05: Configuração Incorreta** | Helmet ativado com cabeçalhos HTTP seguros (HSTS, NoSniff, FrameGuard), CORS configurado com credenciais. |
| **A07: Falhas de Identificação / Brute-Force** | Rate limiting severo no `/auth/login` (máx. 12 req/min) e suporte a 2FA via WhatsApp para administradores. |

---

## 4. Checklist de Homologação para Deploys em Produção

Antes de disponibilizar uma nova versão da aplicação para a igreja, execute o seguinte checklist:

- [ ] **1. Banco de Dados**:
  - [ ] Schema do Prisma sincronizado (`npx prisma generate`).
  - [ ] Índices compostos de busca criados no PostgreSQL.
  - [ ] Backup de segurança prévio gerado via `GET /api/admin/backup`.
- [ ] **2. Segurança & Acessos**:
  - [ ] Teste de login com conta `ADMIN`, `MINISTRY_LEADER` e `VOLUNTEER`.
  - [ ] Verificação de que voluntários de um ministério não conseguem editar escalas de outro ministério.
- [ ] **3. Operação do Culto**:
  - [ ] Gerador de Card Visual da Escala para WhatsApp renderiza com a logo da igreja e data correta.
  - [ ] Alerta de Double Booking acionado ao tentar escalar o mesmo voluntário em duas funções no mesmo horário.
  - [ ] Central de Ajuda com FAQs e contatos de emergência do WhatsApp funcionais.
  - [ ] Chat do culto bloqueado para datas futuras e visível apenas a escalados.
- [ ] **4. Resiliência do Servidor**:
  - [ ] Endpoint `/health` respondendo com status `"ok"` e latência de banco inferior a 150ms.
  - [ ] Fila assíncrona de WhatsApp processando mensagens com espaçamento de 2.5s.
