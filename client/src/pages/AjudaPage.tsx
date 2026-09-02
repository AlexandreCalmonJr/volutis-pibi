import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

interface FAQItem {
  id: string;
  categoria: "GERAL" | "MIDIA" | "LOUVOR" | "DIACONIA";
  pergunta: string;
  resposta: string;
  passos?: string[];
}

const FAQS: FAQItem[] = [
  {
    id: "troca-escala",
    categoria: "GERAL",
    pergunta: "Estou escalado hoje e tive um imprevisto. O que devo fazer?",
    resposta: "Entre imediatamente na tela de Escalas e solicite uma substituição. Se faltar menos de 2 horas para o culto, envie uma mensagem urgente para o seu líder no WhatsApp.",
    passos: [
      "1. Acesse o menu 'Escalas' no aplicativo.",
      "2. Localize o culto onde você está escalado e toque em 'Ações' → 'Pedir Troca'.",
      "3. Escolha um voluntário disponível da mesma função para assumir.",
      "4. Avise seu líder no WhatsApp pelo diretório abaixo para aprovação rápida."
    ]
  },
  {
    id: "datashow-holyrics",
    categoria: "MIDIA",
    pergunta: "O Holyrics ou o projetor da igreja perdeu a conexão. Como reiniciar?",
    resposta: "Geralmente é um problema de espelhamento de display no Windows ou do adaptador HDMI na bancada de mídia.",
    passos: [
      "1. No computador da Mídia, aperte as teclas Windows + P e certifique-se de que está selecionado 'Estender'.",
      "2. Verifique se o cabo HDMI principal do switcher ou projetor está firme na entrada da placa de vídeo.",
      "3. No Holyrics, vá em 'Configurações' → 'Monitores' e selecione o monitor 2 como Telão.",
      "4. Se travar, feche o Holyrics pelo gerenciador de tarefas (Ctrl+Shift+Esc) e abra novamente."
    ]
  },
  {
    id: "obs-live-caiu",
    categoria: "MIDIA",
    pergunta: "A transmissão ao vivo no YouTube caiu ou o OBS Studio desconectou.",
    resposta: "Quedas de live ocorrem principalmente por oscilação da internet ou sobrecarga na taxa de bits (bitrate).",
    passos: [
      "1. Olhe no canto inferior direito do OBS: se o quadrado estiver vermelho, a internet oscilou.",
      "2. Clique em 'Interromper Transmissão', aguarde 5 segundos e clique em 'Iniciar Transmissão'.",
      "3. Se não reconectar, confirme se o cabo de rede Ethernet azul está conectado ao computador da live.",
      "4. Se necessário, troque o bitrate de 6000 Kbps para 4500 Kbps em Configurações → Saída."
    ]
  },
  {
    id: "microfone-sem-som",
    categoria: "LOUVOR",
    pergunta: "O microfone sem fio está falhando, chiando ou sem sinal na mesa de som.",
    resposta: "90% dos casos são pilhas fracas ou canal mutado acidentalmente na mesa Behringer/Soundcraft.",
    passos: [
      "1. Abra o compartimento do microfone e substitua o par de pilhas AA pelas pilhas novas da gaveta de baterias da bancada de som.",
      "2. Olhe a base receptora no rack: o LED 'RF' deve acender indicando que o microfone está conectado na mesma frequência.",
      "3. Na mesa de som, verifique se o botão 'MUTE' do canal correspondente está apagado.",
      "4. Certifique-se de que o fader do canal e o Master LR estão no volume nominal (0dB)."
    ]
  },
  {
    id: "fone-retorno",
    categoria: "LOUVOR",
    pergunta: "Como configurar meu retorno individual no aplicativo de fones?",
    resposta: "Você pode controlar seu próprio volume de retorno pelo aplicativo da mesa conectado à rede Wi-Fi interna.",
    passos: [
      "1. Conecte seu celular à rede Wi-Fi 'PIBI-INTERNA' (senha no mural de TI).",
      "2. Abra o app X32-Q ou Behringer Mix no seu celular.",
      "3. Localize a mesa de som no IP automático e selecione o seu barramento (Bus) de fone.",
      "4. Ajuste os volumes do seu microfone e instrumento com cuidado para não saturar."
    ]
  },
  {
    id: "recepcao-novos-visitantes",
    categoria: "DIACONIA",
    pergunta: "Qual o procedimento de acolhimento e fichas de visitantes na portaria?",
    resposta: "A equipe de recepção deve manter as boas-vindas calorosas, kits de visitantes e controle de assentos.",
    passos: [
      "1. Esteja no hall de entrada 30 minutos antes do início do culto.",
      "2. Entregue o boletim e o kit de boas-vindas para quem estiver visitando pela primeira vez.",
      "3. Caso o templo esteja com mais de 80% de ocupação, auxilie os irmãos a preencherem as fileiras da frente.",
      "4. Qualquer situação de socorro ou emergência médica, chame imediatamente o diácono de plantão."
    ]
  }
];

