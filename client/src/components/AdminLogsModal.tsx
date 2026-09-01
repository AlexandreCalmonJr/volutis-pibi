import { useState, useEffect } from "react";
import { api } from "../api";

interface AuditLog {
  id: string;
  action: string;
  category: string;
  details?: string | null;
  actorName: string;
  actorRole?: string | null;
  createdAt: string;
}

interface MemberPushStatus {
  id: string;
  name: string;
  email: string | null;
  pushDevices: number;
}

export function AdminLogsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"audit" | "devices">("devices");
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [membersPush, setMembersPush] = useState<MemberPushStatus[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  async function loadData() {
    setLoading(true);
    try {
      const [auditRes, pushRes] = await Promise.all([
        api<{ logs: AuditLog[] }>("/admin/audit-logs").catch(() => ({ logs: [] })),
        api<{ members: MemberPushStatus[] }>("/admin/members-push").catch(() => ({ members: [] })),
      ]);
      setAuditLogs(auditRes.logs || []);
      setMembersPush(pushRes.members || []);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const filteredMembers = membersPush.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredAudit = auditLogs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actorName.toLowerCase().includes(search.toLowerCase()) ||
      (l.details || "").toLowerCase().includes(search.toLowerCase())
  );

  const registeredCount = membersPush.filter((m) => m.pushDevices > 0).length;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5 sm:p-6 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center text-lg shadow-md shadow-violet-500/20">
              📊
            </span>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-[var(--color-ink)]">
                Central de Logs & Dispositivos (Admin)
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Acompanhe status de notificações, aparelhos cadastrados e ações do sistema
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-ink)] flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tabs & Search */}
        <div className="p-4 sm:px-6 bg-[var(--color-surface-2)] border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-fit">
            <button
              onClick={() => setActiveTab("devices")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "devices"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              📱 Dispositivos / Push ({registeredCount}/{membersPush.length})
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "audit"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              🛡️ Auditoria ({auditLogs.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nome, email ou ação..."
              className="px-3.5 py-1.5 text-xs rounded-xl border border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] text-[var(--color-ink)] focus:outline-none focus:border-violet-600 w-full sm:w-56"
            />
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-white transition-all cursor-pointer"
              title="Atualizar logs"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-[var(--color-muted)] space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-violet-600 border-t-transparent animate-spin mx-auto" />
              <p>Carregando registros do servidor...</p>
            </div>
          ) : activeTab === "devices" ? (
            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-violet-50/70 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900 text-xs text-violet-800 dark:text-violet-300 flex items-center justify-between flex-wrap gap-2">
                <span>
                  💡 <strong>{registeredCount}</strong> de <strong>{membersPush.length}</strong> voluntários ativos já ativaram notificações no celular.
                </span>
              </div>

              {filteredMembers.length === 0 ? (
                <p className="text-center py-8 text-xs text-[var(--color-muted)]">
                  Nenhum membro encontrado.
                </p>
              ) : (
                <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-2xl overflow-hidden bg-white dark:bg-[var(--color-surface)]">
                  {filteredMembers.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--color-ink)] truncate">
                          {m.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-muted)] truncate">
                          {m.email || "Sem e-mail vinculado"}
                        </p>
                      </div>

                      <div className="flex-shrink-0">
                        {m.pushDevices > 0 ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1 shadow-sm">
                            <span>📲</span> {m.pushDevices} aparelho(s)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-[11px] font-semibold inline-flex items-center gap-1">
                            <span>⚠️</span> Sem celular cadastrado
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAudit.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--color-muted)] space-y-1">
                  <p className="text-2xl">📋</p>
                  <p className="font-semibold">Nenhum log de auditoria recente registrado.</p>
                  <p className="text-[11px]">Ações críticas de líderes e administradores aparecerão aqui.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAudit.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl border border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-[10px] font-bold uppercase tracking-wider">
                          {log.action}
                        </span>
                        <span className="text-[11px] text-[var(--color-muted)] font-medium">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-ink)] font-medium">
                        Por: <span className="font-bold">{log.actorName}</span> ({log.actorRole || "Admin"})
                      </p>
                      {log.details && (
                        <pre className="p-2 rounded-xl bg-[var(--color-surface-2)] text-[10px] font-mono text-[var(--color-text-secondary)] overflow-x-auto">
                          {log.details}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-all cursor-pointer shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
