import { useState, useEffect } from "react";
import { api } from "../api";
import { MINISTERIO_COLORS } from "../lib/constants";
import { Avatar } from "../components/Avatar";

interface Ministry {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface MinistryMember {
  id: string;
  ministryId: string;
  memberId: string;
  ministry: Ministry;
}

interface Member {
  id: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  avatarKey?: string | null;
  instruments: string[];
  points: number;
  ministryMembers: MinistryMember[];
}

interface RankingMember {
  id: string;
  name: string;
  photoUrl?: string;
  avatarKey?: string | null;
  points: number;
}

interface EventSummary {
  id: string;
  title: string;
  date: string;
  scheduleItems: Array<{
    id: string;
    status: string;
    member: { id: string; name: string };
    checkin?: { id: string; checkedInAt: string; method: string } | null;
  }>;
}

function BarChart({ data, maxValue, color }: { data: { label: string; value: number }[]; maxValue: number; color: string }) {
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => {
        const h = maxValue > 0 ? (d.value / maxValue) * 100 : 0;
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-medium text-[#5b5077]">{d.value}%</span>
            <div className="w-full rounded-t-lg relative overflow-hidden" style={{ height: "80px", backgroundColor: "#f5f3ff" }}>
              <div
                className="absolute bottom-0 w-full rounded-t-lg transition-all duration-700"
                style={{ height: `${h}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs text-[#7c6ea8] text-center leading-tight">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ data }: { data: { mes: string; score: number }[] }) {
  const maxScore = 5;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 280 + 20,
    y: 80 - ((d.score / maxScore) * 70) + 10,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="relative">
      <svg width="100%" viewBox="0 0 320 100" className="overflow-visible">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[1, 2, 3, 4, 5].map((y) => {
          const yPos = 80 - ((y / maxScore) * 70) + 10;
          return (
            <g key={y}>
              <line x1="20" y1={yPos} x2="300" y2={yPos} stroke="#e5e0f8" strokeWidth="1" strokeDasharray="4,4" />
              <text x="14" y={yPos + 3} fill="#7c6ea8" fontSize="8" textAnchor="end">{y}</text>
            </g>
          );
        })}
        <path
          d={`${pathD} L ${points[points.length - 1].x} 90 L ${points[0].x} 90 Z`}
          fill="url(#lineGrad)"
        />
        <path d={pathD} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <g key={p.mes}>
            <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#7c3aed" strokeWidth="2" />
            <text x={p.x} y="98" fill="#7c6ea8" fontSize="9" textAnchor="middle">{p.mes}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#e5e0f8] p-5 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-32 mb-4" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
        <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-32 mb-4" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e0f8] p-12 text-center">
      <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
      <p className="text-[#7c6ea8] text-sm">{message}</p>
    </div>
  );
}

function getMinistryName(m: Member): string {
  return m.ministryMembers?.[0]?.ministry?.name || "Sem ministério";
}

function getMinistryColor(ministryName: string): string {
  return MINISTERIO_COLORS[ministryName]?.text || "#7c3aed";
}

export default function Relatorios() {
  const [abaRelatorio, setAbaRelatorio] = useState<"geral" | "felicitometro" | "jornada">("geral");
  const [members, setMembers] = useState<Member[]>([]);
  const [ranking, setRanking] = useState<RankingMember[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [membersData, rankingData, eventsData] = await Promise.all([
          api<Member[]>("/members"),
          api<RankingMember[]>("/gamification/ranking"),
          api<EventSummary[]>("/events"),
        ]);
        setMembers(membersData);
        setRanking(rankingData);
        setEvents(eventsData);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const totalMembers = members.length;
  const totalPoints = members.reduce((a, m) => a + m.points, 0);
  const allScheduleItems = events.flatMap((event) => event.scheduleItems || []);
  const totalSchedules = allScheduleItems.length;
  const confirmedSchedules = allScheduleItems.filter((item) => item.status === "CONFIRMED").length;
  const checkedInSchedules = allScheduleItems.filter((item) => !!item.checkin).length;
  const confirmationRate = totalSchedules > 0 ? Math.round((confirmedSchedules / totalSchedules) * 100) : 0;
  const checkinRate = totalSchedules > 0 ? Math.round((checkedInSchedules / totalSchedules) * 100) : 0;
  const felicimetro = Math.round((confirmationRate * 0.55) + (checkinRate * 0.45));

  const ministryCounts = new Map<string, number>();
  members.forEach((m) => {
    const name = getMinistryName(m);
    ministryCounts.set(name, (ministryCounts.get(name) || 0) + 1);
  });

  const ministryBarData = Array.from(ministryCounts.entries()).map(([label, value]) => ({
    label,
    value,
  }));

  const topRanking = ranking.slice(0, 5);
  const monthTrend = Array.from({ length: 6 }).map((_, idx) => {
    const ref = new Date();
    ref.setMonth(ref.getMonth() - (5 - idx), 1);
    ref.setHours(0, 0, 0, 0);
    const month = ref.getMonth();
    const year = ref.getFullYear();
    const monthItems = events
      .filter((event) => {
        const date = new Date(event.date);
        return date.getMonth() === month && date.getFullYear() === year;
      })
      .flatMap((event) => event.scheduleItems || []);
    const monthConfirmed = monthItems.filter((item) => item.status === "CONFIRMED").length;
    return {
      mes: ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      score: monthItems.length > 0 ? Number(((monthConfirmed / monthItems.length) * 5).toFixed(1)) : 0,
    };
  });
  const memberJourney = members.map((member) => {
    const items = allScheduleItems.filter((item) => item.member.id === member.id);
    return {
      ...member,
      scheduleCount: items.length,
      checkinCount: items.filter((item) => !!item.checkin).length,
    };
  });

  function exportMembersCsv() {
    const header = ["Nome", "Ministério", "Funções", "Pontos", "Escalas", "Check-ins"];
    const rows = memberJourney.map((member) => [
      member.name,
      getMinistryName(member),
      member.instruments?.join(" | ") || "",
      String(member.points),
      String(member.scheduleCount),
      String(member.checkinCount),
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-volut-membros.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
              Relatórios
            </h1>
            <p className="text-[#5b5077] text-sm mt-1">Carregando dados...</p>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Relatórios
          </h1>
        </div>
        <EmptyState message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Relatórios
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            Acompanhamento geral
          </p>
        </div>
        <button onClick={exportMembersCsv} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1 w-fit">
        {(["geral", "felicitometro", "jornada"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAbaRelatorio(a)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${abaRelatorio === a ? "text-white" : "text-[#7c6ea8] hover:bg-gray-50"}`}
            style={abaRelatorio === a ? { backgroundColor: "#7c3aed" } : {}}
          >
            {a === "geral" ? "Geral" : a === "felicitometro" ? "Felicitômetro" : "Jornada"}
          </button>
        ))}
      </div>

      {/* Geral */}
      {abaRelatorio === "geral" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               {[
               { label: "Membros Cadastrados", value: String(totalMembers), trend: "", positive: true },
               { label: "Total de Pontos", value: String(totalPoints), trend: "", positive: true },
               { label: "Confirmação de Escalas", value: `${confirmationRate}%`, trend: `${confirmedSchedules}/${totalSchedules} confirmadas`, positive: true },
               { label: "Check-ins Realizados", value: `${checkinRate}%`, trend: `${checkedInSchedules} check-ins`, positive: true },
             ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-[#e5e0f8] p-5">
                <p className="text-3xl font-bold text-[#1e1b4b]">{s.value}</p>
                <p className="text-xs text-[#7c6ea8] mt-1">{s.label}</p>
                {s.trend && (
                  <p className="text-xs font-medium mt-2 text-[#10b981]">
                    {s.trend}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Membros por ministério */}
            <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
              <h2 className="font-semibold text-[#1e1b4b] mb-1">Membros por Ministério</h2>
              <p className="text-xs text-[#7c6ea8] mb-4">Distribuição atual</p>
              {ministryBarData.length > 0 ? (
                <BarChart
                  data={ministryBarData}
                  maxValue={Math.max(...ministryBarData.map((d) => d.value))}
                  color="#7c3aed"
                />
              ) : (
                <p className="text-sm text-[#7c6ea8] text-center py-8">Nenhum dado disponível</p>
              )}
            </div>

            {/* Top ranking */}
            <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
              <h2 className="font-semibold text-[#1e1b4b] mb-1">Ranking de Pontuação</h2>
              <p className="text-xs text-[#7c6ea8] mb-4">Membros mais engajados</p>
              {topRanking.length > 0 ? (
                <div className="space-y-3">
                  {topRanking.map((m, i) => {
                    const maxPts = topRanking[0]?.points || 1;
                    const pct = Math.round((m.points / maxPts) * 100);
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[#d4c7f7] w-4">{i + 1}</span>
                        <Avatar name={m.name} avatarKey={m.avatarKey} size={32} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1e1b4b] truncate">{m.name}</p>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#7c3aed" }} />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-[#7c3aed]">{m.points} pts</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[#7c6ea8] text-center py-8">Nenhum dado de ranking disponível</p>
              )}
            </div>
          </div>

          {/* Tabela de membros */}
          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0eefe]">
              <h2 className="font-semibold text-[#1e1b4b]">Lista de Membros</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#fafafe]">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Membro</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Ministério</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Funções</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0eefe]">
                  {members.slice(0, 10).map((m) => {
                    const ministryName = getMinistryName(m);
                    const color = getMinistryColor(ministryName);
                    return (
                      <tr key={m.id} className="hover:bg-[#fafafe] transition-colors">
                        <td className="px-6 py-3">
                          <span className="text-sm font-medium text-[#1e1b4b]">{m.name}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: color + "15", color }}>
                            {ministryName}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-[#5b5077]">
                          {m.instruments?.length > 0 ? m.instruments.join(", ") : "—"}
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-bold" style={{ color }}>
                          {m.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Felicitômetro */}
      {abaRelatorio === "felicitometro" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div
              className="lg:col-span-1 rounded-2xl p-6 flex flex-col items-center justify-center text-center"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)" }}
            >
              <p className="text-white/70 text-sm font-medium mb-2">Felicitômetro</p>
              <p className="text-7xl font-bold text-white">{felicimetro}</p>
              <p className="text-white/70 text-sm mt-1">índice de engajamento operacional</p>
              <div className="flex gap-1 mt-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} className="w-5 h-5" fill="rgba(255,255,255,0.3)" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e5e0f8] p-6">
              <h2 className="font-semibold text-[#1e1b4b] mb-1">Evolução do Engajamento</h2>
              <p className="text-xs text-[#7c6ea8] mb-4">Proxy por taxa de confirmação mensal</p>
              <LineChart data={monthTrend} />
            </div>
          </div>

          {/* Respostas */}
          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0eefe] flex items-center justify-between">
              <h2 className="font-semibold text-[#1e1b4b]">Respostas Recentes</h2>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: "#7c3aed" }}>
                  {`Confirmação ${confirmationRate}% · Check-in ${checkinRate}%`}
                </button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl bg-[#f5f3ff] p-4 text-center"><p className="text-2xl font-bold text-[#1e1b4b]">{totalSchedules}</p><p className="text-xs text-[#7c6ea8] mt-1">Escalas monitoradas</p></div>
                  <div className="rounded-xl bg-[#eefcf6] p-4 text-center"><p className="text-2xl font-bold text-[#14532d]">{confirmedSchedules}</p><p className="text-xs text-[#166534] mt-1">Confirmadas</p></div>
                  <div className="rounded-xl bg-[#eff6ff] p-4 text-center"><p className="text-2xl font-bold text-[#1d4ed8]">{checkedInSchedules}</p><p className="text-xs text-[#2563eb] mt-1">Check-ins</p></div>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* Jornada */}
      {abaRelatorio === "jornada" && (
        <div className="space-y-4">
          <p className="text-sm text-[#7c6ea8]">Jornada completa de serviço de cada membro do ministério</p>
          {members.length === 0 ? (
            <EmptyState message="Nenhum membro encontrado." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {memberJourney.map((m) => {
                const ministryName = getMinistryName(m);
                const color = getMinistryColor(ministryName);
                return (
                  <div key={m.id} className="bg-white rounded-2xl border border-[#e5e0f8] p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar name={m.name} avatarKey={m.avatarKey} size={44} className="flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-[#1e1b4b]">{m.name}</p>
                        <p className="text-xs text-[#7c6ea8]">{ministryName}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-[#f5f3ff] rounded-xl p-2.5">
                        <p className="text-lg font-bold text-[#1e1b4b]">{m.scheduleCount}</p>
                        <p className="text-xs text-[#7c6ea8]">Escalas</p>
                      </div>
                      <div className="bg-[#f5f3ff] rounded-xl p-2.5">
                        <p className="text-lg font-bold text-[#1e1b4b]">{m.checkinCount}</p>
                        <p className="text-xs text-[#7c6ea8]">Check-ins</p>
                      </div>
                    </div>
                    {m.instruments && m.instruments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {m.instruments.map((inst) => (
                          <span key={inst} className="text-xs px-2 py-0.5 rounded-full bg-[#f5f3ff] text-[#7c3aed] font-medium">
                            {inst}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
