import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store";
import { API_URL } from "../api";

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<"email" | "phone">("email");

  const isEmail = loginType === "email";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = isEmail
        ? { email: identifier, password }
        : { email: identifier, password };

      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setError(
            !API_URL && window.location.hostname !== "localhost"
              ? "Servidor API não encontrado (verifique a variável VITE_API_URL na Vercel)."
              : "Rota de autenticação não encontrada no servidor."
          );
          return;
        }
        setError(data.error ?? "Credenciais inválidas");
        return;
      }
      setSession(
        {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          memberId: data.user.memberId,
          memberName: data.user.memberName,
          avatarKey: data.user.avatarKey,
          photoUrl: data.user.photoUrl,
        },
        data.accessToken,
        data.refreshToken
      );
      navigate("/");
    } catch {
      setError("Erro de conexão com o servidor. Verifique sua conexão ou se a API está online.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#f5f3ff" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "#7c3aed" }}
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Volut
          </h1>
          <p className="text-sm text-[#7c6ea8] mt-1">Gestão de Ministérios da Igreja</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1e1b4b] mb-1">Entrar</h2>
          <p className="text-sm text-[#7c6ea8] mb-6">Acesse sua conta para continuar</p>

          {/* Login Type Tabs */}
          <div className="flex gap-2 mb-6 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => { setLoginType("email"); setIdentifier(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                loginType === "email"
                  ? "bg-white text-[#7c3aed] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              E-mail
            </button>
            <button
              onClick={() => { setLoginType("phone"); setIdentifier(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                loginType === "phone"
                  ? "bg-white text-[#7c3aed] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Telefone
            </button>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">
                {isEmail ? "E-mail" : "Telefone"}
              </label>
              <input
                type={isEmail ? "email" : "tel"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isEmail ? "seu@email.com" : "(71) 99999-9999"}
                required
                className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                required
                className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-70 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#7c3aed" }}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
