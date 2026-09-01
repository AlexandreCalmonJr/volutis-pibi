# Melhorias e Estratégia de App Nativo — Volut PIBI

## Estado Atual do Projeto

O Volut PIBI é uma aplicação **React + Vite (PWA)** com backend **Fastify + Prisma + PostgreSQL**. Já possui:

| Área | Status |
|------|--------|
| Escalas inteligentes | ✅ Implementado |
| Ministérios + RBAC | ✅ Implementado |
| Estante musical (cifras, setlist) | ✅ Implementado |
| Liturgia | ✅ Implementado |
| Chat por evento | ✅ Implementado |
| Holyrics (import/projeção) | ✅ Implementado |
| Gamificação (badges, pontos, check-in) | ✅ Implementado |
| PWA + Push Notifications | ✅ Implementado |
| Feed de posts | ✅ Implementado |
| Convites + Triagem + Cadastro público | ✅ Implementado |
| Transferências entre ministérios | ✅ Implementado |
| WebSocket em tempo real | ✅ Implementado |
| Relatórios | ✅ Implementado |

---

## 🚀 Melhorias Possíveis

### 1. UX / Interface

| Melhoria | Impacto | Esforço |
|----------|---------|---------|
| **Modo escuro completo** — o `themeStore.ts` existe mas garantir cobertura total | 🟢 Alto | 🟡 Médio |
| **Animações de transição entre páginas** — framer-motion ou view transitions API | 🟢 Alto | 🟡 Médio |
| **Skeleton loaders** — substituir spinners genéricos por placeholders com forma | 🟡 Médio | 🟢 Baixo |
| **Onboarding guiado** — tour interativo para novos voluntários (1ª vez) | 🟡 Médio | 🟡 Médio |
| **Drag & drop** na liturgia e setlist para reordenação | 🟢 Alto | 🟡 Médio |
| **Pull-to-refresh** (gesture nativa mobile no PWA) | 🟡 Médio | 🟢 Baixo |

### 2. Funcionalidades Novas

| Funcionalidade | Descrição | Esforço |
|---------------|-----------|---------|
| **Agenda pessoal integrada** | Exportar escalas para Google Calendar / Apple Calendar (formato `.ics`) | 🟡 Médio |
| **Relatórios em PDF** | Gerar relatórios exportáveis em PDF (escalas, frequência, ranking) | 🟡 Médio |
| **Ensaio online** | Player de áudio/vídeo embutido com playlist do setlist (YouTube/Spotify embeds) | 🟡 Médio |
| **Biblioteca de recursos** | Upload de partituras, cifras em PDF, backing tracks | 🔴 Alto |
| **Devocionais / Leitura bíblica** | Integrar uma API de Bíblia (ABibliaDigital) para devocional diário | 🟡 Médio |
| **Metrônomo integrado** | Metrônomo visual/sonoro na tela de músicas (útil para músicos) | 🟢 Baixo |
| **Multi-igreja** | Dashboard admin para gerenciar várias igrejas (modelo já tem `Church`) | 🔴 Alto |
| **Backup/Export** | Exportar todos os dados da igreja em JSON/CSV | 🟡 Médio |

### 3. Performance & Infraestrutura

| Melhoria | Descrição | Esforço |
|----------|-----------|---------|
| **Rate limiting** | Adicionar `@fastify/rate-limit` no servidor | 🟢 Baixo |
| **Compressão** | Adicionar `@fastify/compress` para gzip/brotli | 🟢 Baixo |
| **Cache de API** | ETags + cache headers para endpoints de leitura | 🟡 Médio |
| **Pagination virtual** | Para listas longas (voluntários, músicas) — react-window | 🟡 Médio |
| **Image optimization** | Upload de fotos com resize automático (sharp) | 🟡 Médio |
| **Health check endpoint** | `/api/health` para monitoramento | 🟢 Baixo |
| **Logging estruturado** | Pino já existe, mas adicionar correlation IDs | 🟡 Médio |

### 4. Segurança

| Melhoria | Descrição | Esforço |
|----------|-----------|---------|
| **Helmet** | Headers de segurança com `@fastify/helmet` | 🟢 Baixo |
| **2FA / MFA** | Autenticação em dois fatores para admins | 🟡 Médio |
| **Audit log** | Registrar ações administrativas (quem fez o quê) | 🟡 Médio |
| **CSRF protection** | Para formulários sensíveis | 🟢 Baixo |

### 5. Testes & Qualidade

| Melhoria | Descrição | Esforço |
|----------|-----------|---------|
| **Testes E2E** | Playwright/Cypress para fluxos críticos (login, escala, aceite) | 🔴 Alto |
| **Testes unitários frontend** | Vitest + Testing Library para componentes React | 🟡 Médio |
| **CI/CD pipeline** | GitHub Actions: lint, test, build, deploy automático | 🟡 Médio |
| **Linting + Formatting** | ESLint + Prettier configurados com pre-commit hooks | 🟢 Baixo |

---

## 📱 Transformar em APK (Android) ou App iOS

### Sim, é possível! Existem **3 estratégias**, ordenadas da mais simples à mais robusta:

---

### Opção 1: PWA (Já funciona! Otimizar) ⭐ Recomendada

Seu app **já é um PWA** com manifest.json e service worker. No Android, ele já pode ser "instalado" na tela inicial.

