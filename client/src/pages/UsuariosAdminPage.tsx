import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../store";
import { Avatar } from "../components/Avatar";

interface MinistryOption {
  id: string;
  name: string;
}

interface AdminUser {
  id: string;
  email: string;
  phone?: string | null;
  role: "ADMIN" | "MINISTRY_LEADER" | "VOLUNTEER" | "MEMBER";
  createdAt: string;
  member: null | {
    id: string;
    name: string;
    phone?: string | null;
    photoUrl?: string | null;
    avatarKey?: string | null;
    approvalStatus: string;
    instruments: string[];
    ministryMembers: Array<{ ministryId: string; isLeader: boolean; roles: string[]; ministry?: { name: string } }>;
  };
}

const AVATAR_OPTIONS = ["violet", "blue", "emerald", "amber", "rose", "slate"] as const;

function normalizeAssignments(user: AdminUser | null) {
  return user?.member?.ministryMembers.map((item) => ({
    ministryId: item.ministryId,
    isLeader: item.isLeader,
    rolesText: item.roles.join(", "),
  })) ?? [];
}

export default function UsuariosAdminPage() {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [ministries, setMinistries] = useState<MinistryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "VOLUNTEER" as AdminUser["role"],
    photoUrl: "",
    avatarKey: "violet",
    instrumentsText: "",
    approvalStatus: "ACTIVE",
  });
  const [assignments, setAssignments] = useState<Array<{ ministryId: string; isLeader: boolean; rolesText: string }>>([]);

  const selectedUser = useMemo(() => users.find((item) => item.id === selectedUserId) ?? null, [users, selectedUserId]);

  async function loadData() {
    setLoading(true);
    try {
      const [userData, ministriesData] = await Promise.all([
        api<AdminUser[]>("/admin/users"),
        api<MinistryOption[]>("/ministries"),
      ]);
      setUsers(userData);
      setMinistries(ministriesData.map((item: any) => ({ id: item.id, name: item.name })));
      setSelectedUserId((current) => current || userData[0]?.id || "");
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Não foi possível carregar usuários." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedUser) {
      setForm({ email: "", password: "", name: "", phone: "", role: "VOLUNTEER", photoUrl: "", avatarKey: "violet", instrumentsText: "", approvalStatus: "ACTIVE" });
      setAssignments([]);
      return;
    }
    setForm({
      email: selectedUser.email,
      password: "",
      name: selectedUser.member?.name ?? "",
      phone: selectedUser.member?.phone ?? selectedUser.phone ?? "",
      role: selectedUser.role,
      photoUrl: selectedUser.member?.photoUrl ?? "",
      avatarKey: selectedUser.member?.avatarKey ?? "violet",
      instrumentsText: (selectedUser.member?.instruments ?? []).join(", "),
      approvalStatus: selectedUser.member?.approvalStatus ?? "ACTIVE",
    });
    setAssignments(normalizeAssignments(selectedUser));
  }, [selectedUserId, selectedUser]);

  if (!isAdmin) return <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-sm text-[#7c6ea8]">Acesso restrito ao administrador.</div>;

  function resetForCreate() {
    setSelectedUserId("");
    setForm({ email: "", password: "", name: "", phone: "", role: "VOLUNTEER", photoUrl: "", avatarKey: "violet", instrumentsText: "", approvalStatus: "ACTIVE" });
    setAssignments([]);
    setFeedback(null);
  }

  function addAssignment() {
    setAssignments((prev) => [...prev, { ministryId: ministries[0]?.id || "", isLeader: false, rolesText: "" }]);
  }

  async function saveUser() {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        email: form.email.trim(),
        ...(form.password ? { password: form.password } : {}),
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        photoUrl: form.photoUrl.trim() || undefined,
        avatarKey: form.avatarKey,
        instruments: form.instrumentsText.split(",").map((item) => item.trim()).filter(Boolean),
        approvalStatus: form.approvalStatus,
        ministryAssignments: assignments.filter((item) => item.ministryId).map((item) => ({
          ministryId: item.ministryId,
          isLeader: item.isLeader,
          roles: item.rolesText.split(",").map((role) => role.trim()).filter(Boolean),
        })),
      };

      if (selectedUserId) {
        await api(`/admin/users/${selectedUserId}`, { method: "PUT", body: payload });
        setFeedback({ type: "ok", text: "Usuário atualizado com sucesso." });
      } else {
        if (!form.password) throw new Error("Defina uma senha para o novo usuário.");
        await api("/admin/users", { method: "POST", body: payload });
        setFeedback({ type: "ok", text: "Usuário criado com sucesso." });
      }
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Não foi possível salvar o usuário." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    if (!selectedUserId) return;
    setSaving(true);
    setFeedback(null);
    try {
      await api(`/admin/users/${selectedUserId}`, { method: "DELETE" });
      setFeedback({ type: "ok", text: "Usuário removido." });
      await loadData();
      resetForCreate();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Não foi possível remover o usuário." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>Usuários e acessos</h1>
          <p className="text-[#5b5077] text-sm mt-1">Crie usuários diretamente, ajuste papéis e relacione ministérios sem depender só de convite.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="px-4 py-2 rounded-xl border border-[#e5e0f8] text-[#7c3aed] text-sm font-semibold">Atualizar</button>
          <button onClick={resetForCreate} className="px-4 py-2 rounded-xl bg-[#7c3aed] text-white text-sm font-semibold">Novo usuário</button>
        </div>
      </div>

      {feedback && <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>{feedback.text}</div>}

      {loading ? <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-[#ede9fe] border-t-[#7c3aed] rounded-full animate-spin" /></div> : (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-4 space-y-2 max-h-[700px] overflow-y-auto">
            {users.map((item) => (
              <button key={item.id} onClick={() => setSelectedUserId(item.id)} className={`w-full text-left rounded-2xl border p-4 ${selectedUserId === item.id ? "border-[#7c3aed] bg-[#faf5ff]" : "border-[#ede9fe]"}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={item.member?.name || item.email} photoUrl={item.member?.photoUrl} avatarKey={item.member?.avatarKey} size={40} />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1e1b4b] truncate">{item.member?.name || item.email}</p>
                    <p className="text-xs text-[#7c6ea8] truncate">{item.email}</p>
                    <p className="text-[11px] text-[#7c6ea8]">{item.role} · {item.member?.approvalStatus || "SEM_MEMBRO"}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nome completo" className="px-4 py-2.5 rounded-xl border border-[#e5e0f8] text-sm" />
              <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="E-mail" className="px-4 py-2.5 rounded-xl border border-[#e5e0f8] text-sm" />
              <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Telefone" className="px-4 py-2.5 rounded-xl border border-[#e5e0f8] text-sm" />
              <input value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder={selectedUserId ? "Nova senha (opcional)" : "Senha inicial"} className="px-4 py-2.5 rounded-xl border border-[#e5e0f8] text-sm" />
              <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as AdminUser["role"] }))} className="px-4 py-2.5 rounded-xl border border-[#e5e0f8] text-sm">
                <option value="ADMIN">ADMIN</option><option value="MINISTRY_LEADER">MINISTRY_LEADER</option><option value="VOLUNTEER">VOLUNTEER</option><option value="MEMBER">MEMBER</option>
              </select>
              <select value={form.approvalStatus} onChange={(e) => setForm((prev) => ({ ...prev, approvalStatus: e.target.value }))} className="px-4 py-2.5 rounded-xl border border-[#e5e0f8] text-sm">
                <option value="ACTIVE">ACTIVE</option><option value="PENDING">PENDING</option><option value="INACTIVE">INACTIVE</option>
              </select>
              <input value={form.photoUrl} onChange={(e) => setForm((prev) => ({ ...prev, photoUrl: e.target.value }))} placeholder="Foto (URL)" className="px-4 py-2.5 rounded-xl border border-[#e5e0f8] text-sm md:col-span-2" />
              <select value={form.avatarKey} onChange={(e) => setForm((prev) => ({ ...prev, avatarKey: e.target.value }))} className="px-4 py-2.5 rounded-xl border border-[#e5e0f8] text-sm">
                {AVATAR_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input value={form.instrumentsText} onChange={(e) => setForm((prev) => ({ ...prev, instrumentsText: e.target.value }))} placeholder="Instrumentos / habilidades (vírgula)" className="px-4 py-2.5 rounded-xl border border-[#e5e0f8] text-sm" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-[#1e1b4b]">Vínculos ministeriais</h2>
                <button onClick={addAssignment} className="text-sm font-semibold text-[#7c3aed]">+ Adicionar</button>
              </div>
              {assignments.length === 0 && <p className="text-sm text-[#7c6ea8]">Nenhum ministério vinculado.</p>}
              {assignments.map((assignment, idx) => (
                <div key={`${assignment.ministryId}-${idx}`} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_40px] gap-3 items-center rounded-2xl border border-[#ede9fe] p-4">
                  <select value={assignment.ministryId} onChange={(e) => setAssignments((prev) => prev.map((item, i) => i === idx ? { ...item, ministryId: e.target.value } : item))} className="px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm">
                    <option value="">Selecione o ministério</option>
                    {ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-[#5b5077]"><input type="checkbox" checked={assignment.isLeader} onChange={(e) => setAssignments((prev) => prev.map((item, i) => i === idx ? { ...item, isLeader: e.target.checked } : item))} /> Líder</label>
                  <input value={assignment.rolesText} onChange={(e) => setAssignments((prev) => prev.map((item, i) => i === idx ? { ...item, rolesText: e.target.value } : item))} placeholder="Funções (vírgula)" className="px-3 py-2.5 rounded-xl border border-[#e5e0f8] text-sm" />
                  <button onClick={() => setAssignments((prev) => prev.filter((_, i) => i !== idx))} className="text-red-500 text-lg">×</button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={saveUser} disabled={saving} className="px-5 py-3 rounded-xl bg-[#7c3aed] text-white text-sm font-semibold disabled:opacity-50">{saving ? "Salvando..." : selectedUserId ? "Salvar alterações" : "Criar usuário"}</button>
              {selectedUserId && <button onClick={deleteUser} disabled={saving} className="px-5 py-3 rounded-xl border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50">Excluir usuário</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
