import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../store";
import { AVATAR_OPTIONS, Avatar, getInitials } from "../components/Avatar";

interface MinistryLink {
  id: string;
  isLeader: boolean;
  roles: string[] | string;
  ministry: { id: string; name: string; color?: string | null; icon?: string | null };
}

interface BadgeItem {
  id: string;
  name: string;
  icon?: string | null;
  earnedAt: string;
}

interface UnavailabilityItem {
  id: string;
  date: string;
  reason?: string | null;
  recurring: boolean;
}

interface ProfileData {
  id: string;
  name: string;
  phone?: string | null;
  photoUrl?: string | null;
  avatarKey?: string | null;
  instruments: string[];
  birthDate?: string | null;
  points: number;
  ministryMembers: MinistryLink[];
  badges: BadgeItem[];
  unavailabilities: UnavailabilityItem[];
}

interface MyScheduleResponse {
  items: Array<{
    id: string;
    status: string;
    roleName: string;
    checkin?: { id: string; checkedInAt: string; method: string } | null;
    event: { id: string; title: string; date: string; startTime: string };
  }>;
  swapInvites?: Array<{
    id: string;
    scheduleItem: {
      id: string;
      roleName: string;
      member: { name: string };
      event: { title: string; startTime: string };
    };
  }>;
}

function parseRoles(value: string[] | string | undefined) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function getScheduleStatusMeta(status: string) {
  switch (status) {
    case "CONFIRMED":
      return { label: "Confirmada", className: "bg-emerald-100 text-emerald-700" };
    case "PENDING":
      return { label: "Aguardando resposta", className: "bg-amber-100 text-amber-700" };
    case "DECLINED":
      return { label: "Recusada", className: "bg-rose-100 text-rose-700" };
    case "SWAP_REQUESTED":
      return { label: "Troca solicitada", className: "bg-sky-100 text-sky-700" };
    default:
      return { label: status, className: "bg-slate-100 text-slate-700" };
  }
}

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { label: "Fraca", color: "#ef4444", width: "33%" };
  if (score <= 4) return { label: "Média", color: "#f59e0b", width: "66%" };
  return { label: "Forte", color: "#10b981", width: "100%" };
}

