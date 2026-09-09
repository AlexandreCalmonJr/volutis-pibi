/**
 * Utilitário de alta performance para compressão e redimensionamento
 * de imagens diretamente no navegador antes do upload.
 * Reduz fotos pesadas de celulares (4MB - 10MB) para ~30KB - 80KB com qualidade impecável.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 a 1.0 (default 0.82)
  mimeType?: "image/webp" | "image/jpeg";
}

export async function compressImage(
  fileOrDataUrl: File | string,
  options: CompressImageOptions = {}
): Promise<{ dataUrl: string; file: File; originalSize: number; compressedSize: number }> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.82,
    mimeType = "image/webp",
  } = options;

  return new Promise((resolve, reject) => {
    let originalSize = 0;
    let fileName = "imagem.webp";

    if (fileOrDataUrl instanceof File) {
      originalSize = fileOrDataUrl.size;
      fileName = fileOrDataUrl.name.replace(/\.[^.]+$/, "") + (mimeType === "image/webp" ? ".webp" : ".jpg");
    }

    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Calcula dimensões mantendo proporção de aspecto
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return reject(new Error("Não foi possível inicializar o contexto Canvas 2D"));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Fundo branco se houver transparência para evitar bordas pretas ao converter para jpeg
      if (mimeType === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL(mimeType, quality);

      // Converte dataURL para objeto File nativo
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error("Falha ao gerar blob de imagem"));
          }
          const compressedFile = new File([blob], fileName, { type: mimeType });
          resolve({
            dataUrl,
            file: compressedFile,
            originalSize: originalSize || blob.size,
            compressedSize: blob.size,
          });
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error("Erro ao carregar e decodificar a imagem selecionada"));
    };

    if (fileOrDataUrl instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Erro ao ler o arquivo local"));
      reader.readAsDataURL(fileOrDataUrl);
    } else {
      img.src = fileOrDataUrl;
      originalSize = Math.round((fileOrDataUrl.length * 3) / 4);
    }
  });
}
