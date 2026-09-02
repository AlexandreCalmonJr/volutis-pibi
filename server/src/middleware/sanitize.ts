/**
 * Sanitizador de texto anti-XSS leve e de alta performance.
 * Remove tags script, iframes, atributos inline de eventos (onerror, onload)
 * e protocolos perigosos (javascript:) sem quebrar textos legítimos, links ou emojis.
 */

export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  
  return input
    // Remove scripts e iframes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    // Remove manipuladores de evento HTML inline (ex: onload=, onerror=, onclick=)
    .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\bon\w+\s*=\s*[^\s>]+/gi, "")
    // Remove pseudo-protocolo javascript:
    .replace(/javascript:/gi, "")
    .trim();
}

/**
 * Sanitiza recursivamente objetos de payload enviados em formulários e requisições JSON.
 */
export function sanitizePayload<T>(payload: T): T {
  if (!payload || typeof payload !== "object") {
    return typeof payload === "string" ? (sanitizeText(payload) as unknown as T) : payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item)) as unknown as T;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    // Não sanitizar senhas ou URLs que possam conter caracteres específicos legítimos
    if (key.toLowerCase().includes("password") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("token")) {
      cleaned[key] = value;
    } else if (typeof value === "string") {
      cleaned[key] = sanitizeText(value);
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = sanitizePayload(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned as T;
}
