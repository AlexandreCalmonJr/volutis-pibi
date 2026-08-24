import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store";
import { Button, Card, PageHeader } from "../components/ui";

interface Me {
  user: {
    email: string; role: string;
    member: {
      id: string; name: string; points: number; instruments: string;
      ministryMembers: { ministry: { name: string; icon: string | null } }[];
      badges: { id: string; name: string; icon: string; earnedAt: string }[];
    } | null;
  };
}
interface RankRow { id: string; name: string; points: number; photoUrl: string | null }

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador", MINISTRY_LEADER: "Líder de Ministério",
  VOLUNTEER: "Voluntário", MEMBER: "Membro",
};

export default function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const isLeader = user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER";

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => {});
    api<RankRow[]>("/gamification/ranking").then(setRanking).catch(() => {});
  }, []);

  const member = me?.user.member;
  const myRank = ranking.findIndex((r) => r.id === member?.id) + 1;

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-safe">
      <PageHeader title="Perfil" />
      <Card className="mb-4 text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-accent/20 text-3xl font-bold text-accent-soft">
          {member?.name?.[0] ?? "?"}
        </div>
        <p className="font-display text-xl font-bold">{member?.name ?? user?.email}</p>
        <p className="text-xs text-muted">{ROLE_LABEL[me?.user.role ?? ""] ?? me?.user.role}</p>
        <div className="mt-4 flex justify-center gap-6">
          <div>
            <p className="font-display text-2xl font-extrabold text-accent-soft">{member?.points ?? 0}</p>
            <p className="text-xs text-muted">pontos</p>
          </div>
          <div>
            <p className="font-display text-2xl font-extrabold text-accent-soft">{myRank > 0 ? `#${myRank}` : "—"}</p>
            <p className="text-xs text-muted">ranking</p>
          </div>
          <div>
            <p className="font-display text-2xl font-extrabold text-accent-soft">{member?.ministryMembers.length ?? 0}</p>
            <p className="text-xs text-muted">ministérios</p>
          </div>
        </div>
        {member && member.ministryMembers.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {member.ministryMembers.map((mm, i) => (
              <span key={i} className="rounded-full bg-surface-2 px-3 py-1 text-xs">
                {mm.ministry.icon} {mm.ministry.name}
              </span>
            ))}
          </div>
        )}
      </Card>

      {member && member.badges.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold">🎖️ Conquistas</h2>
          <div className="grid grid-cols-3 gap-2">
            {member.badges.map((b) => (
              <div key={b.id} className="rounded-xl bg-surface-2 p-3 text-center">
                <p className="text-2xl">{b.icon}</p>
                <p className="mt-1 text-[11px] font-medium leading-tight">{b.name}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold">🏆 Ranking do mês</h2>
        <div className="space-y-2">
          {ranking.slice(0, 10).map((r, i) => (
            <div key={r.id} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${r.id === member?.id ? "bg-accent/15" : ""}`}>
              <span className="flex items-center gap-2">
                <span className="w-6 text-center font-bold text-muted">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                {r.name}
              </span>
              <span className="font-semibold text-accent-soft">{r.points} pts</span>
            </div>
          ))}
          {ranking.length === 0 && <p className="text-xs text-muted">Sem pontuações ainda.</p>}
        </div>
      </Card>

      {isLeader && <InviteCard isAdmin={user?.role === "ADMIN"} />}

      {isLeader && (
        <Card className="mb-4 cursor-pointer active:bg-surface-2" >
          <div onClick={() => nav("/holyrics")} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📽️</span>
              <div>
                <p className="font-semibold">Painel Holyrics</p>
                <p className="text-xs text-muted">Projeção, importação e controle remoto</p>
              </div>
            </div>
            <span className="text-muted">→</span>
          </div>
        </Card>
      )}

      <Button variant="danger" className="w-full" onClick={logout}>Sair da conta</Button>
    </div>
  );
}

function InviteCard({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"VOLUNTEER" | "MEMBER" | "MINISTRY_LEADER">("VOLUNTEER");
  const [invite, setInvite] = useState<{ code: string; registerUrl: string; whatsappShare: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const roles: Array<{ v: typeof role; label: string }> = [
    { v: "VOLUNTEER", label: "Voluntário" },
    { v: "MEMBER", label: "Membro" },
    ...(isAdmin ? [{ v: "MINISTRY_LEADER" as const, label: "Líder" }] : []),
  ];

  async function generate() {
    setBusy(true);
    try {
      const r = await api<{ code: string; registerUrl: string; whatsappShare: string }>("/invites", {
        method: "POST", body: { role },
      });
      setInvite(r);
    } catch { /* toast já cuidado globalmente se houver */ }
    setBusy(false);
  }

  return (
    <Card className="mb-4">
      <div className="flex cursor-pointer items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">✉️</span>
          <div>
            <p className="font-semibold">Convidar para o app</p>
            <p className="text-xs text-muted">Gera código de uso único (7 dias)</p>
          </div>
        </div>
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="flex gap-2">
            {roles.map((r) => (
              <button key={r.v} onClick={() => setRole(r.v)}
                className={`flex-1 rounded-lg py-2 text-xs font-medium ${role === r.v ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={generate} disabled={busy}>
            {busy ? "Gerando..." : "Gerar convite"}
          </Button>
          {invite && (
            <div className="rounded-xl bg-surface-2 p-3 text-center">
              <p className="font-mono text-2xl font-bold tracking-widest text-accent-soft">{invite.code}</p>
              <p className="mt-1 break-all text-[11px] text-muted">{invite.registerUrl}</p>
              <a href={invite.whatsappShare} target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-block rounded-lg bg-ok/90 px-4 py-2 text-xs font-semibold text-bg">
                Compartilhar no WhatsApp
              </a>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
