import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store";
import { api } from "../api";
import { Avatar } from "../components/Avatar";
import { ModalPortal } from "../components/ModalPortal";

interface HelpdeskContact {
  id: string;
  name: string;
  phone?: string | null;
  photoUrl?: string | null;
  bannerUrl?: string | null;
  avatarKey?: string | null;
  helpdeskRole?: string | null;
  ministryMembers?: Array<{ ministry: { name: string } }>;
}

interface MemberOption {
  id: string;
  name: string;
  phone?: string | null;
  photoUrl?: string | null;
  avatarKey?: string | null;
}

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
  const user = useAuth((s) => s.user);
  const canManageFaq = user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER";

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<"TODAS" | "GERAL" | "MIDIA" | "LOUVOR" | "DIACONIA">("TODAS");
  const [openFaqId, setOpenFaqId] = useState<string | null>("troca-escala");

  const [faqsList, setFaqsList] = useState<FAQItem[]>(() => {
    try {
      const saved = localStorage.getItem("volut_custom_faqs");
      if (saved) {
        const parsed = JSON.parse(saved);
        return [...parsed, ...FAQS];
      }
    } catch {}
    return FAQS;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [newPergunta, setNewPergunta] = useState("");
  const [newResposta, setNewResposta] = useState("");
  const [newCategoria, setNewCategoria] = useState<"GERAL" | "MIDIA" | "LOUVOR" | "DIACONIA">("GERAL");
  const [newPassosText, setNewPassosText] = useState("");

  // Contatos de Plantão & Delegação
  const [contacts, setContacts] = useState<HelpdeskContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [delegatesModalOpen, setDelegatesModalOpen] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<MemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [editDelegates, setEditDelegates] = useState<Array<{ memberId: string; name: string; helpdeskRole: string; phone?: string | null; photoUrl?: string | null; avatarKey?: string | null }>>([]);
  const [newDelegateMemberId, setNewDelegateMemberId] = useState("");
  const [newDelegateRole, setNewDelegateRole] = useState("");
  const [savingDelegates, setSavingDelegates] = useState(false);
  const [delegatesFeedback, setDelegatesFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      setLoadingContacts(true);
      const data = await api<HelpdeskContact[]>("/helpdesk/contacts");
      setContacts(data || []);
    } catch (err) {
      console.error("Erro ao carregar contatos do plantão:", err);
    } finally {
      setLoadingContacts(false);
    }
  }

  async function openDelegatesModal() {
    setDelegatesFeedback(null);
    setNewDelegateMemberId("");
    setNewDelegateRole("");
    setEditDelegates(
      contacts.map((c) => ({
        memberId: c.id,
        name: c.name,
        helpdeskRole: c.helpdeskRole || "Suporte Geral",
        phone: c.phone,
        photoUrl: c.photoUrl,
        avatarKey: c.avatarKey,
      }))
    );
    setDelegatesModalOpen(true);

    if (availableMembers.length === 0) {
      try {
        setLoadingMembers(true);
        const members = await api<MemberOption[]>("/members");
        setAvailableMembers(members || []);
      } catch (err) {
        console.error("Erro ao carregar lista de membros:", err);
      } finally {
        setLoadingMembers(false);
      }
    }
  }

  function handleAddDelegate() {
    if (!newDelegateMemberId || !newDelegateRole.trim()) return;
    const member = availableMembers.find((m) => m.id === newDelegateMemberId);
    if (!member) return;

    const exists = editDelegates.some((d) => d.memberId === member.id);
    if (exists) {
      setEditDelegates((prev) =>
        prev.map((d) => (d.memberId === member.id ? { ...d, helpdeskRole: newDelegateRole.trim() } : d))
      );
    } else {
      setEditDelegates((prev) => [
        ...prev,
        {
          memberId: member.id,
          name: member.name,
          helpdeskRole: newDelegateRole.trim(),
          phone: member.phone,
          photoUrl: member.photoUrl,
          avatarKey: member.avatarKey,
        },
      ]);
    }
    setNewDelegateMemberId("");
    setNewDelegateRole("");
  }

  function handleRemoveDelegate(memberId: string) {
    setEditDelegates((prev) => prev.filter((d) => d.memberId !== memberId));
  }

  async function handleSaveDelegates(e: React.FormEvent) {
    e.preventDefault();
    setSavingDelegates(true);
    setDelegatesFeedback(null);
    try {
      const payload = {
        delegates: editDelegates.map((d) => ({
          memberId: d.memberId,
          helpdeskRole: d.helpdeskRole,
        })),
      };
      const res = await api<{ success: boolean; message: string; contacts: HelpdeskContact[] }>("/helpdesk/delegates", {
        method: "PUT",
        body: payload,
      });
      setContacts(res.contacts || []);
      setDelegatesFeedback({ type: "ok", text: res.message || "Responsáveis atualizados com sucesso!" });
      setTimeout(() => {
        setDelegatesModalOpen(false);
      }, 1000);
    } catch (err: any) {
      setDelegatesFeedback({ type: "error", text: err?.message || "Não foi possível salvar os responsáveis." });
    } finally {
      setSavingDelegates(false);
    }
  }

  function handleSaveFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!newPergunta.trim() || !newResposta.trim()) return;
    const item: FAQItem = {
      id: "custom-" + Date.now(),
      categoria: newCategoria,
      pergunta: newPergunta.trim(),
      resposta: newResposta.trim(),
      passos: newPassosText
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
    };
    const updated = [item, ...faqsList];
    setFaqsList(updated);
    const customOnly = updated.filter((f) => f.id.startsWith("custom-"));
    localStorage.setItem("volut_custom_faqs", JSON.stringify(customOnly));
    setModalOpen(false);
    setNewPergunta("");
    setNewResposta("");
    setNewPassosText("");
    setOpenFaqId(item.id);
  }

  function handleDeleteFaq(id: string) {
    if (!confirm("Deseja remover esta orientação cadastrada?")) return;
    const updated = faqsList.filter((f) => f.id !== id);
    setFaqsList(updated);
    const customOnly = updated.filter((f) => f.id.startsWith("custom-"));
    localStorage.setItem("volut_custom_faqs", JSON.stringify(customOnly));
  }

  const faqsFiltrados = useMemo(() => {
    return faqsList.filter((item) => {
      const matchCat = categoria === "TODAS" || item.categoria === categoria;
      const matchBusca =
        !busca.trim() ||
        item.pergunta.toLowerCase().includes(busca.toLowerCase()) ||
        item.resposta.toLowerCase().includes(busca.toLowerCase()) ||
        (item.passos && item.passos.some((p) => p.toLowerCase().includes(busca.toLowerCase())));
      return matchCat && matchBusca;
    });
  }, [busca, categoria, faqsList]);

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
          {canManageFaq && (
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              style={{ backgroundColor: "#7c3aed" }}
            >
              + Adicionar FAQ
            </button>
          )}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-ink)]" style={{ fontFamily: "'Fraunces', serif" }}>
              Quem Procurar no Dia do Culto
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              Contatos diretos dos coordenadores e responsáveis delegados de plantão para apoio imediato
            </p>
          </div>
          {user?.role === "ADMIN" && (
            <button
              onClick={openDelegatesModal}
              className="px-3.5 py-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 text-xs font-semibold hover:bg-violet-100 dark:hover:bg-violet-900/60 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
            >
              <span>⚙️</span>
              <span>Delegar Responsáveis</span>
            </button>
          )}
        </div>

        {loadingContacts ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-7 h-7 border-2 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full" />
          </div>
        ) : contacts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {contacts.map((c) => {
              const cleanPhone = c.phone ? c.phone.replace(/\D/g, "") : "";
              const fullPhone = cleanPhone.length > 0 ? (cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`) : "";
              const ministriesStr = c.ministryMembers?.map((m) => m.ministry.name).join(", ");

              return (
                <div
                  key={c.id}
                  className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-violet-300 dark:hover:border-violet-700 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} photoUrl={c.photoUrl} avatarKey={c.avatarKey} size={40} />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] block truncate">
                          {c.helpdeskRole || "Plantão de Apoio"}
                        </span>
                        <p className="font-bold text-sm text-[var(--color-ink)] truncate">{c.name}</p>
                      </div>
                    </div>
                    {ministriesStr && (
                      <p className="text-[11px] text-[var(--color-muted)] leading-tight">
                        Ministérios: <span className="text-[var(--color-ink)] font-medium">{ministriesStr}</span>
                      </p>
                    )}
                  </div>

                  {fullPhone ? (
                    <a
                      href={`https://wa.me/${fullPhone}?text=${encodeURIComponent(
                        `Olá ${c.name}, estou escalado no culto e preciso de apoio com ${c.helpdeskRole || "Central de Ajuda"}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>Chamar no WhatsApp</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  ) : (
                    <div className="w-full py-1.5 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-[var(--color-muted)] text-[11px] text-center font-medium">
                      Telefone não informado
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
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
        )}
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
        <div className="flex flex-wrap items-center gap-1.5">
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

                      {canManageFaq && faq.id.startsWith("custom-") && (
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleDeleteFaq(faq.id)}
                            className="text-xs font-semibold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            Excluir esta orientação
                          </button>
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

      {/* Modal Adicionar FAQ */}
      {modalOpen && (
        <ModalPortal isOpen={modalOpen}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={() => setModalOpen(false)} />
            <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <h3 className="font-bold text-base sm:text-lg text-[var(--color-ink)]" style={{ fontFamily: "'Fraunces', serif" }}>
                  Adicionar Orientação / FAQ
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-muted)] flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveFaq} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Categoria
                  </label>
                  <select
                    value={newCategoria}
                    onChange={(e: any) => setNewCategoria(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="GERAL">Geral & Escalas</option>
                    <option value="MIDIA">Mídia & TI</option>
                    <option value="LOUVOR">Louvor & Som</option>
                    <option value="DIACONIA">Recepção & Diaconia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Pergunta / Dúvida Operacional
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Como ligar o ar-condicionado do templo?"
                    value={newPergunta}
                    onChange={(e) => setNewPergunta(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Resposta Explicativa
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Explique a solução de forma clara para os voluntários..."
                    value={newResposta}
                    onChange={(e) => setNewResposta(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Passos Recomendados (Opcional - 1 por linha)
                  </label>
                  <textarea
                    rows={3}
                    placeholder={"1. Vá até o quadro geral...\n2. Ligue a chave 4...\n3. Acione o controle remoto..."}
                    value={newPassosText}
                    onChange={(e) => setNewPassosText(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-sm hover:opacity-90 transition-all cursor-pointer"
                    style={{ backgroundColor: "#7c3aed" }}
                  >
                    Salvar FAQ
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal de Delegação de Responsáveis de Plantão (Apenas ADMIN) */}
      {delegatesModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                    Administração da Central
                  </span>
                  <h3 className="text-lg font-bold text-[var(--color-ink)] mt-0.5" style={{ fontFamily: "'Fraunces', serif" }}>
                    Delegar Responsáveis de Plantão
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Escolha os membros que darão suporte e plantão no dia do culto.
                  </p>
                </div>
                <button
                  onClick={() => setDelegatesModalOpen(false)}
                  className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {delegatesFeedback && (
                <div
                  className={`rounded-xl border p-3 text-xs font-medium ${
                    delegatesFeedback.type === "ok"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                      : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200"
                  }`}
                >
                  {delegatesFeedback.text}
                </div>
              )}

              {/* Lista dos responsáveis já definidos */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                  Equipe de Suporte Atual ({editDelegates.length})
                </label>

                {editDelegates.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] text-center text-xs text-[var(--color-muted)]">
                    Nenhum membro delegado ainda. Adicione abaixo para ativar o plantão dinâmico!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {editDelegates.map((item) => (
                      <div
                        key={item.memberId}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Avatar name={item.name} photoUrl={item.photoUrl} avatarKey={item.avatarKey as any} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[var(--color-ink)] truncate">{item.name}</p>
                            <input
                              type="text"
                              value={item.helpdeskRole}
                              onChange={(e) =>
                                setEditDelegates((prev) =>
                                  prev.map((d) => (d.memberId === item.memberId ? { ...d, helpdeskRole: e.target.value } : d))
                                )
                              }
                              placeholder="Cargo/Área de suporte"
                              className="mt-1 w-full text-[11px] font-semibold text-[var(--color-primary)] bg-transparent border-b border-dashed border-violet-300 dark:border-violet-700 focus:outline-none focus:border-violet-500 pb-0.5"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDelegate(item.memberId)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                          title="Remover do plantão"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Adicionar novo responsável */}
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3.5">
                <span className="text-xs font-bold text-[var(--color-ink)] block">
                  + Adicionar Membro ao Plantão
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-muted)] mb-1">
                      Membro da Igreja
                    </label>
                    <select
                      value={newDelegateMemberId}
                      onChange={(e) => setNewDelegateMemberId(e.target.value)}
                      disabled={loadingMembers}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                    >
                      <option value="">
                        {loadingMembers ? "Carregando membros..." : "-- Selecione um membro cadastrado --"}
                      </option>
                      {availableMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.phone ? `(${m.phone})` : "(sem telefone)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-muted)] mb-1">
                      Função no Plantão
                    </label>
                    <input
                      type="text"
                      value={newDelegateRole}
                      onChange={(e) => setNewDelegateRole(e.target.value)}
                      placeholder="Ex: Suporte de TI & Telão, Coordenação de Mídia..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)]"
                    />

                    {/* Sugestões rápidas de cargo */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        "Suporte de TI & Telão",
                        "Coordenação de Mídia & Live",
                        "Sonorização & Louvor",
                        "Diaconia & Portaria",
                      ].map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setNewDelegateRole(sug)}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-surface-2)] hover:bg-violet-100 dark:hover:bg-violet-950/60 text-[var(--color-muted)] hover:text-violet-700 transition-colors cursor-pointer border border-[var(--color-border)]"
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddDelegate}
                    disabled={!newDelegateMemberId || !newDelegateRole.trim()}
                    className="w-full py-2 px-3 rounded-xl bg-violet-100 dark:bg-violet-950/60 hover:bg-violet-200 text-violet-700 dark:text-violet-300 font-semibold text-xs transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    + Incluir na Lista
                  </button>
                </div>
              </div>

              {/* Rodapé de Ações */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setDelegatesModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDelegates}
                  disabled={savingDelegates}
                  className="px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  {savingDelegates ? "Salvando..." : "Salvar Responsáveis"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
