import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { MINISTERIO_COLORS, MINISTERIOS } from "../lib/constants";
import { Avatar } from "../components/Avatar";

interface Ministry {
  id: number;
  name: string;
  icon: string;
  color: string;
}

interface MinistryMember {
  ministry: Ministry;
  isLeader: boolean;
  roles: string;
}

interface Member {
  id: number;
  name: string;
  phone: string;
  photoUrl: string;
  avatarKey?: string | null;
  instruments: string[];
  birthDate: string;
  approvalStatus: "ACTIVE" | "PENDING" | "INACTIVE";
  points: number;
  ministryMembers: MinistryMember[];
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  ativo: { bg: "#d1fae5", text: "#059669", label: "Ativo" },
  pendente: { bg: "#fef3c7", text: "#d97706", label: "Pendente" },
  inativo: { bg: "#f3f4f6", text: "#6b7280", label: "Inativo" },
};

function mapStatus(s: string): "ativo" | "pendente" | "inativo" {
  if (s === "ACTIVE") return "ativo";
  if (s === "PENDING") return "pendente";
  return "inativo";
}

function getMinistryName(m: Member): string {
  return m.ministryMembers[0]?.ministry?.name ?? "Sem ministério";
}

function getMinistryColorFor(name: string): string {
  return MINISTERIO_COLORS[name]?.text || "#7c3aed";
}

interface ProfileModalProps {
  member: Member;
  loading: boolean;
  feedback: { type: "ok" | "error"; text: string } | null;
  onApprove: (member: Member) => void;
  onDeactivate: (member: Member) => void;
  onClose: () => void;
}

