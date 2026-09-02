import { useState, useEffect, useRef, useCallback } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../store";
import { AVATAR_OPTIONS, Avatar } from "../components/Avatar";
import { ModalPortal } from "../components/ModalPortal";

interface Ministry {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface ApplicationPreference {
  id: string;
  ministry: Ministry;
}

interface Application {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  avatarKey?: string | null;
  instruments: string[];
  availability: Record<string, string[]> | null;
  status: string;
  source: string;
  notes: string | null;
  appliedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  preferences: ApplicationPreference[];
}

interface ApplicationDetail extends Application {
  preferences: (ApplicationPreference & { ministry: Ministry & { roles: { id: string; name: string }[] } })[];
}

interface ApplicationStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  approvedThisMonth: number;
}

export default function TriagemPage() {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("PENDING");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedApp, setSelectedApp] = useState<ApplicationDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [draftAvatarKey, setDraftAvatarKey] = useState<string>("violet");
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<"info" | "notes" | "review">("info");
  const [notes, setNotes] = useState("");
  const [reviewRole, setReviewRole] = useState("VOLUNTEER");
  const [ministryAssignments, setMinistryAssignments] = useState<Array<{
    ministryId: string;
    roles: string[];
    isLeader: boolean;
  }>>([]);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (actionTimer.current) clearTimeout(actionTimer.current); };
  }, []);

  const handleDeleteApplication = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Deseja realmente excluir esta inscrição?")) return;
    try {
      await api(`/applications/${id}`, { method: "DELETE" });
      if (selectedApp?.id === id) {
        setShowModal(false);
        setSelectedApp(null);
      }
      fetchData();
    } catch (err: any) {
      alert(err?.message || "Erro ao excluir inscrição.");
    }
  };

  const handleCleanupTest = async () => {
    if (!window.confirm("Deseja excluir todas as inscrições de teste (como 'Voluntário Teste Nuvem' e e-mails @volutis.local)? Esta ação não pode ser desfeita.")) return;
    try {
      const res = await api<{ success: boolean; message: string }>("/applications/cleanup-test", { method: "POST" });
      alert(res.message);
      fetchData();
    } catch (err: any) {
      alert(err?.message || "Erro ao limpar inscrições de teste.");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [apps, st] = await Promise.all([
        api<Application[]>(`/applications?status=${filter}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`),
        api<ApplicationStats>("/applications/stats"),
      ]);
      setApplications(apps);
      setStats(st);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter, debouncedSearch]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  useEffect(() => {
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);

  const fetchDetail = async (id: string) => {
    try {
      const detail = await api<ApplicationDetail>(`/applications/${id}`);
      setSelectedApp(detail);
      setNotes(detail.notes || "");
      setDraftAvatarKey(detail.avatarKey || "violet");
      setMinistryAssignments(
        detail.preferences.map((p) => ({
          ministryId: p.ministry.id,
          roles: [],
          isLeader: false,
        }))
      );
      setShowModal(true);
      setModalTab("info");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      const result = await api(`/applications/${selectedApp.id}/approve`, {
        method: "POST",
        body: {
          notes,
          role: reviewRole,
          avatarKey: draftAvatarKey,
          ministryAssignments,
        },
      });
      setActionResult({ type: "success", message: "Candidato aprovado com sucesso!" });
      actionTimer.current = setTimeout(() => {
        setShowModal(false);
        setSelectedApp(null);
        setActionResult(null);
        fetchData();
      }, 2000);
    } catch (e: any) {
      setActionResult({ type: "error", message: e.message || "Erro ao aprovar" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      await api(`/applications/${selectedApp.id}/reject`, {
        method: "POST",
        body: { notes },
      });
      setActionResult({ type: "success", message: "Candidato rejeitado" });
      actionTimer.current = setTimeout(() => {
        setShowModal(false);
        setSelectedApp(null);
        setActionResult(null);
        fetchData();
      }, 2000);
    } catch (e: any) {
      setActionResult({ type: "error", message: e.message || "Erro ao rejeitar" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedApp) return;
    try {
      await api(`/applications/${selectedApp.id}/notes`, {
        method: "PUT",
        body: { notes },
      });
      setActionResult({ type: "success", message: "Notas salvas!" });
      actionTimer.current = setTimeout(() => setActionResult(null), 2000);
    } catch (e: any) {
      setActionResult({ type: "error", message: e.message });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return { bg: "#fef3c7", text: "#d97706", label: "Pendente" };
      case "APPROVED": return { bg: "#d1fae5", text: "#059669", label: "Aprovado" };
      case "REJECTED": return { bg: "#fee2e2", text: "#dc2626", label: "Rejeitado" };
      default: return { bg: "#f3f4f6", text: "#6b7280", label: status };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Triagem de Candidatos
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {stats ? `${stats.pending} pendente(s) · ${stats.approved} aprovado(s) este mês` : "Carregando..."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button
              onClick={handleCleanupTest}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors shadow-sm"
              title="Excluir todas as inscrições de teste"
            >
              🧹 Limpar Inscrições de Teste
            </button>
          )}
          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#7c3aed] text-white hover:opacity-90 shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Link da Igreja & QR Code 📲
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#e5e0f8]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-[#1e1b4b]">{stats.pending}</p>
            <p className="text-xs font-medium text-[#7c6ea8] mt-0.5">Pendentes</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#e5e0f8]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-[#1e1b4b]">{stats.approved}</p>
            <p className="text-xs font-medium text-[#7c6ea8] mt-0.5">Aprovados</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#e5e0f8]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-[#1e1b4b]">{stats.rejected}</p>
            <p className="text-xs font-medium text-[#7c6ea8] mt-0.5">Rejeitados</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#e5e0f8]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-100">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-[#1e1b4b]">{stats.approvedThisMonth}</p>
            <p className="text-xs font-medium text-[#7c6ea8] mt-0.5">Aprovados (mês)</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c6ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar candidato..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl bg-white text-[#1e1b4b] placeholder:text-[#7c6ea8] focus:outline-none focus:border-[#a78bfa] transition-colors"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border border-[#e5e0f8] rounded-xl px-3 py-2.5 bg-white text-[#5b5077] focus:outline-none focus:border-[#a78bfa]"
        >
          <option value="ALL">Todos</option>
          <option value="PENDING">Pendentes</option>
          <option value="APPROVED">Aprovados</option>
          <option value="REJECTED">Rejeitados</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500 text-sm">Carregando candidatos...</p>
        </div>
      )}

      {/* Applications List */}
      {!loading && applications.length === 0 && (
        <div className="text-center py-16 text-[#7c6ea8]">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>Nenhum candidato encontrado</p>
        </div>
      )}

      {!loading && applications.length > 0 && (
        <div className="space-y-3">
          {applications.map((app) => {
            const status = getStatusColor(app.status);
            return (
              <button
                key={app.id}
                onClick={() => fetchDetail(app.id)}
                className="w-full bg-white rounded-2xl border border-[#e5e0f8] p-5 text-left hover:shadow-md hover:border-[#c4b5fd] transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <Avatar name={app.name} photoUrl={app.photoUrl} avatarKey={app.avatarKey} size={48} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[#1e1b4b] group-hover:text-[#7c3aed] transition-colors">
                        {app.name}
                      </p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: status.bg, color: status.text }}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-[#7c6ea8]">
                      {app.email && <span>{app.email}</span>}
                      {app.phone && <span>{app.phone}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {app.preferences.map((p) => (
                        <span
                          key={p.id}
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: (p.ministry.color || "#7c3aed") + "15",
                            color: p.ministry.color || "#7c3aed",
                          }}
                        >
                          {p.ministry.icon} {p.ministry.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Date & Arrow & Delete */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-[#7c6ea8]">
                        {new Date(app.appliedAt).toLocaleDateString("pt-BR")}
                      </p>
                      <svg className="w-4 h-4 text-[#c4b5fd] mt-2 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteApplication(app.id, e)}
                        className="w-8 h-8 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 flex items-center justify-center transition-colors ml-2"
                        title="Excluir inscrição"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedApp && (
        <ModalPortal isOpen={showModal && !!selectedApp}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedApp.name} photoUrl={selectedApp.photoUrl} avatarKey={selectedApp.avatarKey || draftAvatarKey} size={48} />
                  <div>
                    <h2 className="text-lg font-bold text-[#1e1b4b]">{selectedApp.name}</h2>
                    <p className="text-sm text-[#7c6ea8]">
                      Candidato desde {new Date(selectedApp.appliedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => setModalTab("info")}
                  className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
                    modalTab === "info" ? "border-purple-500 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Informações
                </button>
                <button
                  onClick={() => setModalTab("notes")}
                  className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
                    modalTab === "notes" ? "border-purple-500 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Notas
                </button>
                {selectedApp.status === "PENDING" && (
                  <button
                    onClick={() => setModalTab("review")}
                    className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
                      modalTab === "review" ? "border-purple-500 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Revisão
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
              {actionResult && (
                <div
                  className={`mb-4 p-3 rounded-xl text-sm ${
                    actionResult.type === "success"
                      ? "bg-green-50 border border-green-200 text-green-700"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}
                >
                  {actionResult.message}
                </div>
              )}

              {modalTab === "info" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">E-mail</p>
                      <p className="text-sm text-gray-800">{selectedApp.email || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">Telefone</p>
                      <p className="text-sm text-gray-800">{selectedApp.phone || "Não informado"}</p>
                    </div>
                  </div>

                  {selectedApp.instruments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Instrumentos</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedApp.instruments.map((inst) => (
                          <span key={inst} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            {inst}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Avatar escolhido</p>
                    <div className="grid grid-cols-3 gap-2">
                      {AVATAR_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setDraftAvatarKey(option);
                            setSelectedApp((current) => current ? { ...current, avatarKey: option } : current);
                          }}
                          className={`rounded-xl border p-2 flex items-center justify-center ${draftAvatarKey === option ? "border-purple-500 bg-purple-50" : "border-gray-200"}`}
                        >
                          <Avatar name={selectedApp.name} photoUrl={selectedApp.photoUrl} avatarKey={option} size={36} />
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">Se houver foto, ela continua aparecendo. O avatar entra como fallback visual.</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Ministérios de interesse</p>
                    <div className="space-y-2">
                      {selectedApp.preferences.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <span className="text-lg">{p.ministry.icon || "⛪"}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{p.ministry.name}</p>
                            {p.ministry.roles && (
                              <p className="text-xs text-gray-500">
                                Funções: {p.ministry.roles.map((r) => r.name).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedApp.availability && Object.keys(selectedApp.availability).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Disponibilidade</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(selectedApp.availability).map(([day, slots]) => (
                          <span key={day} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            {day}: {slots.join(", ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {modalTab === "notes" && (
                <div className="space-y-4">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Adicione notas sobre o candidato..."
                    rows={6}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 resize-none"
                  />
                  <button
                    onClick={handleSaveNotes}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                  >
                    Salvar Notas
                  </button>
                </div>
              )}

              {modalTab === "review" && selectedApp.status === "PENDING" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                      Papel no ministério
                    </label>
                    <select
                      value={reviewRole}
                      onChange={(e) => setReviewRole(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400"
                    >
                      <option value="VOLUNTEER">Membro do Ministério</option>
                      <option value="MEMBER">Membro Geral</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                      Vinculação a ministérios
                    </label>
                    <div className="space-y-2">
                      {selectedApp.preferences.map((p) => {
                        const assignment = ministryAssignments.find((a) => a.ministryId === p.ministry.id);
                        return (
                          <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span>{p.ministry.icon}</span>
                              <span className="text-sm font-medium">{p.ministry.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                             <label className="flex items-center gap-1 text-xs text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={assignment?.isLeader || false}
                                  onChange={(e) => {
                                    setMinistryAssignments((prev) =>
                                      prev.map((a) =>
                                        a.ministryId === p.ministry.id
                                          ? { ...a, isLeader: e.target.checked }
                                          : a
                                      )
                                    );
                                  }}
                                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                Líder
                              </label>
                              {p.ministry.roles && p.ministry.roles.length > 0 && (
                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                  {p.ministry.roles.map((role) => {
                                    const selected = assignment?.roles.includes(role.name) || false;
                                    return (
                                      <button
                                        key={role.id}
                                        type="button"
                                        onClick={() => {
                                          setMinistryAssignments((prev) =>
                                            prev.map((a) =>
                                              a.ministryId === p.ministry.id
                                                ? {
                                                    ...a,
                                                    roles: selected
                                                      ? a.roles.filter((item) => item !== role.name)
                                                      : [...a.roles, role.name],
                                                  }
                                                : a
                                            )
                                          );
                                        }}
                                        className={`px-2 py-1 rounded-full text-[11px] font-semibold ${selected ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
                                      >
                                        {role.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                      Notas da revisão
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Motivo da aprovação..."
                      rows={3}
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDeleteApplication(selectedApp.id)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                >
                  🗑️ Excluir
                </button>
              )}
              {selectedApp.status === "PENDING" && modalTab === "review" && (
                <div className="flex gap-2 flex-1 justify-end">
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Processando..." : "Rejeitar"}
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Processando..." : "Aprovar"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </ModalPortal>
    )}

      {/* Modal de QR Code e Link de Inscrição */}
      {showQrModal && (
        <ModalPortal isOpen={showQrModal}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowQrModal(false)} />
            <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#e5e0f8] space-y-4 my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-y-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#f0eefe] pb-4 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl">
                    📲
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#1e1b4b]">Inscrição de Membros do Ministério</h3>
                    <p className="text-xs text-[#7c6ea8]">Divulgue para a igreja se cadastrar nos ministérios</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* QR Code centralizado */}
              <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#faf8ff] to-[#f5f0ff] rounded-2xl border border-[#ede9fe] text-center">
                <div className="p-3 bg-white rounded-2xl shadow-md border border-[#e5e0f8]">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`${window.location.origin}/cadastro/pibi`)}&color=7c3aed`}
                    alt="QR Code de Inscrição Volutis"
                    className="w-48 h-48 rounded-lg"
                  />
                </div>
                <p className="font-bold text-[#1e1b4b] mt-4 text-sm">Escaneie com a câmera do celular</p>
                <p className="text-xs text-[#7c6ea8] mt-1 max-w-xs">
                  Aponte a câmera para preencher a ficha de membro e escolher os ministérios desejados.
                </p>
              </div>

              {/* Link direto com cópia rápida */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider">
                  Link público de cadastro
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/cadastro/pibi`}
                    className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-[#e5e0f8] rounded-xl text-[#1e1b4b] select-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/cadastro/pibi`);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 ${
                      copiedLink ? "bg-emerald-600 text-white" : "bg-[#7c3aed] text-white hover:opacity-90"
                    }`}
                  >
                    {copiedLink ? "Copiado! ✓" : "Copiar"}
                  </button>
                </div>
              </div>

              {/* Ações e Dicas */}
              <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl text-[11px] text-[#5b5077] leading-relaxed">
                💡 <strong>Dica para os Cultos:</strong> Projete esta imagem no telão nos avisos de domingo ou envie o link nos grupos de WhatsApp da igreja para cadastrar novos membros nos ministérios.
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#f0eefe] flex-shrink-0">
                <a
                  href={`${window.location.origin}/cadastro/pibi`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#7c3aed] hover:underline flex items-center gap-1"
                >
                  Abrir formulário ↗
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(`${window.location.origin}/cadastro/pibi`)}&color=7c3aed`;
                    link.download = "qrcode-voluntarios-igreja.png";
                    link.target = "_blank";
                    link.click();
                  }}
                  className="px-4 py-2 text-xs font-semibold border border-[#c4b5fd] text-[#7c3aed] hover:bg-[#f5f3ff] rounded-xl transition-all"
                >
                  Baixar Imagem do QR Code 📥
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
