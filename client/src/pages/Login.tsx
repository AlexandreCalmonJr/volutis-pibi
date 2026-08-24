import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../store";

const BASE = import.meta.env.VITE_API_URL ?? "";

export default function Login() {
  const [params] = useSearchParams();
  const inviteFromUrl = params.get("convite") ?? "";
  const [mode, setMode] = useState<"login" | "register">(inviteFromUrl ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState(inviteFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuth((s) => s.setSession);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { email, password }
        : { email, password, name, phone: phone || undefined, inviteCode };
      const res = await fetch(`${BASE}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na autenticação");
      setSession(
        { id: data.user.id, email: data.user.email, role: data.user.role, memberId: data.user.memberId },
        data.accessToken,
        data.refreshToken
      );
      nav("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-accent";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/20 text-3xl">🙌</div>
          <h1 className="font-display text-3xl font-extrabold">Volutis <span className="text-accent-soft">PIBI</span></h1>
          <p className="mt-1 text-sm text-muted">Escalas e ministérios da igreja</p>
        </div>

        <div className="mb-4 flex rounded-xl bg-surface p-1">
          {(["login", "register"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium ${mode === m ? "bg-accent text-white" : "text-muted"}`}>
              {m === "login" ? "Entrar" : "Tenho um convite"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <>
              <input required placeholder="Código do convite" value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className={`${input} font-mono tracking-widest`} />
              <input required placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} className={input} />
              <input placeholder="WhatsApp (71 99999-9999)" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
            </>
          )}
          <input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <input type="password" required placeholder={mode === "register" ? "Senha (mín. 6 caracteres)" : "Senha"} value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button disabled={loading}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition active:bg-accent/80 disabled:opacity-50">
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar minha conta"}
          </button>
        </form>
        {mode === "register" && (
          <p className="mt-3 text-center text-xs text-muted">
            O cadastro requer um convite gerado por um líder da igreja.
          </p>
        )}
      </div>
    </div>
  );
}
