import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store";
import { MINISTERIO_COLORS, MINISTERIOS } from "../lib/constants";
import { Avatar } from "../components/Avatar";
import { Skeleton, ListItemSkeleton } from "../components/Skeleton";
import { ModalPortal } from "../components/ModalPortal";

const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const mesNomes = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface ScheduleItem {
  id: string;
  status: string;
  roleName: string;
  member: { id: string; name: string; photoUrl?: string; avatarKey?: string | null };
  checkin?: { id: string; arrived: boolean };
}

interface Event {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string;
  scheduleItems: ScheduleItem[];
}

interface Ministry {
  id: string;
  name: string;
  roles: Array<{ id: string; name: string }>;
}

interface MemberOption {
  id: string;
  name: string;
  approvalStatus: string;
  photoUrl?: string | null;
  avatarKey?: string | null;
  ministryMembers?: Array<{
    ministryId: string;
    roles: string[];
  }>;
}

interface Suggestion {
  memberId: string;
  name: string;
  photoUrl?: string | null;
  avatarKey?: string | null;
  roles: string[];
  timesServedLast90d: number;
}

interface DayScheduleItem extends ScheduleItem {
  eventTitle: string;
  eventType: string;
  eventId: string;
}

const MONTHS_PT: Record<string, number> = {
  JANEIRO: 0,
  FEVEREIRO: 1,
  MARÇO: 2,
  MARCO: 2,
  ABRIL: 3,
  MAIO: 4,
  JUNHO: 5,
  JULHO: 6,
  AGOSTO: 7,
  SETEMBRO: 8,
  OUTUBRO: 9,
  NOVEMBRO: 10,
  DEZEMBRO: 11,
};

const SLOT_EVENT_MAP: Record<string, { title: string; type: string; startTime: string }> = {
  "DOMINGO/ MANHÃ": { title: "Culto Domingo Manhã", type: "SUNDAY_MORNING", startTime: "09:00" },
  "DOMINGO/ NOITE": { title: "Culto Domingo Noite", type: "SUNDAY_EVENING", startTime: "18:00" },
  "SEGUNDA-FEIRA": { title: "Reunião Segunda-feira", type: "SPECIAL_EVENT", startTime: "19:30" },
  "QUARTA-FEIRA": { title: "Culto de Oração", type: "WEDNESDAY_PRAYER", startTime: "19:30" },
  "SEXTA E SABADO/NOITE": { title: "Culto Sexta/Sábado Noite", type: "SPECIAL_EVENT", startTime: "19:30" },
};

function normalizeHeader(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function inferRoleName(title: string, sheetName: string) {
  const match = title.match(/escala\s+(.+)$/i);
  if (match) return match[1].trim();
  return sheetName.replace(/\s*\([^)]*\)/g, "").trim();
}

