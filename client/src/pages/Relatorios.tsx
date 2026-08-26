import { useState } from "react";
import { voluntarios, feedbackData, presencaData } from "../data/mockData";
import { MINISTERIO_COLORS } from "../lib/constants";

function safeTaxa(presencas: number, faltas: number): number {
  const total = presencas + faltas;
  return total > 0 ? Math.round((presencas / total) * 100) : 0;
}

function BarChart({ data, maxValue, color }: { data: { label: string; value: number }[]; maxValue: number; color: string }) {
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => {
        const h = (d.value / maxValue) * 100;
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
        {/* Grid lines */}
        {[1, 2, 3, 4, 5].map((y) => {
          const yPos = 80 - ((y / maxScore) * 70) + 10;
          return (
            <g key={y}>
              <line x1="20" y1={yPos} x2="300" y2={yPos} stroke="#e5e0f8" strokeWidth="1" strokeDasharray="4,4" />
              <text x="14" y={yPos + 3} fill="#7c6ea8" fontSize="8" textAnchor="end">{y}</text>
            </g>
          );
        })}
        {/* Area fill */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} 90 L ${points[0].x} 90 Z`}
          fill="url(#lineGrad)"
        />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
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

const feedbackRespostas = [
  { nome: "Ana Paula Costa", score: 5, comentario: "Amo servir neste ministério! Me sinto muito acolhida.", ministerio: "Louvor" },
  { nome: "Carlos Eduardo Silva", score: 4, comentario: "Estou satisfeito. Só preciso de mais comunicação antecipada.", ministerio: "Mídia" },
  { nome: "Beatriz Fernandes", score: 5, comentario: "Incrível! Cada culto é uma nova experiência.", ministerio: "Recepção" },
  { nome: "Mariana Santos", score: 5, comentario: "Sou abençoada por servir no ministério infantil!", ministerio: "Infantil" },
  { nome: "Rafael Oliveira", score: 3, comentario: "Às vezes sinto que estou sobrecarregado.", ministerio: "Mídia" },
];

export default function Relatorios() {
  const [periodoFelicitometro, setPeriodoFelicitometro] = useState("agosto");
  const [abaRelatorio, setAbaRelatorio] = useState<"geral" | "felicitometro" | "jornada">("geral");

  const scoreMedio = feedbackData[feedbackData.length - 1].score;
  const totalPresencas = voluntarios.reduce((a, v) => a + v.presencas, 0);
  const totalFaltas = voluntarios.reduce((a, v) => a + v.faltas, 0);
  const taxaGeral = safeTaxa(totalPresencas, totalFaltas);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Relatórios
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            Acompanhamento geral · Agosto 2024
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar PDF
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
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Taxa de Presença", value: `${taxaGeral}%`, trend: "+3%", positive: true },
              { label: "Voluntários Ativos", value: String(voluntarios.filter((v) => v.status === "ativo").length), trend: "+3", positive: true },
              { label: "Total de Escalas", value: "48", trend: "este mês", positive: true },
              { label: "Trocas Solicitadas", value: "4", trend: "-2 vs mês ant.", positive: true },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-[#e5e0f8] p-5">
                <p className="text-3xl font-bold text-[#1e1b4b]">{s.value}</p>
                <p className="text-xs text-[#7c6ea8] mt-1">{s.label}</p>
                <p className="text-xs font-medium mt-2" style={{ color: s.positive ? "#10b981" : "#ef4444" }}>
                  ↑ {s.trend}
                </p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Presença por ministério */}
            <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
              <h2 className="font-semibold text-[#1e1b4b] mb-1">Presença por Ministério</h2>
              <p className="text-xs text-[#7c6ea8] mb-4">Taxa média — Agosto 2024</p>
              <BarChart
                data={presencaData.map((p) => ({ label: p.ministerio, value: p.presenca }))}
                maxValue={100}
                color="#7c3aed"
              />
            </div>

            {/* Top volunteers */}
            <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
              <h2 className="font-semibold text-[#1e1b4b] mb-1">Ranking de Presença</h2>
              <p className="text-xs text-[#7c6ea8] mb-4">Top voluntários — Agosto 2024</p>
              <div className="space-y-3">
                {voluntarios
                  .filter((v) => v.status === "ativo")
                  .sort((a, b) => safeTaxa(b.presencas, b.faltas) - safeTaxa(a.presencas, a.faltas))
                  .slice(0, 5)
                  .map((v, i) => {
                    const taxa = safeTaxa(v.presencas, v.faltas);
                    const color = MINISTERIO_COLORS[v.ministerio]?.text || "#7c3aed";
                    const initials = v.nome.split(" ").slice(0, 2).map((n) => n[0]).join("");
                    return (
                      <div key={v.id} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[#d4c7f7] w-4">{i + 1}</span>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1e1b4b] truncate">{v.nome}</p>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div className="h-full rounded-full" style={{ width: `${taxa}%`, backgroundColor: color }} />
                          </div>
                        </div>
                        <span className="text-sm font-bold" style={{ color }}>{taxa}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Faltas table */}
          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0eefe]">
              <h2 className="font-semibold text-[#1e1b4b]">Histórico de Faltas</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#fafafe]">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Voluntário</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Ministério</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Presenças</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Faltas</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Taxa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0eefe]">
                  {voluntarios.filter((v) => v.status !== "pendente").slice(0, 8).map((v) => {
                    const taxa = safeTaxa(v.presencas, v.faltas);
                    const color = MINISTERIO_COLORS[v.ministerio]?.text || "#7c3aed";
                    return (
                      <tr key={v.id} className="hover:bg-[#fafafe] transition-colors">
                        <td className="px-6 py-3">
                          <span className="text-sm font-medium text-[#1e1b4b]">{v.nome}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: color + "15", color }}>
                            {v.ministerio}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-[#1e1b4b] font-medium">{v.presencas}</td>
                        <td className="px-6 py-3 text-right text-sm font-medium" style={{ color: v.faltas > 3 ? "#ef4444" : "#7c6ea8" }}>
                          {v.faltas}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="text-sm font-bold" style={{ color: taxa > 85 ? "#10b981" : taxa > 70 ? "#f59e0b" : "#ef4444" }}>
                            {taxa}%
                          </span>
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
          {/* Score atual */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div
              className="lg:col-span-1 rounded-2xl p-6 flex flex-col items-center justify-center text-center"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)" }}
            >
              <p className="text-white/70 text-sm font-medium mb-2">Felicitômetro</p>
              <p className="text-7xl font-bold text-white">{scoreMedio}</p>
              <p className="text-white/70 text-sm mt-1">de 5.0</p>
              <div className="flex gap-1 mt-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} className="w-5 h-5" fill={s <= Math.round(scoreMedio) ? "white" : "rgba(255,255,255,0.3)"} viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <p className="text-white/60 text-xs mt-3">Agosto 2024</p>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e5e0f8] p-6">
              <h2 className="font-semibold text-[#1e1b4b] mb-1">Evolução do Clima da Equipe</h2>
              <p className="text-xs text-[#7c6ea8] mb-4">Nota média mensal</p>
              <LineChart data={feedbackData} />
            </div>
          </div>

          {/* Respostas */}
          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0eefe] flex items-center justify-between">
              <h2 className="font-semibold text-[#1e1b4b]">Respostas Recentes</h2>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90" style={{ backgroundColor: "#7c3aed" }}>
                Enviar Pesquisa
              </button>
            </div>
            <div className="divide-y divide-[#f0eefe]">
              {feedbackRespostas.map((r, i) => {
                const color = MINISTERIO_COLORS[r.ministerio]?.text || "#7c3aed";
                const initials = r.nome.split(" ").slice(0, 2).map((n) => n[0]).join("");
                return (
                  <div key={i} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-[#1e1b4b] text-sm">{r.nome}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: color + "15", color }}>
                            {r.ministerio}
                          </span>
                        </div>
                        <div className="flex gap-0.5 mb-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <svg key={s} className="w-4 h-4" fill={s <= r.score ? "#f59e0b" : "#e5e7eb"} viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                        </div>
                        <p className="text-sm text-[#5b5077] italic">"{r.comentario}"</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Jornada */}
      {abaRelatorio === "jornada" && (
        <div className="space-y-4">
          <p className="text-sm text-[#7c6ea8]">Jornada completa de serviço de cada voluntário</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {voluntarios.filter((v) => v.status === "ativo").map((v) => {
              const taxa = safeTaxa(v.presencas, v.faltas);
              const color = MINISTERIO_COLORS[v.ministerio]?.text || "#7c3aed";
              const initials = v.nome.split(" ").slice(0, 2).map((n) => n[0]).join("");
              const mesesServ = Math.floor((Date.now() - new Date(v.dataIngresso).getTime()) / (1000 * 60 * 60 * 24 * 30));
              return (
                <div key={v.id} className="bg-white rounded-2xl border border-[#e5e0f8] p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </div>
                    <div>
                      <p className="font-semibold text-[#1e1b4b]">{v.nome}</p>
                      <p className="text-xs text-[#7c6ea8]">{v.ministerio} · {mesesServ} meses servindo</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-[#f5f3ff] rounded-xl p-2.5">
                      <p className="text-lg font-bold text-[#1e1b4b]">{v.presencas}</p>
                      <p className="text-xs text-[#7c6ea8]">Serviços</p>
                    </div>
                    <div className="bg-[#f5f3ff] rounded-xl p-2.5">
                      <p className="text-lg font-bold" style={{ color: taxa > 85 ? "#10b981" : "#f59e0b" }}>{taxa}%</p>
                      <p className="text-xs text-[#7c6ea8]">Presença</p>
                    </div>
                    <div className="bg-[#f5f3ff] rounded-xl p-2.5">
                      <p className="text-lg font-bold text-[#1e1b4b]">{v.funcoes.length}</p>
                      <p className="text-xs text-[#7c6ea8]">Funções</p>
                    </div>
                  </div>
                  {/* Timeline bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-[#7c6ea8] mb-1">
                      <span>Ingresso: {new Date(v.dataIngresso).getFullYear()}</span>
                      <span>Hoje</span>
                    </div>
                    <div className="h-2 bg-[#f0eefe] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min((mesesServ / 60) * 100, 100)}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