export default function Perfil() {
  const user = useAuth((s) => s.user);
  const accessToken = useAuth((s) => s.accessToken);
  const refreshToken = useAuth((s) => s.refreshToken);
  const setSession = useAuth((s) => s.setSession);
  const setTokens = useAuth((s) => s.setTokens);
  const logout = useAuth((s) => s.logout);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [schedule, setSchedule] = useState<MyScheduleResponse["items"]>([]);
  const [swapInvites, setSwapInvites] = useState<MyScheduleResponse["swapInvites"]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [unavailabilityForm, setUnavailabilityForm] = useState({
    date: "",
    reason: "",
    recurring: false,
  });
  const [unavailabilitySaving, setUnavailabilitySaving] = useState(false);
  const [unavailabilityFeedback, setUnavailabilityFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [swapFeedback, setSwapFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [swapActionId, setSwapActionId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    photoUrl: "",
    avatarKey: "violet",
    birthDate: "",
    instrumentsText: "",
  });

  async function loadProfileData() {
    const [profileData, scheduleData] = await Promise.all([
      api<ProfileData>("/my/profile"),
      api<MyScheduleResponse>("/my/schedule?scope=all"),
    ]);

    setProfile(profileData);
    setSchedule(scheduleData.items ?? []);
    setSwapInvites(scheduleData.swapInvites ?? []);
    setForm({
      name: profileData.name ?? "",
      phone: profileData.phone ?? "",
      photoUrl: profileData.photoUrl ?? "",
      avatarKey: profileData.avatarKey ?? "violet",
      birthDate: profileData.birthDate ? profileData.birthDate.slice(0, 10) : "",
      instrumentsText: profileData.instruments.join(", "),
    });
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadProfileData()
      .catch((err: any) => {
        if (!active) return;
        setFeedback({ type: "error", text: err?.message || "Não foi possível carregar o perfil." });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const upcomingItems = useMemo(
    () => schedule
      .filter((item) => new Date(item.event.startTime).getTime() >= Date.now() - 86400000)
      .slice()
      .sort((a, b) => new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime())
      .slice(0, 5),
    [schedule]
  );

  const historyItems = useMemo(
    () => schedule
      .slice()
      .sort((a, b) => new Date(b.event.startTime).getTime() - new Date(a.event.startTime).getTime())
      .slice(0, 10),
    [schedule]
  );

  const unreadBadges = useMemo(() => profile?.badges.slice(0, 6) ?? [], [profile]);
  const passwordStrength = useMemo(() => getPasswordStrength(passwordForm.newPassword), [passwordForm.newPassword]);
  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    const checks = [
      !!profile.name,
      !!profile.phone,
      !!(profile.photoUrl || profile.avatarKey),
      !!profile.birthDate,
      profile.instruments.length > 0,
      profile.ministryMembers.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const instruments = form.instrumentsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const updated = await api<ProfileData>("/my/profile", {
        method: "PUT",
        body: {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          photoUrl: form.photoUrl.trim() || undefined,
          avatarKey: form.avatarKey,
          birthDate: form.birthDate ? new Date(`${form.birthDate}T12:00:00`).toISOString() : undefined,
          instruments,
        },
      });

      setProfile(updated);
      setFeedback({ type: "ok", text: "Perfil atualizado com sucesso." });

      if (user && accessToken && refreshToken) {
        setSession({ ...user, memberName: updated.name, avatarKey: updated.avatarKey, photoUrl: updated.photoUrl }, accessToken, refreshToken);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Não foi possível salvar o perfil." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordFeedback(null);

    if (passwordForm.newPassword.length < 6) {
      setPasswordFeedback({ type: "error", text: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ type: "error", text: "A confirmação da nova senha não confere." });
      return;
    }

    setPasswordSaving(true);
    try {
      const result = await api<{ ok: boolean; accessToken: string; refreshToken: string }>("/auth/change-password", {
        method: "POST",
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
      });

      if (result.accessToken && result.refreshToken) {
        setTokens(result.accessToken, result.refreshToken);
      }
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordFeedback({ type: "ok", text: "Senha atualizada com sucesso." });
    } catch (err: any) {
      setPasswordFeedback({ type: "error", text: err?.message || "Não foi possível alterar a senha." });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleAddUnavailability(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !unavailabilityForm.date) return;
    setUnavailabilitySaving(true);
    setUnavailabilityFeedback(null);
    try {
      await api(`/members/${profile.id}/unavailabilities`, {
        method: "POST",
        body: {
          date: new Date(`${unavailabilityForm.date}T12:00:00`).toISOString(),
          reason: unavailabilityForm.reason.trim() || undefined,
          recurring: unavailabilityForm.recurring,
        },
      });
      await loadProfileData();
      setUnavailabilityForm({ date: "", reason: "", recurring: false });
      setUnavailabilityFeedback({ type: "ok", text: "Indisponibilidade adicionada com sucesso." });
    } catch (err: any) {
      setUnavailabilityFeedback({ type: "error", text: err?.message || "Não foi possível adicionar a indisponibilidade." });
    } finally {
      setUnavailabilitySaving(false);
    }
  }

  async function handleDeleteUnavailability(unavailabilityId: string) {
    if (!profile) return;
    setUnavailabilityFeedback(null);
    try {
      await api(`/members/${profile.id}/unavailabilities/${unavailabilityId}`, { method: "DELETE" });
      await loadProfileData();
      setUnavailabilityFeedback({ type: "ok", text: "Indisponibilidade removida." });
    } catch (err: any) {
      setUnavailabilityFeedback({ type: "error", text: err?.message || "Não foi possível remover a indisponibilidade." });
    }
  }

  async function handleRespondSwapRequest(swapRequestId: string, action: "ACCEPT" | "DECLINE") {
    setSwapFeedback(null);
    setSwapActionId(swapRequestId);
    try {
      await api(`/swap-requests/${swapRequestId}/respond`, {
        method: "POST",
        body: { action },
      });
      await loadProfileData();
      setSwapFeedback({
        type: "ok",
        text: action === "ACCEPT" ? "Troca aceita com sucesso." : "Troca recusada e a escala voltou para o voluntário original.",
      });
    } catch (err: any) {
      setSwapFeedback({ type: "error", text: err?.message || "Não foi possível responder ao pedido de troca." });
    } finally {
      setSwapActionId(null);
    }
  }

  const initials = getInitials(profile?.name || user?.memberName || user?.email || "Usuário");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-10 h-10 border-4 border-[#ede9fe] border-t-[#7c3aed] rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center">
        <p className="text-sm text-red-500">Não foi possível carregar seu perfil.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-[#e5e0f8] overflow-hidden">
        <div className="px-6 py-8 md:px-8 bg-gradient-to-r from-[#f5f3ff] to-[#eef2ff] flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} photoUrl={profile.photoUrl} avatarKey={profile.avatarKey} size={80} />
            <div>
              <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>{profile.name}</h1>
              <p className="text-sm text-[#6d5fa1]">{user?.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-[#ede9fe] text-[#7c3aed]">{user?.role === "ADMIN" ? "Administrador" : user?.role === "MINISTRY_LEADER" ? "Líder" : user?.role === "VOLUNTEER" ? "Voluntário" : "Membro"}</span>
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-[#ecfdf5] text-[#059669]">{profile.points} pontos</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:min-w-[260px]">
            <div className="rounded-2xl bg-white/70 border border-white px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-[#7c6ea8] font-semibold">Ministérios</p>
              <p className="mt-1 text-xl font-bold text-[#1e1b4b]">{profile.ministryMembers.length}</p>
            </div>
            <div className="rounded-2xl bg-white/70 border border-white px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-[#7c6ea8] font-semibold">Badges</p>
              <p className="mt-1 text-xl font-bold text-[#1e1b4b]">{profile.badges.length}</p>
            </div>
            <div className="rounded-2xl bg-white/70 border border-white px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-[#7c6ea8] font-semibold">Perfil completo</p>
              <p className="mt-1 text-xl font-bold text-[#1e1b4b]">{profileCompletion}%</p>
            </div>
            <div className="rounded-2xl bg-white/70 border border-white px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-[#7c6ea8] font-semibold">Trocas pendentes</p>
              <p className="mt-1 text-xl font-bold text-[#1e1b4b]">{swapInvites?.length ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-[#e5e0f8] p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#1e1b4b]">Meus dados</h2>
            <p className="text-sm text-[#7c6ea8] mt-1">Atualize suas informações para manter as escalas e notificações corretas.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSave}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Nome completo</label>
                <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Telefone / WhatsApp</label>
                <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="71999990000" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa]" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Foto (URL)</label>
                <input value={form.photoUrl} onChange={(e) => setForm((prev) => ({ ...prev, photoUrl: e.target.value }))} placeholder="https://..." className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Avatar</label>
                <div className="grid grid-cols-3 gap-3">
                  {AVATAR_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, avatarKey: option }))}
                      className={`rounded-2xl border p-3 flex flex-col items-center gap-2 transition-colors ${form.avatarKey === option ? "border-[#7c3aed] bg-[#faf5ff]" : "border-[#e5e0f8] bg-white hover:bg-[#faf8ff]"}`}
                    >
                      <Avatar name={profile.name || initials} photoUrl={form.photoUrl || profile.photoUrl} avatarKey={option} size={44} />
                      <span className="text-[11px] font-semibold text-[#6d5fa1] capitalize">{option}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Data de nascimento</label>
                <input type="date" value={form.birthDate} onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa]" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Instrumentos / habilidades</label>
              <input value={form.instrumentsText} onChange={(e) => setForm((prev) => ({ ...prev, instrumentsText: e.target.value }))} placeholder="Vocal, Violão, Teclado" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa]" />
              <p className="mt-2 text-xs text-[#7c6ea8]">Separe por vírgula. Isso ajuda na escala automática e nas sugestões de voluntários.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button type="submit" disabled={saving} className="px-5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#7c3aed" }}>
                {saving ? "Salvando..." : "Salvar perfil"}
              </button>
              <button type="button" onClick={logout} className="px-5 py-3 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#5b5077] hover:bg-gray-50">
                Sair da conta
              </button>
            </div>
          </form>

          <div className="mt-8 border-t border-[#f0eefe] pt-6">
            <div className="mb-4">
              <h3 className="text-base font-bold text-[#1e1b4b]">Trocar senha</h3>
              <p className="text-sm text-[#7c6ea8] mt-1">Atualize sua senha de acesso ao app.</p>
            </div>

            {passwordFeedback && (
              <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${passwordFeedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                {passwordFeedback.text}
              </div>
            )}

            <form className="space-y-4" onSubmit={handlePasswordChange}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Senha atual</label>
                  <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Nova senha</label>
                  <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Confirmar nova senha</label>
                  <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-[#7c6ea8] mb-1.5">
                  <span>Força da senha</span>
                  <span style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                </div>
                <div className="h-2 rounded-full bg-[#ede9fe] overflow-hidden">
                  <div className="h-full transition-all" style={{ width: passwordStrength.width, backgroundColor: passwordStrength.color }} />
                </div>
                <p className="mt-2 text-xs text-[#7c6ea8]">Use 8+ caracteres com maiúsculas, minúsculas, números e símbolo.</p>
              </div>

              <button type="submit" disabled={passwordSaving} className="px-5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#7c3aed" }}>
                {passwordSaving ? "Atualizando senha..." : "Atualizar senha"}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
            <h3 className="text-base font-bold text-[#1e1b4b] mb-4">Meus ministérios</h3>
            <div className="space-y-3">
              {profile.ministryMembers.length === 0 ? (
                <p className="text-sm text-[#7c6ea8]">Você ainda não está vinculado a um ministério.</p>
              ) : profile.ministryMembers.map((link) => {
                const roles = parseRoles(link.roles);
                return (
                  <div key={link.id} className="rounded-2xl border border-[#ede9fe] bg-[#faf8ff] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#1e1b4b]">{link.ministry.name}</p>
                        <p className="text-xs text-[#7c6ea8]">{link.isLeader ? "Liderança" : "Participante"}</p>
                      </div>
                      {link.ministry.icon && <span className="text-xl">{link.ministry.icon}</span>}
                    </div>
                    {roles.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {roles.map((role) => (
                          <span key={role} className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-[#e5e0f8] text-[#6d5fa1]">{role}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
            <h3 className="text-base font-bold text-[#1e1b4b] mb-4">Próximas escalas</h3>
            <div className="space-y-3">
              {upcomingItems.length === 0 ? (
                <p className="text-sm text-[#7c6ea8]">Nenhuma escala futura encontrada.</p>
              ) : upcomingItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[#ede9fe] p-4">
                  <p className="font-semibold text-[#1e1b4b]">{item.event.title}</p>
                  <p className="mt-1 text-sm text-[#6d5fa1]">{item.roleName}</p>
                  <p className="mt-2 text-xs text-[#7c6ea8]">
                    {new Date(item.event.startTime).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <span className={`mt-3 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getScheduleStatusMeta(item.status).className}`}>{getScheduleStatusMeta(item.status).label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
            <h3 className="text-base font-bold text-[#1e1b4b] mb-4">Histórico de escalas</h3>
            <div className="space-y-3">
              {historyItems.length === 0 ? (
                <p className="text-sm text-[#7c6ea8]">Nenhum histórico de escalas encontrado.</p>
              ) : historyItems.map((item) => {
                const status = getScheduleStatusMeta(item.status);
                return (
                  <div key={item.id} className="rounded-2xl border border-[#ede9fe] bg-[#fcfbff] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#1e1b4b]">{item.event.title}</p>
                        <p className="mt-1 text-sm text-[#6d5fa1]">{item.roleName}</p>
                        <p className="mt-2 text-xs text-[#7c6ea8]">
                          {new Date(item.event.startTime).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {item.checkin && (
                          <p className="mt-2 text-xs font-medium text-emerald-700">Check-in realizado via {item.checkin.method}</p>
                        )}
                      </div>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${status.className}`}>{status.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
            <h3 className="text-base font-bold text-[#1e1b4b] mb-4">Pedidos de troca aguardando você</h3>
            {swapFeedback && (
              <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${swapFeedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                {swapFeedback.text}
              </div>
            )}
            <div className="space-y-3">
              {!swapInvites || swapInvites.length === 0 ? (
                <p className="text-sm text-[#7c6ea8]">Nenhum pedido de troca pendente.</p>
              ) : swapInvites.map((invite) => (
                <div key={invite.id} className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] p-4">
                  <p className="font-semibold text-[#1e1b4b]">{invite.scheduleItem.event.title}</p>
                  <p className="mt-1 text-sm text-[#0369a1]">{invite.scheduleItem.member.name} pediu que você assuma {invite.scheduleItem.roleName}</p>
                  <p className="mt-2 text-xs text-[#64748b]">
                    {new Date(invite.scheduleItem.event.startTime).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={swapActionId === invite.id}
                      onClick={() => handleRespondSwapRequest(invite.id, "ACCEPT")}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: "#10b981" }}
                    >
                      {swapActionId === invite.id ? "Processando..." : "Aceitar troca"}
                    </button>
                    <button
                      type="button"
                      disabled={swapActionId === invite.id}
                      onClick={() => handleRespondSwapRequest(invite.id, "DECLINE")}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Recusar troca
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
            <h3 className="text-base font-bold text-[#1e1b4b] mb-4">Conquistas e indisponibilidades</h3>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7c6ea8] mb-2">Badges recentes</p>
              <div className="flex flex-wrap gap-2">
                {unreadBadges.length === 0 ? (
                  <p className="text-sm text-[#7c6ea8]">Nenhum badge conquistado ainda.</p>
                ) : unreadBadges.map((badge) => (
                  <span key={badge.id} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#fff7ed] text-[#c2410c] text-xs font-semibold">
                    <span>{badge.icon || "🏅"}</span>
                    {badge.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7c6ea8] mb-2">Minhas indisponibilidades</p>
              {unavailabilityFeedback && (
                <div className={`mb-3 rounded-2xl border px-4 py-3 text-sm ${unavailabilityFeedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  {unavailabilityFeedback.text}
                </div>
              )}

              <form className="mb-4 space-y-3 rounded-2xl border border-[#ede9fe] bg-[#faf8ff] p-4" onSubmit={handleAddUnavailability}>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#7c6ea8] mb-1.5">Nova indisponibilidade</label>
                  <input type="date" value={unavailabilityForm.date} onChange={(e) => setUnavailabilityForm((prev) => ({ ...prev, date: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa] bg-white" />
                </div>
                <div>
                  <input value={unavailabilityForm.reason} onChange={(e) => setUnavailabilityForm((prev) => ({ ...prev, reason: e.target.value }))} placeholder="Motivo opcional" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa] bg-white" />
                </div>
                <label className="flex items-center gap-2 text-sm text-[#5b5077]">
                  <input type="checkbox" checked={unavailabilityForm.recurring} onChange={(e) => setUnavailabilityForm((prev) => ({ ...prev, recurring: e.target.checked }))} className="rounded border-[#c4b5fd]" />
                  Repetir no mesmo dia da semana
                </label>
                <button type="submit" disabled={unavailabilitySaving || !unavailabilityForm.date} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#7c3aed" }}>
                  {unavailabilitySaving ? "Salvando..." : "Adicionar indisponibilidade"}
                </button>
              </form>

              <div className="space-y-2">
                {profile.unavailabilities.length === 0 ? (
                  <p className="text-sm text-[#7c6ea8]">Nenhuma indisponibilidade cadastrada.</p>
                ) : profile.unavailabilities.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-xl bg-[#faf8ff] border border-[#ede9fe] px-3 py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#1e1b4b]">{new Date(item.date).toLocaleDateString("pt-BR")}</p>
                      <p className="text-xs text-[#7c6ea8]">{item.recurring ? "Recorrente" : "Data específica"}{item.reason ? ` · ${item.reason}` : ""}</p>
                    </div>
                    <button type="button" onClick={() => handleDeleteUnavailability(item.id)} className="text-xs font-semibold text-red-500 hover:underline">
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