function parseMatrixRows(rows: any[][], sheetName: string) {
  const currentYear = new Date().getFullYear();
  const parsed: Array<{ eventTitle: string; eventType: string; date: string; startTime: string; roleName: string; memberName: string }> = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] || [];
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      if (normalizeHeader(row[colIndex]) !== "MÊS") continue;

      let titleCell = "";
      for (let seekRow = Math.max(0, rowIndex - 4); seekRow < rowIndex; seekRow++) {
        for (let seekCol = Math.max(0, colIndex - 1); seekCol <= Math.min(rows[seekRow]?.length ?? 0, colIndex + 8); seekCol++) {
          const candidate = String(rows[seekRow]?.[seekCol] ?? "").trim();
          if (/escala/i.test(candidate)) titleCell = candidate;
        }
      }
      const roleName = inferRoleName(titleCell || sheetName, sheetName);
      const dayCol = colIndex + 1;

      const slotColumns: Array<{ col: number; header: string }> = [];
      for (let slotCol = colIndex + 2; slotCol < row.length; slotCol++) {
        const header = String(row[slotCol] ?? "").trim();
        if (!header) continue;
        if (normalizeHeader(header) === "MÊS") break;
        slotColumns.push({ col: slotCol, header });
      }

      let currentMonth: number | null = null;
      for (let dataRow = rowIndex + 1; dataRow < rows.length; dataRow++) {
        const values = rows[dataRow] || [];
        const monthLabel = normalizeHeader(values[colIndex]);
        const maybeDay = Number(values[dayCol]);

        if (monthLabel in MONTHS_PT) currentMonth = MONTHS_PT[monthLabel];
        if (!Number.isFinite(maybeDay) || maybeDay <= 0 || currentMonth === null) continue;

        const baseDate = new Date(currentYear, currentMonth, maybeDay);
        const dateStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}-${String(baseDate.getDate()).padStart(2, "0")}`;

        for (const slot of slotColumns) {
          const memberName = String(values[slot.col] ?? "").trim();
          if (!memberName) continue;
          const mapped = SLOT_EVENT_MAP[normalizeHeader(slot.header)] ?? {
            title: slot.header.trim(),
            type: "SPECIAL_EVENT",
            startTime: "19:30",
          };
          parsed.push({
            eventTitle: mapped.title,
            eventType: mapped.type,
            date: dateStr,
            startTime: mapped.startTime,
            roleName,
            memberName,
          });
        }
      }
    }
  }

  return parsed;
}

export default function Escalas() {
  const user = useAuth((s) => s.user);
  const isAdminOrLeader = user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesAtual, setMesAtual] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);
  const [filtroMinisterio, setFiltroMinisterio] = useState("Todos");
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Troca de Escala
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapItem, setSwapItem] = useState<DayScheduleItem | null>(null);
  const [swapTargetMemberId, setSwapTargetMemberId] = useState("");
  const [swapMessage, setSwapMessage] = useState("");
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);
  const [swapCandidates, setSwapCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Auto Gerar Escala
  const [modalAutoOpen, setModalAutoOpen] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [selectedMinistryId, setSelectedMinistryId] = useState("ALL");
  const [ministriesList, setMinistriesList] = useState<Ministry[]>([]);
  const [membersList, setMembersList] = useState<MemberOption[]>([]);
  const [autoResult, setAutoResult] = useState<{
    eventsProcessed: number;
    rolesAssigned: number;
    skippedRoles: number;
    assignments: Array<{
      eventTitle: string;
      roleName: string;
      memberName: string;
      ministryName: string;
    }>; 
  } | null>(null);
  const [modalAddOpen, setModalAddOpen] = useState(false);
  const [addingVolunteer, setAddingVolunteer] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedEventForAdd, setSelectedEventForAdd] = useState<string>("");
  const [selectedAddMinistryId, setSelectedAddMinistryId] = useState<string>("");
  const [selectedRoleName, setSelectedRoleName] = useState<string>("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [forceAssign, setForceAssign] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    createdEvents: number;
    notified: number;
    skipped: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<Array<{ row: number; eventTitle: string; roleName: string; memberName: string; status: "ready" | "warning" | "error"; message: string }>>([]);
  const [importDraftRows, setImportDraftRows] = useState<any[]>([]);
  const [importPreviewSummary, setImportPreviewSummary] = useState<{ total: number; ready: number; warnings: number; errors: number } | null>(null);
  const [replacementItem, setReplacementItem] = useState<DayScheduleItem | null>(null);
  const focusedEventId = searchParams.get("eventId");
  const focusedScheduleItemId = searchParams.get("scheduleItemId");

  useEffect(() => {
    api<Ministry[]>("/ministries")
      .then((data) => setMinistriesList(data))
      .catch(() => setMinistriesList([]));
    api<MemberOption[]>("/members")
      .then((data) => setMembersList(data.filter((item) => item.approvalStatus === "ACTIVE")))
      .catch(() => setMembersList([]));
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [mesAtual]);

  useEffect(() => {
    if (events.length === 0) return;
    const targetEvent = events.find((event) => event.id === focusedEventId)
      ?? events.find((event) => event.scheduleItems.some((item) => item.id === focusedScheduleItemId));
    if (!targetEvent) return;

    const eventDate = new Date(targetEvent.date);
    if (eventDate.getFullYear() !== mesAtual.year || eventDate.getMonth() !== mesAtual.month) {
      setMesAtual({ year: eventDate.getFullYear(), month: eventDate.getMonth() });
      return;
    }

    setDiaSelecionado(eventDate.getDate());
  }, [events, focusedEventId, focusedScheduleItemId, mesAtual.month, mesAtual.year]);

  async function fetchEvents() {
    setLoading(true);
    try {
      const data = await api<Event[]>("/events");
      const startOfMonth = new Date(mesAtual.year, mesAtual.month, 1);
      const endOfMonth = new Date(mesAtual.year, mesAtual.month + 1, 0, 23, 59, 59);
      const filtered = data.filter((ev) => {
        const d = new Date(ev.date);
        return d >= startOfMonth && d <= endOfMonth;
      });
      setEvents(filtered);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoGenerate() {
    setGerando(true);
    setAutoResult(null);
    try {
      const result = await api<any>("/schedules/auto-generate", {
        method: "POST",
        body: {
          year: mesAtual.year,
          month: mesAtual.month + 1,
          ministryId: selectedMinistryId === "ALL" ? undefined : selectedMinistryId,
          overwrite,
        },
      });
      setAutoResult(result);
      await fetchEvents();
    } catch (err: any) {
      alert(err.message || "Erro ao gerar escala automática.");
    } finally {
      setGerando(false);
    }
  }

  function eventosPorDia(dia: number): Event[] {
    return events.filter((ev) => {
      const d = new Date(ev.date);
      return d.getFullYear() === mesAtual.year
        && d.getMonth() === mesAtual.month
        && d.getDate() === dia;
    });
  }

  const diasNoMes = new Date(mesAtual.year, mesAtual.month + 1, 0).getDate();
  const primeiroOffset = new Date(mesAtual.year, mesAtual.month, 1).getDay();

  const eventDays = new Set(events.map((ev) => new Date(ev.date).getDate()));
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === mesAtual.year && today.getMonth() === mesAtual.month;

  function navigateMonth(delta: number) {
    setMesAtual((prev) => {
      const newDate = new Date(prev.year, prev.month + delta, 1);
      return { year: newDate.getFullYear(), month: newDate.getMonth() };
    });
    setDiaSelecionado(null);
  }

  const eventosDoDia = diaSelecionado ? eventosPorDia(diaSelecionado) : [];
  const itemsDoDia = eventosDoDia.flatMap((ev) =>
    ev.scheduleItems.map((item) => ({ ...item, eventTitle: ev.title, eventType: ev.type, eventId: ev.id }))
  );
  const itemsFiltrados = filtroMinisterio === "Todos"
    ? itemsDoDia
    : itemsDoDia.filter((item) => item.roleName === filtroMinisterio);
  const eventOptions = eventosDoDia;
  const selectedMinistry = ministriesList.find((item) => item.id === selectedAddMinistryId) || null;
  const availableMembers = membersList.filter((member) => {
    if (!selectedAddMinistryId) return true;
    const link = member.ministryMembers?.find((item) => item.ministryId === selectedAddMinistryId);
    if (!link) return false;
    if (!selectedRoleName) return true;
    return link.roles.length === 0 || link.roles.includes(selectedRoleName);
  });

  useEffect(() => {
    if (!modalAddOpen) return;
    const firstEventId = eventOptions[0]?.id ?? "";
    setSelectedEventForAdd((current) => current || firstEventId);
  }, [modalAddOpen, eventOptions]);

  useEffect(() => {
    if (!selectedMinistry) {
      setSelectedRoleName("");
      return;
    }
    if (!selectedMinistry.roles.some((role) => role.name === selectedRoleName)) {
      setSelectedRoleName(selectedMinistry.roles[0]?.name ?? "");
    }
  }, [selectedMinistry, selectedRoleName]);

  useEffect(() => {
    if (!modalAddOpen || !selectedEventForAdd || !selectedAddMinistryId || !selectedRoleName) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    api<Suggestion[]>(`/events/${selectedEventForAdd}/suggestions?ministryId=${encodeURIComponent(selectedAddMinistryId)}&role=${encodeURIComponent(selectedRoleName)}`)
      .then((data) => setSuggestions(data))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false));
  }, [modalAddOpen, selectedEventForAdd, selectedAddMinistryId, selectedRoleName]);

  function openAddVolunteerModal() {
    const firstEventId = eventOptions[0]?.id ?? "";
    const firstMinistryId = ministriesList[0]?.id ?? "";
    setAddError(null);
    setSelectedEventForAdd(firstEventId);
    setSelectedAddMinistryId(firstMinistryId);
    setSelectedRoleName(ministriesList[0]?.roles?.[0]?.name ?? "");
    setSelectedMemberId("");
    setForceAssign(false);
    setSuggestions([]);
    setReplacementItem(null);
    setModalAddOpen(true);
  }

  function openReplaceVolunteerModal(item: DayScheduleItem) {
    const inferredMinistry = ministriesList.find((ministry) => ministry.roles.some((role) => role.name === item.roleName));
    setAddError(null);
    setReplacementItem(item);
    setSelectedEventForAdd(item.eventId);
    setSelectedAddMinistryId(inferredMinistry?.id ?? "");
    setSelectedRoleName(item.roleName);
    setSelectedMemberId("");
    setForceAssign(false);
    setSuggestions([]);
    setModalAddOpen(true);
  }

  async function handleAddVolunteer() {
    if (!selectedEventForAdd || !selectedRoleName || !selectedMemberId) return;
    if (replacementItem && replacementItem.member.id === selectedMemberId) {
      setAddError("Escolha outro voluntário para substituir a escala atual.");
      return;
    }
    setAddingVolunteer(true);
    setAddError(null);
    try {
      await api(`/events/${selectedEventForAdd}/schedule`, {
        method: "POST",
        body: {
          memberId: selectedMemberId,
          roleName: selectedRoleName,
          ministryId: selectedAddMinistryId || undefined,
          force: forceAssign,
        },
      });
      if (replacementItem) {
        await api(`/schedule-items/${replacementItem.id}`, { method: "DELETE" });
      }
      await fetchEvents();
      setModalAddOpen(false);
    } catch (err: any) {
      setAddError(err?.message || "Não foi possível adicionar o voluntário.");
    } finally {
      setAddingVolunteer(false);
    }
  }

  async function handleRemoveScheduleItem(id: string) {
    try {
      await api(`/schedule-items/${id}`, { method: "DELETE" });
      await fetchEvents();
    } catch (err: any) {
      alert(err?.message || "Não foi possível remover o voluntário da escala.");
    }
  }

  async function handleRespondSchedule(id: string, action: "CONFIRM" | "DECLINE") {
    setRespondingId(id);
    try {
      await api(`/schedule-items/${id}/respond`, {
        method: "POST",
        body: { action },
      });
      await fetchEvents();
    } catch (err: any) {
      alert(err?.message || "Não foi possível responder à escala.");
    } finally {
      setRespondingId(null);
    }
  }

  async function openSwapModal(item: DayScheduleItem) {
    setSwapItem(item);
    setSwapTargetMemberId("");
    setSwapMessage("");
    setSwapError(null);
    setSwapSuccess(null);
    setSwapModalOpen(true);
    setLoadingCandidates(true);
    try {
      const inferredMinistry = ministriesList.find((m) => m.roles.some((r) => r.name === item.roleName));
      if (inferredMinistry) {
        const candidates = await api<Array<{ memberId: string; name: string }>>(
          `/events/${item.eventId}/suggestions?ministryId=${inferredMinistry.id}&role=${encodeURIComponent(item.roleName)}`
        );
        const filtered = candidates
          .map((c) => ({ id: c.memberId, name: c.name }))
          .filter((c) => c.id !== user?.memberId && c.id !== item.member.id);
        setSwapCandidates(filtered);
      } else {
        setSwapCandidates(membersList.filter((m) => m.id !== user?.memberId && m.id !== item.member.id).map((m) => ({ id: m.id, name: m.name })));
      }
    } catch {
      setSwapCandidates(membersList.filter((m) => m.id !== user?.memberId && m.id !== item.member.id).map((m) => ({ id: m.id, name: m.name })));
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function handleSendSwapRequest() {
    if (!swapItem || !swapTargetMemberId) return;
    setSwapSubmitting(true);
    setSwapError(null);
    try {
      await api(`/schedule-items/${swapItem.id}/swap`, {
        method: "POST",
        body: {
          targetMemberId: swapTargetMemberId,
          message: swapMessage.trim() || undefined,
        },
      });
      setSwapSuccess("Pedido de troca enviado com sucesso! O voluntário e a liderança foram notificados.");
      await fetchEvents();
      setTimeout(() => {
        setSwapModalOpen(false);
        setSwapSuccess(null);
      }, 2200);
    } catch (err: any) {
      setSwapError(err?.message || "Não foi possível enviar o pedido de troca.");
    } finally {
      setSwapSubmitting(false);
    }
  }

  async function handleImportExcel(file: File) {
    setImportingExcel(true);
    setImportSummary(null);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const mappedRows = workbook.SheetNames.flatMap((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
        const rowFormat = jsonRows.map((row) => {
          const eventTitle = String(row.eventTitle || row["Evento"] || row["event"] || row["Culto"] || "").trim();
          const eventType = String(row.eventType || row["Tipo"] || "SPECIAL_EVENT").trim();
          const date = String(row.date || row["Data"] || row["Dia"] || "").trim();
          const startTime = String(row.startTime || row["Horário"] || row["Horario"] || row["Hora"] || row["Inicio"] || "").trim();
          const endTime = String(row.endTime || row["Fim"] || "").trim();
          const roleName = String(row.roleName || row["Função"] || row["Funcao"] || row["Cargo"] || "").trim();
          const memberName = String(row.memberName || row["Voluntário"] || row["Voluntario"] || row["Nome"] || "").trim();
          const memberEmail = String(row.memberEmail || row["Email"] || "").trim();
          const memberPhone = String(row.memberPhone || row["Telefone"] || row["WhatsApp"] || "").trim();

            return {
              eventTitle,
              eventType,
              ministryName: String(row.ministryName || row["Ministério"] || row["Ministerio"] || row["Equipe"] || "").trim() || undefined,
              date,
              startTime,
            endTime: endTime || undefined,
            roleName,
            memberName,
            memberEmail: memberEmail || undefined,
            memberPhone: memberPhone || undefined,
          };
        }).filter((row) => row.eventTitle && row.date && row.startTime && row.roleName && row.memberName);

        if (rowFormat.length > 0) return rowFormat;

        const matrixRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][];
        return parseMatrixRows(matrixRows, sheetName);
      });

      if (mappedRows.length === 0) {
        throw new Error("A planilha não contém linhas válidas. Use colunas como Evento, Data, Horário, Função e Voluntário.");
      }

      const preview = await api<{ summary: { total: number; ready: number; warnings: number; errors: number }; rows: Array<{ row: number; eventTitle: string; roleName: string; memberName: string; status: "ready" | "warning" | "error"; message: string }> }>("/schedules/import/preview", {
        method: "POST",
        body: {
          rows: mappedRows,
          createMissingEvents: true,
        },
      });

      setImportDraftRows(mappedRows);
      setImportPreviewRows(preview.rows);
      setImportPreviewSummary(preview.summary);
      setImportPreviewOpen(true);
    } catch (err: any) {
      alert(err?.message || "Não foi possível importar a planilha.");
    } finally {
      setImportingExcel(false);
    }
  }

  async function confirmImportExcel() {
    if (importDraftRows.length === 0) return;
    setImportingExcel(true);
    try {
      const result = await api<{
        imported: number;
        createdEvents: number;
        notified: number;
        skipped: number;
        errors: Array<{ row: number; message: string }>;
      }>("/schedules/import", {
        method: "POST",
        body: {
          rows: importDraftRows,
          notify: true,
          overwritePending: false,
          createMissingEvents: true,
        },
      });
      setImportSummary(result);
      setImportPreviewOpen(false);
      setImportDraftRows([]);
      await fetchEvents();
    } catch (err: any) {
      alert(err?.message || "Não foi possível confirmar a importação.");
    } finally {
      setImportingExcel(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Escalas — {mesNomes[mesAtual.month]} {mesAtual.year}
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {events.length} eventos este mês
          </p>
        </div>
        {isAdminOrLeader && (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e5e0f8] text-[#7c3aed] text-sm font-semibold hover:bg-[#f5f3ff] transition-all cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportExcel(file);
                  e.currentTarget.value = "";
                }}
              />
              {importingExcel ? "Importando Excel..." : "Importar Excel"}
            </label>
            <button
              onClick={() => {
                setAutoResult(null);
                setModalAutoOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 shadow-sm cursor-pointer"
              style={{ backgroundColor: "#7c3aed" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Gerar Escala Automática
            </button>
          </div>
        )}
      </div>

      {importSummary && (
        <div className="rounded-2xl border border-[#d1fae5] bg-[#ecfdf5] px-5 py-4 text-sm text-[#166534] space-y-2">
          <p className="font-semibold">Importação concluída</p>
          <p>
            {importSummary.imported} escala(s) importada(s), {importSummary.createdEvents} evento(s) criado(s), {importSummary.skipped} linha(s) ignorada(s)
            {importSummary.notified > 0 ? ` e ${importSummary.notified} notificação(ões) disparada(s).` : "."}
          </p>
          {importSummary.errors.length > 0 && (
            <div className="text-xs text-[#166534]">
              <p className="font-semibold mb-1">Linhas ignoradas:</p>
              <ul className="list-disc pl-5 space-y-1">
                {importSummary.errors.slice(0, 8).map((error) => (
                  <li key={`${error.row}-${error.message}`}>Linha {error.row}: {error.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {importPreviewOpen && importPreviewSummary && (
        <ModalPortal isOpen={importPreviewOpen && !!importPreviewSummary}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setImportPreviewOpen(false)} />
            <div className="relative bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-[#e5e0f8] space-y-5 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] my-auto overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#f0eefe] pb-4 flex-shrink-0">
                <div>
                  <h3 className="font-bold text-lg text-[#1e1b4b]">Prévia da importação de escala</h3>
                  <p className="text-xs text-[#7c6ea8]">Revise as linhas antes de gravar no banco.</p>
                </div>
                <button onClick={() => setImportPreviewOpen(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center flex-shrink-0">
                <div className="rounded-xl bg-[#f5f3ff] p-3"><p className="text-lg font-bold text-[#1e1b4b]">{importPreviewSummary.total}</p><p className="text-xs text-[#7c6ea8]">Linhas</p></div>
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-lg font-bold text-emerald-700">{importPreviewSummary.ready}</p><p className="text-xs text-emerald-700">Prontas</p></div>
                <div className="rounded-xl bg-amber-50 p-3"><p className="text-lg font-bold text-amber-700">{importPreviewSummary.warnings}</p><p className="text-xs text-amber-700">Avisos</p></div>
                <div className="rounded-xl bg-rose-50 p-3"><p className="text-lg font-bold text-rose-700">{importPreviewSummary.errors}</p><p className="text-xs text-rose-700">Erros</p></div>
              </div>
              <div className="overflow-y-auto border border-[#ede9fe] rounded-xl flex-1">
                <table className="w-full text-sm">
                  <thead className="bg-[#faf8ff] sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2">Linha</th>
                      <th className="text-left px-4 py-2">Evento</th>
                      <th className="text-left px-4 py-2">Função</th>
                      <th className="text-left px-4 py-2">Voluntário</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreviewRows.slice(0, 50).map((row) => (
                      <tr key={`${row.row}-${row.memberName}-${row.roleName}`} className="border-t border-[#f0eefe]">
                        <td className="px-4 py-2">{row.row}</td>
                        <td className="px-4 py-2">{row.eventTitle}</td>
                        <td className="px-4 py-2">{row.roleName}</td>
                        <td className="px-4 py-2">{row.memberName}</td>
                        <td className="px-4 py-2"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${row.status === "ready" ? "bg-emerald-100 text-emerald-700" : row.status === "warning" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{row.message}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#f0eefe] flex-shrink-0">
                <button type="button" onClick={() => setImportPreviewOpen(false)} disabled={importingExcel} className="px-4 py-2 text-xs font-medium text-[#5b5077] hover:bg-gray-100 rounded-xl transition-all">Cancelar</button>
                <button type="button" onClick={confirmImportExcel} disabled={importingExcel || importPreviewSummary.errors > 0} className="px-5 py-2.5 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm disabled:opacity-50" style={{ backgroundColor: "#7c3aed" }}>
                  {importingExcel ? "Importando..." : "Confirmar importação"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f0eefe] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateMonth(-1)}
                className="w-8 h-8 rounded-lg border border-[#e5e0f8] flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-[#7c6ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="font-semibold text-[#1e1b4b]">{mesNomes[mesAtual.month]} {mesAtual.year}</h2>
              <button
                onClick={() => navigateMonth(1)}
                className="w-8 h-8 rounded-lg border border-[#e5e0f8] flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-[#7c6ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#7c3aed" }} />
              <span className="text-[#7c6ea8]">Com escala</span>
              <span className="w-3 h-3 rounded-full inline-block bg-amber-400 ml-2" />
              <span className="text-[#7c6ea8]">Incompleto</span>
            </div>
          </div>
          <div className="p-4">
            {/* Days header */}
            <div className="grid grid-cols-7 mb-2">
              {dias.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-[#7c6ea8] py-1">
                  {d}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            {loading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: primeiroOffset }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {Array.from({ length: diasNoMes }).map((_, i) => {
                  const day = i + 1;
                  const temEscala = eventDays.has(day);
                  const isSelected = diaSelecionado === day;
                  const isToday = isCurrentMonth && today.getDate() === day;
                  return (
                    <button
                      key={day}
                      onClick={() => setDiaSelecionado(day === diaSelecionado ? null : day)}
                      className={[
                        "relative aspect-square rounded-xl text-sm font-medium transition-all",
                        isSelected
                          ? "text-white"
                          : temEscala
                            ? "text-[#1e1b4b] hover:bg-[#f5f3ff]"
                            : "text-[#7c6ea8] hover:bg-gray-50",
                      ].join(" ")}
                      style={isSelected ? { backgroundColor: "#7c3aed" } : {}}
                    >
                      {isToday && !isSelected && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#7c3aed]" />
                      )}
                      {day}
                      {temEscala && !isSelected && (
                        <span
                          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                          style={{ backgroundColor: "#7c3aed" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Escala do dia */}
        <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-[#f0eefe]">
            <h2 className="font-semibold text-[#1e1b4b]">
              {diaSelecionado
                ? `${diaSelecionado} de ${mesNomes[mesAtual.month]}`
                : "Selecione um dia"}
            </h2>
            {diaSelecionado && (
              <div className="mt-2">
                <select
                  value={filtroMinisterio}
                  onChange={(e) => setFiltroMinisterio(e.target.value)}
                  className="text-xs border border-[#e5e0f8] rounded-lg px-2 py-1 text-[#5b5077] bg-white focus:outline-none focus:border-[#a78bfa]"
                >
                  <option>Todos</option>
                  {MINISTERIOS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-2">
                <ListItemSkeleton />
                <ListItemSkeleton />
                <ListItemSkeleton />
              </div>
            ) : !diaSelecionado ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#7c6ea8]">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Clique em um dia para ver a escala</p>
              </div>
            ) : eventosDoDia.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#7c6ea8]">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Nenhum evento neste dia</p>
              </div>
            ) : itemsFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#7c6ea8]">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm">Sem escalas para este ministério</p>
                {isAdminOrLeader && (
                  <button onClick={openAddVolunteerModal} className="mt-2 text-xs text-[#7c3aed] hover:underline">+ Adicionar voluntário</button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#f0eefe]">
                {itemsFiltrados.map((item) => {
                  const roleName = item.roleName;
                  const colors = MINISTERIO_COLORS[roleName] || { bg: "#f5f3ff", text: "#7c3aed" };
                  const isMyItem = item.member.id === user?.memberId || item.member.name === user?.memberName;
                  const isPending = item.status === "PENDING";
                  const isConfirmed = item.status === "CONFIRMED";
                  const isDeclined = item.status === "DECLINED";
                  const isSwap = item.status === "SWAP_REQUESTED";

                  return (
                    <div key={item.id} className={`px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fafafe] transition-colors group ${focusedScheduleItemId === item.id ? "bg-[#faf5ff] ring-2 ring-inset ring-[#7c3aed]" : ""}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={item.member.name} avatarKey={item.member.avatarKey} size={36} className="flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#1e1b4b] truncate">{item.member.name}</p>
                            {isMyItem && (
                              <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-1.5 py-0.2 rounded">Você</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: colors.bg, color: colors.text }}
                            >
                              {roleName}
                            </span>
                            <span className="text-xs text-[#7c6ea8]">{item.eventTitle}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* Status Badge */}
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          isConfirmed ? "bg-emerald-100 text-emerald-700" :
                          isPending ? "bg-amber-100 text-amber-700" :
                          isDeclined ? "bg-rose-100 text-rose-700" :
                          isSwap ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-700"
                        }`}>
                          {isConfirmed ? "Confirmado ✅" :
                           isPending ? "Aguardando resposta ⏳" :
                           isDeclined ? "Recusado ❌" :
                           isSwap ? "Troca pendente 🔄" : item.status}
                        </span>

                        {/* Botões de Ação para o voluntário logado */}
                        {isMyItem && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleRespondSchedule(item.id, "CONFIRM")}
                                  disabled={respondingId === item.id}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                                  title="Confirmar presença nesta escala"
                                >
                                  {respondingId === item.id ? "Confirmando..." : "Confirmar"}
                                </button>
                                <button
                                  onClick={() => handleRespondSchedule(item.id, "DECLINE")}
                                  disabled={respondingId === item.id}
                                  className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all disabled:opacity-50"
                                  title="Recusar esta escala"
                                >
                                  Recusar
                                </button>
                              </>
                            )}
                            {!isDeclined && !isSwap && (
                              <button
                                onClick={() => openSwapModal(item)}
                                className="px-2.5 py-1 rounded-lg border border-[#c4b5fd] text-[#7c3aed] hover:bg-[#f5f3ff] text-xs font-semibold transition-all flex items-center gap-1"
                                title="Solicitar troca com outro voluntário"
                              >
                                <span>🔄</span> Pedir Troca
                              </button>
                            )}
                          </div>
                        )}

                        {/* Botões administrativos de substituir/remover */}
                        {isAdminOrLeader && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openReplaceVolunteerModal(item)} className="w-7 h-7 rounded-lg hover:bg-amber-50 flex items-center justify-center text-amber-500" title="Substituir voluntário">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                            </button>
                            <button onClick={() => handleRemoveScheduleItem(item.id)} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500" title="Remover da escala">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isAdminOrLeader && diaSelecionado && eventosDoDia.length > 0 && (
            <div className="px-6 py-4 border-t border-[#f0eefe]">
              <button onClick={openAddVolunteerModal} className="w-full py-2 rounded-xl text-sm font-semibold border-2 border-dashed border-[#c4b5fd] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors">
                + Adicionar Voluntário
              </button>
            </div>
          )}
        </div>
      </div>

      {modalAddOpen && (
        <ModalPortal isOpen={modalAddOpen}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalAddOpen(false)} />
            <div className="relative bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#e5e0f8] space-y-5 my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-y-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#f0eefe] pb-4 flex-shrink-0">
                <div>
                  <h3 className="font-bold text-lg text-[#1e1b4b]">{replacementItem ? "Substituir voluntário da escala" : "Adicionar voluntário à escala"}</h3>
                  <p className="text-xs text-[#7c6ea8]">{replacementItem ? `Escala atual: ${replacementItem.member.name} em ${replacementItem.eventTitle}` : "Escolha evento, ministério, função e voluntário."}</p>
                </div>
                <button onClick={() => setModalAddOpen(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">✕</button>
              </div>

              {addError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{addError}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider mb-1.5">Evento</label>
                  <select value={selectedEventForAdd} onChange={(e) => setSelectedEventForAdd(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] bg-white focus:outline-none focus:border-[#7c3aed]">
                    <option value="">Selecione o evento</option>
                    {eventOptions.map((event) => (
                      <option key={event.id} value={event.id}>{event.title} — {new Date(event.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider mb-1.5">Ministério</label>
                  <select value={selectedAddMinistryId} onChange={(e) => setSelectedAddMinistryId(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] bg-white focus:outline-none focus:border-[#7c3aed]">
                    <option value="">Selecione o ministério</option>
                    {ministriesList.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider mb-1.5">Função</label>
                  <select value={selectedRoleName} onChange={(e) => setSelectedRoleName(e.target.value)} disabled={!selectedMinistry} className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] bg-white focus:outline-none focus:border-[#7c3aed] disabled:opacity-50">
                    <option value="">Selecione a função</option>
                    {(selectedMinistry?.roles ?? []).map((role) => (
                      <option key={role.id} value={role.name}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider mb-1.5">Voluntário</label>
                  <select value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)} className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] bg-white focus:outline-none focus:border-[#7c3aed]">
                    <option value="">Selecione o voluntário</option>
                    {availableMembers.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[#5b5077]">
                <input type="checkbox" checked={forceAssign} onChange={(e) => setForceAssign(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                Permitir conflito de horário se o líder quiser forçar a escala
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#5b5077] uppercase tracking-wider">Sugestões inteligentes</p>
                  {loadingSuggestions && <span className="text-[11px] text-[#7c6ea8]">Carregando...</span>}
                </div>
                {suggestions.length === 0 ? (
                  <div className="rounded-xl border border-[#ede9fe] bg-[#faf8ff] px-4 py-3 text-sm text-[#7c6ea8]">Selecione ministério e função para ver as melhores sugestões.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {suggestions.slice(0, 6).map((suggestion) => (
                      <button key={suggestion.memberId} onClick={() => setSelectedMemberId(suggestion.memberId)} className={`rounded-xl border p-3 text-left transition-colors ${selectedMemberId === suggestion.memberId ? "border-[#7c3aed] bg-[#faf5ff]" : "border-[#ede9fe] hover:bg-[#faf8ff]"}`}>
                        <div className="flex items-center gap-3">
                          <Avatar name={suggestion.name} photoUrl={suggestion.photoUrl} avatarKey={suggestion.avatarKey} size={36} />
                          <div>
                            <p className="text-sm font-semibold text-[#1e1b4b]">{suggestion.name}</p>
                            <p className="text-[11px] text-[#7c6ea8]">Últimos 90 dias: {suggestion.timesServedLast90d} escala(s)</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#f0eefe] flex-shrink-0">
                <button type="button" onClick={() => setModalAddOpen(false)} disabled={addingVolunteer} className="px-4 py-2 text-xs font-medium text-[#5b5077] hover:bg-gray-100 rounded-xl transition-all">Cancelar</button>
                <button type="button" onClick={handleAddVolunteer} disabled={addingVolunteer || !selectedEventForAdd || !selectedRoleName || !selectedMemberId} className="px-5 py-2.5 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50" style={{ backgroundColor: "#7c3aed" }}>
                  {addingVolunteer ? (replacementItem ? "Substituindo..." : "Adicionando...") : (replacementItem ? "Confirmar substituição" : "Confirmar voluntário")}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal de Geração Automática */}
      {modalAutoOpen && (
        <ModalPortal isOpen={modalAutoOpen}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalAutoOpen(false)} />
            <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#e5e0f8] space-y-5 my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-y-auto animate-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[#f0eefe] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#ede9fe] flex items-center justify-center text-xl">
                  ⚡
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#1e1b4b]">Gerar Escala Automática</h3>
                  <p className="text-xs text-[#7c6ea8]">
                    {mesNomes[mesAtual.month]} de {mesAtual.year}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalAutoOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {autoResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                    <span>🎉</span> Escala gerada com sucesso!
                  </div>
                  <p className="text-xs text-emerald-700">
                    <strong>{autoResult.rolesAssigned}</strong> voluntários foram escalados em{" "}
                    <strong>{autoResult.eventsProcessed}</strong> eventos com balanceamento inteligente.
                  </p>
                </div>

                {autoResult.assignments.length > 0 && (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    <p className="text-xs font-semibold text-[#5b5077] uppercase tracking-wider">
                      Atribuições Realizadas:
                    </p>
                    {autoResult.assignments.map((a, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-[#f8f7ff] border border-[#ede9fe] rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#1e1b4b]">{a.memberName}</p>
                          <p className="text-[11px] text-[#7c6ea8]">
                            {a.eventTitle} · {a.ministryName}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full font-medium bg-[#ede9fe] text-[#7c3aed]">
                          {a.roleName}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setModalAutoOpen(false)}
                    className="px-5 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer"
                    style={{ backgroundColor: "#7c3aed" }}
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider mb-1.5">
                    Ministério Alvo
                  </label>
                  <select
                    value={selectedMinistryId}
                    onChange={(e) => setSelectedMinistryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] bg-white focus:outline-none focus:border-[#7c3aed]"
                  >
                    <option value="ALL">🏛️ Todos os Ministérios</option>
                    {ministriesList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="overwriteCheck"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                    className="w-4 h-4 rounded text-[#7c3aed] border-gray-300 focus:ring-[#7c3aed]"
                  />
                  <label htmlFor="overwriteCheck" className="text-xs text-[#5b5077] cursor-pointer">
                    Substituir escalas pendentes já existentes no mês
                  </label>
                </div>

                <div className="p-3.5 bg-[#f8f7ff] border border-[#ede9fe] rounded-xl text-xs text-[#5b5077] space-y-1 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-semibold text-[#7c3aed]">
                    <span>🧠</span> Algoritmo Inteligente Volut:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#7c6ea8]">
                    <li>Verifica indisponibilidades e bloqueios de data informados pelos voluntários.</li>
                    <li>Evita sobreposição de horários entre diferentes ministérios no mesmo culto.</li>
                    <li>Prioriza voluntários com menor número de escalas nos últimos 90 dias (revezamento justo).</li>
                  </ul>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#f0eefe]">
                  <button
                    type="button"
                    onClick={() => setModalAutoOpen(false)}
                    disabled={gerando}
                    className="px-4 py-2 text-xs font-medium text-[#5b5077] hover:bg-gray-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoGenerate}
                    disabled={gerando}
                    className="px-5 py-2.5 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: "#7c3aed" }}
                  >
                    {gerando ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Calculando e Escalando...
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        Confirmar e Gerar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </ModalPortal>
    )}

      {/* Modal de Solicitar Troca de Escala */}
      {swapModalOpen && swapItem && (
        <ModalPortal isOpen={swapModalOpen && !!swapItem}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSwapModalOpen(false)} />
            <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#e5e0f8] space-y-5 my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-y-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#f0eefe] pb-4 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl">
                    🔄
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#1e1b4b]">Solicitar Troca de Escala</h3>
                    <p className="text-xs text-[#7c6ea8]">Envie um pedido para outro voluntário assumir sua vaga</p>
                  </div>
                </div>
                <button
                  onClick={() => setSwapModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Resumo da vaga */}
              <div className="p-3.5 bg-[#f8f7ff] border border-[#ede9fe] rounded-xl flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="font-bold text-sm text-[#1e1b4b]">{swapItem.eventTitle}</p>
                  <p className="text-xs text-[#7c6ea8] mt-0.5">
                    Função: <strong className="text-[#7c3aed]">{swapItem.roleName}</strong>
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 font-semibold">
                  Sua Vaga
                </span>
              </div>

              {swapSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <span>✅</span> {swapSuccess}
                </div>
              )}

              {swapError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <span>⚠️</span> {swapError}
                </div>
              )}

              {!swapSuccess && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider mb-1.5">
                      Trocar com qual voluntário? *
                    </label>
                    {loadingCandidates ? (
                      <div className="py-3 text-center text-xs text-[#7c6ea8]">Buscando voluntários disponíveis...</div>
                    ) : (
                      <select
                        value={swapTargetMemberId}
                        onChange={(e) => setSwapTargetMemberId(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] bg-white focus:outline-none focus:border-[#7c3aed]"
                      >
                        <option value="">Selecione um voluntário...</option>
                        {swapCandidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="text-[11px] text-[#7c6ea8] mt-1">
                      Mostrando voluntários habilitados para esta função sem conflito de horário.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider mb-1.5">
                      Mensagem / Motivo (opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={swapMessage}
                      onChange={(e) => setSwapMessage(e.target.value)}
                      placeholder="Ex: Não poderei neste dia por motivo de viagem. Consegue cobrir minha vaga?"
                      className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] bg-white focus:outline-none focus:border-[#7c3aed]"
                    />
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 leading-relaxed">
                    ℹ️ <strong>Como funciona a troca:</strong> O voluntário convidado receberá uma notificação no app e celular. O líder do ministério também será notificado. Assim que o voluntário aceitar, a escala será transferida para ele automaticamente.
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#f0eefe] flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setSwapModalOpen(false)}
                      disabled={swapSubmitting}
                      className="px-4 py-2 text-xs font-medium text-[#5b5077] hover:bg-gray-100 rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSendSwapRequest}
                      disabled={swapSubmitting || !swapTargetMemberId}
                      className="px-5 py-2.5 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: "#7c3aed" }}
                    >
                      {swapSubmitting ? "Enviando pedido..." : "Enviar Pedido de Troca 🔄"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