**O que falta para PWA perfeito:**
- [ ] Adicionar `maskable` icon no manifest (para ícone adaptativo Android)
- [ ] Splash screen customizada (campos `screenshots` e `splash_screen` no manifest)
- [ ] Adicionar campo `"orientation": "portrait"` ao manifest
- [ ] Adicionar `"categories": ["productivity", "social"]`
- [ ] Offline-first melhorado (cache de dados da API com IndexedDB)
- [ ] Implementar `beforeinstallprompt` para banner de instalação customizado

> [!TIP]
> **PWA no iOS**: Desde iOS 16.4+, PWAs no Safari suportam push notifications. Seu service worker com push já cobre isso! O usuário adiciona à tela inicial via "Compartilhar > Adicionar à Tela de Início".

> [!IMPORTANT]
> **PWA no Android**: Pode ser distribuído na **Google Play Store** via [TWA (Trusted Web Activity)](https://developer.chrome.com/docs/android/trusted-web-activity/) usando o **Bubblewrap**. Isso gera um APK real a partir do seu PWA sem reescrever nada!

**Gerar APK com Bubblewrap:**
```bash
npx @nicolo-ribaudo/bubblewrap init --manifest https://seu-dominio.com/manifest.json
npx @nicolo-ribaudo/bubblewrap build
# Resultado: app-release-signed.apk
```

---

### Opção 2: Capacitor (Hybrid App) — Melhor custo-benefício para APK + iOS

O [Capacitor](https://capacitorjs.com/) da Ionic empacota seu app React/Vite existente numa WebView nativa com acesso a APIs nativas.

**Vantagens:**
- ✅ Reutiliza 100% do seu código React/Vite atual
- ✅ Acesso a APIs nativas (câmera, biometria, share, armazenamento local)
- ✅ Gera APK (Android) e IPA (iOS)
- ✅ Publicável na Google Play Store e Apple App Store
- ✅ Push notifications nativas (Firebase Cloud Messaging)
- ✅ Deep links nativos

**Como implementar:**
```bash
cd client
npm install @capacitor/core @capacitor/cli
npx cap init "Volut PIBI" "com.pibi.volut"
npm install @capacitor/android @capacitor/ios

# Build e sync
npm run build
npx cap sync

# Abrir no Android Studio / Xcode
npx cap open android
npx cap open ios
```

**Esforço estimado:** 1-2 dias para configuração básica, 1 semana para polir (splash screen, ícones, deep links, push nativo).

> [!WARNING]
> Para publicar na **Apple App Store** (iOS), você precisa de uma conta Apple Developer ($99/ano) e um Mac para compilar via Xcode. Para a **Google Play Store**, a taxa é única ($25).

---

### Opção 3: React Native (Reescrita parcial) — Maior esforço, melhor resultado nativo

Reescrever o frontend usando React Native ou Expo. Compartilha a lógica/store mas requer novos componentes de UI nativos.

**Vantagens:**
- Performance nativa real (não é WebView)
- UX indistinguível de apps nativos
- Compartilha a API e backend atual

**Desvantagens:**
- ❌ Reescrever todos os 16 arquivos de páginas (~350KB de código)
- ❌ Trocar Tailwind por StyleSheet do React Native
- ❌ Manter duas codebases (web + mobile) ou usar Expo Web
- ❌ Esforço estimado: 3-6 semanas

---

## 📊 Comparação das Estratégias

| Critério | PWA (TWA/Bubblewrap) | Capacitor | React Native |
|----------|---------------------|-----------|--------------|
| **Esforço** | 🟢 1-2 horas | 🟡 1-2 dias | 🔴 3-6 semanas |
| **Reuso de código** | 100% | 100% | ~30% (backend + store) |
| **APK (Android)** | ✅ Via TWA | ✅ Nativo | ✅ Nativo |
| **iOS App Store** | ❌ Somente PWA | ✅ Via Xcode | ✅ Via Xcode |
| **Performance** | 🟡 Web | 🟡 WebView | 🟢 Nativo |
| **APIs nativas** | ❌ Limitado | ✅ Amplo | ✅ Total |
| **Push nativo** | 🟡 Web Push | ✅ FCM/APNs | ✅ FCM/APNs |
| **Publicável na Play Store** | ✅ | ✅ | ✅ |
| **Publicável na App Store** | ⚠️ Pode ser rejeitado | ✅ | ✅ |

---

## 🎯 Recomendação

> [!IMPORTANT]
> **Para o Volut PIBI, recomendo a combinação:**
> 1. **Curto prazo**: Otimizar o PWA atual + gerar APK via **Bubblewrap/TWA** (esforço mínimo, já funciona)
> 2. **Médio prazo**: Migrar para **Capacitor** quando precisar de recursos nativos (câmera para fotos de perfil, push nativo robusto, deep links, biometria)
> 3. **Longo prazo**: Avaliar React Native/Expo apenas se a UX nativa se tornar um diferencial competitivo importante

### Próximos passos sugeridos (prioridade):
1. 🟢 Otimizar manifest.json + ícones para PWA completo
2. 🟢 Adicionar rate limiting + helmet no server
3. 🟡 Implementar exportação de escalas para calendário (.ics)
4. 🟡 Integrar Capacitor para gerar APK e IPA
5. 🟡 Configurar CI/CD com GitHub Actions