function ProfileModal({ member, loading, feedback, onApprove, onDeactivate, onClose }: ProfileModalProps) {
  const mapped = mapStatus(member.approvalStatus);
  const s = statusConfig[mapped];
  const ministryName = getMinistryName(member);
  const color = getMinistryColorFor(ministryName);
  const roles = member.ministryMembers[0]?.roles;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center" style={{ backgroundColor: color + "10" }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <Avatar name={member.name} photoUrl={member.photoUrl} avatarKey={member.avatarKey} size={64} className="mx-auto mb-3" />
          <h2 className="text-lg font-bold text-[#1e1b4b]">{member.name}</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-sm" style={{ color }}>{ministryName}</span>
            <span className="text-gray-300">·</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: s.bg, color: s.text }}
            >
              {s.label}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {feedback && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {feedback.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center bg-[#f5f3ff] rounded-xl p-3">
              <p className="text-xl font-bold text-[#1e1b4b]">{member.points ?? 0}</p>
              <p className="text-xs text-[#7c6ea8]">Pontos</p>
            </div>
            <div className="text-center bg-[#f5f3ff] rounded-xl p-3">
              <p className="text-xl font-bold text-[#1e1b4b]">
                {member.ministryMembers.length}
              </p>
              <p className="text-xs text-[#7c6ea8]">Ministérios</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {member.phone && (
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-[#7c6ea8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-sm text-[#1e1b4b]">{member.phone}</span>
              </div>
            )}
            {member.birthDate && (
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-[#7c6ea8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-[#1e1b4b]">
                  Nascimento: {new Date(member.birthDate).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
          </div>

          {member.instruments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-2">Instrumentos</p>
              <div className="flex flex-wrap gap-1.5">
                {member.instruments.map((inst) => (
                  <span key={inst} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: color + "15", color }}>
                    {inst}
                  </span>
                ))}
              </div>
            </div>
          )}

          {roles && (
            <div>
              <p className="text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-2">Funções</p>
              <div className="flex flex-wrap gap-1.5">
                {roles.split(",").map((r) => (
                  <span key={r} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: color + "15", color }}>
                    {r.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {member.approvalStatus === "PENDING" && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onApprove(member)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#10b981" }}
              >
                {loading ? "Processando..." : "Aprovar Voluntário"}
              </button>
              <button
                onClick={() => onDeactivate(member)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Marcar Inativo
              </button>
            </div>
          )}

          {member.approvalStatus === "ACTIVE" && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onDeactivate(member)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {loading ? "Processando..." : "Desativar membro"}
              </button>
            </div>
          )}

          {member.approvalStatus === "INACTIVE" && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onApprove(member)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#7c3aed" }}
              >
                {loading ? "Processando..." : "Reativar membro"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Voluntarios() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [filtroMinisterio, setFiltroMinisterio] = useState("Todos");
  const [memberSelecionado, setMemberSelecionado] = useState<Member | null>(null);
  const [visualizacao, setVisualizacao] = useState<"grid" | "lista">("grid");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function carregarMembros() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Member[]>("/members");
      setMembers(data);
    } catch (e: any) {
      setError(e.message ?? "Erro ao carregar membros do ministério");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarMembros();
  }, []);

  async function updateMemberStatus(member: Member, approvalStatus: "ACTIVE" | "INACTIVE") {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const updated = await api<Member>(`/members/${member.id}/status`, {
        method: "PATCH",
        body: { approvalStatus },
      });
      setMembers((current) => current.map((item) => (item.id === member.id ? updated : item)));
      setMemberSelecionado(updated);
      setActionFeedback({
        type: "ok",
        text: approvalStatus === "ACTIVE" ? "Membro aprovado/reativado com sucesso." : "Membro marcado como inativo.",
      });
    } catch (e: any) {
      setActionFeedback({ type: "error", text: e.message ?? "Não foi possível atualizar o membro." });
    } finally {
      setActionLoading(false);
    }
  }

  const filtrados = members.filter((m) => {
    const ministryName = getMinistryName(m);
    const mapped = mapStatus(m.approvalStatus);
    const matchBusca = m.name.toLowerCase().includes(busca.toLowerCase()) ||
      ministryName.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "Todos" || mapped === filtroStatus.toLowerCase();
    const matchMinisterio = filtroMinisterio === "Todos" || ministryName === filtroMinisterio;
    return matchBusca && matchStatus && matchMinisterio;
  });

  const pendentes = members.filter((m) => m.approvalStatus === "PENDING");
  const ativos = members.filter((m) => m.approvalStatus === "ACTIVE");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin w-8 h-8 border-2 border-[#e5e0f8] border-t-[#7c3aed] rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-32 text-[#7c6ea8]">
        <p className="text-sm font-medium text-red-500 mb-2">{error}</p>
        <button onClick={() => window.location.reload()} className="text-xs text-[#7c3aed] hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Membros do Ministério
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {ativos.length} ativos · {pendentes.length} aguardando aprovação
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => carregarMembros()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#7c6ea8] hover:bg-[#f5f3ff]"
          >
            Atualizar lista
          </button>
          <button
            onClick={() => navigate("/convites")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#7c3aed] hover:bg-[#f5f3ff]"
          >
            Gerar convite
          </button>
        </div>
      </div>

      {pendentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-amber-800">
                {pendentes.length} membro(s) aguardando aprovação
              </span>
            </div>
            <button
              onClick={() => setFiltroStatus("Pendente")}
              className="text-xs text-amber-700 font-semibold hover:underline"
            >
              Ver todos
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c6ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar membro do ministério..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl bg-white text-[#1e1b4b] placeholder:text-[#7c6ea8] focus:outline-none focus:border-[#a78bfa] transition-colors"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="text-sm border border-[#e5e0f8] rounded-xl px-3 py-2.5 bg-white text-[#5b5077] focus:outline-none focus:border-[#a78bfa]"
        >
          <option>Todos</option>
          <option>Ativo</option>
          <option>Pendente</option>
          <option>Inativo</option>
        </select>
        <select
          value={filtroMinisterio}
          onChange={(e) => setFiltroMinisterio(e.target.value)}
          className="text-sm border border-[#e5e0f8] rounded-xl px-3 py-2.5 bg-white text-[#5b5077] focus:outline-none focus:border-[#a78bfa]"
        >
          <option>Todos</option>
          {MINISTERIOS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1">
          <button
            onClick={() => setVisualizacao("grid")}
            className={`px-3 py-1.5 rounded-lg transition-all ${visualizacao === "grid" ? "bg-[#f5f3ff] text-[#7c3aed]" : "text-[#7c6ea8] hover:bg-gray-50"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setVisualizacao("lista")}
            className={`px-3 py-1.5 rounded-lg transition-all ${visualizacao === "lista" ? "bg-[#f5f3ff] text-[#7c3aed]" : "text-[#7c6ea8] hover:bg-gray-50"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {visualizacao === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((m) => {
            const s = statusConfig[mapStatus(m.approvalStatus)];
            const ministryName = getMinistryName(m);
            const color = getMinistryColorFor(ministryName);
            return (
              <button
                key={m.id}
                onClick={() => setMemberSelecionado(m)}
                className="bg-white rounded-2xl border border-[#e5e0f8] p-5 text-left hover:shadow-md hover:border-[#c4b5fd] transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <Avatar name={m.name} photoUrl={m.photoUrl} avatarKey={m.avatarKey} size={44} />
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: s.bg, color: s.text }}
                  >
                    {s.label}
                  </span>
                </div>
                <p className="font-semibold text-[#1e1b4b] group-hover:text-[#7c3aed] transition-colors">{m.name}</p>
                <p className="text-xs text-[#7c6ea8] mt-0.5">{ministryName}{m.ministryMembers[0]?.isLeader ? " (Líder)" : ""}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-[#7c6ea8]">
                  <span>{m.points ?? 0} pontos</span>
                  {m.instruments.length > 0 && <span>{m.instruments.join(", ")}</span>}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
          <div className="divide-y divide-[#f0eefe]">
            {filtrados.map((m) => {
              const s = statusConfig[mapStatus(m.approvalStatus)];
              const ministryName = getMinistryName(m);
              const color = getMinistryColorFor(ministryName);
              return (
                <button
                  key={m.id}
                  onClick={() => setMemberSelecionado(m)}
                  className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-[#fafafe] transition-colors text-left"
                >
                  <Avatar name={m.name} photoUrl={m.photoUrl} avatarKey={m.avatarKey} size={36} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1e1b4b] text-sm">{m.name}</p>
                    <p className="text-xs text-[#7c6ea8]">{ministryName}{m.ministryMembers[0]?.isLeader ? " (Líder)" : ""}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4">
                    <span className="text-xs text-[#7c6ea8]">{m.points ?? 0} pontos</span>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{ backgroundColor: s.bg, color: s.text }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-[#c4b5fd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filtrados.length === 0 && (
        <div className="text-center py-16 text-[#7c6ea8]">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
          </svg>
          <p>Nenhum membro encontrado</p>
        </div>
      )}

      {memberSelecionado && (
        <ProfileModal
          member={memberSelecionado}
          loading={actionLoading}
          feedback={actionFeedback}
          onApprove={(member) => updateMemberStatus(member, "ACTIVE")}
          onDeactivate={(member) => updateMemberStatus(member, "INACTIVE")}
          onClose={() => setMemberSelecionado(null)}
        />
      )}
    </div>
  );
}
