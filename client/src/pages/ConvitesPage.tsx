import { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../store";
import { useInvites, type InviteAPI } from "../hooks/useAdminData";
import { ModalPortal } from "../components/ModalPortal";

interface MinistryOption {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Membro Geral", description: "Acesso básico ao app e cultos", color: "#6b7280" },
  { value: "VOLUNTEER", label: "Membro do Ministério", description: "Participa das escalas do ministério", color: "#7c3aed" },
  { value: "MINISTRY_LEADER", label: "Líder de Ministério", description: "Gerencia membros do ministério", color: "#f59e0b" },
];

export default function ConvitesPage() {
  const user = useAuth((s) => s.user);
  const { data: invites, loading, error, refetch } = useInvites();
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedRole, setSelectedRole] = useState("VOLUNTEER");
  const [selectedMinistryId, setSelectedMinistryId] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [createdInvite, setCreatedInvite] = useState<InviteAPI | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [ministries, setMinistries] = useState<MinistryOption[]>([]);

  const isAdmin = user?.role === "ADMIN";

  // Buscar ministérios disponíveis
  useEffect(() => {
    api<MinistryOption[]>("/invites/ministries")
      .then(setMinistries)
      .catch(() => {});
  }, []);

  // Se líder (não-admin), selecionar automaticamente o ministério
  useEffect(() => {
    if (!isAdmin && ministries.length === 1) {
      setSelectedMinistryId(ministries[0].id);
    }
  }, [isAdmin, ministries]);

  const handleCreate = async () => {
    setActionError("");
    setCreating(true);
    try {
      const result = await api<InviteAPI>("/invites", {
        method: "POST",
        body: {
          role: selectedRole,
          inviteeName: inviteeName.trim() || undefined,
          ministryId: selectedMinistryId || undefined,
        },
      });
      setCreatedInvite(result);
      refetch();
    } catch (e: any) {
      setActionError(e.message || "Erro ao criar convite");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este convite?")) return;
    try {
      await api(`/invites/${id}`, { method: "DELETE" });
      refetch();
    } catch (e: any) {
      alert(e.message || "Erro ao excluir convite");
    }
  };

  const copyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getRoleConfig = (role: string) => {
    return ROLE_OPTIONS.find((r) => r.value === role) || ROLE_OPTIONS[1];
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();
  const isUsed = (usedAt: string | null) => !!usedAt;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Convites
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {invites ? `${invites.filter((i) => !isUsed(i.usedAt) && !isExpired(i.expiresAt)).length} ativo(s)` : "Carregando..."}
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setCreatedInvite(null); setInviteeName(""); setSelectedRole("VOLUNTEER"); setSelectedMinistryId(!isAdmin && ministries.length === 1 ? ministries[0].id : ""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "#7c3aed" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Convite
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500 text-sm">Carregando convites...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && invites && invites.length === 0 && (
        <div className="text-center py-16 text-[#7c6ea8]">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p>Nenhum convite criado</p>
          <p className="text-sm mt-1">Clique em "Novo Convite" para começar</p>
        </div>
      )}

      {/* Invites List */}
      {!loading && invites && invites.length > 0 && (
        <div className="space-y-3">
          {invites.map((invite) => {
            const role = getRoleConfig(invite.role);
            const expired = isExpired(invite.expiresAt);
            const used = isUsed(invite.usedAt);
            const active = !expired && !used;

            return (
              <div
                key={invite.id}
                className={`bg-white rounded-2xl border p-5 transition-all ${
                  active ? "border-[#e5e0f8] hover:shadow-md" : "border-gray-200 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-lg font-bold text-[#1e1b4b]">{invite.code}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: role.color + "15", color: role.color }}
                      >
                        {role.label}
                      </span>
                      {invite.ministry && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: (invite.ministry.color || "#7c3aed") + "15", color: invite.ministry.color || "#7c3aed" }}
                        >
                          {invite.ministry.icon} {invite.ministry.name}
                        </span>
                      )}
                      {used && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">
                          Usado
                        </span>
                      )}
                      {expired && !used && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">
                          Expirado
                        </span>
                      )}
                      {active && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">
                          Ativo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm text-[#7c6ea8]">
                      {invite.createdByName && <span>Por: {invite.createdByName}</span>}
                      <span>
                        Expira: {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
                      </span>
                      {invite.usedByEmail && <span>Usado por: {invite.usedByEmail}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {active && invite.registerUrl && (
                      <>
                        <button
                          onClick={() => copyLink(invite.registerUrl!, invite.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#e5e0f8] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors"
                          title="Copiar link"
                        >
                          {copiedId === invite.id ? "✓ Copiado" : "Copiar Link"}
                        </button>
                        <a
                          href={invite.whatsappShare}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors"
                        >
                          WhatsApp
                        </a>
                      </>
                    )}
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      title="Excluir convite"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <ModalPortal isOpen={showModal}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-y-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h2 className="text-lg font-bold text-[#1e1b4b]">Novo Convite</h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{actionError}</div>
            )}

            {createdInvite ? (
              /* Success State */
              <div className="space-y-4">
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="font-semibold text-green-800">Convite criado!</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Código</p>
                  <p className="font-mono text-2xl font-bold text-[#1e1b4b]">{createdInvite.code}</p>
                </div>

                {createdInvite.ministry && (
                  <div className="p-4 bg-gray-50 rounded-xl flex items-center gap-2">
                    <span className="text-lg">{createdInvite.ministry.icon}</span>
                    <span className="text-sm font-medium text-gray-700">Ministério: {createdInvite.ministry.name}</span>
                  </div>
                )}

                {createdInvite.registerUrl && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Link de registro</p>
                    <p className="text-sm text-[#7c3aed] break-all">{createdInvite.registerUrl}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => copyLink(createdInvite.registerUrl || "", "modal")}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors"
                  >
                    {copiedId === "modal" ? "✓ Copiado!" : "Copiar Link"}
                  </button>
                  <a
                    href={createdInvite.whatsappShare}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors text-center"
                  >
                    Enviar WhatsApp
                  </a>
                </div>

                <button
                  onClick={() => { setShowModal(false); setCreatedInvite(null); }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              /* Create Form */
              <div className="space-y-4">
                {/* Ministry Selector */}
                {ministries.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Ministério
                    </label>
                    {isAdmin && ministries.length > 1 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {ministries.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedMinistryId(m.id)}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              selectedMinistryId === m.id
                                ? "border-purple-500 bg-purple-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{m.icon || "⛪"}</span>
                              <span className="text-sm font-medium text-gray-700">{m.name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-2">
                        <span className="text-lg">{ministries[0]?.icon || "⛪"}</span>
                        <span className="text-sm font-medium text-gray-700">{ministries[0]?.name}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Papel do convidado
                  </label>
                  <div className="space-y-2">
                    {ROLE_OPTIONS.map((role) => {
                      const disabled = role.value === "MINISTRY_LEADER" && !isAdmin;
                      return (
                        <button
                          key={role.value}
                          onClick={() => !disabled && setSelectedRole(role.value)}
                          disabled={disabled}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                            disabled
                              ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                              : selectedRole === role.value
                                ? "border-purple-500 bg-purple-50"
                                : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: role.color }}
                            />
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{role.label}</p>
                              <p className="text-xs text-gray-500">{role.description}</p>
                            </div>
                            {disabled && (
                              <span className="ml-auto text-xs text-gray-400">Apenas ADMIN</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nome do convidado (opcional)
                  </label>
                  <input
                    type="text"
                    value={inviteeName}
                    onChange={(e) => setInviteeName(e.target.value)}
                    placeholder="Nome para referência"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                  />
                </div>

                <button
                  onClick={handleCreate}
                  disabled={creating || (!isAdmin && ministries.length === 0)}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Criando...
                    </>
                  ) : (
                    "Criar Convite"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </ModalPortal>
    )}
    </div>
  );
}
