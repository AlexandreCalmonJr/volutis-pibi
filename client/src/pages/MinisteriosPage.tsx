import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../store";
import { Avatar } from "../components/Avatar";

interface MemberLite {
  id: string;
  name: string;
  phone?: string | null;
  photoUrl?: string | null;
  avatarKey?: string | null;
  approvalStatus: string;
  ministryMembers?: Array<{ ministryId: string; isLeader: boolean; roles: string[] | string }>;
}

interface MinistryRole {
  id: string;
  name: string;
}

interface MinistryMember {
  memberId: string;
  isLeader: boolean;
  roles: string[];
  member: MemberLite;
}

interface Ministry {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  roles: MinistryRole[];
  members: MinistryMember[];
}

interface TransferRequest {
  id: string;
  status: string;
  mode: "TRANSFER" | "ADD";
  requestedRoles: string[];
  requestedLeader: boolean;
  reason?: string | null;
  createdAt: string;
  rejectionReason?: string | null;
  member: MemberLite;
  fromMinistry?: { id: string; name: string; icon?: string | null } | null;
  toMinistry: { id: string; name: string; icon?: string | null };
}

const COLOR_OPTIONS = ["#7c3aed", "#2563eb", "#059669", "#d97706", "#db2777", "#475569"];

function parseRoles(raw: string[] | string | undefined) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function prettyStatus(status: string) {
  switch (status) {
    case "PENDING_SOURCE_LEADER": return { label: "Aguardando líder de origem", cls: "bg-amber-100 text-amber-800" };
    case "PENDING_TARGET_LEADER": return { label: "Aguardando líder de destino", cls: "bg-sky-100 text-sky-800" };
    case "APPROVED": return { label: "Aprovada", cls: "bg-emerald-100 text-emerald-800" };
    case "REJECTED": return { label: "Rejeitada", cls: "bg-rose-100 text-rose-800" };
    default: return { label: status, cls: "bg-slate-100 text-slate-700" };
  }
}

