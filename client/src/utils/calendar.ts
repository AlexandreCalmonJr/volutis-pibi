export interface CalendarEventData {
  title: string;
  description?: string;
  location?: string;
  startDate: Date | string;
  endDate?: Date | string;
}

/**
 * Formata data no padrão UTC exigido pelo iCalendar (YYYYMMDDTHHMMSSZ).
 */
function formatDateToICS(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Gera e dispara o download do arquivo .ics compatível com Apple Calendar, Google Agenda e Outlook.
 */
export function downloadIcsFile(event: CalendarEventData, filename = "escala-volut.ics") {
  const start = formatDateToICS(event.startDate);
  const end = event.endDate
    ? formatDateToICS(event.endDate)
    : formatDateToICS(new Date(new Date(event.startDate).getTime() + 2 * 60 * 60 * 1000)); // 2h de culto por padrão

  const uid = `volut-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@pibi.org.br`;
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Volut PIBI//Escala de Ministérios//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatDateToICS(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title.replace(/[\n\r]/g, " ")}`,
    event.description ? `DESCRIPTION:${event.description.replace(/[\n\r]/g, "\\n")}` : "DESCRIPTION:Escala no Volut PIBI",
    event.location ? `LOCATION:${event.location.replace(/[\n\r]/g, " ")}` : "LOCATION:Primeira Igreja Batista de Itapuã",
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lembrete de Escala no Volut PIBI",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Gera URL direta para adicionar evento no Google Agenda Web.
 */
export function getGoogleCalendarUrl(event: CalendarEventData): string {
  const start = formatDateToICS(event.startDate);
  const end = event.endDate
    ? formatDateToICS(event.endDate)
    : formatDateToICS(new Date(new Date(event.startDate).getTime() + 2 * 60 * 60 * 1000));

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description || "Escala de voluntário no Volut PIBI",
    location: event.location || "Primeira Igreja Batista de Itapuã",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
