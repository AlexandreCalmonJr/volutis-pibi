import { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../store";

export interface EventMediaAsset {
  id: string;
  type: string;
  title: string;
  fileUrl: string;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedBy?: string | null;
  createdAt: string;
}

interface EventMediaModalProps {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  bannerUrl?: string | null;
  youtubeBroadcastUrl?: string | null;
  youtubeStatus?: string | null;
  onClose: () => void;
  onMediaUpdated?: () => void;
}

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  YOUTUBE_THUMBNAIL: { label: "Capa da Live (YouTube)", icon: "📺", color: "#dc2626" },
  DATASHOW_WALLPAPER: { label: "Papel de Parede (Data Show / Telão)", icon: "📽️", color: "#7c3aed" },
  SERMON_SLIDE: { label: "Slide do Pregador / Tema", icon: "📖", color: "#2563eb" },
  BIBLE_BACKGROUND: { label: "Fundo de Versículos", icon: "📜", color: "#059669" },
  OTHER: { label: "Outro Card / Arte", icon: "🎨", color: "#475569" },
};

export function EventMediaModal({
  eventId,
  eventTitle,
  eventDate,
  bannerUrl,
  youtubeBroadcastUrl,
  youtubeStatus,
  onClose,
  onMediaUpdated,
}: EventMediaModalProps) {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const isLeader = user?.role === "MINISTRY_LEADER";
  const canManageMedia = isAdmin || isLeader;

  const [assets, setAssets] = useState<EventMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [schedulingLive, setSchedulingLive] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Form de upload
  const [mediaType, setMediaType] = useState("YOUTUBE_THUMBNAIL");
  const [mediaTitle, setMediaTitle] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<number | undefined>();

  // Form do YouTube Live
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [liveTitle, setLiveTitle] = useState(eventTitle);
  const [liveDescription, setLiveDescription] = useState("");

  useEffect(() => {
    loadAssets();
  }, [eventId]);

  async function loadAssets() {
    setLoading(true);
    try {
      const data = await api<EventMediaAsset[]>(`/events/${eventId}/media`);
      setAssets(data);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize(file.size);
    if (!mediaTitle) {
      setMediaTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!fileDataUrl || !mediaTitle.trim()) {
      setFeedback({ type: "error", text: "Por favor, selecione um arquivo e defina um título." });
      return;
    }

    setUploading(true);
    setFeedback(null);
    try {
      await api(`/events/${eventId}/media`, {
        method: "POST",
        body: {
          type: mediaType,
          title: mediaTitle.trim(),
          fileUrl: fileDataUrl,
          fileName,
          fileSize,
        },
      });

      setFeedback({ type: "ok", text: "Arte enviada com sucesso!" });
      setShowUploadForm(false);
      setFileDataUrl("");
      setFileName("");
      setMediaTitle("");
      await loadAssets();
      onMediaUpdated?.();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao enviar arte." });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(mediaId: string) {
    if (!window.confirm("Deseja realmente remover esta arte?")) return;
    try {
      await api(`/events/${eventId}/media/${mediaId}`, { method: "DELETE" });
      await loadAssets();
      onMediaUpdated?.();
    } catch (err: any) {
      alert(err?.message || "Erro ao excluir arte.");
    }
  }

  async function handleScheduleLive() {
    setSchedulingLive(true);
    setFeedback(null);
    try {
      const res = await api<{ message: string; broadcastUrl: string }>(`/events/${eventId}/youtube/schedule`, {
        method: "POST",
        body: {
          title: liveTitle,
          description: liveDescription,
          thumbnailUrl: assets.find((a) => a.type === "YOUTUBE_THUMBNAIL")?.fileUrl || bannerUrl,
        },
      });

      setFeedback({ type: "ok", text: res.message });
      setShowYoutubeModal(false);
      onMediaUpdated?.();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao agendar no YouTube." });
    } finally {
      setSchedulingLive(false);
    }
  }

  function downloadAsset(fileUrl: string, name: string) {
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = name || "arte-culto.png";
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[#e5e0f8]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#f0eefe] flex items-center justify-between bg-gradient-to-r from-[#faf8ff] to-[#f5f0ff]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#7c3aed]/10 text-[#7c3aed] flex items-center justify-center text-xl">
              🎨
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1e1b4b]">Central de Mídias & Artes do Culto</h2>
              <p className="text-xs text-[#7c6ea8]">
                {eventTitle} · {new Date(eventDate).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                feedback.type === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              <span>{feedback.type === "ok" ? "✓" : "⚠️"}</span>
              {feedback.text}
            </div>
          )}

          {/* YouTube Status Bar */}
          {youtubeBroadcastUrl && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔴</span>
                <div>
                  <p className="text-xs font-bold text-red-900">Transmissão ao Vivo Agendada</p>
                  <a
                    href={youtubeBroadcastUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-red-600 hover:underline font-mono truncate max-w-xs block"
                  >
                    {youtubeBroadcastUrl}
                  </a>
                </div>
              </div>
              <a
                href={youtubeBroadcastUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
              >
                Abrir Live ↗
              </a>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold text-sm text-[#1e1b4b]">Arquivos e Templates para Telão e Live</h3>
              <p className="text-xs text-[#7c6ea8]">Baixe os templates em alta qualidade para projeção e transmissão.</p>
            </div>
            <div className="flex items-center gap-2">
              {canManageMedia && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowYoutubeModal(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <span>🔴</span> Agendar YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUploadForm(!showUploadForm)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#7c3aed] text-white hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <span>📤</span> Enviar Arte
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Upload Form Accordion */}
          {showUploadForm && (
            <div className="p-5 rounded-2xl bg-[#faf8ff] border border-[#ede9fe] space-y-4 animate-in fade-in duration-150">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7c6ea8]">Enviar Novo Template / Card</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5b5077] mb-1">Tipo de Arte</label>
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#e5e0f8] rounded-xl bg-white"
                  >
                    <option value="YOUTUBE_THUMBNAIL">📺 Capa da Live (YouTube)</option>
                    <option value="DATASHOW_WALLPAPER">📽️ Papel de Parede (Data Show / Telão)</option>
                    <option value="SERMON_SLIDE">📖 Slide do Pregador / Tema</option>
                    <option value="BIBLE_BACKGROUND">📜 Fundo de Versículos</option>
                    <option value="OTHER">🎨 Outro Card / Arte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5b5077] mb-1">Título da Arte</label>
                  <input
                    type="text"
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="Ex: Capa Oficial Culto da Noite"
                    className="w-full px-3 py-2 text-xs border border-[#e5e0f8] rounded-xl bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#5b5077] mb-1">Arquivo da Imagem / Card</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="w-full text-xs text-[#7c6ea8] file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#7c3aed] file:text-white hover:file:opacity-90 cursor-pointer"
                />
              </div>

              {fileDataUrl && (
                <div className="p-3 bg-white rounded-xl border border-[#e5e0f8] flex items-center gap-3">
                  <img src={fileDataUrl} alt="Preview" className="w-16 h-10 object-cover rounded-lg border border-[#e5e0f8]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#1e1b4b] truncate">{fileName}</p>
                    <p className="text-[10px] text-[#7c6ea8]">Pronto para envio</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#e5e0f8] text-xs font-semibold text-[#5b5077]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || !fileDataUrl}
                  className="px-4 py-1.5 rounded-xl bg-[#7c3aed] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {uploading ? "Enviando..." : "Salvar Arte"}
                </button>
              </div>
            </div>
          )}

          {/* YouTube Modal */}
          {showYoutubeModal && (
            <div className="p-5 rounded-2xl bg-red-50/70 border border-red-200 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔴</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-900">Agendar Live no Canal do YouTube</h4>
                </div>
                <button onClick={() => setShowYoutubeModal(false)} className="text-xs text-red-600 font-semibold">✕ Fechar</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-red-950 mb-1">Título da Transmissão</label>
                  <input
                    type="text"
                    value={liveTitle}
                    onChange={(e) => setLiveTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-red-200 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-950 mb-1">Descrição / Avisos da Live</label>
                  <textarea
                    rows={3}
                    value={liveDescription}
                    onChange={(e) => setLiveDescription(e.target.value)}
                    placeholder="Link do dízimo, redes sociais da igreja e pedidos de oração..."
                    className="w-full px-3 py-2 text-xs border border-red-200 rounded-xl bg-white resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleScheduleLive}
                  disabled={schedulingLive}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {schedulingLive ? "Agendando..." : "Confirmar e Agendar no YouTube"}
                </button>
              </div>
            </div>
          )}

          {/* Grid de Mídias Cadastradas */}
          {loading ? (
            <div className="py-12 text-center text-xs text-[#7c6ea8]">Carregando artes do culto...</div>
          ) : assets.length === 0 ? (
            <div className="py-12 text-center bg-[#faf8ff] rounded-2xl border border-dashed border-[#d4c7f7] p-8 space-y-2">
              <span className="text-3xl">🖼️</span>
              <p className="font-semibold text-sm text-[#1e1b4b]">Nenhuma arte enviada para este culto</p>
              <p className="text-xs text-[#7c6ea8] max-w-sm mx-auto">
                A equipe de mídia e design pode enviar capas, papéis de parede do data show e slides de versículos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {assets.map((asset) => {
                const meta = TYPE_LABELS[asset.type] || TYPE_LABELS.OTHER;
                return (
                  <div
                    key={asset.id}
                    className="rounded-2xl border border-[#e5e0f8] overflow-hidden bg-white hover:shadow-md hover:border-[#c4b5fd] transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Image Preview */}
                      <div className="relative aspect-video bg-slate-900 overflow-hidden group">
                        <img
                          src={asset.fileUrl}
                          alt={asset.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-black/60 backdrop-blur-sm flex items-center gap-1">
                          <span>{meta.icon}</span> {meta.label}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="p-3.5 space-y-1">
                        <p className="font-semibold text-xs text-[#1e1b4b] truncate">{asset.title}</p>
                        <p className="text-[10px] text-[#7c6ea8]">
                          Enviado em {new Date(asset.createdAt).toLocaleDateString("pt-BR")} {asset.uploadedBy ? `por ${asset.uploadedBy}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Download & Actions Bar */}
                    <div className="p-3 bg-[#faf8ff] border-t border-[#f0eefe] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => downloadAsset(asset.fileUrl, asset.fileName || `${asset.title}.png`)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-white border border-[#d4c7f7] text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white transition-all text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <span>📥</span> Baixar Template
                      </button>
                      {canManageMedia && (
                        <button
                          type="button"
                          onClick={() => handleDelete(asset.id)}
                          className="w-8 h-8 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center text-xs transition-colors"
                          title="Excluir arte"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f0eefe] bg-[#faf8ff] flex items-center justify-between">
          <p className="text-[11px] text-[#7c6ea8]">
            💡 <strong>Dica:</strong> Salve os papéis de parede na pasta de projeção do Holyrics ou OBS.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1e1b4b] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