export default function MinisteriosPage() {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const canManage = user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER";
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [ministryForm, setMinistryForm] = useState({ name: "", icon: "⛪", color: COLOR_OPTIONS[0] });
  const [memberForm, setMemberForm] = useState({ memberId: "", isLeader: false, rolesText: "" });
  const [roleName, setRoleName] = useState("");
  const [transferForm, setTransferForm] = useState({ memberId: "", fromMinistryId: "", toMinistryId: "", mode: "TRANSFER" as "TRANSFER" | "ADD", requestedLeader: false, requestedRolesText: "", reason: "" });

  const selectedMinistry = useMemo(
    () => ministries.find((item) => item.id === selectedMinistryId) ?? ministries[0],
    [ministries, selectedMinistryId]
  );

  async function loadData() {
    setLoading(true);
    try {
      const [ministriesData, membersData, requestsData] = await Promise.all([
        api<Ministry[]>("/ministries"),
        api<MemberLite[]>("/members"),
        canManage ? api<TransferRequest[]>("/transfer-requests") : Promise.resolve([]),
      ]);
      setMinistries(ministriesData);
      setMembers(membersData);
      setRequests(requestsData);
      setSelectedMinistryId((current) => current || ministriesData[0]?.id || "");
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Não foi possível carregar ministérios." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage) loadData();
  }, [canManage]);

  useEffect(() => {
    if (!selectedMinistry && ministries[0]) {
      setSelectedMinistryId(ministries[0].id);
    }
  }, [ministries, selectedMinistry]);

  useEffect(() => {
    if (selectedMinistry) {
      setMinistryForm({ name: selectedMinistry.name, icon: selectedMinistry.icon || "⛪", color: selectedMinistry.color || COLOR_OPTIONS[0] });
    }
  }, [selectedMinistry]);

  if (!canManage) {
    return <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-sm text-[#7c6ea8]">Acesso restrito a administradores e líderes de ministério.</div>;
  }

  async function createOrUpdateMinistry() {
    if (!isAdmin || !ministryForm.name.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      if (selectedMinistry) {
        await api(`/ministries/${selectedMinistry.id}`, { method: "PUT", body: ministryForm });
        setFeedback({ type: "ok", text: "Ministério atualizado com sucesso." });
      } else {
        await api("/ministries", { method: "POST", body: ministryForm });
        setFeedback({ type: "ok", text: "Ministério criado com sucesso." });
      }
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao salvar ministério." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteMinistry() {
    if (!isAdmin || !selectedMinistry) return;
    setSaving(true);
    setFeedback(null);
    try {
      await api(`/ministries/${selectedMinistry.id}`, { method: "DELETE" });
      setSelectedMinistryId("");
      setFeedback({ type: "ok", text: "Ministério removido." });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao excluir ministério." });
    } finally {
      setSaving(false);
    }
  }

  async function addRole() {
    if (!selectedMinistry || !roleName.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await api(`/ministries/${selectedMinistry.id}/roles`, { method: "POST", body: { name: roleName.trim() } });
      setRoleName("");
      setFeedback({ type: "ok", text: "Função adicionada ao ministério." });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao adicionar função." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(roleId: string) {
    if (!selectedMinistry) return;
    setSaving(true);
    setFeedback(null);
    try {
      await api(`/ministries/${selectedMinistry.id}/roles/${roleId}`, { method: "DELETE" });
      setFeedback({ type: "ok", text: "Função removida." });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao remover função." });
    } finally {
      setSaving(false);
    }
  }

  async function saveMemberLink(memberId?: string, opts?: { isLeader?: boolean; roles?: string[] }) {
    if (!selectedMinistry) return;
    const effectiveMemberId = memberId || memberForm.memberId;
    if (!effectiveMemberId) return;
    setSaving(true);
    setFeedback(null);
    try {
      const roles = opts?.roles ?? memberForm.rolesText.split(",").map((item) => item.trim()).filter(Boolean);
      const isLeader = opts?.isLeader ?? memberForm.isLeader;
      await api(`/ministries/${selectedMinistry.id}/members${memberId ? `/${memberId}` : ""}`, {
        method: memberId ? "PATCH" : "POST",
        body: { memberId: effectiveMemberId, isLeader, roles },
      });
      setMemberForm({ memberId: "", isLeader: false, rolesText: "" });
      setFeedback({ type: "ok", text: "Vínculo do membro atualizado." });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao vincular membro." });
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!selectedMinistry) return;
    setSaving(true);
    setFeedback(null);
    try {
      await api(`/ministries/${selectedMinistry.id}/members/${memberId}`, { method: "DELETE" });
      setFeedback({ type: "ok", text: "Membro removido do ministério." });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao remover membro." });
    } finally {
      setSaving(false);
    }
  }

  async function createTransferRequest() {
    if (!isAdmin || !transferForm.memberId || !transferForm.toMinistryId) return;
    setSaving(true);
    setFeedback(null);
    try {
      await api("/transfer-requests", {
        method: "POST",
        body: {
          memberId: transferForm.memberId,
          fromMinistryId: transferForm.fromMinistryId || undefined,
          toMinistryId: transferForm.toMinistryId,
          mode: transferForm.mode,
          requestedLeader: transferForm.requestedLeader,
          requestedRoles: transferForm.requestedRolesText.split(",").map((item) => item.trim()).filter(Boolean),
          reason: transferForm.reason.trim() || undefined,
        },
      });
      setTransferForm({ memberId: "", fromMinistryId: "", toMinistryId: "", mode: "TRANSFER", requestedLeader: false, requestedRolesText: "", reason: "" });
      setFeedback({ type: "ok", text: "Solicitação de transferência criada." });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao criar transferência." });
    } finally {
      setSaving(false);
    }
  }

  async function respondTransferRequest(id: string, action: "APPROVE" | "REJECT") {
    setSaving(true);
    setFeedback(null);
    try {
      await api(`/transfer-requests/${id}/respond`, { method: "POST", body: { action } });
      setFeedback({ type: "ok", text: action === "APPROVE" ? "Solicitação aprovada." : "Solicitação rejeitada." });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao responder solicitação." });
    } finally {
      setSaving(false);
    }
  }

  const availableMembers = members.filter((item) => item.approvalStatus === "ACTIVE");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>Ministérios e Liderança</h1>
          <p className="text-[#5b5077] text-sm mt-1">Administre ministérios, papéis de liderança e transferências com aprovação dos líderes.</p>
        </div>
        <button onClick={loadData} className="px-4 py-2 rounded-xl border border-[#e5e0f8] text-[#7c3aed] text-sm font-semibold hover:bg-[#f5f3ff]">Atualizar</button>
      </div>

      {feedback && <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>{feedback.text}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-10 h-10 rounded-full border-4 border-[#ede9fe] border-t-[#7c3aed] animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6">
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-4">
                <h2 className="text-sm font-bold text-[#1e1b4b] mb-3">Ministérios cadastrados</h2>
                <div className="space-y-2 max-h-[520px] overflow-y-auto">
                  {ministries.map((ministry) => (
                    <button key={ministry.id} onClick={() => setSelectedMinistryId(ministry.id)} className={`w-full text-left rounded-2xl border p-4 transition-all ${selectedMinistry?.id === ministry.id ? "border-[#7c3aed] bg-[#faf5ff]" : "border-[#ede9fe] hover:border-[#c4b5fd]"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${ministry.color || "#7c3aed"}20`, color: ministry.color || "#7c3aed" }}>{ministry.icon || "⛪"}</div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#1e1b4b] truncate">{ministry.name}</p>
                            <p className="text-xs text-[#7c6ea8]">{ministry.roles.length} função(ões) · {ministry.members.length} membro(s)</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <div className="bg-white rounded-2xl border border-[#e5e0f8] p-4 space-y-3">
                  <h2 className="text-sm font-bold text-[#1e1b4b]">Nova solicitação de transferência</h2>
                  <select value={transferForm.memberId} onChange={(e) => setTransferForm((prev) => ({ ...prev, memberId: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm">
                    <option value="">Selecione o membro</option>
                    {availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={transferForm.fromMinistryId} onChange={(e) => setTransferForm((prev) => ({ ...prev, fromMinistryId: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm">
                      <option value="">Sem origem</option>
                      {ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
                    </select>
                    <select value={transferForm.toMinistryId} onChange={(e) => setTransferForm((prev) => ({ ...prev, toMinistryId: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm">
                      <option value="">Selecione o destino</option>
                      {ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={transferForm.mode} onChange={(e) => setTransferForm((prev) => ({ ...prev, mode: e.target.value as "TRANSFER" | "ADD" }))} className="w-full px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm">
                      <option value="TRANSFER">Transferir</option>
                      <option value="ADD">Adicionar sem remover</option>
                    </select>
                    <input value={transferForm.requestedRolesText} onChange={(e) => setTransferForm((prev) => ({ ...prev, requestedRolesText: e.target.value }))} placeholder="Funções alvo (vírgula)" className="w-full px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[#5b5077]"><input type="checkbox" checked={transferForm.requestedLeader} onChange={(e) => setTransferForm((prev) => ({ ...prev, requestedLeader: e.target.checked }))} /> Tornar líder no destino</label>
                  <textarea value={transferForm.reason} onChange={(e) => setTransferForm((prev) => ({ ...prev, reason: e.target.value }))} rows={3} placeholder="Motivo da transferência" className="w-full px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm resize-none" />
                  <button onClick={createTransferRequest} disabled={saving} className="w-full px-4 py-3 rounded-xl bg-[#7c3aed] text-white text-sm font-semibold disabled:opacity-50">Criar solicitação</button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#1e1b4b]">{selectedMinistry?.name || "Selecione um ministério"}</h2>
                    <p className="text-sm text-[#7c6ea8]">Configure líderes, funções e membros de cada equipe.</p>
                  </div>
                  {selectedMinistry && <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ backgroundColor: `${selectedMinistry.color || "#7c3aed"}20`, color: selectedMinistry.color || "#7c3aed" }}>{selectedMinistry.icon || "⛪"}</div>}
                </div>

                {isAdmin && (
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_140px] gap-3 items-end">
                    <input value={ministryForm.name} onChange={(e) => setMinistryForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nome do ministério" className="px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm" />
                    <input value={ministryForm.icon} onChange={(e) => setMinistryForm((prev) => ({ ...prev, icon: e.target.value }))} placeholder="Ícone" className="px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm" />
                    <select value={ministryForm.color} onChange={(e) => setMinistryForm((prev) => ({ ...prev, color: e.target.value }))} className="px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm">
                      {COLOR_OPTIONS.map((color) => <option key={color} value={color}>{color}</option>)}
                    </select>
                    <div className="md:col-span-3 flex gap-2">
                      <button onClick={createOrUpdateMinistry} disabled={saving} className="px-4 py-2.5 rounded-xl bg-[#7c3aed] text-white text-sm font-semibold disabled:opacity-50">{selectedMinistry ? "Salvar ministério" : "Criar ministério"}</button>
                      <button onClick={() => { setSelectedMinistryId(""); setMinistryForm({ name: "", icon: "⛪", color: COLOR_OPTIONS[0] }); }} className="px-4 py-2.5 rounded-xl border border-[#e5e0f8] text-[#5b5077] text-sm font-semibold">Novo</button>
                      {selectedMinistry && <button onClick={deleteMinistry} disabled={saving} className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50">Excluir</button>}
                    </div>
                  </div>
                )}

                {selectedMinistry && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-3 gap-3">
                        <h3 className="text-sm font-bold text-[#1e1b4b]">Funções do ministério</h3>
                        <div className="flex gap-2">
                          <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Nova função" className="px-3 py-2 rounded-xl border border-[#e5e0f8] text-sm" />
                          <button onClick={addRole} disabled={saving} className="px-3 py-2 rounded-xl bg-[#1e1b4b] text-white text-sm font-semibold disabled:opacity-50">Adicionar</button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedMinistry.roles.map((role) => (
                          <div key={role.id} className="inline-flex items-center gap-2 rounded-full border border-[#e5e0f8] bg-[#faf8ff] px-3 py-1.5 text-sm text-[#5b5077]">
                            <span>{role.name}</span>
                            <button onClick={() => deleteRole(role.id)} className="text-red-500">×</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-[#1e1b4b] mb-3">Adicionar membro</h3>
                        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_140px] gap-3 items-center">
                          <select value={memberForm.memberId} onChange={(e) => setMemberForm((prev) => ({ ...prev, memberId: e.target.value }))} className="px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm">
                            <option value="">Selecione um membro ativo</option>
                            {availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                          </select>
                          <label className="flex items-center gap-2 text-sm text-[#5b5077]"><input type="checkbox" checked={memberForm.isLeader} onChange={(e) => setMemberForm((prev) => ({ ...prev, isLeader: e.target.checked }))} /> Líder</label>
                          <input value={memberForm.rolesText} onChange={(e) => setMemberForm((prev) => ({ ...prev, rolesText: e.target.value }))} placeholder="Funções (vírgula)" className="px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm" />
                          <button onClick={() => saveMemberLink()} disabled={saving} className="px-4 py-2.5 rounded-xl bg-[#7c3aed] text-white text-sm font-semibold disabled:opacity-50">Vincular</button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {selectedMinistry.members.map((link) => (
                          <div key={link.memberId} className="rounded-2xl border border-[#ede9fe] p-4 bg-[#fcfbff]">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar name={link.member.name} photoUrl={link.member.photoUrl} avatarKey={link.member.avatarKey} size={44} />
                                <div className="min-w-0">
                                  <p className="font-semibold text-[#1e1b4b] truncate">{link.member.name}</p>
                                  <p className="text-xs text-[#7c6ea8] truncate">{link.member.phone || "Sem telefone"}</p>
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2 lg:items-center">
                                <label className="flex items-center gap-2 text-sm text-[#5b5077]"><input type="checkbox" checked={link.isLeader} onChange={(e) => saveMemberLink(link.memberId, { isLeader: e.target.checked, roles: link.roles })} /> Liderança</label>
                                <input defaultValue={link.roles.join(", ")} onBlur={(e) => saveMemberLink(link.memberId, { isLeader: link.isLeader, roles: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} className="px-3 py-2 rounded-xl border border-[#e5e0f8] text-sm min-w-[220px]" />
                                <button onClick={() => removeMember(link.memberId)} className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold">Remover</button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {selectedMinistry.members.length === 0 && <p className="text-sm text-[#7c6ea8]">Nenhum membro vinculado a este ministério.</p>}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-[#1e1b4b]">Transferências e aprovações</h2>
                  <p className="text-sm text-[#7c6ea8]">Acompanhe solicitações e aprove conforme a liderança de origem e destino.</p>
                </div>
                <div className="space-y-3">
                  {requests.map((request) => {
                    const status = prettyStatus(request.status);
                    return (
                      <div key={request.id} className="rounded-2xl border border-[#ede9fe] p-4 bg-[#fcfbff]">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Avatar name={request.member.name} photoUrl={request.member.photoUrl} avatarKey={request.member.avatarKey} size={40} />
                              <div>
                                <p className="font-semibold text-[#1e1b4b]">{request.member.name}</p>
                                <p className="text-xs text-[#7c6ea8]">{request.mode === "TRANSFER" ? "Transferência" : "Adição"} · {new Date(request.createdAt).toLocaleDateString("pt-BR")}</p>
                              </div>
                            </div>
                            <p className="text-sm text-[#5b5077]">{request.fromMinistry?.name || "Sem origem"} → {request.toMinistry.name}</p>
                            {request.requestedRoles.length > 0 && <p className="text-xs text-[#7c6ea8]">Funções alvo: {request.requestedRoles.join(", ")}</p>}
                            {request.reason && <p className="text-xs text-[#7c6ea8]">Motivo: {request.reason}</p>}
                            {request.rejectionReason && <p className="text-xs text-red-500">Rejeição: {request.rejectionReason}</p>}
                          </div>
                          <div className="flex flex-col gap-2 items-start lg:items-end">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${status.cls}`}>{status.label}</span>
                            {request.status !== "APPROVED" && request.status !== "REJECTED" && (
                              <div className="flex gap-2">
                                <button onClick={() => respondTransferRequest(request.id, "APPROVE")} disabled={saving} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">Aprovar</button>
                                <button onClick={() => respondTransferRequest(request.id, "REJECT")} disabled={saving} className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold disabled:opacity-50">Rejeitar</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {requests.length === 0 && <p className="text-sm text-[#7c6ea8]">Nenhuma solicitação de transferência encontrada.</p>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
