import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth, useToasts } from "../store";
import { Button, Card, PageHeader } from "../components/ui";

interface Status { configured: boolean; connected: boolean; version?: string | null; error?: string | null }
interface Config { mode: string | null; localIp: string | null; localPort: number | null; hasToken: boolean; hasApiKey: boolean; configured: boolean }
interface Presentation { id: string; type: string; name: string; slide_number: number; total_slides: number }

export default function Holyrics() {
  const user = useAuth((s) => s.user);
  const push = useToasts((s) => s.push);
  const nav = useNavigate();
  const isAdmin = user?.role === "ADMIN";

  const [status, setStatus] = useState<Status | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [form, setForm] = useState({ mode: "local", localIp: "", localPort: "8091", token: "", apiKey: "" });
  const [current, setCurrent] = useState<Presentation | null>(null);
  const [verse, setVerse] = useState("");
  const [countdown, setCountdown] = useState("05:00");
  const [quickText, setQuickText] = useState("");
  const [panelText, setPanelText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const [st, cfg] = await Promise.all([api<Status>("/holyrics/status"), api<Config>("/holyrics/config")]);
      setStatus(st); setConfig(cfg);
      if (cfg.mode) setForm((f) => ({ ...f, mode: cfg.mode!, localIp: cfg.localIp ?? "", localPort: String(cfg.localPort ?? 8091) }));
      if (!cfg.configured) setShowConfig(true);
    } catch { /* sem permissão */ }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Poll do que está sendo projetado
  useEffect(() => {
    if (!status?.connected) return;
    const tick = () => api<{ presentation: Presentation | null }>("/holyrics/current").then((r) => setCurrent(r.presentation)).catch(() => {});
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [status?.connected]);

  async function run(label: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusy(label);
    try {
      await fn();
      push({ title: okMsg, kind: "ok" });
    } catch (e: any) { push({ title: e.message, kind: "warn" }); }
    setBusy(null);
  }

  async function saveConfig() {
    const body: any = { mode: form.mode };
    if (form.mode === "local") {
      body.localIp = form.localIp;
      body.localPort = Number(form.localPort);
    }
    if (form.token) body.token = form.token;
    if (form.apiKey) body.apiKey = form.apiKey;
    await run("config", () => api("/holyrics/config", { method: "PUT", body }), "Configuração salva");
    setShowConfig(false);
    loadStatus();
  }

  const input = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent";

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-safe">
      <button onClick={() => nav(-1)} className="mb-3 text-sm text-accent-soft">← Voltar</button>
      <PageHeader title="Holyrics" subtitle="Projeção e repertório integrados" />

      {/* Status */}
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${status?.connected ? "bg-ok" : "bg-danger"}`} />
            <p className="text-sm font-semibold">
              {status?.connected ? `Conectado (v${status.version})` : status?.configured ? "Sem conexão" : "Não configurado"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={loadStatus}>↻</Button>
            {isAdmin && <Button variant="ghost" onClick={() => setShowConfig((v) => !v)}>⚙️</Button>}
          </div>
        </div>
        {status?.error && <p className="mt-2 text-xs text-danger">{status.error}</p>}
        {current && (
          <div className="mt-3 rounded-xl bg-surface-2 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">No telão agora</p>
            <p className="mt-0.5 text-sm font-semibold">{current.name}</p>
            <p className="text-xs text-muted">{current.type} · slide {current.slide_number}/{current.total_slides}</p>
          </div>
        )}
      </Card>

      {/* Configuração (admin) */}
      {showConfig && isAdmin && (
        <Card className="mb-4 space-y-2">
          <p className="text-sm font-semibold">Conexão</p>
          <div className="flex gap-2">
            {["local", "online"].map((m) => (
              <button key={m} onClick={() => setForm({ ...form, mode: m })}
                className={`flex-1 rounded-xl py-2 text-sm font-medium capitalize ${form.mode === m ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}>
                {m === "local" ? "🏠 Rede local" : "☁️ Online"}
              </button>
            ))}
          </div>
          {form.mode === "local" ? (
            <div className="flex gap-2">
              <input placeholder="IP (192.168.1.100)" value={form.localIp} onChange={(e) => setForm({ ...form, localIp: e.target.value })} className={input} />
              <input placeholder="Porta" value={form.localPort} onChange={(e) => setForm({ ...form, localPort: e.target.value })} className={`${input} max-w-24`} />
            </div>
          ) : (
            <input placeholder={config?.hasApiKey ? "API Key (mantida)" : "API Key (plano Advanced)"} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className={input} />
          )}
          <input placeholder={config?.hasToken ? "Token (mantido — preencha p/ trocar)" : "Token do API Server"} value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} className={input} />
          <p className="text-[11px] text-muted">No Holyrics: Arquivo → Configurações → API Server → Gerenciar Permissões</p>
          <Button className="w-full" onClick={saveConfig} disabled={busy === "config"}>Salvar conexão</Button>
        </Card>
      )}

      {/* Repertório */}
      <Card className="mb-4">
        <p className="mb-2 text-sm font-semibold">🎵 Repertório</p>
        <Button className="w-full" variant="ghost" disabled={!status?.connected || busy === "import"}
          onClick={() => run("import", async () => {
            const r = await api<{ imported: number; updated: number }>("/holyrics/import-songs", { method: "POST" });
            push({ title: `Importadas ${r.imported} novas · ${r.updated} atualizadas`, kind: "ok" });
          }, "Importação concluída")}>
          {busy === "import" ? "Importando..." : "⬇ Importar músicas do Holyrics"}
        </Button>
        <p className="mt-2 text-[11px] text-muted">O envio da setlist é feito na tela de cada evento (aba Setlist).</p>
      </Card>

      {/* Controle remoto */}
      <Card className="mb-4 space-y-3">
        <p className="text-sm font-semibold">📽️ Projeção remota</p>

        <div className="flex gap-2">
          <input placeholder="Versículo (Sl 23:1-6 Jo 3:16)" value={verse} onChange={(e) => setVerse(e.target.value)} className={input} />
          <Button disabled={!verse.trim() || !status?.connected}
            onClick={() => run("verse", () => api("/holyrics/show-verse", { method: "POST", body: { references: verse } }), "Versículo no telão 📖")}>
            Projetar
          </Button>
        </div>

        <div className="flex gap-2">
          <input placeholder="MM:SS" value={countdown} onChange={(e) => setCountdown(e.target.value)} className={`${input} max-w-24`} />
          <Button variant="ghost" className="flex-1" disabled={!status?.connected}
            onClick={() => run("cd", () => api("/holyrics/show-countdown", { method: "POST", body: { time: countdown } }), "Contagem iniciada ⏱️")}>
            Iniciar contagem regressiva
          </Button>
        </div>

        <div className="flex gap-2">
          <input placeholder="Texto rápido (avisos)" value={quickText} onChange={(e) => setQuickText(e.target.value)} className={input} />
          <Button disabled={!quickText.trim() || !status?.connected}
            onClick={() => run("txt", () => api("/holyrics/show-text", { method: "POST", body: { text: quickText } }), "Texto no telão")}>
            Exibir
          </Button>
        </div>

        <div className="flex gap-2">
          <input placeholder="Recado ao pregador (painel)" value={panelText} onChange={(e) => setPanelText(e.target.value)} className={input} />
          <Button disabled={!panelText.trim() || !status?.connected}
            onClick={() => run("panel", () => api("/holyrics/panel-text", { method: "POST", body: { text: panelText, show: true } }), "Recado enviado ao painel")}>
            Enviar
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <Button variant="ghost" disabled={!status?.connected}
            onClick={() => run("prev", () => api("/holyrics/action", { method: "POST", body: { action: "previous" } }), "← Slide anterior")}>
            ← Slide
          </Button>
          <Button variant="ghost" disabled={!status?.connected}
            onClick={() => run("next", () => api("/holyrics/action", { method: "POST", body: { action: "next" } }), "Próximo slide →")}>
            Slide →
          </Button>
          <Button variant="danger" disabled={!status?.connected}
            onClick={() => run("close", () => api("/holyrics/action", { method: "POST", body: { action: "close" } }), "Apresentação encerrada")}>
            ■ Fechar
          </Button>
        </div>
      </Card>
    </div>
  );
}