const PLANTAO_CONTATOS = [
  {
    cargo: "Suporte de TI & Sistemas",
    responsavel: "Equipe de Tecnologia PIBI",
    whatsapp: "5571992425646",
    atua: "Acessos ao Volut, Holyrics, redes Wi-Fi e projetores",
  },
  {
    cargo: "Coordenação de Mídia & Live",
    responsavel: "Liderança de Transmissão",
    whatsapp: "5571991234567",
    atua: "Câmeras, OBS Studio, links do YouTube e slides",
  },
  {
    cargo: "Sonorização & Louvor",
    responsavel: "Diretoria Musical & Operador de Som",
    whatsapp: "5571992345678",
    atua: "Mesa de som, microfones, fones e cabos de palco",
  },
  {
    cargo: "Diaconia & Portaria",
    responsavel: "Diácono Supervisor de Plantão",
    whatsapp: "5571993456789",
    atua: "Abertura do templo, ar-condicionado, segurança e apoio",
  }
];

export default function AjudaPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<"TODAS" | "GERAL" | "MIDIA" | "LOUVOR" | "DIACONIA">("TODAS");
  const [openFaqId, setOpenFaqId] = useState<string | null>("troca-escala");

  const faqsFiltrados = useMemo(() => {
    return FAQS.filter((item) => {
      const matchCat = categoria === "TODAS" || item.categoria === categoria;
      const matchBusca =
        !busca.trim() ||
        item.pergunta.toLowerCase().includes(busca.toLowerCase()) ||
        item.resposta.toLowerCase().includes(busca.toLowerCase()) ||
        (item.passos && item.passos.some((p) => p.toLowerCase().includes(busca.toLowerCase())));
      return matchCat && matchBusca;
    });
  }, [busca, categoria]);

  return (
    <div className="space-y-7 max-w-6xl mx-auto pb-12">
      {/* Header com estilo moderno */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-ink)]" style={{ fontFamily: "'Fraunces', serif" }}>
            Central de Ajuda & Helpdesk
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
            Resolução rápida de problemas operacionais, padrões da igreja e suporte de plantão
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/escalas")}
            className="px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-xs font-semibold hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          >
            Minhas Escalas ↗
          </button>
        </div>
      </div>

      {/* Cartões de Ação Rápida de Emergência no Dia do Culto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4.5 shadow-xs space-y-2 hover:border-violet-400 transition-all">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 flex items-center justify-center font-bold text-sm">
            ⚡
          </div>
          <h3 className="font-bold text-sm text-[var(--color-ink)]">Não posso ir ao culto</h3>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Peça troca de escala pelo aplicativo com até 2h de antecedência.
          </p>
          <button
            onClick={() => navigate("/escalas")}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline pt-1 block cursor-pointer"
          >
            Pedir substituição →
          </button>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4.5 shadow-xs space-y-2 hover:border-violet-400 transition-all">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center font-bold text-sm">
            📺
          </div>
          <h3 className="font-bold text-sm text-[var(--color-ink)]">Holyrics / Telão</h3>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Sem sinal nos projetores ou letras travadas na tela.
          </p>
          <button
            onClick={() => {
              setCategoria("MIDIA");
              setOpenFaqId("datashow-holyrics");
            }}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline pt-1 block cursor-pointer"
          >
            Ver solução passo a passo →
          </button>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4.5 shadow-xs space-y-2 hover:border-violet-400 transition-all">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold text-sm">
            🎙️
          </div>
          <h3 className="font-bold text-sm text-[var(--color-ink)]">Microfone sem som</h3>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Troca de pilhas e canais de microfone sem fio na mesa de som.
          </p>
          <button
            onClick={() => {
              setCategoria("LOUVOR");
              setOpenFaqId("microfone-sem-som");
            }}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline pt-1 block cursor-pointer"
          >
            Como resolver agora →
          </button>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4.5 shadow-xs space-y-2 hover:border-violet-400 transition-all">
          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center font-bold text-sm">
            📡
          </div>
          <h3 className="font-bold text-sm text-[var(--color-ink)]">Live caiu no OBS</h3>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Queda de streaming no YouTube e checagem de bitrate.
          </p>
          <button
            onClick={() => {
              setCategoria("MIDIA");
              setOpenFaqId("obs-live-caiu");
            }}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline pt-1 block cursor-pointer"
          >
            Guia de contingência →
          </button>
        </div>
      </div>

      {/* Diretório de Plantão: "Quem Procurar" */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-ink)]" style={{ fontFamily: "'Fraunces', serif" }}>
            Quem Procurar no Dia do Culto
          </h2>
          <p className="text-xs text-[var(--color-muted)]">
            Contatos diretos dos coordenadores de plantão para apoio imediato
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {PLANTAO_CONTATOS.map((c, i) => (
            <div
              key={i}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col justify-between space-y-3"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                  {c.cargo}
                </span>
                <p className="font-bold text-sm text-[var(--color-ink)] mt-0.5">{c.responsavel}</p>
                <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">{c.atua}</p>
              </div>

              <a
                href={`https://wa.me/${c.whatsapp}?text=${encodeURIComponent("Olá, estou escalado no culto e preciso de apoio com " + c.cargo)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Chamar no WhatsApp</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Seção de FAQ Pesquisável com Filtros */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-ink)]" style={{ fontFamily: "'Fraunces', serif" }}>
              Perguntas Frequentes & Procedimentos (FAQ)
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              Pesquise qualquer dúvida ou padrão de funcionamento dos ministérios
            </p>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative w-full sm:w-72">
            <svg className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar dúvida, som, projetor..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* Filtros de Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(["TODAS", "GERAL", "MIDIA", "LOUVOR", "DIACONIA"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                categoria === cat
                  ? "bg-[var(--color-primary)] text-white shadow-xs"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {cat === "TODAS" ? "Todas as Categorias" : cat === "GERAL" ? "Geral & Escalas" : cat === "MIDIA" ? "Mídia & TI" : cat === "LOUVOR" ? "Louvor & Som" : "Recepção & Diaconia"}
            </button>
          ))}
        </div>

        {/* Lista de FAQs com Accordion */}
        <div className="space-y-3 pt-2">
          {faqsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-xs text-[var(--color-muted)]">
              Nenhuma resposta encontrada para sua pesquisa. Fale com o plantão acima!
            </div>
          ) : (
            faqsFiltrados.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="font-bold text-sm text-[var(--color-ink)] leading-snug">
                      {faq.pergunta}
                    </span>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-[var(--color-muted)] flex-shrink-0">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4.5 pt-1 border-t border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                      <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
                        {faq.resposta}
                      </p>

                      {faq.passos && faq.passos.length > 0 && (
                        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-3.5 space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] block">
                            Passo a Passo Recomendado:
                          </span>
                          {faq.passos.map((p, idx) => (
                            <p key={idx} className="text-xs text-[var(--color-ink)] font-medium">
                              {p}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
