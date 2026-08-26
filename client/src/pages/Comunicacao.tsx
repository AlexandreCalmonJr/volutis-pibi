import { useState } from "react";
import { notificacoes } from "../data/mockData";
import { MINISTERIO_COLORS, MINISTERIOS } from "../lib/constants";

const mensagensExtras: Record<string, { autor: string; texto: string; horario: string; minha?: boolean }[]> = {
  Louvor: [
    { autor: "Ana Paula Costa", texto: "Pessoal, vamos confirmar a presença no ensaio de sexta?", horario: "10:32" },
    { autor: "João Victor Mendes", texto: "Eu confirmo! Já deixei na agenda.", horario: "10:45" },
    { autor: "Você", texto: "Ótimo! Ensaio às 19h30 no templo.", horario: "10:50", minha: true },
    { autor: "Ana Paula Costa", texto: "Perfeito! Vou levar o novo repertório.", horario: "10:52" },
    { autor: "João Victor Mendes", texto: "Alguém sabe o tom de 'Oceanos'? Quero afinar antes.", horario: "11:00" },
    { autor: "Ana Paula Costa", texto: "É em Lá maior (A)! 🎵", horario: "11:01" },
  ],
  Mídia: [
    { autor: "Carlos Eduardo Silva", texto: "O sistema de som foi atualizado. Novo setup disponível.", horario: "09:15" },
    { autor: "Lucas Pereira", texto: "Vi sim! Ficou muito melhor. As monitoras estão mais equilibradas.", horario: "09:22" },
    { autor: "Você", texto: "Ótimo trabalho pessoal! Ficou excelente.", horario: "09:30", minha: true },
    { autor: "Rafael Oliveira", texto: "Tenho uma dúvida sobre os slides — qual template usar no domingo?", horario: "09:45" },
  ],
  Recepção: [
    { autor: "Beatriz Fernandes", texto: "Precisamos de mais 2 recepcionistas para o domingo de manhã!", horario: "08:50" },
    { autor: "Você", texto: "Vou verificar quem está disponível e escalamos. Pode deixar!", horario: "09:00", minha: true },
  ],
  Jovens: [
    { autor: "Isabela Rocha", texto: "Lembrete: reunião de líderes na quarta às 19h antes do culto.", horario: "11:00" },
    { autor: "Você", texto: "Confirmado! Estarei lá.", horario: "11:05", minha: true },
  ],
};

