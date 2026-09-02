# 🚀 DevOps, Infraestrutura & Deploy — Volutis PIBI

**Ambientes**: Cloud Run, VPS Linux (Docker / Docker Compose), Node.js Standalone  
**Contêiner**: Docker Multi-stage (Node 22 Alpine)  

---

## 1. Arquitetura de Contêineres (Docker)

O [Dockerfile](file:///c:/Users/alexandre/Documents/Volutis-PIBI/Dockerfile) do projeto é construído em múltiplos estágios (*multi-stage build*) para gerar uma imagem de produção ultraleve e segura:

```
Estágio 1: Builder (Node 22 Alpine)
  ├── Instala dependências do server e client
  ├── Gera o Prisma Client (prisma generate)
  ├── Compila o Frontend SPA (vite build) -> client/dist
  └── Compila o Backend TypeScript (tsc) -> server/dist

Estágio 2: Runner de Produção (Node 22 Alpine)
  ├── Copia apenas os pacotes de produção (sem devDependencies)
  ├── Copia os arquivos compilados (server/dist e client/dist)
  ├── Define o usuário não-root 'node' para segurança
  └── Expõe a porta 3333
```

---

## 2. Orquestração Local com Docker Compose

O arquivo [docker-compose.yml](file:///c:/Users/alexandre/Documents/Volutis-PIBI/docker-compose.yml) inicializa a stack completa:

```yaml
version: '3.8'
services:
  volutis-app:
    build: .
    ports:
      - "3333:3333"
    environment:
      - NODE_ENV=production
      - PORT=3333
      - DATABASE_URL=postgresql://postgres:senha@postgres:5432/volut_pibi?schema=public
      - JWT_SECRET=chave_secreta_super_segura
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: volut_pibi
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: senha
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  pgdata:
```

### Comandos de Operação:
```bash
# Iniciar todos os serviços em background
docker compose up -d

# Visualizar logs em tempo real
docker compose logs -f volut-app

# Parar serviços
docker compose down
```

---

## 3. Variáveis de Ambiente Essenciais (`.env`)

| Variável | Exemplo | Descrição |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Modo de execução do Fastify e Vite. |
| `PORT` | `3333` | Porta HTTP em que o servidor escuta. |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | String de conexão do PostgreSQL com SSL. |
| `JWT_SECRET` | `chave-aleatoria-64-caracteres` | Chave de assinatura criptográfica dos tokens JWT. |
| `VAPID_PUBLIC_KEY` | `BMv9...` | Chave pública para Web Push no navegador. |
| `VAPID_PRIVATE_KEY`| `a8k...` | Chave privada para autenticação do Web Push. |
| `WHATSAPP_API_URL` | `http://localhost:3000` | URL do servidor WAHA (quando não utilizar Baileys nativo). |

---

## 4. Deploy em Produção (Google Cloud Run / VPS)

### Opção A: Deploy no Google Cloud Run
1. Gere e envie a imagem Docker para o Artifact Registry:
   ```bash
   gcloud builds submit --tag gcr.io/seu-projeto/volut-pibi
   ```
2. Implante o serviço habilitando conexões de WebSocket:
   ```bash
   gcloud run deploy volut-pibi \
     --image gcr.io/seu-projeto/volut-pibi \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars NODE_ENV=production,DATABASE_URL=...
   ```

### Opção B: Deploy em VPS Linux (Ubuntu com Nginx e SSL)
1. Instale o Nginx e o Certbot para HTTPS gratuito:
   ```bash
   sudo apt update && sudo apt install nginx certbot python3-certbot-nginx -y
   ```
2. Configure o bloco do Nginx com suporte a WebSocket:
   ```nginx
   server {
       server_name app.volutis.com.br;

       location / {
           proxy_pass http://127.0.0.1:3333;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
3. Emita o certificado SSL:
   ```bash
   sudo certbot --nginx -d app.volutis.com.br
   ```

---

## 5. Monitoramento de Saúde & Logs

- **Health Check Endpoint**: `/health` e `/api/health`.
  - Retorna status do serviço, latência de query ao banco em milissegundos (`dbLatencyMs`), estatísticas de memória RAM (Heap/RSS) e métricas do cache em memória.
- **Logs Estruturados**: O Fastify utiliza `pino` para logging em formato JSON de alta velocidade, pronto para ingestão no Datadog, Grafana Loki ou Google Cloud Logging.
