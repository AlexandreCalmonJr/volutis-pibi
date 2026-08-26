import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../store";
import { useInvites, type InviteAPI } from "../hooks/useAdminData";

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Membro", description: "Acesso básico ao app", color: "#6b7280" },
  { value: "VOLUNTEER", label: "Voluntário", description: "Pode participar de escalas", color: "#7c3aed" },
  { value: "MINISTRY_LEADER", label: "Líder de Ministério", description: "Gerencia membros do ministério", color: "#f59e0b" },
];

export default function ConvitesPage() {
  const user = useAuth((s) => s.user);
  const { data: invites, loading, error, refetch } = useInvites();
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedRole, setSelectedRole] = useState("VOLUNTEER");
  const [inviteeName, setInviteeName] = useState("");
  const [createdInvite, setCreatedInvite] = useState<InviteAPI | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState("");

  const isAdmin = user?.role === "ADMIN";

  const handleCreate = async () => {
    setActionError("");
    setCreating(true);
    try {
      const result = await api<InviteAPI>("/invites", {
        method: "POST",
        body: { role: selectedRole, inviteeName: inviteeName.trim() || undefined },
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
    if (!confirm("Tem certeza que deseja revogar este convite?")) return;
    try {
      await api(`/invites/${id}`, { method: "DELETE" });
      refetch();
    } catch (e: any) {
      alert(e.message || "Erro ao revogar convite");
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          onClick={() => { setShowModal(true); setCreatedInvite(null); setInviteeName(""); setSelectedRole("VOLUNTEER"); }}
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
                          onClick={() => copyLink(invite.registerUrl!)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#e5e0f8] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors"
                          title="Copiar link"
                        >
                          {copied ? "✓ Copiado" : "Copiar Link"}
                        </button>
                        <a
                          href={invite.whatsappShare}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors"
                        >
                          WhatsApp
                        </a>
                        {isAdmin && (
                          <button
                            onClick={() => handleRevoke(invite.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                          >
                            Revogar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
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

                {createdInvite.registerUrl && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Link de registro</p>
                    <p className="text-sm text-[#7c3aed] break-all">{createdInvite.registerUrl}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => copyLink(createdInvite.registerUrl || "")}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors"
                  >
                    {copied ? "✓ Copiado!" : "Copiar Link"}
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
                  disabled={creating}
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
      )}
    </div>
  );
}