export default function Comunicacao() {
  const [ministerioAtivo, setMinisterioAtivo] = useState("Louvor");
  const [aba, setAba] = useState<"chat" | "notificacoes" | "whatsapp">("chat");
  const [novaMensagem, setNovaMensagem] = useState("");

  const conversaAtual = mensagensExtras[ministerioAtivo] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Comunicação
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            Chats por ministério · Notificações · WhatsApp
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1 w-fit">
        {(["chat", "notificacoes", "whatsapp"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === a ? "text-white" : "text-[#7c6ea8] hover:bg-gray-50"}`}
            style={aba === a ? { backgroundColor: "#7c3aed" } : {}}
          >
            {a === "chat" ? "Chats" : a === "notificacoes" ? "Notificações" : "WhatsApp"}
          </button>
        ))}
      </div>

      {/* Chat */}
      {aba === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
          {/* Ministry list */}
          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[#f0eefe]">
              <p className="text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Ministérios</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#f0eefe]">
              {MINISTERIOS.map((m) => {
                const color = MINISTERIO_COLORS[m]?.text || "#7c3aed";
                const ativo = ministerioAtivo === m;
                const naoLidas = m === "Recepção" ? 1 : m === "Jovens" ? 1 : 0;
                return (
                  <button
                    key={m}
                    onClick={() => setMinisterioAtivo(m)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${ativo ? "bg-[#f5f3ff]" : "hover:bg-gray-50"}`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {m[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${ativo ? "text-[#7c3aed]" : "text-[#1e1b4b]"}`}>
                        {m}
                      </p>
                      <p className="text-xs text-[#7c6ea8] truncate">
                        {mensagensExtras[m]?.[mensagensExtras[m].length - 1]?.texto?.slice(0, 30) || "Sem mensagens"}...
                      </p>
                    </div>
                    {naoLidas > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#7c3aed] text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                        {naoLidas}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat window */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden flex flex-col">
            {/* Chat header */}
            <div className="px-6 py-4 border-b border-[#f0eefe] flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: MINISTERIO_COLORS[ministerioAtivo]?.text || "#7c3aed" }}
              >
                {ministerioAtivo[0]}
              </div>
              <div>
                <p className="font-semibold text-[#1e1b4b]">Ministério de {ministerioAtivo}</p>
                <p className="text-xs text-[#7c6ea8]">{conversaAtual.length} mensagens</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {conversaAtual.map((msg, i) => {
                const isMinha = msg.minha;
                const initials = msg.autor.split(" ").slice(0, 2).map((n) => n[0]).join("");
                return (
                  <div key={i} className={`flex gap-3 ${isMinha ? "flex-row-reverse" : ""}`}>
                    {!isMinha && (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: MINISTERIO_COLORS[ministerioAtivo]?.text || "#7c3aed" }}
                      >
                        {initials}
                      </div>
                    )}
                    <div className={`max-w-sm ${isMinha ? "items-end" : "items-start"} flex flex-col`}>
                      {!isMinha && (
                        <p className="text-xs font-medium text-[#5b5077] mb-1">{msg.autor}</p>
                      )}
                      <div
                        className="px-4 py-2.5 rounded-2xl text-sm"
                        style={isMinha
                          ? { backgroundColor: "#7c3aed", color: "white", borderBottomRightRadius: "4px" }
                          : { backgroundColor: "#f5f3ff", color: "#1e1b4b", borderBottomLeftRadius: "4px" }
                        }
                      >
                        {msg.texto}
                      </div>
                      <p className="text-xs text-[#7c6ea8] mt-1">{msg.horario}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-[#f0eefe]">
              <div className="flex gap-3">
                <input
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novaMensagem.trim()) setNovaMensagem("");
                  }}
                  placeholder={`Mensagem para ${ministerioAtivo}...`}
                  className="flex-1 px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa] transition-colors"
                />
                <button
                  className="px-4 py-2.5 rounded-xl text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notificações */}
      {aba === "notificacoes" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Enviadas hoje", value: "23", icon: "#10b981", bg: "#d1fae5" },
              { label: "Aguardando resposta", value: "8", icon: "#f59e0b", bg: "#fef3c7" },
              { label: "Taxa de confirmação", value: "78%", icon: "#7c3aed", bg: "#ede9fe" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-[#e5e0f8] p-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: s.bg }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={s.icon} strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-[#1e1b4b]">{s.value}</p>
                <p className="text-xs text-[#7c6ea8]">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0eefe] flex items-center justify-between">
              <h2 className="font-semibold text-[#1e1b4b]">Log de Notificações</h2>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90" style={{ backgroundColor: "#7c3aed" }}>
                + Enviar Aviso
              </button>
            </div>
            <div className="divide-y divide-[#f0eefe]">
              {notificacoes.map((n) => {
                const statusConf = {
                  enviado: { bg: "#d1fae5", text: "#059669", label: "Enviado" },
                  aguardando: { bg: "#fef3c7", text: "#d97706", label: "Aguardando" },
                  pendente: { bg: "#fee2e2", text: "#dc2626", label: "Pendente" },
                };
                const s = statusConf[n.status as keyof typeof statusConf];
                return (
                  <div key={n.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#fafafe] transition-colors">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#ede9fe" }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#1e1b4b]">{n.descricao}</p>
                      <p className="text-xs text-[#7c6ea8]">{n.horario}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp */}
      {aba === "whatsapp" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#dcfce7" }}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#16a34a">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-[#1e1b4b]">Integração WhatsApp</h3>
                  <p className="text-xs text-green-600 font-medium">● Conectado</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[#f5f3ff] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#1e1b4b]">Lembretes automáticos</p>
                    <p className="text-xs text-[#7c6ea8]">1 dia antes do serviço</p>
                  </div>
                  <div className="w-10 h-6 rounded-full relative" style={{ backgroundColor: "#7c3aed" }}>
                    <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow" />
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#f5f3ff] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#1e1b4b]">Consulta de disponibilidade</p>
                    <p className="text-xs text-[#7c6ea8]">Mensal, no dia 25</p>
                  </div>
                  <div className="w-10 h-6 rounded-full relative" style={{ backgroundColor: "#7c3aed" }}>
                    <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow" />
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#f5f3ff] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#1e1b4b]">Confirmação de escala</p>
                    <p className="text-xs text-[#7c6ea8]">Ao gerar nova escala</p>
                  </div>
                  <div className="w-10 h-6 rounded-full relative" style={{ backgroundColor: "#7c3aed" }}>
                    <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
              <h3 className="font-semibold text-[#1e1b4b] mb-4">Enviar Mensagem</h3>
              <div className="space-y-3">
                <select className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#5b5077] bg-white focus:outline-none focus:border-[#a78bfa]">
                  <option>Todos os voluntários ativos</option>
                  {MINISTERIOS.map((m) => <option key={m}>{m}</option>)}
                </select>
                <textarea
                  rows={3}
                  placeholder="Digite a mensagem para enviar via WhatsApp..."
                  className="w-full px-4 py-3 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa] resize-none"
                />
                <button className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity" style={{ backgroundColor: "#16a34a" }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Enviar via WhatsApp
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
            <h3 className="font-semibold text-[#1e1b4b] mb-4">Histórico de Envios</h3>
            <div className="space-y-3">
              {[
                { para: "Todos os voluntários", msg: "Lembrete: Culto Domingo Manhã às 09h. Confirme sua presença.", time: "Ontem, 10:00", lidas: "41/47" },
                { para: "Ministério de Louvor", msg: "Escala de Setembro disponível. Acesse o app para ver seus dias.", time: "25 Ago, 14:30", lidas: "6/6" },
                { para: "Todos os voluntários", msg: "Consulta de disponibilidade para Setembro. Por favor responda até dia 30.", time: "25 Ago, 09:00", lidas: "38/47" },
                { para: "Ministério de Mídia", msg: "Novo equipamento chegou. Reunião de treinamento na quinta.", time: "22 Ago, 11:15", lidas: "4/4" },
              ].map((h, i) => (
                <div key={i} className="border border-[#f0eefe] rounded-xl p-4 hover:bg-[#fafafe] transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-[#7c3aed]">{h.para}</p>
                    <span className="text-xs text-[#7c6ea8] whitespace-nowrap">{h.time}</span>
                  </div>
                  <p className="text-sm text-[#1e1b4b] leading-relaxed">{h.msg}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-[#7c6ea8]">{h.lidas} leram</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
