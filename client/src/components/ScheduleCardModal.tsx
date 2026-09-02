import { useEffect, useRef, useState } from "react";
import { ModalPortal } from "./ModalPortal";

export interface ScheduleCardItem {
  id: string;
  roleName: string;
  status: string;
  member: {
    id: string;
    name: string;
  };
}

export interface ScheduleCardEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  theme?: string | null;
  scheduleItems: ScheduleCardItem[];
}

interface ScheduleCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ScheduleCardEvent | null;
  churchName?: string;
}

export function ScheduleCardModal({ isOpen, onClose, event, churchName = "Primeira Igreja Batista de Itapuã" }: ScheduleCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedImg, setCopiedImg] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Formatação de data e horário
  const formattedDate = event
    ? new Date(event.date).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  const formattedTime = event?.startTime
    ? /^\d{2}:\d{2}$/.test(event.startTime)
      ? event.startTime
      : new Date(event.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  useEffect(() => {
    if (!isOpen || !event) return;
    drawCard();
  }, [isOpen, event]);

  function drawCard() {
    const canvas = canvasRef.current;
    if (!canvas || !event) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setGenerating(true);

    // Resolução 1080 x 1350 (formato ideal para feed/WhatsApp/Stories)
    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;

    // 1. Fundo Gradiente Elegante
    const bgGradient = ctx.createLinearGradient(0, 0, W, H);
    bgGradient.addColorStop(0, "#0f0c20");
    bgGradient.addColorStop(0.5, "#181335");
    bgGradient.addColorStop(1, "#251b4d");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, W, H);

    // Efeito de iluminação suave
    const radial = ctx.createRadialGradient(W / 2, 200, 50, W / 2, 200, 600);
    radial.addColorStop(0, "rgba(124, 58, 237, 0.25)");
    radial.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, W, H);

    // 2. Borda externa suave
    ctx.strokeStyle = "rgba(167, 139, 250, 0.2)";
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    // 3. Topo: Nome da Igreja
    ctx.textAlign = "center";
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 24px sans-serif";
    ctx.letterSpacing = "4px";
    ctx.fillText(churchName.toUpperCase(), W / 2, 105);

    // 4. Título do Culto
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 56px sans-serif";
    ctx.letterSpacing = "0px";
    ctx.fillText(event.title, W / 2, 185);

    // 5. Badge de Data e Horário
    const dateText = `${formattedDate.toUpperCase()} • ${formattedTime}`;
    ctx.font = "bold 26px sans-serif";
    const textWidth = ctx.measureText(dateText).width;
    const badgeW = textWidth + 60;
    const badgeH = 54;
    const badgeX = (W - badgeW) / 2;
    const badgeY = 225;

    ctx.fillStyle = "rgba(124, 58, 237, 0.45)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 27);
    ctx.fill();
    ctx.strokeStyle = "rgba(196, 181, 253, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#f5f3ff";
    ctx.fillText(dateText, W / 2, badgeY + 36);

    // 6. Linha Divisória
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 325);
    ctx.lineTo(W - 80, 325);
    ctx.stroke();

    // 7. Lista de Voluntários Escalados
    const items = event.scheduleItems || [];
    const startY = 370;
    const colWidth = 440;
    const colGap = 40;
    const startXCol1 = 80;
    const startXCol2 = startXCol1 + colWidth + colGap;

    if (items.length === 0) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "32px sans-serif";
      ctx.fillText("Nenhum voluntário escalado ainda neste culto.", W / 2, 600);
    } else {
      // Divide em até 2 colunas
      const maxRows = 10;
      items.slice(0, 20).forEach((item, index) => {
        const isCol2 = index >= maxRows;
        const colX = isCol2 ? startXCol2 : startXCol1;
        const rowIndex = isCol2 ? index - maxRows : index;
        const rowY = startY + rowIndex * 80;

        // Card do voluntário
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(colX, rowY, colWidth, 68, 16);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Ponto indicador
        ctx.fillStyle = "#7c3aed";
        ctx.beginPath();
        ctx.arc(colX + 24, rowY + 34, 7, 0, Math.PI * 2);
        ctx.fill();

        // Função
        ctx.textAlign = "left";
        ctx.fillStyle = "#c4b5fd";
        ctx.font = "bold 20px sans-serif";
        const roleStr = item.roleName.length > 22 ? item.roleName.slice(0, 22) + "..." : item.roleName;
        ctx.fillText(roleStr, colX + 44, rowY + 30);

        // Nome do voluntário
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px sans-serif";
        const nameStr = item.member.name.length > 20 ? item.member.name.slice(0, 20) + "..." : item.member.name;
        ctx.fillText(nameStr, colX + 44, rowY + 56);
      });
    }

    // 8. Rodapé
    ctx.textAlign = "center";
    ctx.fillStyle = "#7c6ea8";
    ctx.font = "20px sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("VOLUT • GESTÃO DE ESCALAS E CULTOS", W / 2, H - 75);

    setGenerating(false);
  }

  // Baixar Imagem PNG
  function handleDownloadPNG() {
    const canvas = canvasRef.current;
    if (!canvas || !event) return;
    const link = document.createElement("a");
    const safeTitle = event.title.toLowerCase().replace(/\s+/g, "-");
    link.download = `escala-${safeTitle}-${event.date.slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // Copiar Imagem para Área de Transferência
  async function handleCopyImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopiedImg(true);
        setTimeout(() => setCopiedImg(false), 2500);
      });
    } catch {
      handleDownloadPNG();
    }
  }

  // Copiar Texto Formatado para WhatsApp
  function handleCopyWhatsAppText() {
    if (!event) return;
    let txt = `*ESCALA: ${event.title.toUpperCase()}*\n`;
    txt += `📅 ${formattedDate} às ${formattedTime}\n`;
    if (event.theme) txt += `📖 *Tema:* ${event.theme}\n`;
    txt += `\n*EQUIPE ESCALADA:*\n`;

    (event.scheduleItems || []).forEach((item) => {
      txt += `• *${item.roleName}:* ${item.member.name}\n`;
    });

    txt += `\n_Primeira Igreja Batista de Itapuã_`;
    navigator.clipboard.writeText(txt);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  }

  if (!isOpen || !event) return null;

  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
        <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
            <div>
              <h3 className="font-bold text-lg text-[var(--color-ink)]" style={{ fontFamily: "'Fraunces', serif" }}>
                Card da Escala para WhatsApp
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Gere uma imagem limpa e profissional para enviar no grupo da equipe
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-muted)] flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Pré-visualização do Canvas */}
          <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] bg-black/10 flex items-center justify-center shadow-inner max-h-[460px] overflow-y-auto">
            <canvas
              ref={canvasRef}
              className="w-full max-w-[340px] sm:max-w-[380px] h-auto rounded-xl shadow-md my-2"
            />
          </div>

          {/* Ações de Compartilhamento */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={handleDownloadPNG}
              disabled={generating}
              className="flex-1 py-3 px-4 rounded-xl bg-[var(--color-primary)] hover:opacity-95 text-white text-xs sm:text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Baixar PNG</span>
            </button>

            <button
              onClick={handleCopyImage}
              className="flex-1 py-3 px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] text-[var(--color-ink)] text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>{copiedImg ? "Imagem Copiada! ✓" : "Copiar Imagem"}</span>
            </button>

            <button
              onClick={handleCopyWhatsAppText}
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-xs"
              title="Copiar texto para colar no WhatsApp"
            >
              <span>{copiedText ? "Texto Copiado! ✓" : "Texto WhatsApp"}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
