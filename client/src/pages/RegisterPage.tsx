import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../store";
import { API_URL } from "../api";

interface InviteInfo {
  code: string;
  role: string;
  ministry: { id: string; name: string; icon: string | null; color: string | null } | null;
}

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);

  const inviteCode = searchParams.get("convite") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const navigateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (navigateTimer.current) clearTimeout(navigateTimer.current); };
  }, []);

  useEffect(() => {
    if (!inviteCode) {
      setError("Código de convite não fornecido. Peça um link de convite ao líder.");
      return;
    }
    setInviteLoading(true);
    fetch(`${API_URL}/api/auth/validate-invite/${encodeURIComponent(inviteCode.trim().toUpperCase())}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Convite inválido");
        }
        return res.json();
      })
      .then((data: InviteInfo) => setInviteInfo(data))
      .catch((e: any) => setInviteError(e.message || "Convite inválido"))
      .finally(() => setInviteLoading(false));
  }, [inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!inviteCode) {
      setError("Código de convite inválido");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (!name.trim()) {
      setError("Preencha seu nome");
      return;
    }
    if (!email.trim()) {
      setError("Preencha seu e-mail");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
          phone: phone.trim() || undefined,
          inviteCode: inviteCode.trim().toUpperCase(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erro ao criar conta");
        return;
      }

      setSession(
        {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          memberId: data.user.memberId,
          memberName: name.trim(),
          avatarKey: data.user.avatarKey,
          photoUrl: data.user.photoUrl,
        },
        data.accessToken,
        data.refreshToken
      );

      setSuccess(true);
      navigateTimer.current = setTimeout(() => navigate("/"), 2000);
    } catch {
      setError("Erro de conexão com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "VOLUNTEER": return "Voluntário";
      case "MINISTRY_LEADER": return "Líder de Ministério";
      case "MEMBER": return "Membro";
      default: return role;
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Conta criada!</h1>
          <p className="text-gray-600">Redirecionando para o painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-purple-600">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "'Fraunces', serif" }}>
            Criar sua Conta
          </h1>
          <p className="text-gray-600 mt-1">Você foi convidado(a) para o Volutis</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {/* Invite Loading */}
          {inviteLoading && (
            <div className="mb-6 text-center py-8">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
              <p className="mt-3 text-sm text-gray-500">Validando convite...</p>
            </div>
          )}

          {/* Invite Error */}
          {inviteError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {inviteError}
            </div>
          )}

          {/* Invite Info */}
          {!inviteLoading && !inviteError && inviteInfo && (
            <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: (inviteInfo.ministry?.color || "#7c3aed") + "10" }}>
              <div className="flex items-center gap-3">
                {inviteInfo.ministry && (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: (inviteInfo.ministry.color || "#7c3aed") + "20" }}
                  >
                    {inviteInfo.ministry.icon || "⛪"}
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Você foi convidado para</p>
                  <p className="font-bold text-gray-800">
                    {inviteInfo.ministry ? inviteInfo.ministry.name : "a equipe"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: inviteInfo.ministry?.color || "#7c3aed" }}>
                    Papel: {getRoleLabel(inviteInfo.role)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          {!inviteLoading && !inviteError && inviteInfo && (
            <>
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nome completo *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Telefone (opcional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(71) 99999-9999"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Senha *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Confirmar senha *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                    required
                    minLength={6}
                  />
                </div>

                <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span className="text-xs text-gray-600">
                    Código: <strong className="text-purple-700">{inviteInfo.code}</strong>
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Criando conta...
                    </>
                  ) : (
                    "Criar Minha Conta"
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Já tem uma conta?{" "}
                <a href="/login" className="text-purple-600 font-semibold hover:underline">
                  Entrar
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
